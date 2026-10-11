-- 0002_sample_data.sql
-- Sprint 2: sample records matching the owner's original prototype.
--
-- HOW TO RUN (in the Supabase SQL Editor):
--   1. Find your user id:
--        select id, email from auth.users;
--   2. Seed with that id:
--        select public.seed_sample_data('PASTE-USER-ID-HERE');
--
-- The user id must be passed explicitly because the SQL Editor runs as the
-- postgres service role and has no login session, so auth.uid() is NULL there.
-- (The parameter defaults to auth.uid(), so calling it from inside an
-- authenticated session still works without arguments.)

create or replace function public.seed_sample_data(p_user uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Fall back to auth.uid() when called from an authenticated session;
  -- the SQL Editor passes the id explicitly since auth.uid() is NULL there.
  v_user uuid := coalesce(p_user, auth.uid());
  v_sup_pla_black uuid;
  v_sup_pla_white uuid;
  v_sup_petg uuid;
  v_sup_nozzle uuid;
  v_mat_pla_black uuid;
  v_mat_pla_white uuid;
  v_mat_petg uuid;
  v_mach_bambu uuid;
  v_mach_ender uuid;
begin
  if v_user is null then
    raise exception 'No user: pass your user id, e.g. select public.seed_sample_data(''<uuid>'')';
  end if;

  -- Avoid duplicating data if run twice
  if exists (select 1 from machines where user_id = v_user) then
    raise exception 'Sample data already present for this user';
  end if;

  insert into global_settings (user_id, printer_watts, electricity_rate_kwh)
  values (v_user, 150, 0.18);

  -- Supplies
  insert into supplies (user_id, name, unit, min_threshold) values
    (v_user, 'PLA Black', 'g', 500) returning id into v_sup_pla_black;
  insert into supplies (user_id, name, unit, min_threshold) values
    (v_user, 'PLA White', 'g', 500) returning id into v_sup_pla_white;
  insert into supplies (user_id, name, unit, min_threshold) values
    (v_user, 'PETG Transparent', 'g', 300) returning id into v_sup_petg;
  insert into supplies (user_id, name, unit, min_threshold) values
    (v_user, 'Nozzle 0.4mm', 'pcs', 2) returning id into v_sup_nozzle;

  -- Materials (each linked to its supply row)
  insert into materials (user_id, name, cost_per_1000g, supply_id) values
    (v_user, 'PLA Black', 22, v_sup_pla_black) returning id into v_mat_pla_black;
  insert into materials (user_id, name, cost_per_1000g, supply_id) values
    (v_user, 'PLA White', 22, v_sup_pla_white) returning id into v_mat_pla_white;
  insert into materials (user_id, name, cost_per_1000g, supply_id) values
    (v_user, 'PETG Transparent', 28, v_sup_petg) returning id into v_mat_petg;

  -- Machines
  insert into machines (user_id, name, icon, purchase_price, useful_life_hours,
                        residual_value, annual_usage_hours, annual_maintenance_cost)
  values (v_user, 'Bambu Lab H2S (AMS Pro)', 'cubes', 3000, 4500, 0, 1500, 100)
  returning id into v_mach_bambu;
  insert into machines (user_id, name, icon, purchase_price, useful_life_hours,
                        residual_value, annual_usage_hours, annual_maintenance_cost)
  values (v_user, 'Ender 3 V2 (Modded)', 'print', 280, 1400, 0, 1400, 70)
  returning id into v_mach_ender;

  -- Stock purchases
  insert into stock_adjustments (user_id, supply_id, delta, reason) values
    (v_user, v_sup_pla_black, 1000, 'purchase'),
    (v_user, v_sup_pla_white, 1000, 'purchase'),
    (v_user, v_sup_petg, 500, 'purchase'),
    (v_user, v_sup_nozzle, 5, 'purchase');

  -- Maintenance history (Ender's next due date is in the past: shows as overdue)
  insert into maintenance_records (user_id, machine_id, performed_at, description, cost, next_due_at) values
    (v_user, v_mach_bambu, date '2026-08-15', 'Rieles lineales lubricados, rodillos del AMS limpiados', 12, date '2026-11-15'),
    (v_user, v_mach_ender, date '2026-07-01', 'Reemplazo de tubo Bowden y boquilla', 18, date '2026-10-01');

  -- Orders with cost snapshots computed by the same formulas as the app.
  -- material = grams * (price/1000); energy = (150/1000) * hours * 0.18;
  -- wear = hours * ((purchase - residual)/life + maint/annual_hours)
  insert into orders (user_id, machine_id, material_id, client_name, design_name, order_date,
                      grams, print_hours, labor_cost, price_total, amount_paid,
                      material_price_per_1000g, material_cost, energy_cost, wear_cost,
                      total_cost, profit, status)
  values
    (v_user, v_mach_bambu, v_mat_pla_white, 'Roberto Gómez', 'Lámpara Litofanía Personalizada',
     date '2026-09-04', 210, 9.5, null, 35, 35,
     22, round(210 * (22.0/1000), 2), round((150.0/1000) * 9.5 * 0.18, 2),
     round(9.5 * (3000.0/4500 + 100.0/1500), 2), 0, 0, 'completed'),
    (v_user, v_mach_bambu, v_mat_pla_white, 'Estudio Arquitectura', 'Maqueta Escala 1:100 Casa',
     date '2026-09-10', 450, 18, null, 90, 45,
     22, round(450 * (22.0/1000), 2), round((150.0/1000) * 18 * 0.18, 2),
     round(18 * (3000.0/4500 + 100.0/1500), 2), 0, 0, 'open'),
    (v_user, v_mach_ender, v_mat_pla_black, 'María Fernández', 'Organizador de Escritorio',
     date '2026-09-22', 180, 7, null, 25, 12.5,
     22, round(180 * (22.0/1000), 2), round((150.0/1000) * 7 * 0.18, 2),
     round(7 * (280.0/1400 + 70.0/1400), 2), 0, 0, 'open'),
    (v_user, v_mach_bambu, v_mat_petg, 'Tech Corp', 'Carcasa Prototipo Sensor IoT',
     date '2026-09-26', 95, 4, null, 28, 0,
     28, round(95 * (28.0/1000), 2), round((150.0/1000) * 4 * 0.18, 2),
     round(4 * (3000.0/4500 + 100.0/1500), 2), 0, 0, 'open');

  -- Fix snapshots: total_cost and profit depend on the computed parts
  update orders set
    total_cost = material_cost + energy_cost + wear_cost + coalesce(labor_cost, 0),
    profit = price_total - (material_cost + energy_cost + wear_cost + coalesce(labor_cost, 0))
  where user_id = v_user;

  -- Order-linked stock deductions (grams used, resolved via the material's supply)
  insert into stock_adjustments (user_id, supply_id, delta, reason, order_id)
  select v_user, m.supply_id, -o.grams, 'order: ' || o.design_name, o.id
  from orders o
  join materials m on m.id = o.material_id
  where o.user_id = v_user;
end;
$$;
