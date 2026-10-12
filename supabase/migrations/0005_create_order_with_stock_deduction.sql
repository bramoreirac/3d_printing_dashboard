-- 0005_create_order_with_stock_deduction.sql
-- Sprint 3: atomic quote persistence.
--
-- One RPC that, in a single transaction:
--   1. recomputes the cost breakdown server-side (never trusts client numbers)
--   2. snapshots prices/rates onto the order row
--   3. inserts the order and the -grams stock adjustment together
-- Orders and stock can therefore never diverge (schema.md decision).
--
-- Security: SECURITY DEFINER bypasses RLS for the inserts, so every input
-- is explicitly ownership-checked against auth.uid() before use.

create or replace function public.create_order_with_stock_deduction(
  p_machine_id uuid,
  p_material_id uuid,
  p_client_name text,
  p_design_name text,
  p_grams numeric,
  p_print_hours numeric,
  p_labor_cost numeric default null,
  p_price_total numeric,
  p_amount_paid numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_machine machines%rowtype;
  v_material materials%rowtype;
  v_settings global_settings%rowtype;
  v_material_cost numeric;
  v_energy_cost numeric;
  v_wear_cost numeric;
  v_total_cost numeric;
  v_profit numeric;
  v_order orders%rowtype;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_grams <= 0 or p_print_hours <= 0 or p_price_total <= 0 then
    raise exception 'Gramos, horas y precio deben ser mayores a 0';
  end if;
  if p_amount_paid < 0 or coalesce(p_labor_cost, 0) < 0 then
    raise exception 'Montos negativos no permitidos';
  end if;

  select * into v_machine from machines
    where id = p_machine_id and user_id = v_user;
  if not found then
    raise exception 'Impresora no encontrada';
  end if;

  select * into v_material from materials
    where id = p_material_id and user_id = v_user;
  if not found then
    raise exception 'Material no encontrado';
  end if;

  select * into v_settings from global_settings where user_id = v_user;
  if not found then
    raise exception 'Faltan los ajustes globales (global_settings)';
  end if;

  -- Same formulas as the prototype, computed from current database state.
  v_material_cost := round(p_grams * (v_material.cost_per_1000g / 1000), 2);
  v_energy_cost := round((v_settings.printer_watts / 1000) * p_print_hours * v_settings.electricity_rate_kwh, 2);
  v_wear_cost := round(p_print_hours * (
    (v_machine.purchase_price - v_machine.residual_value) / v_machine.useful_life_hours
    + v_machine.annual_maintenance_cost / v_machine.annual_usage_hours
  ), 2);
  v_total_cost := round(v_material_cost + v_energy_cost + v_wear_cost + coalesce(p_labor_cost, 0), 2);
  v_profit := round(p_price_total - v_total_cost, 2);

  insert into orders (
    user_id, machine_id, material_id, client_name, design_name,
    grams, print_hours, labor_cost, price_total, amount_paid,
    material_price_per_1000g, material_cost, energy_cost, wear_cost,
    total_cost, profit, status
  ) values (
    v_user, p_machine_id, p_material_id, p_client_name, p_design_name,
    p_grams, p_print_hours, p_labor_cost, p_price_total, p_amount_paid,
    v_material.cost_per_1000g, v_material_cost, v_energy_cost, v_wear_cost,
    v_total_cost, v_profit,
    case when p_amount_paid >= p_price_total then 'completed' else 'open' end
  )
  returning * into v_order;

  -- Automatic stock deduction on the material's linked supply.
  insert into stock_adjustments (user_id, supply_id, delta, reason, order_id)
  values (v_user, v_material.supply_id, -p_grams,
          'order: ' || p_design_name, v_order.id);

  return to_jsonb(v_order);
end;
$$;

-- Deleting an order reverses its stock deduction automatically
-- (schema.md: "stock reversal on order deletion is automatic").
create or replace function public.delete_order_with_stock_reversal(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_order orders%rowtype;
  v_supply_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_order from orders where id = p_order_id and user_id = v_user;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  select supply_id into v_supply_id from materials where id = v_order.material_id;

  insert into stock_adjustments (user_id, supply_id, delta, reason)
  values (v_user, v_supply_id, v_order.grams,
          'order deleted: ' || v_order.design_name);

  delete from orders where id = p_order_id;
end;
$$;

-- Only signed-in users may execute these; RLS alone is not enough because
-- the functions are SECURITY DEFINER.
revoke execute on function public.create_order_with_stock_deduction from public, anon;
revoke execute on function public.delete_order_with_stock_reversal from public, anon;
grant execute on function public.create_order_with_stock_deduction to authenticated;
grant execute on function public.delete_order_with_stock_reversal to authenticated;
