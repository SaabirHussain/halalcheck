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

## Deploying to Railway

Use one Railway service for the Next.js app and worker, plus a Railway Postgres
service. `railway.json` runs migrations before startup and checks `/api/health`.
Mount a volume at `/data` and set `STORAGE_DIR=/data/storage`.

Set `DATABASE_URL` to the Postgres service reference (for example,
`${{Postgres.DATABASE_URL}}`), `APP_URL` to the public HTTPS URL, and
`DEMO_MODE=false`. Configure `PLACES_PROVIDER`, `GEOCODER_PROVIDER`,
`AI_PROVIDER`, `EMAIL_PROVIDER`, and `PUSH_PROVIDER` with the matching
credentials when those integrations are approved; do not use the demo Places
provider for real listings. Keep `OUTREACH_ALLOW_REAL_SEND=false` until
Mailgun is configured and reviewed.

After the first deployment has run migrations, set `ADMIN_EMAIL`,
`ADMIN_PASSWORD` (12–128 characters), and optionally `ADMIN_NAME` in the
service environment, then run `npm run admin:create` from the service context.
The command creates an admin or promotes the matching account without logging
the password. Set a Railway usage limit in the project billing settings to
control Hobby-plan spend. Do not deploy real provider credentials or enable
real sends until their setup and usage limits are reviewed.

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

## Start the application

From the repository root, start PostgreSQL, install dependencies, and initialize
the local demo database:

```sh
cp .env.example .env
docker compose up -d db
npm ci
npm run db:reset
npm run db:seed
```

Run the web application and the durable worker in separate terminals:

```sh
npm run dev
```

```sh
npm run worker
```

Open <http://localhost:3000>. The worker consumes jobs and owns recurring
schedules; keep it running for queue-backed research and outreach. The app
defaults to fictional demo data and captured email.

## End-to-end demo

1. Sign in as `user@demo.halalcheck.test` and open Cedar Grill.
2. Request research and follow the investigation.
3. Sign in as `admin@demo.halalcheck.test`; approve the initial draft and its
   contact endpoint in the outreach queue.
4. Open the Cedar Grill investigation and use the reply simulator with
   **All our meat is halal.** The simulator uses an internal provider and does
   not send or receive an external email.
5. Review and approve the targeted follow-up draft, then simulate the
   clarification preset.
6. Review the proposed findings, confirm any material changes, and publish.
7. Verify the public branch page and the user's in-app notification.

## Available scripts

| Script                | Purpose                                               |
| --------------------- | ----------------------------------------------------- |
| `npm run dev`         | Start the Next.js development server.                 |
| `npm run build`       | Build the production application.                     |
| `npm run start`       | Serve a production build.                             |
| `npm run start:all`   | Serve the app and run its worker in one process.       |
| `npm run worker`      | Start the pg-boss queue worker and schedules.         |
| `npm run admin:create` | Create or promote the initial admin from environment. |
| `npm run lint`        | Run ESLint.                                           |
| `npm run typecheck`   | Run TypeScript without emitting files.                |
| `npm test`            | Run Vitest unit and PostgreSQL integration tests.     |
| `npm run e2e`         | Run Playwright end-to-end tests.                      |
| `npm run db:generate` | Generate Drizzle SQL migrations.                      |
| `npm run db:migrate`  | Apply migrations to `DATABASE_URL`.                   |
| `npm run db:seed`     | Seed fictional demo data (`DEMO_MODE=true` required). |
| `npm run db:reset`    | Destructively reset the local demo database.          |

## Provider configuration

Keep all credentials server-side. `.env.example` is the authoritative list of
supported variable names; do not add public prefixes to secrets.

### Places search

The default `PLACES_PROVIDER=demo` uses fixtures. For Google Places, set
`PLACES_PROVIDER=google` and `GOOGLE_PLACES_API_KEY` to a restricted
server-side Places API key. Never expose that key in the browser. Set
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` separately for the browser map; restrict it
by HTTP referrer and enable **Maps JavaScript API**. Set
`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` when using your own map ID; it defaults to
`DEMO_MAP_ID`. Without a browser Maps key, the map falls back to Leaflet and
omits provider places.

Search and Place Details calls are capped by
`GOOGLE_PLACES_SEARCH_DAILY_LIMIT` and `GOOGLE_PLACES_DETAILS_DAILY_LIMIT`
(both default to 150); searches are also limited to 60 per hour per client IP.
When Google is selected without an explicit location, the first search uses
`DISCOVERY_DEFAULT_CENTER=43.6532,-79.3832` (Toronto). The app keeps Google
place IDs indefinitely and refreshes coordinates within 30 days; names,
addresses, websites, and phone numbers are fetched live and not saved.

Provider places have no first-party business details initially. Before
outreach, an administrator must confirm the name, address, city, website,
phone, and timezone from the business’s own website or signage. Google details
are shown as reference only; outreach drafting and approval remain blocked
until confirmation.

### Geocoding

The default `GEOCODER_PROVIDER=demo` uses local fixtures. To use Nominatim, set
`GEOCODER_PROVIDER=nominatim` and identify the application in
`NOMINATIM_USER_AGENT` with a contactable, truthful user agent. Follow
Nominatim's usage policy, cache results, and avoid bulk or high-rate requests.

### AI research

The default `AI_PROVIDER=demo` uses deterministic local behavior. To connect an
OpenAI-compatible endpoint, set `AI_PROVIDER=openai`,
`AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`. Use a server-side key and a trusted
endpoint; public web text is untrusted input and must not override system
instructions or access private data.

### Outbound and inbound Mailgun

Email defaults to `EMAIL_PROVIDER=demo`; demo messages are captured and never
sent. For an explicitly configured Mailgun integration, set `EMAIL_PROVIDER=mailgun`,
`MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, and, if required by your account,
`MAILGUN_API_BASE`. Configure `OUTREACH_FROM_ADDRESS`,
`OUTREACH_REPLY_DOMAIN`, `OUTREACH_DEFAULT_TIMEZONE`,
`OUTREACH_BUSINESS_HOURS`, and `OUTREACH_BUSINESS_DAYS` for sender identity,
reply routing, and permitted send windows. Real sends require the separate
opt-in `OUTREACH_ALLOW_REAL_SEND=true`; keep it false in local development and
tests.

Configure Mailgun inbound routing to the deployment's
`/api/webhooks/mailgun/inbound` URL. Set `MAILGUN_WEBHOOK_SIGNING_KEY` to the
signing key from Mailgun and configure delivery events to
`/api/webhooks/mailgun/events`. The application validates signatures and
deduplicates provider events. Do not expose webhook keys in logs or client
bundles.

### Notifications

In-app notifications are stored in PostgreSQL and require no provider
configuration. Users can control email notification preferences in account
settings. In demo mode, email is captured in the outbox; notifications do not
cause a real send unless the Mailgun provider and explicit send opt-in are both
configured.

### Evidence storage

Uploads use local filesystem storage. Set `STORAGE_DIR` to a private,
non-publicly-served directory with appropriate ownership and backups.
`MAX_UPLOAD_BYTES` sets the upload byte limit; correction attachments accept
PDF, PNG, JPEG, and WebP up to 5 MiB. Raw evidence and private correspondence
are not public branch-page assets.

### Map tiles

`NEXT_PUBLIC_MAP_TILE_URL` configures the Leaflet tile URL template and
`NEXT_PUBLIC_MAP_ATTRIBUTION` supplies the visible attribution. The defaults
use OpenStreetMap's public tile service; follow its tile usage policy. These
values are public and are embedded in the client.

### Other environment settings

| Variable                   | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`             | Application PostgreSQL connection.                         |
| `TEST_DATABASE_URL`        | Isolated PostgreSQL database used by integration tests.    |
| `APP_URL`                  | Canonical application URL for links and callbacks.         |
| `DEMO_MODE`                | Enables fictional demo fixtures and demo-only behavior.    |
| `QUEUE_DRIVER`             | Queue adapter selection (`pg-boss` in normal local setup). |
| `REFRESH_AFTER_DAYS`       | Age threshold for considering published research stale.    |
| `CERT_EXPIRY_WARNING_DAYS` | Certificate expiry warning window.                         |

## Worker and queue

The worker registers these jobs in `src/worker/handlers.ts`:

- `investigation.public_research` — fetch and review public research.
- `investigation.prepare_outreach` — prepare an approval-ready message draft.
- `investigation.evidence_review` — turn reviewed claims into a proposal.
- `outreach.send` — send or capture an approved message.
- `outreach.no_response_check` — schedule an eligible follow-up.
- `message.parse` — parse an inbound business reply.
- `notify.followers` — deliver in-app notifications to followers.
- `investigations.reconcile` — resume or reconcile active investigations.
- `refresh.scan` — find stale or expiring public research.

- `investigations.reconcile` runs every two minutes.
- `refresh.scan` runs daily at 03:00 UTC.
- pg-boss jobs use a retry limit of 3 with backoff enabled. Failed exhausted
  jobs are recorded for administrator review and can be retried from the admin
  interface.
- The queue is durable; keep PostgreSQL and the worker available. Tests use an
  inline queue or isolated test database as appropriate.

## Security and privacy notes

- Sessions use opaque, database-backed tokens stored as hashes; session cookies
  are HTTP-only and scoped by the application.
- Public URL fetching validates destinations and rejects private or otherwise
  disallowed IP ranges to reduce SSRF risk. Configure only trusted providers.
- Login and sensitive inbound operations are rate-limited; Mailgun signatures
  are verified and webhook events are deduplicated.
- Correction uploads enforce server-side size and file-type checks; do not
  serve private storage directly from a public static directory.
- Business email replies and raw source text are private evidence. Public pages
  expose reviewed summaries, approved excerpts, and evidence categories, not
  private correspondence or raw attachment contents.
- Admin server actions verify the administrator role, and domain services
  enforce actor authorization and audit sensitive changes.
- Keep provider credentials out of source control, client code, screenshots,
  and logs. Never enable real sends, paid APIs, or public deployment for a demo
  verification run.

## Implemented, simulated, and limited

### Implemented

Public branch discovery and evidence summaries, account sessions, research
requests and follows, in-app notifications, admin review workflows, audit
events, correction intake, durable jobs, and provider adapters are implemented.

### Simulated in demo mode

Businesses, locations, research fixtures, inbound reply presets, and outbound
email are fictional. Demo email is captured only. The simulator routes replies
through the same inbound parsing workflow without contacting an external
mailbox. Demo providers do not call paid services.

### Limitations & not implemented

Phone outreach, real-world business verification guarantees, religious rulings,
and a production moderation/legal process are not provided. Map tiles and
external providers depend on third-party availability and terms. Production
deployment, operational monitoring, retention policies, and provider-specific
compliance review must be completed separately.

## Test overview

`npm run typecheck` checks strict TypeScript. `npm run lint` runs ESLint.
`npm test` includes PostgreSQL-backed integration coverage for requests,
authorization, evidence privacy, outreach and inbound parsing, refresh,
publication, notifications, and failure handling; it requires
`TEST_DATABASE_URL` to point to the isolated `halalcheck_test` database.
`npm run e2e` exercises the browser demo workflow and screenshot/overflow
coverage and requires the local app, demo database, and (for the queued path)
worker to be running. Never point tests or reset scripts at production data.

## Troubleshooting

- If PostgreSQL is unavailable, run `docker compose up -d db` and verify the
  local `DATABASE_URL` and `TEST_DATABASE_URL`.
- If queue-backed work remains pending, start `npm run worker` in a separate
  terminal and inspect the recorded admin job status.
- Next.js development and build processes must not share the same `.next`
  output directory. Stop the dev server before a normal build, or use an
  isolated directory:

  ```sh
  HALALCHECK_DIST_DIR=.next-handoff-build npm run build
  ```

- If a previous process left stale `.next` artifacts, stop that process before
  removing the local build output and restarting `npm run dev`. Do not delete
  output used by a running server.
- If map tiles do not load, check `NEXT_PUBLIC_MAP_TILE_URL`,
  `NEXT_PUBLIC_MAP_ATTRIBUTION`, network access, and the tile provider's usage
  policy.
- If uploads fail, check `STORAGE_DIR` permissions and ensure the file is one
  of the supported formats and within `MAX_UPLOAD_BYTES`.

## Mobile app (Capacitor)

The native iOS and Android projects are thin shells around the existing Next.js
server; this application uses server rendering, server actions, and database
sessions and therefore is not a static export. `capacitor.config.ts` reads
`CAP_SERVER_URL` when Capacitor sync runs. It defaults to
`http://10.0.2.2:3000` for the Android emulator to reach the host machine.
Use an HTTPS URL for a hosted environment. Capacitor's `server.cleartext` is
enabled only when this URL uses HTTP; on Android, Capacitor sync generates the
corresponding application-level cleartext setting rather than requiring a
manual manifest flag. `server.errorPath` points to the bundled
`mobile/www/offline.html`; Retry opens the configured server URL.

Install the matching Android SDK platform/build tools and JDK 21 or newer,
then run:

```sh
npm install
cp .env.example .env
# Set DATABASE_URL and other local values in .env.
npm run db:migrate
npm run db:seed
npm run dev
npm run worker
npm run cap:sync
npm run android:debug
```

The debug APK is written to
`android/app/build/outputs/apk/debug/app-debug.apk`. `android:debug` syncs the
native project before running Gradle. Use `CAP_SERVER_URL` when syncing against
a different server, for example:

```sh
CAP_SERVER_URL=https://halalcheck.example npm run cap:sync
```

On a Mac with Xcode installed, run `npx cap sync ios` and open
`ios/App/App.xcodeproj` in Xcode to build and sign the iOS app. iOS builds and
signing cannot be completed on Linux. Store release requires a hosted HTTPS
server and Apple/Google developer accounts; neither release nor account setup
is performed by this project workflow.

The app uses native location permission/geolocation, system browser handling
for external links, Android hardware-back navigation, status-bar and splash
handling, and configured native push-device registration. Apple App Store
Review Guideline 4.2 may reject apps that merely repackage a website; these
native capabilities are intended to add functionality beyond a plain wrapper.
Production push delivery is not implemented; review the current guideline
before submission.

Push delivery is demo-only by default (`PUSH_PROVIDER=demo`): it records
deliveries locally and makes no network calls. `PUSH_PROVIDER=fcm-apns` is an
unconfigured stub and throws `not configured`; it does not send. A future
implementation would need a Firebase service-account credential for FCM and an
Apple APNs authentication key (`.p8`), Key ID, Team ID, and the app's bundle
identifier. Consult the official
[Firebase Cloud Messaging documentation](https://firebase.google.com/docs/cloud-messaging)
and [Apple APNs documentation](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server).
The internal push message carries a same-origin app path as `data.link`; native
tap handling ignores links that are not root-relative or that resolve off-origin.
Do not put production credentials in this repository or in demo configuration.
Native push registration only runs when `PUSH_PROVIDER=fcm-apns`; this requires
`android/app/google-services.json` and APNs setup. Demo mode skips native device
registration entirely, while the server-side demo push path continues to record
deliveries locally without network calls.
