-- 0006_delete_registries.sql
-- Sprint 4: delete actions for machines, maintenance records, and supplies.
--
-- Maintenance records are deleted directly from the client (single table,
-- nothing references it; the owner-all RLS policy from 0001 covers DELETE).
-- Machines and supplies need RPCs because they own hidden children:
--   * deleting a machine takes its maintenance records with it, but is
--     REFUSED when orders reference it (the historical order keeps its
--     machine reference; decommissioning = mark the machine "Retirada")
--   * deleting a supply takes its material and stock movements with it,
--     but is REFUSED when orders used the material (order snapshots keep
--     the price, but the material row must stay for consistency)
-- The guard raises the sentinel 'HAS_ORDERS', which the client translates
-- into a friendly Spanish message. SECURITY DEFINER bypasses RLS, so every
-- statement is explicitly scoped by user_id, mirroring 0005.

create or replace function public.delete_machine_cascade(p_machine_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_machine machines%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_machine from machines
    where id = p_machine_id and user_id = v_user;
  if not found then
    raise exception 'Impresora no encontrada';
  end if;

  if exists (select 1 from orders where machine_id = p_machine_id and user_id = v_user) then
    raise exception 'HAS_ORDERS';
  end if;

  delete from maintenance_records
    where machine_id = p_machine_id and user_id = v_user;

  delete from machines
    where id = p_machine_id and user_id = v_user;
end;
$$;

create or replace function public.delete_supply_cascade(p_supply_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_supply supplies%rowtype;
  v_material materials%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_supply from supplies
    where id = p_supply_id and user_id = v_user;
  if not found then
    raise exception 'Insumo no encontrado';
  end if;

  select * into v_material from materials
    where supply_id = p_supply_id and user_id = v_user;

  if v_material.id is not null and exists (
    select 1 from orders where material_id = v_material.id and user_id = v_user
  ) then
    raise exception 'HAS_ORDERS';
  end if;

  -- Adjustments first: they hold the FK to the supply. This also removes
  -- the reversal rows of previously deleted orders, which are meaningless
  -- once the supply is gone.
  delete from stock_adjustments
    where supply_id = p_supply_id and user_id = v_user;

  if v_material.id is not null then
    delete from materials where id = v_material.id and user_id = v_user;
  end if;

  delete from supplies where id = p_supply_id and user_id = v_user;
end;
$$;

-- Only signed-in users may execute these; RLS alone is not enough because
-- the functions are SECURITY DEFINER.
revoke execute on function public.delete_machine_cascade from public, anon;
revoke execute on function public.delete_supply_cascade from public, anon;
grant execute on function public.delete_machine_cascade to authenticated;
grant execute on function public.delete_supply_cascade to authenticated;
