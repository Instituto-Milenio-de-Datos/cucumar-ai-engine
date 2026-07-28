# CuCuMar AI Engine

See `CLAUDE.md` for project scope and conventions, and `docs/reference/` for the
original spec and reference data.

## Local development

```bash
docker compose up -d postgres   # Postgres on localhost:5432
cp .env.example .env            # first time only; fill in the API keys you have
npm install
npx prisma migrate dev          # first time only, or after a schema change
npx prisma db seed              # first time only, loads SeedSpecies
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/catalog`.

Other useful commands:

```bash
npx prisma studio   # browse/edit the database
npx prisma validate # check the schema without touching the database
npm run build        # type-checks and produces a production build
```

## Running everything in Docker (no local Node/npm needed)

For trying out the app without setting up a local dev environment — this is
the same image the Cloud Run deploy will eventually use, so it also doubles as
a check that the app actually works in a container.

```bash
cp .env.example .env   # first time only; fill in the API keys you have
docker compose up -d   # builds + starts postgres, runs migrations once, starts the app
```

Open [http://localhost:3000](http://localhost:3000). `docker compose up -d`
with no service name starts all three services (`postgres`, a one-shot
`migrate` that runs `prisma migrate deploy` and exits, then `app`) — day-to-day
development doesn't need `app`/`migrate` and should keep using `npm run dev`
against the same `postgres` service, as above.
