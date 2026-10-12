# Sprint Reviews & Retrospectives

One entry per sprint, using the template from `plan.md`. Kept as portfolio
evidence: demonstrated results, owner feedback, and honest retros.

---

## Sprint 1 — October 2026

**Goal:** A navigable prototype with both tabs and sample data.

**Completed backlog IDs:** Foundational only (no story accepted yet; prototype
covered the fields of B02, B03, and B06 visually).

**Demonstrated result:** Owner navigated both tabs (Quotes & Profitability,
Machines & Supplies) in Spanish with sample data; live quote calculator
reproduced the hand-calculated example exactly ($6.44 cost / $18.56 profit).

**Owner feedback:**
- Remove the "Cómo se calculan los costos" side card — redundant with the
  Machines tab. Done (`bf4aa88`).
- Interface must be in Spanish (owner only reads Spanish). Done (`8e8e8e0`).

**Unfinished items and reason:** None — schema questions deferred to the review
were answered during it (clients free text; cancelled orders count toward
machine hours; automatic stock reversal on deletion).

**What worked:** Designing the schema from the owner's real prototype first —
it caught four plan-vs-reality mismatches (markup vs. margin, labor, residual
value, payment tracking) before any code. The calculation module was validated
against the owner's hand math on day one.

**What to improve:** The owner's prototype arrived via a sign-in-gated Gemini
link, costing a round-trip; ask for pasted files or exports up front. The
grid overflow bug (items refusing to shrink below table width) should have
been caught before the owner saw it — test at 375px/768px before demos.

**Next sprint goal:** Authorized users can save machines and materials securely.

---

## Sprint 2 — October 2026

**Goal:** Authorized users can save machines and materials securely.

**Completed backlog IDs:** B01, B02 (plus the full read path for order history).

**Demonstrated result:** Owner signs in, adds and edits machines/materials in
Supabase, reload persists. Private window: only the login screen is reachable.
Second self-registered account: completely empty dashboard — RLS isolates
owners at the row level (HTTP 200 with `[]`, not an error).

**Owner feedback:**
- Magic link created passwordless accounts (a user that could never sign in
  with a password). Replaced with a proper sign-up form so the client sets
  their own password (`0a382e5`).

**Unfinished items and reason:** None.

**What worked:** Error surfacing in Spanish turned the RLS INSERT rejection
into a five-minute diagnosis; the two-account test *proved* isolation instead
of assuming it.

**What to improve:** Three avoidable round-trips caused by shipping queries
untested against the real API: a PostgREST view embed that could never resolve
(`PGRST200`), RLS policies without GRANTs, and INSERTs without a `user_id`
default. Fallback sample data looked identical to seeded data and masked the
first failure. Process change for Sprint 3: run every query against Supabase
(SQL Editor or REST) before calling a task done, and make fallback data
visibly distinct from cloud data.

**Next sprint goal:** Create, calculate, save, and reopen a quote.

---

## Sprint 3 — October 2026

**Goal:** Create, calculate, save, and reopen a quote.

**Completed backlog IDs:** B03 (quote calculation with markup/margin), B04
(save and reopen quotes with cost snapshots).

**Demonstrated result:** Owner created a quote through the form, saved it to
Supabase, reloaded the page, and confirmed the breakdown survived unchanged
against the hand calculation; the linked supply's stock dropped by the grams
used in the same transaction. Deleting an order reverses the stock
automatically. The markup/margin helper suggests a price from the live cost.

**Owner feedback:**
- The save button stayed disabled with every field filled → root cause was an
  orphaned machine/material preselection from prototype sample data; fixed
  with a repair effect (`435c03d`) plus a hint for the legitimate empty case.
- UI polish requests delivered alongside the feature: dark mode, recolor
  blue→yellow on warm-dark surfaces, sand-wave photo background on login and
  dashboard (downloaded locally, Unsplash License), full-width auth submit,
  signed-in email in the header, center-anchored tab group.

**Unfinished items and reason:** None for the sprint goal. Noted for the
backlog: editing an existing order's grams (schema decision: writes a stock
adjustment for the difference) — only create/delete are wired so far.

**What worked:** The server-recompute RPC design made persistence one
transaction that cannot diverge; the save/reload review test passed as soon
as migration `0005` was applied. Splitting UI polish into its own commits
kept the history readable alongside feature work.

**What to improve:** The disabled-button bug revealed a pattern: state
initialized from data that gets replaced asynchronously (sample → fetched)
silently orphans selections. Process change: initialize async-loaded lists
empty and wait, or repair stale ids — and make disabled controls say *why*.

**Next sprint goal:** A deployed MVP ready for the owner's review.
