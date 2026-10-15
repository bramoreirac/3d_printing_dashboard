# Panel de Impresión 3D

Dashboard for quoting 3D print jobs and tracking the machine fleet,
maintenance, and material inventory. React + Vite + Supabase.
Data security lives in the **Row Level Security** policies: each account only
sees its own rows; the browser keys are publishable on purpose.

## Requirements

- Node.js 20 or newer
- A Supabase project with the migrations applied (see below)

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the project URL and key
   (Supabase → Project Settings → API). The `.env` file is in `.gitignore`:
   it is never committed.
3. `npm run dev` → http://localhost:5173

Without `.env`, the app starts in **prototype mode** with in-memory sample
data: useful for trying the UI without touching the database.

## Database

Migrations live in `supabase/migrations/` and are applied **in order** from
the Supabase SQL Editor (they run with service privileges there; the person
running them must be signed in to the console):

| # | File | What it does |
|---|------|--------------|
| 1 | `0001_init.sql` | Tables, owner-only RLS, RPC `create_material_with_supply` |
| 2 | `0002_sample_data.sql` | RPC `seed_sample_data('<user-id>')` with the sample fleet |
| 3 | `0003_grants.sql` | Table GRANTs for `anon`/`authenticated` (newer projects do not grant these by default) |
| 4 | `0004_user_defaults.sql` | `user_id` defaults to `auth.uid()` |
| 5 | `0005_create_order_with_stock_deduction.sql` | Atomic save/delete of an order, with automatic stock deduction and reversal |
| 6 | `0006_delete_registries.sql` | Delete a machine (with its maintenance) or a supply (with its material and movements); blocked while orders reference them |

## Operations notes

- The free tiers of Vercel and Supabase may not permit commercial use:
  confirm the terms before recording real business data.
- Before relying on the dashboard with real records: agree with the owner on
  the backup plan (Supabase free keeps daily backups for only a few days),
  data export/recovery, who owns the Supabase/Vercel accounts, and the
  monthly operating costs.
- Orders snapshot their costs at save time: changing rates later does not
  alter history.
- To record a later payment, expand the order in Historial de pedidos, choose
  **Editar pago**, enter the total received to date (or use **Usar total del pedido**),
  and save. This updates the balance and payment status without changing stock
  or the saved cost breakdown. Individual payment transactions are not recorded.

## Owner decisions for later work

- **Quote and order numbers:** confirm whether each needs a separate customer-facing
  sequence, its prefix, and whether it resets annually. Keep the UUID as the
  internal key; a few UUID digits alone do not guarantee a unique business number.
- **Printable document:** decide whether the need is a quote, receipt, invoice,
  or several documents. Confirm the business details, required tax information,
  numbering, and correction/cancellation rules before building the print layout.
- **Broader order editing:** changing printer, material, grams, hours, or price
  needs a defined repricing and inventory adjustment workflow. The current edit
  changes only the cumulative amount paid.
