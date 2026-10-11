# Screen-state acceptance coverage

Traceability for the ten scenarios in the
[approved screen-state resolution](https://github.com/james-litch/SecretSanta/issues/8#issuecomment-6068981044).
These existing tests run without cloud credentials via the commands in
[the release runbook](hosted-release.md#cloud-free-prerequisite-checks).
Files below are relative to the repository root. Coverage is split between
public HTTP/Redis behavior, real browser flows and presentation/accessibility;
it is not a claim that each individual test covers an entire scenario.

1. **Complete exchange and return.** `tests/browser/create.spec.ts` — “create,
   refresh, another tab and revisit retain the room owner” and copy fallback;
   `tests/browser/join.spec.ts` — separate browser joins while owner offline;
   `tests/browser/draw.spec.ts` — separate participants and competing owner tabs
   see stable private results. `RoomCodeShareCard.stories.tsx` covers sharing UI.
2. **Owner authority and private valid assignments.**
   `tests/integration/draw.test.ts` — commits one draw with each browser's stable
   recipient; requires same-origin owner access; `tests/unit/draw.test.ts` —
   assignment invariants and reciprocal pairs. The browser draw journey checks
   each participant's visible result; HTTP integration verifies projection.
3. **Validation, capacity and error focus.** `tests/unit/rules.test.ts` covers
   Unicode/name/configuration contracts; `tests/integration/join.test.ts` covers
   normalization, duplicate/capacity races and invalid operations;
   `tests/integration/draw.test.ts` covers insufficient membership.
   `app/(home)/page.stories.tsx` (`Validation`, `JoinValidation`, `DuplicateName`)
   checks field association/focus; `tests/browser/join.spec.ts` checks preserved
   input and correction after errors.
4. **Confirmation, repeated submissions and races.** `tests/browser/draw.spec.ts`
   covers cancellation and competing owner tabs; `tests/browser/polling.spec.ts`
   covers confirmation during a slow read and pending submission prevention;
   `tests/integration/draw.test.ts` covers concurrent draws, joins on either side
   of draw commit, and rejection after closing joining.
5. **Lost responses and safe recovery.** `tests/browser/create.spec.ts`,
   `join.spec.ts`, `draw.spec.ts` and `recovery.spec.ts` drop responses and recover
   operations, including joins after full/drawn states. Integration `rooms`,
   `join` and `draw` suites cover payload binding, expired/in-transit recovery,
   no duplication, no deadline extension and one saved draw.
6. **Browser access loss, unavailable and offline expiry.**
   `tests/browser/unavailable.spec.ts` covers waiting/drawn access loss, other
   browsers, unaffected participants after owner loss, early Redis loss,
   offline deadlines and FAQ routes. `tests/browser/create.spec.ts` covers same
   browser/tabs/revisit. Integration `rooms.test.ts` verifies missing/expired
   equivalence, credential isolation and no recreation after early data loss.
7. **Connection and polling states.** `tests/browser/polling.spec.ts` covers
   cadence, capped backoff/reset, stale content, hidden/offline pauses, immediate
   return without overlap and terminal/navigation stops. `create.spec.ts` and
   `recovery.spec.ts` cover offline/pending prevention and retained attempts.
   Room stories include `Reconnecting`, `Offline`, `LoadedConnectionFailure`
   and `UncertainDraw`.
8. **Keyboard, focus and announcements.** `tests/browser/draw.spec.ts` covers
   modal Tab/Shift-Tab, Escape/cancellation, trigger restoration and result
   focus. `create.spec.ts` checks copy/FAQ keyboard behavior;
   `polling.spec.ts` checks non-repeating announcements and retained focus;
   `unavailable.spec.ts` checks terminal focus. Landing, room, FormField, Button,
   Disclosure and Modal stories provide interaction and automated a11y checks.
   Automated checks do not replace the hosted keyboard/screen-reader walkthrough.
9. **FAQ links, content and motion.** `tests/browser/faq.spec.ts` covers all ten
   direct anchors, header links, native Enter/Space and tab order, smooth CSS
   enhancement, reduced motion and no-animation fallback. `app/faq/page.stories.tsx`
   and `components/Disclosure/Disclosure.stories.tsx` cover light appearance,
   typography (including regular question weights), focus and a11y.
10. **Configured lifetime wording and fixed expiry.**
    `tests/browser/unavailable.spec.ts` covers waiting/drawn singular and plural
    lifetime copy. `tests/integration/rooms.test.ts` — “snapshots lifetime and
    capacity across later configuration, joins, drawing, recovery and revisits” —
    verifies old rooms preserve settings/deadline. Integration draw/join checks
    additionally ensure mutations and retries cannot extend expiry.

The new `tests/smoke/exchange.spec.ts` adds deployment-boundary HTTP checks using
isolated identities, actual scripts, cookie flags, response privacy, one saved
draw and Redis expiry/no recreation. Its local mode validates the smoke harness;
only running it against Vercel and Redis Cloud supplies hosted evidence.
