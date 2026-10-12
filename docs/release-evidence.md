# Release evidence — issue #19

Recorded 11 October 2026. Gate: **INCOMPLETE / BLOCKED**.

## Cloud-free verification

Verification base: `91b5f2c` plus the browser-test/dialog fixes. Final commit is
available in this file's Git history. Hosted HTTP observations below precede
these fixes and are not evidence that the latest commit has been deployed.

- Runtime: Node v24.21.0.
- Typecheck and lint: PASS.
- Focused real-Redis draw integration: PASS, 7 tests.
- Local smoke including direct Redis expiry/no recreation: PASS, 1 test.
- Smoke transport privacy regression: PASS, 1 test; synthetic authenticated
  GET/POST socket failures do not expose the cookie in the exception or its cause.
- Final `npm test` with bundled Chromium: **PASS**, unit 31/31, integration 30/30,
  Storybook 42/42, browser 57/57 (160 total).
- The three initial browser failures are resolved:
  - Native Chromium dialogs allow boundary Tab navigation into browser chrome.
    The test now verifies forward/backward order within the dialog and that
    background controls cannot receive focus, rather than assuming immediate wrap.
  - Drawing synchronously disabled Confirm draw before its native close command
    ran. The handler now closes the dialog before starting the request. Browser
    assertions and the new `DrawRejected` story cover dismissal and reopening.
  - The FAQ keyboard test pressed Tab while the answer was still clipped to zero
    height. It now waits for actual opening/closing transitions to finish.
- Focused draw/FAQ run: PASS, 21/21. Room stories: PASS, 13/13. A separate FAQ
  privacy-anchor viewport assertion failed once during diagnosis, then passed
  five isolated repetitions and the subsequent focused and full runs; no anchor
  implementation change was made.
- Production build: PASS using a fresh `build/issue-19-fixed` output directory.
- Storybook build: PASS.
- Formatting and two-axis code review: PASS. Standards review found and then
  verified the fix for HTTP exception credential logging; no remaining Standards
  or Spec findings. The release blockers below remain unresolved.

## Upstash migration — 11–12 October 2026

- Operator authorized Upstash and confirmed only test rooms exist: start fresh.
- Target: Upstash Redis Free through Vercel Marketplace, native TCP with TLS.
- Existing Node Redis client, room hashes and atomic scripts are retained.
- Local HTTP smoke including expiry/no recreation: PASS, 1 test (4.7 seconds).
  Standards and Spec reviews: no findings. No application code changed.
- Database `secret-santa-upstash`: created through Vercel Marketplace; Free,
  500,000 monthly commands, primary `iad1`, no read regions, eviction disabled.
  These settings were observed in the provisioning confirmation.
- Production and Preview: Upstash now supplies integration-managed `REDIS_URL`.
  Its copied TCP connection URL was verified to use `rediss://` without printing
  credentials. Old Redis Cloud connection retained as `OLD_REDIS_URL`; no data
  was deleted or copied.
- Production redeployment `GbTQ5WZxdrxH8Q7eFsjCCffCgSqd`: READY at
  23:13:55 Europe/London on 11 October 2026, same source
  `4181294a3a4e3875d3115239de7ad85769dd025f` with updated project settings.
  Local issue #19 fixes remain unpushed and are not part of this deployment.
- Full hosted smoke against Upstash: PASS on 12 October 2026, 1 test, 6.1 seconds.
  Verified create/join/recovery, authorization, private identities/responses,
  competing draws, unique non-self recipients, stable revisits, TLS diagnostics,
  physical expiry and no recreation after expiry. The direct connection found
  the exact stored deadline for the room created through the production API.
- Initial strict physical-expiry checks failed: first a 2 ms offset, then 13 ms
  movement during an exchange. Disposable probes reproduced small expiry shifts
  on hash writes (up to 121 ms across ten writes); reapplying PEXPIREAT still
  showed -19 to +22 ms offsets. Application `expiresAt` remained exact.
- Operator accepted up to one second of physical expiry variance on 12 October.
  The smoke checks physical expiry against the original application deadline
  before and after activity, and checks stored `expiresAt` exactly. Local Redis
  retains zero tolerance. This is evidence for the tested three-participant
  exchange, not a provider-wide bound or a full-capacity load test.
- Latest local regression: all 160 tests PASS; typecheck and lint PASS.
  Final local smoke PASS (4.4 seconds). Standards review: no findings; Spec
  review caught and corrected natural-expiry instructions to allow physical
  cleanup until deadline + 1 second while requiring exact HTTP access cutoff.
- Natural expiry/access-cutoff observation, warm-instance reuse/reconnect,
  full-capacity expiry variance, and storage/bandwidth/connection headroom:
  NOT VERIFIED. These keep the broader issue #19 release gate incomplete.
- Previous hosted results below describe the earlier deployment, not Upstash.
  The earlier 30 MB plan confirmation does not establish any Upstash limit.

## Previous hosted verification (before Upstash)

- Deployment URL: https://secret-santa-pink-psi.vercel.app/ (operator supplied).
  Deployment ID, SHA and Vercel function region: NOT VERIFIED. The response's
  Vercel edge identifier is not proof of the function or Redis region.
- Vercel account plan and remaining usage: NOT VERIFIED (target Hobby).
- Official Marketplace subscription/database and Redis region: NOT VERIFIED.
- Redis plan and provisioned memory: **Free — 30 MB**, confirmed by the operator
  on 11 October 2026; not independently inspected in the provider console.
- TLS support, actual connection limit and eviction policy: NOT VERIFIED
  (subsequently resolved by selecting Upstash; old endpoint still unverified).
- Hosted HTTP-only smoke: PASS on 11 October 2026, around 18:04 Europe/London,
  one test, 6.3 seconds. Command:
  `SMOKE_HTTP_ONLY=1 SMOKE_ORIGIN=https://secret-santa-pink-psi.vercel.app npm run test:smoke`.
  Verified create/join/draw/recovery behavior through the real deployment,
  separate private identities, stable recipients and original HTTP deadline,
  authorization, response projection/cache headers and Secure cookie flags.
  At that time cloud-free prerequisites still failed; the browser fixes above
  have since passed locally. This HTTP-only result is not release sign-off.
- Secure Vercel-to-Redis configuration: NOT VERIFIED. Successful HTTP operations
  exercise deployed script behavior but do not prove TLS or provider identity.
- Fixed stored expiry, natural browser expiry and no recreation: NOT RUN.
- Same-instance connection reuse and interrupted-socket reconnect: NOT RUN.
- Baseline/peak connections, diagnostic connections, operating reserve and
  remaining headroom: NOT MEASURED.
- Used/remaining memory within the 30 MB plan and rejected connections/writes:
  NOT MEASURED.
- Vercel baseline/delta invocations, CPU, provisioned memory and transfer:
  NOT MEASURED.
- Hosted keyboard/screen-reader/visual walkthrough: WAIVED by the operator on
  11 October 2026; no longer a release requirement. Automated local coverage
  remains required.
- Paid upgrades: NONE performed.

The operator initially had no hosting and subsequently supplied a live URL.
Upstash is provisioned, environment bindings are updated, and production was
redeployed successfully. The full automated hosted smoke passes; the remaining
release observations listed above are still pending.
Local tests cannot fill these fields. Preserve the accepted early-data-loss risk
and no-recreation behavior. Follow [the runbook](hosted-release.md), recording
timestamp, sanitized observation and pass/fail for every item; do not publish
credentials, cookies, operation secrets, raw room hashes or participant data.
