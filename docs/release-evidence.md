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

## Hosted verification

- Deployment URL: https://secret-santa-pink-psi.vercel.app/ (operator supplied).
  Deployment ID, SHA and Vercel function region: NOT VERIFIED. The response's
  Vercel edge identifier is not proof of the function or Redis region.
- Vercel account plan and remaining usage: NOT VERIFIED (target Hobby).
- Official Marketplace subscription/database and Redis region: NOT VERIFIED.
- Actual Redis plan, TLS support, memory/connection limits, eviction policy:
  NOT VERIFIED (target Free; TLS documentation conflict recorded in runbook).
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
- Memory capacity and rejected connections/writes: NOT MEASURED.
- Vercel baseline/delta invocations, CPU, provisioned memory and transfer:
  NOT MEASURED.
- Hosted keyboard/screen-reader/visual walkthrough: WAIVED by the operator on
  11 October 2026; no longer a release requirement. Automated local coverage
  remains required.
- Paid upgrades: NONE performed.

The operator initially had no hosting and subsequently supplied a live URL.
Database/operator access and confirmation of a secure zero-cost Marketplace offer
remain concrete blockers.
Local tests cannot fill these fields. Preserve the accepted early-data-loss risk
and no-recreation behavior. Follow [the runbook](hosted-release.md), recording
timestamp, sanitized observation and pass/fail for every item; do not publish
credentials, cookies, operation secrets, raw room hashes or participant data.
