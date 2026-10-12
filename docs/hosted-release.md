# Hosted release gate — issue #19

Status: **INCOMPLETE / BLOCKED**, 11 October 2026. Local verification is not
hosted evidence. The operator subsequently deployed
[the application](https://secret-santa-pink-psi.vercel.app/); its HTTP-only smoke
passes. The subsequent Upstash migration and full automated hosted smoke also
pass, with the operator-approved physical-expiry tolerance below. Natural expiry,
connection headroom/recovery and hosted usage remain unverified. See the evidence record for the latest cloud-free
checks. This checkout has no `.vercel` project link.

The operator selected **Upstash Redis Free** on 11 October 2026, replacing the
Redis Cloud Free target because that plan does not support TLS. This explicitly
supersedes the provider choice in [#19](https://github.com/james-litch/SecretSanta/issues/19)
and the [earlier hosting decision](https://github.com/james-litch/SecretSanta/issues/7#issuecomment-6068643313);
the exchange requirements in [#11](https://github.com/james-litch/SecretSanta/issues/11)
remain unchanged. Upstash documents [always-on TLS](https://upstash.com/docs/redis/features/security)
and [native Redis TCP support](https://upstash.com/docs/redis/overall/compatibility).
The existing Node Redis client and atomic Lua operations can use this endpoint;
no REST SDK or storage-format migration is required. Hosted compatibility still
requires the full smoke against the provisioned database.

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
2. Follow the [official Upstash Vercel integration](https://upstash.com/docs/redis/howto/vercelintegration).
   Install Upstash from Vercel Marketplace, choose Redis and the **Free** plan,
   then connect the Secret Santa project and intended environment. Record the
   actual plan and database/function regions; choose a nearby primary region.
   Keep [eviction disabled](https://upstash.com/docs/redis/features/eviction): rooms
   are stored data, not a disposable cache. Do not enable paid upgrades, extra
   regions or paid features. Stop if the offer requires payment.
3. The app reads **`REDIS_URL`**: map Upstash's **TCP TLS connection URL** to this
   server-only Vercel variable. Use the exact provider-issued `rediss://` URL,
   including its username, password, host and port. A Marketplace `KV_URL` can
   be copied into `REDIS_URL` only if it is that TLS Redis URL. Neither an HTTPS
   REST URL nor a REST token works with the current Node Redis client. Check for
   an old Redis Cloud `REDIS_URL` in each environment and replace that value;
   merely adding Upstash's REST variables does not switch this app. Never use
   `NEXT_PUBLIC_` or disable certificate verification.
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
stored `expiresAt` equals the HTTP deadline, then checks it again after all
activity. `PEXPIRETIME` must be within one second of that original deadline on
Upstash (operator accepted on 12 October 2026), and exact on local Redis. Hosted
probes found small physical expiry shifts on hash writes; this tolerance applies
only to database cleanup, not the stored application deadline or access cutoff.
It shortens **only that room's** TTL to one millisecond and checks that expiration,
reads and all mutation retries leave the key absent. No scans, global flushes or
shared-room deletion are used. This verifies physical expiry and no recreation;
it does not substitute for the original-deadline and warm-instance checks below.
Failed runs may leave a disposable room until its original TTL; do not flush the
database to clean up. The diagnostic client adds one connection to measurements.

## Hosted natural expiry and connection checks

Record each as PASS, FAIL or NOT RUN with timestamp and deployment SHA. A green
automated smoke alone does not complete this gate.

The operator waived the separate deployed-screen keyboard/accessibility/visual
walkthrough on 11 October 2026. It is no longer a release requirement. Automated
cloud-free browser and Storybook coverage remains required, alongside the hosted
HTTP checks and the following expiry/connection observations.

1. For one waiting room and one drawn room, record the original HTTP `expiresAt`
   and `PEXPIRETIME room:<disposable-code>` using an authorized TLS Redis client.
   The stored application deadline must agree exactly; Upstash physical expiry
   may differ by at most the accepted one second. Repeat reads, joins/recovery
   where eligible, and draw; the application deadline must remain identical and
   physical expiry must remain within that original deadline's tolerance. Retain the profiles until the
   original one-day deadline. Put them offline just before it: private content
   must disappear at that deadline. Reconnect and revisit: HTTP must return
   unavailable at the original deadline, even if the physical key is still present.
   Check `EXISTS` returns zero by `expiresAt + 1000 ms` on Upstash (at the exact
   deadline for local Redis). The offline part needs the browser
   awake; also check resuming a suspended tab. If the run cannot wait, leave this
   check NOT RUN rather than changing the application's lifetime validation.
2. Repeat the expiry checks at the configured maximum participant capacity,
   including joins and recovery retries. The three-participant smoke does not
   establish a physical-expiry bound for larger exchanges.
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
just the advertised offer. [Upstash Free pricing](https://upstash.com/pricing/redis)
currently lists 256 MB (shown as 250 MB on the plan card), 500,000 commands/month
and 10 GB monthly bandwidth. Confirm the provisioned limits in the dashboard.
Do not carry over Redis Cloud's 30 MB or 30-connection limits. Record Upstash's
actual concurrent-connection and throughput limits separately from participants.
Reserve connections for diagnostics, previews, overlapping deployments and scaling.
Record peak connections, operating reserve, used/available storage, remaining
commands and bandwidth, eviction setting, and rejected connections/writes.

For an explicit small-use assumption of 30 visible waiting tabs open for one
hour, three-second polling produces roughly `30 × 3600 / 3 = 36,000` reads.
Thirty tabs left open continuously for 30 days could produce about 25.92 million
reads. Latency/backoff can reduce this; page requests, joins, retries and draws
add usage. One hour at that example load uses about 7.2% of a 500,000-command
allowance from polling alone (one hash read per successful poll); account for
other commands and verify actual billing counters. Hidden/offline pauses and stopping after draw do not cap visible-tab
usage. Database connection count is a separate constraint from request volume.

[Vercel Hobby's current documentation](https://vercel.com/docs/plans/hobby)
lists 1 million function invocations, 4 active CPU hours, 360 GB-hours provisioned
memory, 100 GB fast transfer and 10 GB origin transfer. Record the account's
actual remaining allowances, including other projects, and measured smoke deltas
for invocations, CPU, memory and transfer. Usage reporting may lag; a missing
metric is not zero. Estimate intended exchange volume from these observations.
Hobby is for personal non-commercial use; exceeding limits can suspend service.
Do not treat a brief smoke as a zero-cost guarantee or load test.

Upstash provides [durable storage](https://upstash.com/docs/redis/features/durability).
This improves on the previous Redis Cloud Free persistence assumption, but expiry
is still an upper lifetime bound: missing data must remain unavailable, with no
recreated room or saved draw. Do not infer backups or a durability guarantee from
local tests. Any paid upgrade requires a separate decision. Close the gate only
after all hosted observations and capacity fields have evidence.

## Switching the existing deployment

The operator confirmed the old database contains only test rooms and authorized
a fresh start. No room data needs copying. Keep the same deployment hostname so
cookie scope remains unchanged; old test-room links will become unavailable.

1. Provision the free Upstash database and configure `REDIS_URL` as above.
   For Marketplace-managed variables, update the old Redis connection's custom
   prefix to `OLD` (retains `OLD_REDIS_URL`), then leave Upstash's custom prefix
   empty so its integration provides `REDIS_URL`. This avoids manually duplicating
   credentials and preserves integration-managed rotation. Verify both Production
   and Preview bindings before redeploying.
2. Redeploy the latest intended commit with that environment. Record its SHA and
   verify the deployment uses the Upstash endpoint, without recording credentials.
3. Run the full hosted smoke with `SMOKE_REDIS_URL` pointing to that same database.
   The test's direct expiry check also catches accidentally testing a different
   database from the one used by the deployment.
4. Keep the old database until verification finishes. Do not delete it as part
   of this runbook. Reverting the URL would hide new Upstash rooms and restore
   the old test data, so rollback is not a data merge.
