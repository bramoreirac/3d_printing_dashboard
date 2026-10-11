# Database Schema — Draft (Sprint 1)

Status: Draft for owner review. Based on the owner's original prototype
(`tab_pedidos3d.md`, `tab_flota_uso_horas.md`) and the sprint backlog.

## Confirmed decisions

- **Currency:** USD, all monetary values.
- **Labor cost:** optional line item on orders (blank = not charged).
- **Materials have individual prices** (confirmed with the owner); the prototype's single
  global filament price is replaced by a `materials` table, and each order references a
  material and snapshots the price used at the time.
- **Materials are linked to supplies for automatic stock deduction** (confirmed with the
  owner): each material points to a supply row, and saving an order writes a negative
  stock adjustment for the grams used.
- **Supplies / low stock:** wanted; kept in scope (B06, Sprint 4).
- **Residual value:** optional field on machines; default 0.
- Straight-line depreciation, no complex asset accounting.
- All tables are owner-only via Row Level Security; `user_id` included for future multi-user use.

## Entity-relationship overview

```
global_settings  1 ──── (singleton row of global parameters)

machines  1 ──── many orders
materials 1 ──── many orders
supplies  1 ──── many materials (each material tracks stock through one supply)
supplies  1 ──── many stock_adjustments
machines  1 ──── many maintenance_records
```

## Tables

### global_settings (singleton)

Global parameters used by every calculation.

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | single row |
| user_id | uuid | owner |
| printer_watts | numeric(8,2) | e.g. 150 |
| electricity_rate_kwh | numeric(10,4) | e.g. 0.18 |
| currency | text | fixed 'USD' for MVP |

Note: filament cost is **not** global — it lives on each material (see `materials`).

### materials

Each filament / raw material with its own price. Stock is not stored here —
each material is linked to a supply row that holds the stock and adjustments.

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | owner |
| name | text not null | e.g. "PLA Black", "PETG Transparent" |
| cost_per_1000g | numeric(10,2) not null | e.g. 22.00 → $0.022/g |
| supply_id | uuid fk → supplies not null | stock lives on this supply row (unit must be 'g') |
| is_active | boolean default true | hide retired materials from new orders |
| created_at | timestamptz default now() | |

### machines

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | owner |
| name | text not null | e.g. "Bambu Lab H2S (AMS Pro)" |
| icon | text | icon key (print, cube, cubes, gear) |
| purchase_price | numeric(12,2) not null | investment amount |
| useful_life_hours | numeric(10,2) not null | e.g. 4500 |
| residual_value | numeric(12,2) default 0 | optional |
| annual_usage_hours | numeric(10,2) not null | e.g. 1500 |
| annual_maintenance_cost | numeric(12,2) not null | e.g. 100.00 |
| is_active | boolean default true | hide retired machines from new orders |
| created_at | timestamptz default now() | |

**Derived hourly rates (computed in app, not stored):**

- `amort_rate = (purchase_price − residual_value) / useful_life_hours`
- `maint_rate = annual_maintenance_cost / annual_usage_hours`
- `wear_rate = amort_rate + maint_rate`
- `hours_registered` = SUM of print_hours across the machine's orders

### orders

One row per customer order (the prototype's "pedidos" history).

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | owner |
| machine_id | uuid fk → machines | |
| material_id | uuid fk → materials | material used for this order |
| client_name | text not null | free text for MVP |
| design_name | text not null | piece / design description |
| order_date | date not null default today | |
| grams | numeric(10,2) not null | material used |
| material_price_per_1000g | numeric(10,2) not null | snapshot of the material's price at save |
| print_hours | numeric(10,2) not null | machine time |
| labor_cost | numeric(12,2) | optional; null = not charged |
| price_total | numeric(12,2) not null | amount charged to customer |
| amount_paid | numeric(12,2) default 0 | payments received so far |
| material_cost | numeric(12,2) | snapshot at save |
| energy_cost | numeric(12,2) | snapshot at save |
| wear_cost | numeric(12,2) | snapshot at save |
| total_cost | numeric(12,2) | snapshot at save |
| profit | numeric(12,2) | price_total − total_cost (snapshot) |
| status | text | 'open' \| 'completed' \| 'cancelled' |
| created_at | timestamptz default now() | |
| updated_at | timestamptz | |

**Notes:**

- **Cost snapshot:** `material_price_per_1000g`, `material_cost`, `energy_cost`, `wear_cost`,
  `total_cost`, and `profit` are computed and stored when the order is saved, using the
  material price, machine rates, and global settings at that moment. Later price or rate
  changes never alter historical orders. The order keeps `material_id` for reference only.
- **Automatic stock deduction:** saving an order also inserts a `stock_adjustments` row
  on the material's linked supply: `delta = −grams`, `reason = 'order: <design_name>'`.
  Deleting or editing the order must reverse or adjust that deduction. Stock shown in the
  UI is always `SUM(stock_adjustments.delta)` for the supply.
- **Payment status is derived, not stored:** `amount_paid = 0` → Pendiente;
  `0 < amount_paid < price_total` → Pago Parcial (Anticipo is just a partial payment);
  `amount_paid ≥ price_total` → Pagado. Remaining = `price_total − amount_paid`.
- **Formulas (matching the prototype):**
  - `material_cost = grams × (material_price_per_1000g / 1000)` (price snapshotted on the order)
  - `energy_cost = (printer_watts / 1000) × print_hours × electricity_rate_kwh`
  - `wear_cost = print_hours × wear_rate(machine)`
  - `labor_cost` (if present) is added to `total_cost`
  - `total_cost = material_cost + energy_cost + wear_cost + labor_cost?`
  - `profit = price_total − total_cost`

### maintenance_records (Sprint 4)

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | owner |
| machine_id | uuid fk → machines | |
| performed_at | date not null | |
| description | text | |
| cost | numeric(12,2) | |
| next_due_at | date | overdue when < today |
| created_at | timestamptz default now() | |

### supplies (Sprint 4)

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid | owner |
| name | text not null | e.g. "PLA Black", "Nozzle 0.4mm" |
| unit | text not null | g, m, pcs... (filament supplies must use 'g' so orders can deduct grams) |
| stock_qty | numeric(12,2) | current stock (recomputed from adjustments) |
| min_threshold | numeric(12,2) | low-stock flag when stock_qty ≤ min_threshold |
| created_at | timestamptz default now() | |

### stock_adjustments (Sprint 4)

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| supply_id | uuid fk → supplies | |
| delta | numeric(12,2) | + purchase, − consumption or order deduction |
| reason | text | e.g. "purchase", "order: Organizador de Escritorio" |
| created_at | timestamptz default now() | |

## RLS policy summary

- Every table has RLS enabled and a `user_id` column.
- Policy on all tables: `user_id = auth.uid()` for SELECT/INSERT/UPDATE/DELETE.
- No public read access anywhere; the browser only ever holds the publishable anon key.

## Open questions for the owner

1. Is `client_name` as free text enough, or do they want a customers table later?
2. Should cancelled orders count toward `hours_registered` per machine?
3. When an order is deleted or its grams edited, should the stock deduction be reversed
   automatically (recommended), or should the owner adjust stock manually?
