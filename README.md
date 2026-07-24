# CuCuMar AI Engine

See `CLAUDE.md` for project scope and conventions, and `docs/reference/` for the
original spec and reference data.

## Local development

```bash
docker compose up -d      # Postgres on localhost:5432
cp .env.example .env      # first time only; fill in the API keys you have
npm install
npx prisma migrate dev    # first time only, or after a schema change
npx prisma db seed        # first time only, loads SeedSpecies
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/catalog`.

Other useful commands:

```bash
npx prisma studio   # browse/edit the database
npx prisma validate # check the schema without touching the database
npm run build        # type-checks and produces a production build
```
