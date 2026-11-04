# HalalCheck

HalalCheck is a community research directory. Evidence is reviewed before it
becomes public; unknown information stays unknown. The local application starts
in demo mode, uses fictional businesses, and captures email rather than sending
it.

## Local setup

Requirements: Node.js 22 LTS, npm, Docker Compose.

```sh
cp .env.example .env
docker compose up -d db
npm ci
npm run db:reset
npm run db:seed
npm run dev
```

Open <http://localhost:3000>. Run the durable worker in another terminal with
`npm run worker`. PostgreSQL 16 is exposed on port 5432; compose initializes
both `halalcheck` and `halalcheck_test`.

## Demo accounts

- `admin@demo.halalcheck.test` / `DemoAdmin!2026`
- `user@demo.halalcheck.test` / `DemoUser!2026`
- `user2@demo.halalcheck.test` / `DemoUser!2026`

These credentials are local demo credentials only. Seed refuses to run unless
`DEMO_MODE=true`. The entire seed is fictional.

## Architecture

- Next.js App Router, TypeScript strict, Tailwind CSS v4.
- PostgreSQL 16, Drizzle ORM, generated SQL migrations.
- bcryptjs password hashes and SHA-256 hashed opaque database sessions.
- Domain services enforce actor authorization internally.
- Job queue has a durable pg-boss implementation and an inline in-memory test
  implementation. A separate `tsx` worker owns queue consumers and schedules.
- Providers use explicit adapters; absent credentials or demo settings select
  local fixtures/outbox. Mailgun sends additionally require
  `OUTREACH_ALLOW_REAL_SEND=true`.
- Public read models select whitelisted columns and redacted excerpts only.

## Database and tests

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:reset # destructive; demo data only, local database
npm test
```

Vitest uses `TEST_DATABASE_URL` for PostgreSQL-backed workflow tests. Never
point `db:reset` at a shared or production database.

## Provider configuration

Copy `.env.example` to `.env`. Real adapters require both an explicit provider
selection and its credentials. Email remains in demo capture mode unless
explicitly enabled; no real email is sent during development. Google Places,
Nominatim, and OpenAI-compatible configuration are server-side only. Map tile
URL and attribution are public settings.

Phone outreach is an interface only and intentionally not implemented.
Research and evidence summaries are not religious rulings.
