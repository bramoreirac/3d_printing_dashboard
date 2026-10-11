-- 0001_init.sql
-- Sprint 2: core schema + Row Level Security.
-- Mirrors schema.md. All tables are owner-only via user_id = auth.uid().

-- ---------- global_settings (singleton per user) ----------

create table public.global_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  printer_watts numeric(8,2) not null check (printer_watts > 0),
  electricity_rate_kwh numeric(10,4) not null check (electricity_rate_kwh >= 0),
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- ---------- supplies (stock lives here; created before materials) ----------

create table public.supplies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  unit text not null check (unit in ('g', 'm', 'pcs')),
  min_threshold numeric(12,2) not null default 0 check (min_threshold >= 0),
  created_at timestamptz not null default now()
);

-- ---------- materials (each linked to one supply row for stock) ----------

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  cost_per_1000g numeric(10,2) not null check (cost_per_1000g >= 0),
  supply_id uuid not null references public.supplies (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- machines ----------

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  icon text not null default 'print' check (icon in ('print', 'cube', 'cubes', 'gear')),
  purchase_price numeric(12,2) not null check (purchase_price >= 0),
  useful_life_hours numeric(10,2) not null check (useful_life_hours > 0),
  residual_value numeric(12,2) not null default 0 check (residual_value >= 0),
  annual_usage_hours numeric(10,2) not null check (annual_usage_hours > 0),
  annual_maintenance_cost numeric(12,2) not null default 0 check (annual_maintenance_cost >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- orders ----------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  machine_id uuid not null references public.machines (id),
  material_id uuid not null references public.materials (id),
  client_name text not null check (length(trim(client_name)) > 0),
  design_name text not null check (length(trim(design_name)) > 0),
  order_date date not null default current_date,
  grams numeric(10,2) not null check (grams > 0),
  print_hours numeric(10,2) not null check (print_hours > 0),
  labor_cost numeric(12,2) check (labor_cost is null or labor_cost >= 0),
  price_total numeric(12,2) not null check (price_total > 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  -- Cost snapshot at save time; later rate changes never alter historical orders.
  material_price_per_1000g numeric(10,2) not null,
  material_cost numeric(12,2) not null,
  energy_cost numeric(12,2) not null,
  wear_cost numeric(12,2) not null,
  total_cost numeric(12,2) not null,
  profit numeric(12,2) not null,
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- maintenance_records ----------

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  machine_id uuid not null references public.machines (id),
  performed_at date not null default current_date,
  description text not null default '',
  cost numeric(12,2) not null default 0 check (cost >= 0),
  next_due_at date,
  created_at timestamptz not null default now()
);

-- ---------- stock_adjustments ----------

create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  supply_id uuid not null references public.supplies (id),
  delta numeric(12,2) not null,
  reason text not null default '',
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Stock is always the sum of adjustments; never a mutable counter.
-- security_invoker makes the view respect the caller's RLS policies
-- (without it, views run as the owner and bypass RLS entirely).
create view public.supply_stock
with (security_invoker = true) as
select
  s.id as supply_id,
  s.user_id,
  coalesce(sum(a.delta), 0) as stock_qty
from public.supplies s
left join public.stock_adjustments a on a.supply_id = s.id
group by s.id, s.user_id;

-- ---------- updated_at trigger ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- ---------- RPC: create a material with its linked supply atomically ----------

create or replace function public.create_material_with_supply(
  p_name text,
  p_cost_per_1000g numeric,
  p_min_threshold numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supply_id uuid;
  v_material_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.supplies (user_id, name, unit, min_threshold)
  values (auth.uid(), p_name, 'g', p_min_threshold)
  returning id into v_supply_id;

  insert into public.materials (user_id, name, cost_per_1000g, supply_id)
  values (auth.uid(), p_name, p_cost_per_1000g, v_supply_id)
  returning id into v_material_id;

  return v_material_id;
end;
$$;

-- ---------- Row Level Security ----------
-- Owner-only on every table. No public access anywhere.

alter table public.global_settings enable row level security;
alter table public.supplies enable row level security;
alter table public.materials enable row level security;
alter table public.machines enable row level security;
alter table public.orders enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.stock_adjustments enable row level security;

create policy "owner all global_settings" on public.global_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner all supplies" on public.supplies
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner all materials" on public.materials
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner all machines" on public.machines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner all orders" on public.orders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner all maintenance_records" on public.maintenance_records
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner all stock_adjustments" on public.stock_adjustments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
