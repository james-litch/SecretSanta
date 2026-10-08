# Secret Santa hosting and local development feasibility

Research checked 8 October 2026 for [Verify free hosting, Redis, and local development feasibility](https://github.com/james-litch/SecretSanta/issues/3). This is a planning investigation, not a deployed proof or a product decision. No cloud resources were provisioned and no application changes were made.

## Finding

Vercel Hobby plus an account-owned Upstash Free Redis database is a plausible zero-cost option for bounded personal usage. Three-second polling must be budgeted by active browser tabs, not room count or the one-week retention period. Local development can use Docker Redis without cloud credentials with either TCP everywhere or REST plus a local proxy. These are feasible alternatives; the architecture ticket should select one.

## Verified service constraints

Vercel Hobby is restricted to personal, non-commercial use. Its current allowances include 1,000,000 function invocations, 1,000,000 CDN requests, 4 CPU-hours, 360 GB-hours of provisioned memory, 100 GB data transfer, and 10 GB origin transfer. Exceeding limits can make the feature unavailable until its allowance recovers; free hosting is not unlimited availability. [Vercel Hobby](https://vercel.com/docs/plans/hobby)

New projects use Fluid compute by default. Do not mix its allowance with the older 100,000-invocation/100-GB-hour model. Each dynamic polling request consumes an invocation; CPU excludes I/O waiting but provisioned-memory accounting does not. Request counts alone therefore cannot prove the deployment will stay free. [Fluid pricing](https://vercel.com/docs/functions/usage-and-pricing), [legacy pricing](https://vercel.com/docs/functions/usage-and-pricing/legacy-pricing)

Upstash's current Free plan offers one free database, 500,000 commands/month, 256 MB data, and 10 GB monthly bandwidth. Paid plans do not inherit those free allowances. An unclaimed instant database expires after three days, so it cannot provide the proposed one-week retention: use an account-owned database. [Upstash pricing](https://upstash.com/pricing/redis)

There is a documentation inconsistency: Upstash's FAQ still mentions a 10,000/day free request limit; its dated pricing announcement explicitly replaced that with 500,000/month, matching today's pricing page. Use the current pricing allowance, and verify quota/error behaviour in the actual account before release. The stale FAQ says exceeding commands fail; it is not sufficient evidence for a current exact HTTP status or reset-time contract. [Pricing change](https://upstash.com/blog/redis-new-pricing), [FAQ](https://upstash.com/docs/redis/help/faq)

Hobby cannot connect projects to Git-organization-owned repositories. The current remote belongs to the personal `james-litch` account, so that particular restriction is not an apparent blocker. This does not grant other contributors shared Vercel administration; local collaboration and hosting collaboration are separate. [Vercel limits](https://vercel.com/docs/limits)

## Polling arithmetic and operational bounds

Assumptions: one live browser tab per participant, one request every three seconds, no retries, no initial fetch, and no other activity. Derived request count is `tabs × elapsed_seconds / 3`. These are illustrative scenarios, not expected usage:

- 10 tabs waiting 10 minutes: 2,000 polls; 2,000 commands if one Redis read/poll, 4,000 if two.
- 20 tabs waiting 30 minutes: 12,000 polls; 12,000–24,000 commands at one–two reads/poll.
- 50 tabs waiting one hour: 60,000 polls; 60,000–120,000 commands at one–two reads/poll.
- One tab continuously polling for seven days: 201,600 polls. Three such tabs: 604,800 polls, already over the Redis free allowance even with one read/poll.
- At one command/poll, 500,000 commands buy about 416.7 tab-hours. At two, about 208.3 tab-hours, before create/join/draw/authentication/rate-limit activity.

Count actual commands, not HTTP batches. Upstash's rate-limiter costing examples count EVAL and its internal commands separately; a Lua script is not a guaranteed one-command quota optimisation. Pipeline/transaction batching reduces round trips but does not justify treating several operations as one budget unit. Measure the eventual implementation's command count and include script calls, retries, rate limits, previews and other database users. [Upstash command costing](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs)

Browser background timers are throttled and may stop; three seconds cannot be a delivery guarantee for hidden or suspended pages. Proposed policy for the product ticket: poll only while visible and waiting, refresh immediately on return, stop on matched/expired/unauthorised states, and avoid overlapping in-flight requests. Decide an idle waiting cutoff and an error/backoff policy. Visibility is observable via the Page Visibility API. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)

The allowance applies across rooms. A room participant cap alone cannot bound total usage or abuse. Choose an intended usage envelope and graceful unavailable behaviour; instrument commands, response bytes and compute before claiming zero-cost feasibility for that envelope. These are engineering recommendations derived from the above limits.

## Redis access alternatives

1. **TCP client in Next.js Node runtime, local Docker Redis, hosted Upstash over TLS.** Upstash supports native Redis TCP as well as HTTPS REST. This permits one command implementation and a single local Redis container. A long-lived module client and careful connection lifecycle are required under concurrent/serverless execution; Vercel documents `attachDatabasePool` support including `ioredis`. Validate the selected client's integration rather than assuming every client is interchangeable. [Upstash compatibility](https://upstash.com/docs/redis/overall/compatibility), [Vercel connection management](https://vercel.com/kb/guide/efficiently-manage-database-connection-pools-with-fluid-compute)
2. **`@upstash/redis` over HTTP in both environments.** It is a connectionless REST client; a stock Docker Redis server does not expose that HTTP API. Upstash documents the community Serverless Redis HTTP proxy (SRH), including Compose and CI examples. Locally run Redis plus SRH with a dummy local token. This needs no Upstash credentials and exercises the same SDK, but adds a container and a compatibility dependency. Pin versions and verify the actual Lua/transaction/error behaviour needed by this app. [SDK connection](https://upstash.com/docs/redis/howto/connect-with-upstash-redis), [local development/testing](https://upstash.com/docs/redis/sdks/ts/developing)
3. **REST hosted adapter and TCP local adapter behind a room-storage interface.** Technically possible from those protocol capabilities, but an inference rather than a vendor-prescribed architecture. It avoids the proxy while introducing two behaviours to test. Prefer one transport unless the tradeoff is justified.

## Atomic room operations and expiry

Redis Lua scripts execute atomically; Upstash exposes EVAL over REST. A pipeline alone is not atomic. Transactions execute a predetermined batch atomically, but a conditional read/check/write flow requires a script or correctly implemented optimistic concurrency. [Redis scripting](https://redis.io/docs/latest/develop/programmability/eval-intro/), [Upstash EVAL](https://upstash.com/docs/redis/commands/scripting/eval), [REST transaction and pipeline semantics](https://upstash.com/docs/redis/features/restapi)

Required invariants inferred from the agreed one-draw/no-late-join scope:

- Creating a room must reserve an unused code and establish its expiry together.
- Joining must test existence and waiting state and append the participant in one atomic operation; separate GET/SET can lose a concurrent join or admit somebody after a draw.
- Drawing must test owner authority, room state and the roster version, then publish all assignments and the matched state atomically. If matches are generated in application code, commit them only against the same roster/version; retry a conflict according to a defined policy.
- Duplicate/retried draw requests must not replace an existing result. All preconditions must be checked before writes; atomic execution does not mean arbitrary script failures roll back preceding writes.

One week is 604,800 seconds. Redis expiry can delete keys without a cleanup cron. EXPIRE can refresh an existing TTL, while replacing a value with SET clears its previous TTL unless explicitly preserved/reapplied; HSET-style mutation preserves it. Choose a fixed deadline or a sliding deadline explicitly and apply it to every related key. [Redis EXPIRE](https://redis.io/docs/latest/commands/expire/)

Proposed simplest retention model for later discussion: one room aggregate with a fixed `expiresAt` and TTL established at creation, preserved across joins and draw. This is a proposal, not a settled interpretation of 'one week'. A draw-relative week or activity-relative week changes user promises. TTL governs live-key availability, not a verified guarantee of deletion from vendor backups/logs. Do not promise backup erasure on this evidence.

## Installed Next.js and reproducible development

Repository evidence at base commit `f04a557`: package.json pins Next.js 16.4.0 and React 19.3.0. It includes Storybook, Vitest browser/Playwright, and MSW dependencies; scripts cover dev/build/start/lint/Storybook, with no application test script or Redis dependency. No GLOSSARY.md or ADR existed during this check. [Scaffold package.json](../../package.json)

The installed guides were read directly, as required by AGENTS.md:

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`: `app/**/route.ts` provides GET/POST handlers; they are uncached by default, with additional Cache Components behaviour described. Authenticated polling must remain request-specific; explicitly use private/no-store response semantics rather than opt into shared caching.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`: Node.js runtime is supported. Use it for the TCP option.
- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`: non-NEXT_PUBLIC variables stay server-side; public-prefixed values are bundled into browser code. Never expose Redis credentials to clients. `.env.local` is ignored in test mode; test configuration needs deliberate defaults.

These installed documents are the version-specific primary evidence and are regenerated by installing the locked dependencies; they are not checked into the research branch.

Recommended setup specification, not implemented here: pin a supported Node version, package lock and Redis image; keep Next/Storybook on the host for normal hot reload, with Docker Compose for Redis (plus SRH only if selected); provide safe local env defaults, health checks, one startup command and an explicit data-reset command. Docker Redis is officially available. [Redis Docker image](https://hub.docker.com/_/redis)

Tests should use real disposable Redis for concurrent joins, join-versus-draw, duplicate draw, roster-version conflict and TTL preservation. Use short TTLs for expiry tests rather than waiting a week. Storybook/MSW covers UI states but cannot establish Redis atomicity. A browser acceptance flow should use separate browser contexts for owner and participants and verify private recipient responses. Hosted smoke tests later need to check TLS/HTTP differences and service quota errors; local success alone cannot prove provider parity. These are test recommendations arising from the failure modes above, not tests run in this investigation.

## Decisions still needed

- Maximum room size and intended simultaneous/aggregate usage; hidden-tab, idle and error polling policies.
- Whether the week starts at creation, draw or last activity; what expiry communicates to users.
- TCP versus REST/SRH, a room storage shape, credentials/participant identity and owner recovery.
- Exact unavailable/limit-hit UX and deployment verification criteria.

The service facts are sufficient to resolve this investigation while leaving those human product/architecture decisions open.
