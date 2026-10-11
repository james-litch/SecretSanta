# Hosted release gate — issue #19

Status: **INCOMPLETE / BLOCKED**, 11 October 2026. Local verification is not
hosted evidence. The operator subsequently deployed
[the application](https://secret-santa-pink-psi.vercel.app/); its HTTP-only smoke
passes. Database configuration/access, plan, region, connection headroom and
hosted usage remain unverified. The cloud-free browser prerequisite also has
three unresolved failures. This checkout has no `.vercel` project link.

There is also a provider capability question to resolve before provisioning:
[Redis's TLS guide](https://redis.io/docs/latest/operate/rc/security/database-security/tls-ssl/)
says Free Essentials does not support TLS, whereas the
[subscription comparison](https://redis.io/docs/latest/operate/rc/subscriptions/)
lists encryption in transit for Free. Both were checked on 11 October 2026.
Confirm the actual official Marketplace offer supports a certificate-verified
`rediss://` connection at zero cost. Do not assume changing the URL scheme enables
TLS. If it cannot, the selected free-hosting contract needs an explicit decision;
do not substitute plaintext, disable certificate validation or upgrade silently.

The source contracts are [#19](https://github.com/james-litch/SecretSanta/issues/19),
[specification #11](https://github.com/james-litch/SecretSanta/issues/11) and the
[hosting decision](https://github.com/james-litch/SecretSanta/issues/7#issuecomment-6068643313).
The steps below are a runbook. Actual observations, including the limited hosted
HTTP result, are recorded separately in [release evidence](release-evidence.md).

## Configuration and prerequisites

1. Use a disposable deployment/database with synthetic participants. Select
   Vercel Hobby, the Next.js framework preset, repository root, `npm ci`, and
   `npm run build`. Match a supported Node version to the locally tested version.
   Keep the default Node runtime: this installed Next.js version's Cache
   Components does not support explicit route runtime overrides or static export
   for these API operations. Installed guides consulted: `17-deploying.md`,
   `15-route-handlers.md` and `environment-variables.md` under
   `node_modules/next/dist/docs/01-app/`.
2. Follow the [official Redis Marketplace integration](https://redis.io/docs/latest/operate/rc/cloud-integrations/vercel/):
   Storage → Redis → Create, select the actual free offer and region, then Connect
   Project for the intended environment. Record the subscription, database and
   Vercel function regions. Choose nearby regions when available; do not invent
   a region or enable paid high availability. Stop if secure free connectivity
   is unavailable or the offer requires payment.
3. Inspect the generated environment variable names. The app reads **`REDIS_URL`**,
   not a REST endpoint/token or a provider-specific prefixed variable. Map the
   provider's secure connection URL to that server-only name in Vercel. It has
   the form `rediss://default:<encoded-password>@<host>:<tls-port>`; use the
   provider value, not this placeholder. Never use `NEXT_PUBLIC_` for credentials.
   Leave certificate verification enabled. The current client uses Node's trust
   store; a database requiring a custom CA or mutual TLS needs explicit client
   configuration before this gate can pass. Do not claim it already supports it.
4. Set `ROOM_MAX_PARTICIPANTS=30` and `ROOM_LIFETIME_DAYS=1` for disposable smoke
   rooms (one day is the minimum accepted lifetime). Production defaults are
   30 and 7; record final values separately. Do not set `NEXT_TEST_DIST_DIR` on
   Vercel. Redeploy after setting the environment and retain the deployment SHA.
5. Use the final HTTPS origin without redirects. If Deployment Protection is
   enabled, use an operator-accessible disposable environment; the automated
   suite does not bypass protection and will fail on a login/redirect response.
   Verify the tested hostname and `Origin` agree through Vercel's proxy.

`lib/rooms/redis.ts` reuses one Node Redis client and in-flight connect promise
per process, including module reloads. It disables offline command queuing,
allows three bounded reconnect retries, has a two-second connection timeout and
three-second command abort signal. It does not open one socket per participant
or request. Multiple Vercel instances, deployments and tools still consume
separate database connections. Source inspection is not proof of hosted reuse.

## Cloud-free prerequisite checks

Run from a clean checkout with Node, npm and Docker; no cloud credentials are used:

```sh
npm ci
docker compose -f compose.test.yaml up -d --wait
npx playwright install chromium
npm run typecheck
npm run lint
npm test
npm run test:smoke:local
NEXT_TEST_DIST_DIR=build/release-verification npm run build
npm run build-storybook
```

If Chromium is not installed but Chrome is, use
`PLAYWRIGHT_CHANNEL=chrome npm test` for the browser suite. Storybook uses its
own installed Chromium. The smoke is API-only and needs no browser binary.
`npm test` includes unit, real-Redis integration, Storybook and browser suites;
the separate local smoke runs the exact same HTTP test as hosted mode with a
managed local Next.js server and test Redis on port 6380. It is intentionally
outside `npm test`, which must never target cloud infrastructure.

Focused commands while changing the gate:

```sh
npm run test:integration -- tests/integration/draw.test.ts
npm run test:smoke:local
npm run typecheck
```

After all checks, `docker compose -f compose.test.yaml down` stops the disposable
test service. Do not add `--remove-orphans`; development services are separate.
See [acceptance coverage](acceptance-coverage.md) for all ten screen scenarios.

## Automated hosted exchange

Only after the prerequisites pass and the secure setup is available, export
`SMOKE_ORIGIN` as the deployment's HTTPS origin and `SMOKE_REDIS_URL` as the same
disposable database's secure URL using your secret manager/session environment.
Do not place the credential in a shell command, URL argument, report or commit.
Unset `SMOKE_LOCAL`, then run:

```sh
npm run test:smoke
```

When only the deployment URL is available, the explicitly limited mode is:

```sh
SMOKE_HTTP_ONLY=1 SMOKE_ORIGIN=https://your-disposable-deployment.vercel.app npm run test:smoke
```

This does not connect directly to Redis, prints an INCOMPLETE diagnostic warning,
and leaves the disposable room to its original TTL. It can diagnose the deployed
HTTP exchange while prerequisites are still failing, but is not release sign-off.
Unset `SMOKE_HTTP_ONLY` before the full run. No missing credential silently opts
into limited mode.

The config refuses a missing origin, plaintext hosted connections, and mixing
local/hosted modes. The test creates one new room with three synthetic identities
using independent cookie jars. It checks real create/join/draw scripts through
the deployed API, same-origin rejection on all mutations, owner authorization,
cookie scope/flags/expiry, exact private response fields, no CDN cache hit,
one-to-one non-self recipients, competing draws, saved-result revisits, create
and post-draw join recovery, and rejection of late or unauthenticated access.
HTTP transport and JSON parse exceptions are sanitized before reaching the
reporter, because Playwright's original network errors can include Cookie headers.
Raw credentials, operations and bodies stay in memory; do not enable traces,
HTTP debug logs or storage-state exports for hosted runs.

The diagnostic Redis connection first checks that this newly created room's
`PEXPIRETIME` equals the HTTP `expiresAt`, then checks it again after all activity.
It shortens **only that room's** TTL to one millisecond and checks that expiration,
reads and all mutation retries leave the key absent. No scans, global flushes or
shared-room deletion are used. This verifies physical expiry and no recreation;
it does not substitute for the original-deadline and warm-instance checks below.
Failed runs may leave a disposable room until its original TTL; do not flush the
database to clean up. The diagnostic client adds one connection to measurements.

## Hosted browser, natural expiry and connection checks

Record each as PASS, FAIL or NOT RUN with timestamp and deployment SHA. A green
automated smoke alone does not complete this gate.

1. In three separate browser profiles, create a fresh room and join it using
   only synthetic names. Copy/share the code, check the roster, cancel the owner
   confirmation, then confirm. Each profile must see only its recipient, retain
   that result on refresh/revisit, and deny late joining from a fourth profile.
   Use keyboard controls; check focus, status announcements, FAQ links, the
   approved light appearance and lifetime sentence. Inspect API headers locally
   for `private, no-store` and `Vary: Cookie`; the cookie is HttpOnly, Secure,
   SameSite=Lax and scoped to `/api/rooms/<code>`. Do not export a HAR.
2. For one waiting room and one drawn room, record the original HTTP `expiresAt`
   and `PEXPIRETIME room:<disposable-code>` using an authorized TLS Redis client.
   They must agree. Repeat reads, joins/recovery where eligible, and draw; the
   absolute deadline must remain identical. Retain the profiles until the
   original one-day deadline. Put them offline just before it: private content
   must disappear at that deadline. Reconnect and revisit: HTTP must return
   unavailable and `EXISTS` must return zero. The offline part needs the browser
   awake; also check resuming a suspended tab. If the run cannot wait, leave this
   check NOT RUN rather than changing the application's lifetime validation.
3. With only the disposable deployment active, measure Redis connections at
   baseline, after sequential reads, and during a small bounded overlap (three
   profiles, one visible waiting tab each, five minutes). Keep the same function
   instance warm where the platform permits and correlate instance activity
   with Redis connection IDs/ages or provider metrics. Sequential requests in
   the same instance must reuse a connection; counts must not climb once per
   request. Global counts alone cannot prove same-instance reuse when scaling.
4. In the isolated database, identify a connection belonging to that warm
   application instance using the provider's client diagnostics. If supported,
   close that one connection with `CLIENT KILL ID <verified-id>`; never use a
   broad kill filter on a shared database. Request the same room again. Record
   reconnect and subsequent successful private reads with unchanged membership,
   deadline and recipient. A temporary failure must be sanitized and recoverable.
   Do not redeploy for this check: a fresh instance does not prove reconnect.
   If diagnostics/control cannot identify and interrupt the application socket,
   mark reconnect/reuse unverified and retain the gate as incomplete.

## Capacity and usage decision

At verification time record the actual plan limits and observed values, not
just the advertised offer. The current subscription comparison lists Free as
30 MB and 30 concurrent database connections. These are **not 30 participants**.
Reserve connections for diagnostic tools, preview deployments, overlapping old
deployments and scaling. Record peak connections and remaining headroom as
`provisioned limit - measured peak`, plus a deliberate operating reserve. Record
used/available memory, eviction policy and any rejected connections/writes.

For an explicit small-use assumption of 30 visible waiting tabs open for one
hour, three-second polling produces roughly `30 × 3600 / 3 = 36,000` reads.
Thirty tabs left open continuously for 30 days could produce about 25.92 million
reads. Latency/backoff can reduce this; page requests, joins, retries and draws
add usage. Hidden/offline pauses and stopping after draw do not cap visible-tab
usage. Database connection count is a separate constraint from request volume.

[Vercel Hobby's current documentation](https://vercel.com/docs/plans/hobby)
lists 1 million function invocations, 4 active CPU hours, 360 GB-hours provisioned
memory, 100 GB fast transfer and 10 GB origin transfer. Record the account's
actual remaining allowances, including other projects, and measured smoke deltas
for invocations, CPU, memory and transfer. Usage reporting may lag; a missing
metric is not zero. Estimate intended exchange volume from these observations.
Hobby is for personal non-commercial use; exceeding limits can suspend service.
Do not treat a brief smoke as a zero-cost guarantee or load test.

Redis Free's lack of persistence remains an accepted risk; expiry is an upper
lifetime bound, not a durability promise. See [persistence support](https://redis.io/docs/latest/operate/rc/databases/configuration/data-persistence/).
Early data loss must remain unavailable, with no recreated room or saved draw.
Any need for a paid plan or changed provider is a new explicit decision. Close
the gate only after all hosted observations and capacity fields have evidence.
