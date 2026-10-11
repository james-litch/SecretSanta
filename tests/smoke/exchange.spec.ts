import { randomBytes } from 'node:crypto';
import { createClient } from 'redis';
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from '@playwright/test';
import type { RoomView } from '../../lib/rooms/types';
import { privateClient, type PrivateClient } from './private-client';

// All identities and operation secrets remain in memory; do not attach bodies,
// traces, storageState or cookies to the report, including when an assertion fails.
async function responseJson(response: APIResponse, status: number) {
  expect(response.status()).toBe(status);
  expect(response.headers()['cache-control']).toBe('private, no-store');
  expect(response.headers()['vary'].toLowerCase()).toContain('cookie');
  expect(response.headers()['x-vercel-cache']).not.toBe('HIT');
  try {
    return await response.json();
  } catch {
    throw new Error('Smoke response was not JSON; body withheld.');
  }
}

function projection(room: RoomView, drawn: boolean) {
  const fields = [
    'code',
    'state',
    'expiresAt',
    'capacity',
    'lifetimeDays',
    'ownerId',
    'currentParticipantId',
    'isOwner',
    'participants',
  ];
  if (drawn) fields.push('recipient');
  expect(
    JSON.stringify(Object.keys(room).sort()) === JSON.stringify(fields.sort()),
  ).toBe(true);
  expect(room.state).toBe(drawn ? 'drawn' : 'waiting');
  for (const participant of [
    ...room.participants,
    ...(room.recipient ? [room.recipient] : []),
  ]) {
    expect(
      JSON.stringify(Object.keys(participant).sort()) ===
        JSON.stringify(['id', 'name']),
    ).toBe(true);
  }
}

async function identity(
  client: PrivateClient,
  room: RoomView,
  secure: boolean,
) {
  const cookies = (await client.storageState()).cookies;
  const cookie = cookies.find((item) => item.name === 'room_access');
  expect(Boolean(cookie)).toBe(true);
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.secure).toBe(secure);
  expect(cookie!.sameSite).toBe('Lax');
  expect(cookie!.path === `/api/rooms/${room.code}`).toBe(true);
  expect(Math.abs(cookie!.expires * 1000 - room.expiresAt)).toBeLessThan(1000);
}

test('disposable exchange preserves private identities, one saved draw and its original deadline', async ({
  playwright,
  baseURL,
}) => {
  const clients: APIRequestContext[] = [];
  const redis =
    process.env.SMOKE_HTTP_ONLY === '1'
      ? null
      : createClient({
          url:
            process.env.SMOKE_LOCAL === '1'
              ? 'redis://127.0.0.1:6380'
              : process.env.SMOKE_REDIS_URL,
          socket: { connectTimeout: 5000, reconnectStrategy: false },
          disableOfflineQueue: true,
        });
  redis?.on('error', () => {});
  async function browser() {
    const client = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { origin: baseURL! },
      timeout: 15_000,
      maxRedirects: 0,
    });
    clients.push(client);
    return privateClient(client);
  }
  try {
    await redis?.connect().catch(() => {
      throw new Error(
        'Smoke Redis connection failed; check secure endpoint and access.',
      );
    });
    const diagnostics = redis?.withCommandOptions({
      abortSignal: AbortSignal.timeout(60_000),
    });
    const owner = await browser();
    const outsider = await browser();
    const preparation = await owner.post('/api/rooms', {
      data: { phase: 'prepare', name: 'Smoke owner' },
    });
    const operation = await responseJson(preparation, 201);
    expect(Boolean(preparation.headers()['set-cookie'])).toBe(false);
    const created = await owner.post('/api/rooms', { data: operation });
    const room: RoomView = await responseJson(created, 201);
    projection(room, false);
    expect(room.participants.length).toBe(1);
    expect(room.isOwner).toBe(true);
    expect(room.expiresAt).toBeGreaterThan(Date.now());
    await identity(owner, room, baseURL!.startsWith('https:'));
    const path = `/api/rooms/${room.code}`;
    const key = `room:${room.code}`;
    // Confirms diagnostics target the same database before touching this new room.
    if (diagnostics)
      expect(await diagnostics.pExpireTime(key)).toBe(room.expiresAt);

    const denied = await responseJson(await outsider.get(path), 401);
    expect(
      JSON.stringify(Object.keys(denied).sort()) ===
        JSON.stringify(['error', 'message']),
    ).toBe(true);
    expect(denied.error).toBe('invalid_identity');
    for (const endpoint of ['/api/rooms', `${path}/join`, `${path}/draw`]) {
      const rejected = await responseJson(
        await owner.post(endpoint, {
          headers: { origin: 'https://elsewhere.example' },
          data: operation,
        }),
        403,
      );
      expect(rejected.error).toBe('invalid_origin');
    }

    // Discarded cookie jar models a committed create whose response/cookie was lost.
    const recoveredOwner = await browser();
    const recovered: RoomView = await responseJson(
      await recoveredOwner.post('/api/rooms', { data: operation }),
      200,
    );
    expect(JSON.stringify(recovered) === JSON.stringify(room)).toBe(true);
    await identity(recoveredOwner, room, baseURL!.startsWith('https:'));
    const guests: PrivateClient[] = [];
    const joins = [];
    for (const name of ['Smoke Sam', 'Smoke Alex']) {
      const guest = await browser();
      const join = { name, secret: randomBytes(32).toString('hex') };
      const joined: RoomView = await responseJson(
        await guest.post(`${path}/join`, { data: join }),
        201,
      );
      projection(joined, false);
      expect(joined.expiresAt === room.expiresAt).toBe(true);
      await identity(guest, room, baseURL!.startsWith('https:'));
      guests.push(guest);
      joins.push(join);
    }
    expect(
      (await responseJson(await guests[0].post(`${path}/draw`), 403)).error,
    ).toBe('owner_only');
    const draws = await Promise.all([
      owner.post(`${path}/draw`),
      recoveredOwner.post(`${path}/draw`),
    ]);
    const saved: RoomView = await responseJson(draws[0], 200);
    expect(
      JSON.stringify(await responseJson(draws[1], 200)) ===
        JSON.stringify(saved),
    ).toBe(true);
    const views: RoomView[] = [];
    for (const client of [owner, ...guests]) {
      const view: RoomView = await responseJson(await client.get(path), 200);
      projection(view, true);
      expect(view.participants.length).toBe(3);
      expect(view.expiresAt === room.expiresAt).toBe(true);
      expect(view.recipient!.id !== view.currentParticipantId).toBe(true);
      expect(
        view.participants.some(
          (p) => p.id === view.recipient!.id && p.name === view.recipient!.name,
        ),
      ).toBe(true);
      expect(
        JSON.stringify(await responseJson(await client.get(path), 200)) ===
          JSON.stringify(view),
      ).toBe(true);
      views.push(view);
    }
    expect(new Set(views.map((view) => view.recipient!.id)).size).toBe(3);
    expect(
      JSON.stringify(
        await responseJson(await owner.post(`${path}/draw`), 200),
      ) === JSON.stringify(saved),
    ).toBe(true);
    const recoveredGuest = await browser();
    expect(
      JSON.stringify(
        await responseJson(
          await recoveredGuest.post(`${path}/join`, { data: joins[0] }),
          200,
        ),
      ) === JSON.stringify(views[1]),
    ).toBe(true);
    const late = await responseJson(
      await outsider.post(`${path}/join`, {
        data: { name: 'Late', secret: randomBytes(32).toString('hex') },
      }),
      409,
    );
    expect(late.error).toBe('joining_closed');
    const noAccess = await responseJson(await outsider.get(path), 401);
    expect(noAccess.error).toBe('invalid_identity');
    expect(
      JSON.stringify(Object.keys(noAccess).sort()) ===
        JSON.stringify(['error', 'message']),
    ).toBe(true);
    if (!diagnostics) {
      test.info().annotations.push({
        type: 'incomplete',
        description:
          'HTTP only: Redis expiry and no-recreation diagnostics NOT RUN.',
      });
      console.warn(
        'HTTP ONLY: Redis expiry and no-recreation diagnostics NOT RUN. Release gate remains incomplete.',
      );
      return;
    }
    expect(await diagnostics.pExpireTime(key)).toBe(room.expiresAt);
    // Accelerated physical expiry, only for the room created above. Natural
    // deadline/browser expiry and warm-instance reconnect remain runbook checks.
    await diagnostics.pExpire(key, 1);
    await expect.poll(() => diagnostics.exists(key)).toBe(0);
    for (const client of [owner, ...guests]) {
      expect((await responseJson(await client.get(path), 404)).error).toBe(
        'unavailable',
      );
    }
    expect(
      (
        await responseJson(
          await owner.post('/api/rooms', { data: operation }),
          404,
        )
      ).error,
    ).toBe('unavailable');
    expect(
      (
        await responseJson(
          await recoveredGuest.post(`${path}/join`, { data: joins[0] }),
          404,
        )
      ).error,
    ).toBe('unavailable');
    expect(
      (await responseJson(await owner.post(`${path}/draw`), 404)).error,
    ).toBe('unavailable');
    expect(await diagnostics.exists(key)).toBe(0);
  } finally {
    if (redis?.isOpen) redis.destroy();
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
