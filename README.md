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

## Deploying to Vercel

1. Push the project to GitHub from the development machine
   (`git remote add origin <url>` and `git push -u origin main`).
2. On Vercel: **Add New → Project** → import the repository. Vite is detected
   automatically: build `npm run build`, output `dist`.
3. Under **Environment Variables** in the Vercel project, add (same values as
   the local `.env`):
   - `VITE_SUPABASE_URL` = `https://YOUR-PROJECT.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the project's publishable key
4. Deploy. **Verification**: the deployed URL must show the **sign-in
   screen**. If it shows the dashboard with sample data, the environment
   variables are missing (save them and redeploy).
5. In Supabase: **Authentication → URL Configuration** → Site URL = the
   Vercel URL, so account-confirmation emails point at the deployed dashboard.

## Operations notes

- The free tiers of Vercel and Supabase may not permit commercial use:
  confirm the terms before recording real business data.
- Before relying on the dashboard with real records: agree with the owner on
  the backup plan (Supabase free keeps daily backups for only a few days),
  data export/recovery, who owns the Supabase/Vercel accounts, and the
  monthly operating costs.
- Orders snapshot their costs at save time: changing rates later does not
  alter history.
