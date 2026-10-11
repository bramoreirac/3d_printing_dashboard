# 3D Printing Dashboard — Agile Plan

Status: Draft; revise after each review.

## Goal and scope

Build and deploy a small dashboard for a friend's 3D printing business, while practicing frontend development, relational data, authentication, security, and deployment.

The MVP has two tabs:
- **Quotes & Profitability:** customer quotes, cost breakdowns, proposed prices, and estimated profit.
- **Machines & Supplies:** machines, maintenance records, depreciation inputs, consumables, and low-stock indicators.

Confirmed with the owner (from their original prototype in `tab_pedidos3d.md` and `tab_flota_uso_horas.md`):
- The interface language is Spanish (the owner only reads Spanish); code, comments, and database identifiers stay in English.
- Currency is USD throughout.
- Labor cost is an optional order line item; the prototype charges only material, electricity, and machine wear.
- Materials have individual prices: each order references a material and snapshots the price used at the time (replaces the prototype's single global filament price).
- Materials are linked to supplies for automatic stock deduction: saving an order writes a negative stock adjustment for the grams used.
- Supplies / low-stock tracking stays in scope (B06).
- Residual value is an optional machine field (default 0); depreciation is straight-line: `(purchase − residual) / useful life hours`.
- Orders track partial payments; payment status (Pendiente / Pago Parcial / Pagado) is derived from `amount_paid` vs `price_total`.
- Cost breakdowns are snapshotted on each saved order so later rate changes never alter historical quotes.

Planned stack: React with Vite, Supabase for PostgreSQL and authentication, and Vercel for frontend hosting. Confirm current hosting terms before deploying a business demo or live business app. A free learning environment does not automatically permit commercial use. Upgrading existing projects should ordinarily preserve the application structure.

## Lightweight Agile workflow

- Use one-week sprints initially; extend to two weeks if study or work demands it.
- Select a small set of backlog items with a clear sprint goal.
- Track items as To do, In progress, Review, or Done; limit work in progress to one main task.
- Demonstrate working functionality to the business owner at the end of each sprint.
- Record feedback and adjust the next sprint's backlog.
- Write a short retrospective: what worked, what slowed progress, and one improvement.
- Treat the following sprint sequence as a starting forecast, not a fixed commitment. Adjust scope as you learn.

## Initial backlog

| ID | Priority | User story | Acceptance criteria |
|---|---|---|---|
| B01 | Must | As the owner, I can sign in and access my business records. | Valid sign-in works; sign-out works; unauthorized users cannot read or change records. |
| B02 | Must | As the owner, I can register machines and materials. | Records can be created, edited, and viewed; required fields and units are validated. |
| B03 | Must | As the owner, I can calculate a customer quote. | Material, machine time, and other costs are itemized; labor is an optional line; price and estimated profit match a hand calculation. |
| B04 | Must | As the owner, I can save and reopen quotes. | Saved quote inputs and calculated amounts remain consistent after reloading. |
| B05 | Must | As the owner, I can record maintenance and see due dates. | Maintenance history persists; overdue dates are clearly identified. |
| B06 | Must | As the owner, I can estimate depreciation and track supplies. | Useful life, residual value, and usage assumptions are configurable; stock adjustments persist and orders deduct consumed grams automatically; low stock is flagged. |
| B07 | Must | As the owner, I can use the deployed dashboard. | Both tabs work on desktop and phone; sign-in, saving, and reloading work on the hosted app. |
| B08 | Should | As the owner, I can export records. | Exported data is readable and contains the expected fields. |
| B09 | Could | As the owner, I can view summary charts. | Charts agree with saved records. |

Defer invoicing, payments, customer portals, advanced analytics, and automated notifications until the MVP is validated.

## Sprint 1 — Agree on the workflow and build the interface

Goal: A navigable prototype with both tabs and sample data.

- [x] Review the draft database schema (`schema.md`), built from the owner's original prototype (`tab_pedidos3d.md`, `tab_flota_uso_horas.md`) and confirmed requirements.
- [x] Confirm the schema and remaining open questions with the owner — done at the Sprint 1
  review: clients stay free text, cancelled orders count toward machine hours, and
  stock reversal on order deletion is automatic (recorded in `schema.md`).
- [x] Sketch the two tabs and use UI UX Pro Max in Codex to help develop the interface.
- [x] Initialize React/Vite and Git; build reusable forms and navigation.

Review: The owner can navigate both tabs and explain whether the fields fit the business.

## Sprint 2 — Connect authentication and data

Goal: Authorized users can save machines and materials securely.

- [ ] Create versioned database migrations and sample records. *(files ready: `supabase/migrations/0001_init.sql`, `0002_sample_data.sql` — pending applying them to the real Supabase project)*
- [ ] Add Supabase authentication and Row Level Security policies. *(implemented: sign-in screen, session handling, RLS in `0001_init.sql` — pending live verification)*
- [x] Connect machine and material forms to the database. *(create/edit forms on the Machines tab; Supabase in cloud mode, local state in prototype mode)*
- [ ] Test access with an unauthorized session and a separate user account.
- [x] Keep privileged keys out of browser code and Git; browser publishable keys rely on correctly configured access policies. *(only the publishable anon key is used; `.env` is gitignored, `.env.example` documents the setup)*

Review: Create and edit records, reload the page, and demonstrate access restrictions.

## Sprint 3 — Deliver quotes and profitability

Goal: Create, calculate, save, and reopen a quote.

- [ ] Implement and validate cost calculations, including material, machine time, labor, and other costs.
- [ ] Distinguish markup from margin: price = cost × (1 + markup), or price = cost / (1 - margin).
- [ ] Use one agreed method for allocating depreciation; avoid counting it twice inside machine cost and separately.
- [ ] Preserve quote input values or cost snapshots so later rate changes do not silently alter historical quotes.
- [ ] Validate negative values, zero inputs, currency rounding, and a margin of 100% or higher.

Review: Compare one saved quote with a manual calculation and confirm it survives reloading.

## Sprint 4 — Complete operations and deployment

Goal: A deployed MVP ready for the owner's review.

- [ ] Add maintenance history and due-date indicators.
- [ ] Add configurable depreciation estimates, stock adjustments, and low-stock indicators.
- [ ] Check both tabs on desktop and phone; show useful loading and error states.
- [ ] Configure deployment environment variables and authentication redirect URLs.
- [ ] Deploy to a hosting plan that permits the intended use; use sample data for initial validation.
- [ ] Verify permissions, calculations, and persistence on the deployed app.
- [ ] Before relying on real records, agree on backups, export/recovery, account ownership, and operating costs.

Review: The owner completes a quote and updates maintenance and supplies without developer help. Record any requested changes in the backlog.

## Definition of Done

- The story's acceptance criteria are met.
- Relevant calculations and access controls are verified.
- Changes are committed to Git, with no secrets included.
- The interface handles invalid input and failed requests.
- The feature works in the current review environment.
- Assumptions and material limitations are documented.

## Sprint review and retrospective template

Sprint/date:
Goal:
Completed backlog IDs:
Demonstrated result:
Owner feedback:
Unfinished items and reason:
What worked:
What to improve:
Next sprint goal:

## Portfolio evidence

Keep a short README, database diagram, screenshots, calculation example, meaningful Git history, and sprint review notes. Explain decisions and feedback-driven changes. Use sample or anonymized records in public portfolio material.
