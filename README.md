# Secret Santa

A private gift exchange for friends and family. This implements room creation, joining from separate browsers, private participant access and code sharing ([#12](https://github.com/james-litch/SecretSanta/issues/12), [#13](https://github.com/james-litch/SecretSanta/issues/13)). Drawing, results, automatic recovery and automatic room polling belong to later slices.

## Local development

Requires Node.js 22.12+ (Node 24 LTS recommended), npm, and Docker Compose. No cloud account or credentials are needed. The UI uses Georgia and Arial from the device, with serif/sans-serif fallback; no font download is required.

```sh
npm ci
cp .env.example .env.local
docker compose up -d --wait
npm run dev
```

Open [the app](http://localhost:3000). Create a room with your name, then refresh, open its address in another tab, or revisit in the same browser. Keep the room address: the room code alone cannot recover identity. Share the room code with someone in a separate browser/profile; they can join with their own name while the owner is offline. Refresh the room page to retrieve the current roster. A repeated join in the same browser returns its existing participant. Other browser profiles cannot read participants until they join.

[Redis Insight](http://localhost:5540) can connect to host `redis`, port `6379`, without credentials inside the Compose network. Both published services bind only to loopback. Redis 7.4.2 Alpine and Redis Insight 2.66.0 are pinned and health checked. Development Redis persists to the `redis-data` volume.

```sh
docker compose ps
docker compose stop                 # stop, retain data
# Start again with docker compose up -d --wait
docker compose down                 # remove containers, retain data
# Destructive local reset: deletes all development rooms
docker compose down --volumes
```

## Configuration

`.env.example` documents `REDIS_URL`, `ROOM_MAX_PARTICIPANTS` (default 30, integer >= 3) and `ROOM_LIFETIME_DAYS` (default 7, positive representable integer). Startup rejects invalid capacity/lifetime. Each room snapshots both settings and its deadline; changing configuration does not alter existing rooms. Production uses `rediss://` with the provisioned provider credentials and Secure cookies. Hosted connectivity and free-tier headroom still require a separate release check.

## Cloud-free verification

The separate test Redis uses loopback port 6380, no persistent volume and no persistence. Tests never flush development Redis. Start it before integration or browser checks:

```sh
docker compose -f compose.test.yaml up -d --wait
npx playwright install chromium
npm run typecheck
npm run lint
npm test
npm run build
npm run build-storybook
docker compose -f compose.test.yaml down
```

Individual suites:

```sh
npm run test:unit         # focused name normalization and startup configuration contracts
npm run test:integration  # public HTTP handlers backed by real disposable Redis
npm run test:storybook    # presentation states, interaction and accessibility checks
npm run test:browser      # real Next.js create/join/revisit and failure journeys
```

Playwright starts its own Next.js server on port 3100 with test Redis, capacity 12 and a one-day lifetime. Its isolated `.next-test` build directory lets it run alongside the normal development server. If using installed Chrome instead of bundled Chromium: `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`.

Integration tests call the public Route Handlers with actual requests and actual Redis. They cover identity isolation, public response projection, hashed storage, same-origin rejection, concurrent creation, payload binding, fixed TTL/configuration, expired/missing reads and recovery without recreation. Joining adds separate-browser access, repeat identity, retry convergence, normalized duplicate-name races and capacity races. Direct Redis inspection is confined to at-rest privacy, TTL/roster-version contracts, and lifecycle fault injection.

Browser tests cover separate-browser joining with an offline owner, repeated joining, preserved input on errors, lost-join-response retry after refresh, validation/focus, creation with skewed browser clocks, creating again after navigating home, refresh, shared tabs, revisit, lost-response recovery, offline/pending submission prevention, invalid access, known expiry offline, copy fallback and FAQ keyboard behavior. UI styles belong to Storybook: light-only appearance, two typography roles, focus styling, regular FAQ question weight and automated accessibility/contrast checks. Run `npm run storybook` to inspect the mobile, pending, validation, owner, unavailable, invalid-access and connection-failure states.

## Storage and operation boundaries

- Each room is one Redis hash, reserved and then created with expiry by small atomic Lua scripts. It owns metadata, participant IDs/display names, credential hashes, normalized-name index, roster version and the create retry record. Missing reads never write.
- POST `/api/rooms` requires an exact same-origin header. `{ phase: "prepare", name }` reserves a candidate with a server-generated 256-bit operation secret and a 15-minute server-owned deadline. The response contains the name and secret but creates no room or identity cookie. A lost preparation response leaves only a reservation that expires automatically; preparing again always issues a different secret.
- The browser saves that operation in tab session storage before submitting `{ name, secret }` to the same endpoint. The server atomically turns an existing reservation into a room, or recovers an existing room. Original requests and retries use identical bodies: no client timestamp or retry flag controls creation. Losing the reservation/room key makes every commit return unavailable, including a delayed duplicate original request. Expired recovery never extends room lifetime.
- Domain-separated SHA-256 derives a stable 96-bit candidate code and private credential from the operation secret. The scripts bind the operation to its normalized name, reject candidate collisions without overwriting, and store only hashes of secrets and credentials. Pending secrets are discarded from both session storage and React state after success, so returning home permits a fresh creation. Abandoning an uncertain attempt explicitly starts a separate operation and may leave the first room to expire. Pending operations from the earlier browser-generated protocol cannot recover through this new protocol; abandon them and start again. Existing room cookies and reads remain valid.
- POST `/api/rooms/:code/join` accepts a name and a browser-generated random 256-bit operation secret. The browser saves the exact operation and room code before sending. One atomic script checks expiry, existing identity, retry binding, waiting state, snapshotted capacity and normalized-name uniqueness before adding membership and advancing the roster version. Hash updates preserve the deadline. Retry records store only hashes, and committed joins can be recovered for 15 minutes even after the room fills or closes joining. Credentials are domain-separated by room and operation. No membership removal or identity switching is exposed.
- An uncertain join locks both inputs and disables creation; **Try again** resends the same operation, including after refreshing the landing page. A definitive rejection allows correction. Success discards the pending secret. Automatic reconciliation is deferred to the response-loss recovery slice. Join responses expose the private room projection and set the room-scoped cookie; no credentials or retry secrets appear in response bodies.
- GET `/api/rooms/:code` requires its room-scoped HttpOnly, SameSite=Lax cookie. The response contains only the current participant’s allowed view. Every handled API outcome is `private, no-store`; secrets are never in URLs or logs. Pages contain a public shell and load membership only through the authenticated endpoint.
- The Node Redis client is reused per server instance, disables offline command queuing, bounds connection retries and command waiting, and sanitizes service failures. A timeout may follow a committed write, so the browser retains the original attempt.

The installed Next.js documentation was consulted for Route Handlers, cookies, instrumentation and runtime configuration. With this version’s Cache Components, Node is the default and explicit route `runtime` exports are unsupported.
