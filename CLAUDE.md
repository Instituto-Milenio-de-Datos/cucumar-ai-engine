# CuCuMar AI Engine — project context

MVP that covers only points 1-5 of the original spec: classify a conservation object (species) with its taxonomy, assign fixed criteria/subcriteria for "Mamíferos marinos", gather evidence from OpenAlex, extract metadata, and analyze/store each piece of evidence. Points 6+ (gap analysis, Observatorio, expert validation workflow, continuous monitoring) are explicitly OUT OF SCOPE for this MVP — do not build toward them unless asked.

## Reference files (read these when relevant, don't guess)

- `docs/reference/spec-original.md` — full original spec (Spanish) with the client's review comments. Points 6+ are summarized there for context only, not to be implemented.
- `docs/reference/1_Tabla_DB.xlsx` — the exact column schema/format the Excel export must replicate (taxonomy + metadata + classification + ecological/threat matrix columns). Check this file directly before writing the export code, don't infer the schema from this file alone.
- `docs/reference/seed-species.csv` — (to be added) the ~50 Chilean marine mammal species for the seed table. If this file doesn't exist yet, don't invent species data — flag it and ask instead of hardcoding a placeholder list.

## Stack

- Next.js (App Router, TypeScript) full-stack, no separate backend.
- Prisma + Postgres. Local dev via Docker Compose; production target is Cloud SQL on GCP (not set up yet).
- shadcn/ui + Tailwind for components.
- Route Handlers (`app/api/**/route.ts`) for ALL mutations — do not use Server Actions. Reason: future periodic-monitoring feature needs to trigger analysis from outside the browser (cron), and Route Handlers are easier to test with curl/Postman during development.
- External integrations live ONLY behind `src/lib/providers/`: `taxonomy.ts` (GBIF/WoRMS), `evidence.ts` (OpenAlex), `llm.ts` (OpenAI). Nothing else in the codebase calls these APIs directly — this is intentional so any of the three can be swapped later without touching the rest of the pipeline.

## Data model (conceptual)

Three separate tables, do not merge them:
- `SeedSpecies` — static seed list of ~50 Chilean marine mammal species (common name ↔ scientific name), read-mostly/admin-maintained.
- `ConservationObject` — output of Flow 1: a species once classified, with resolved taxonomy. Has `inAnalysis: boolean` and `lastAnalysisDate` fields.
- `Evidence` — output of Flow 2: one row per paper, FK to `ConservationObject`. `openalexId` has a UNIQUE constraint — this is what makes upsert-based reprocessing safe (no manual locking needed).

Deleting a `ConservationObject` is a hard delete with `onDelete: Cascade` to its `Evidence` rows — no soft delete, no history kept.

## Flow 2 behavior — read this before touching analyze-evidence

- "Reprocess" = incremental upsert, NOT a full restart. Papers already saved (matched by `openalexId`) are never re-sent to the LLM or re-fetched. Only new papers found in OpenAlex get processed. This is deliberate (avoids wasted API/LLM cost) — do not "simplify" this into a delete-and-reinsert-everything pattern.
- UI copy must reflect this: button says "Search new evidence", not "Re-analyze from scratch".
- Papers without a clean `openalexId` or with poor metadata (common in 1970s-90s papers) are simply skipped, not force-matched by title/year.
- Processing is per-paper: each paper is classified and saved to the DB immediately, not batched into one all-or-nothing transaction. If paper 15 of 30 fails, papers 1-14 stay saved.
- Simple retry (2 attempts, short backoff) per paper on transient errors. After that, skip and log; report a summary count to the UI at the end ("28/30 processed, 2 failed").
- Processing is currently SYNCHRONOUS (the HTTP request stays open until done, ~20-40s). This was a deliberate choice over a job+polling pattern to avoid the cost/complexity of "CPU always allocated" on Cloud Run for a low-traffic prototype. Do not add a jobs table/polling unless explicitly asked — it's a known, deferred upgrade, not an oversight.
- Before starting analysis, check `inAnalysis` on the `ConservationObject`; if true, block and tell the user an analysis is already running. This is the entire concurrency strategy — no distributed locks needed.

## Excel export

- Generated on-demand from Postgres via a Route Handler — the DB is always the source of truth, the Excel is never edited and re-imported.
- Column order and sheet name must match the reference file `1_Tabla_DB.xlsx` exactly (taxonomy + metadata + classification + 11 ecological-dimension matrix columns + 6 threat-dimension matrix columns).
- The "Robustez toma de decisiones" (LoE / Mupepele 2016) column is kept in the export but left BLANK, with a cell comment on the header reading "No evaluado en este MVP". Do not compute or guess values for this column, and do not remove the column.

## Logging & errors

- Use `console.log`/`console.error` with structured JSON payloads — Cloud Run captures stdout/stderr into Cloud Logging automatically. Do not add Pino, Winston, or Sentry unless asked.
- Route Handlers return clear error JSON with appropriate HTTP status on hard failures (e.g. OpenAlex unreachable).

## Conventions

- All code, file names, folder names, identifiers: English.
- UI navigation is a single catalog view (list of classified conservation objects + "add species" action) with drill-down to a detail view per object (taxonomy, evidence table, download Excel, reprocess, delete). Not separate pages per flow.
- Each Route Handler must check auth/permissions itself once auth exists — never assume protection is inherited from the page that calls it (not implemented yet, but keep handlers structured so this is easy to add).

## Explicitly deferred (do not build unless asked)

- Async job queue + polling for Flow 2.
- User authentication/login.
- Forced full reprocessing (vs. incremental upsert).
- Anything from spec points 6 onward.