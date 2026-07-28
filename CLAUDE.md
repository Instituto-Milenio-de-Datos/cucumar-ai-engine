# CuCuMar AI Engine — project context

MVP that covers only points 1-5 of the original spec: classify a conservation object (species) with its taxonomy, assign fixed criteria/subcriteria for "Mamíferos marinos", gather evidence from OpenAlex, extract metadata, and analyze/store each piece of evidence. Points 6+ (gap analysis, Observatorio, expert validation workflow, continuous monitoring) are explicitly OUT OF SCOPE for this MVP — do not build toward them unless asked.

## Reference files (read these when relevant, don't guess)

- `docs/reference/spec-original.md` — full original spec (Spanish) with the client's review comments. Points 6+ are summarized there for context only, not to be implemented.
- `docs/reference/1_Tabla_DB.xlsx` — the exact column schema/format the Excel export must replicate (taxonomy + metadata + classification + ecological/threat matrix columns). Check this file directly before writing the export code, don't infer the schema from this file alone.
- `docs/reference/seed-species.csv` — (to be added) the ~50 Chilean marine mammal species for the seed table. If this file doesn't exist yet, don't invent species data — flag it and ask instead of hardcoding a placeholder list.

## Stack

- Next.js (App Router, TypeScript) full-stack, no separate backend.
- Prisma + Postgres. Local dev via Docker Compose; production target is Cloud SQL on GCP (not set up yet).
- `Dockerfile` (multi-stage, `output: "standalone"` in `next.config.ts`) exists for two reasons: it's what the eventual Cloud Run deploy needs regardless, and `docker-compose.yml` uses it to offer a no-Node-installed-locally way to run the whole app (services `migrate` + `app`, on top of `postgres`). Day-to-day development still uses `npm run dev` against the `postgres` service only — the `app`/`migrate` services are not part of that flow, don't wire them into it. No Prisma `binaryTargets` concerns in the image: the schema uses the `@prisma/adapter-pg` driver adapter, not the classic native query-engine binary. Migration strategy for the actual Cloud Run deploy (running `migrate deploy` from a single place, not from every scaled instance) is a separate, later concern — not solved by the `migrate` service here, which is only for the local Compose stack.
- shadcn/ui + Tailwind for components.
- Route Handlers (`app/api/**/route.ts`) for ALL mutations — do not use Server Actions. Reason: future periodic-monitoring feature needs to trigger analysis from outside the browser (cron), and Route Handlers are easier to test with curl/Postman during development.
- External integrations live ONLY behind `lib/providers/`: `taxonomy.ts` (GBIF/WoRMS), `evidence.ts` (OpenAlex), `llm.ts` (OpenAI). Nothing else in the codebase calls these APIs directly — this is intentional so any of the three can be swapped later without touching the rest of the pipeline. (No `src/` dir in this project — `lib/` lives at the repo root.)

## Data model (conceptual)

Three separate tables, do not merge them:
- `SeedSpecies` — static seed list of ~50 Chilean marine mammal species (common name ↔ scientific name), read-mostly/admin-maintained.
- `ConservationObject` — output of Flow 1: a species once classified, with resolved taxonomy. Has `inAnalysis: boolean` and `lastAnalysisDate` fields.
- `Evidence` — output of Flow 2: one row per paper *per species*, FK to `ConservationObject`. `openalexId` is unique per `ConservationObject` (composite `@@unique([conservationObjectId, openalexId])`), NOT globally unique — the same paper can legitimately be evidence for more than one species (e.g. a multi-species survey), so it gets its own row per `ConservationObject` it applies to. This composite key is what makes upsert-based reprocessing safe (no manual locking needed).

Deleting a `ConservationObject` is a hard delete with `onDelete: Cascade` to its `Evidence` rows — no soft delete, no history kept.

## Flow 2 behavior — read this before touching analyze-evidence

- "Reprocess" = incremental upsert, NOT a full restart. Papers already saved for THIS species (matched by `conservationObjectId` + `openalexId`) are never re-sent to the LLM or re-fetched. Only new papers found in OpenAlex get processed. This is deliberate (avoids wasted API/LLM cost) — do not "simplify" this into a delete-and-reinsert-everything pattern. Note the match is per-species, not global: the same paper showing up for a second species is a new row, not a skip — it's genuinely new evidence for that species.
- UI copy (in Spanish, see Conventions) must reflect this: button says "Buscar nueva evidencia", not "Reprocesar desde cero".
- Papers without a clean `openalexId` or with poor metadata (common in 1970s-90s papers) are simply skipped, not force-matched by title/year.
- Processing is per-paper: each paper's classification+save is independent, never batched into one all-or-nothing SQL transaction. Papers run in concurrent batches of `CLASSIFICATION_CONCURRENCY` (5), not strictly one-at-a-time — bounded to stay under OpenAI rate limits while still cutting wall-clock time roughly proportionally. This moves failure isolation from the single-paper level to the batch level (a batch's papers all get attempted before the next batch starts; an unexpected per-paper failure is itself caught and logged so it can't take down its batch-mates or abort later batches).
- Simple retry (2 attempts, short backoff) per paper on transient errors. After that, skip and log; report a summary count to the UI at the end ("28/30 processed, 2 failed").
- Processing is currently SYNCHRONOUS (the HTTP request stays open until done). This was a deliberate choice over a job+polling pattern to avoid the cost/complexity of "CPU always allocated" on Cloud Run for a low-traffic prototype. Do not add a jobs table/polling unless explicitly asked — it's a known, deferred upgrade, not an oversight. (Batching the classification calls, above, is a within-the-same-request optimization — not a reintroduction of async jobs.)
- Before starting analysis, check `inAnalysis` on the `ConservationObject`; if true, block and tell the user an analysis is already running. This is the entire concurrency strategy — no distributed locks needed.

## Excel export

- Generated on-demand from Postgres via a Route Handler — the DB is always the source of truth, the Excel is never edited and re-imported.
- Column order and sheet name must match the reference file `1_Tabla_DB.xlsx` exactly (taxonomy + metadata + classification + 11 ecological-dimension matrix columns + 6 threat-dimension matrix columns).
- The "Robustez toma de decisiones" (LoE / Mupepele 2016) column is kept in the export but left BLANK, with a cell comment on the header reading "No evaluado en este MVP". Do not compute or guess values for this column, and do not remove the column.

## Logging & errors

- Use `console.log`/`console.error` with structured JSON payloads — Cloud Run captures stdout/stderr into Cloud Logging automatically. Do not add Pino, Winston, or Sentry unless asked.
- Route Handlers return clear error JSON with appropriate HTTP status on hard failures (e.g. OpenAlex unreachable).

## Conventions

- All code, file names, folder names, identifiers: English. All user-facing UI copy (labels, headings, button text, error messages shown to the user): Spanish. API error messages returned in JSON bodies are user-facing too (they get rendered directly in the UI) and follow the same rule; server-side `console.log`/`console.error` payloads stay in English since those are ops/Cloud Logging facing, not shown to users.
- UI navigation is a single catalog view (list of classified conservation objects + "add species" action) with drill-down to a detail view per object (taxonomy, evidence table, download Excel, reprocess, delete). Not separate pages per flow.
- Each Route Handler must check auth/permissions itself once auth exists — never assume protection is inherited from the page that calls it (not implemented yet, but keep handlers structured so this is easy to add).

## Explicitly deferred (do not build unless asked)

- Async job queue + polling for Flow 2.
- User authentication/login.
- Forced full reprocessing (vs. incremental upsert).
- Anything from spec points 6 onward.