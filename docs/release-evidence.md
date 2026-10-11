# Release evidence — issue #19

Recorded 11 October 2026. Gate: **INCOMPLETE / BLOCKED**.

## Cloud-free verification

Verification base: `4181294a3a4e3875d3115239de7ad85769dd025f` plus the issue #19
smoke/runbook changes. Final commit is available in this file's Git history.

- Runtime: Node v24.21.0.
- Typecheck and lint: PASS.
- Focused real-Redis draw integration: PASS, 7 tests.
- Local smoke including direct Redis expiry/no recreation: PASS, 1 test.
- Smoke transport privacy regression: PASS, 1 test; synthetic authenticated
  GET/POST socket failures do not expose the cookie in the exception or its cause.
- Final `npm test` with bundled Chromium: unit 31/31, integration 30/30,
  Storybook 41/41, browser 54/57. The earlier Chrome run had the same browser
  outcome. Browser prerequisite **FAILS**:
  - `draw.spec.ts`: “separate participants and competing owner tabs see only
    stable private results” — Shift-Tab did not focus Confirm draw.
  - `draw.spec.ts`: “uncertain uncommitted draws retry safely, while definitive
    errors keep their reason” — 30-second timeout, confirmation still visible.
  - `faq.spec.ts`: “native keyboard disclosure keeps focus and skips closed
    answer links” — Tab did not focus the answer link.
- Focused recheck with bundled Chromium and one worker: the same three failures,
  18 passes. Application/browser test code is unchanged by this slice; root causes
  are not established. Do not describe the cloud-free prerequisite as passing.
- Production build: PASS using a fresh `build/issue-19-fresh` output directory.
  The initial sandboxed build could not bind its internal worker port; its cached
  errors also affected the first elevated rerun. A fresh elevated build passed.
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
  This was diagnostic execution with failed cloud-free prerequisites, not sign-off.
- Secure Vercel-to-Redis configuration: NOT VERIFIED. Successful HTTP operations
  exercise deployed script behavior but do not prove TLS or provider identity.
- Fixed stored expiry, natural browser expiry and no recreation: NOT RUN.
- Same-instance connection reuse and interrupted-socket reconnect: NOT RUN.
- Baseline/peak connections, diagnostic connections, operating reserve and
  remaining headroom: NOT MEASURED.
- Memory capacity and rejected connections/writes: NOT MEASURED.
- Vercel baseline/delta invocations, CPU, provisioned memory and transfer:
  NOT MEASURED.
- Hosted keyboard/screen-reader/visual walkthrough: NOT RUN.
- Paid upgrades: NONE performed.

The operator initially had no hosting and subsequently supplied a live URL.
Database/operator access, confirmation of a secure zero-cost Marketplace offer,
and resolution of the browser failures remain concrete blockers.
Local tests cannot fill these fields. Preserve the accepted early-data-loss risk
and no-recreation behavior. Follow [the runbook](hosted-release.md), recording
timestamp, sanitized observation and pass/fail for every item; do not publish
credentials, cookies, operation secrets, raw room hashes or participant data.
