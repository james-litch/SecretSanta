import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import type { PendingCreate } from '../../lib/rooms/types';
import { createClient } from 'redis';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/rooms/route';
import { GET } from '../../app/api/rooms/[code]/route';
import { POST as join } from '../../app/api/rooms/[code]/join/route';
import { POST as draw } from '../../app/api/rooms/[code]/draw/route';

process.env.REDIS_URL = 'redis://127.0.0.1:6380';
const redis = createClient({ url: process.env.REDIS_URL });
const origin = 'http://localhost:3000';
async function pending(name = 'Élodie 🎁'): Promise<PendingCreate> {
  const response = await create({ phase: 'prepare', name });
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('set-cookie')).toBeNull();
  return response.json();
}
const keyFor = (operation: PendingCreate) =>
  `room:${createHash('sha256').update(`room:${operation.secret}`).digest('hex').slice(0, 24).toUpperCase()}`;
function create(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest(`${origin}/api/rooms`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );
}
function read(code: string, cookie = '') {
  return GET(
    new NextRequest(`${origin}/api/rooms/${code}`, { headers: { cookie } }),
    { params: Promise.resolve({ code }) },
  );
}
const cookieFrom = (response: Response) =>
  response.headers.get('set-cookie')!.split(';')[0];
beforeAll(async () => {
  await redis.connect();
});
afterAll(async () => {
  await redis.quit();
});

describe('public room operations with real Redis', () => {
  it('creates an owner, authenticates reads and returns only the private projection', async () => {
    const response = await create(await pending());
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(response.headers.get('set-cookie')).toMatch(/SameSite=Lax/i);
    const room = await response.json();
    expect(room).toMatchObject({
      state: 'waiting',
      capacity: 30,
      lifetimeDays: 7,
      isOwner: true,
      participants: [{ name: 'Élodie 🎁', id: room.currentParticipantId }],
    });
    expect(Object.keys(room).sort()).toEqual(
      [
        'capacity',
        'code',
        'currentParticipantId',
        'expiresAt',
        'isOwner',
        'lifetimeDays',
        'ownerId',
        'participants',
        'state',
      ].sort(),
    );
    expect(await (await read(room.code, cookieFrom(response))).json()).toEqual(
      room,
    );
    for (const cookie of ['', 'room_access=wrong']) {
      const denied = await read(room.code, cookie);
      expect(denied.status).toBe(401);
      expect(await denied.json()).toMatchObject({ error: 'invalid_identity' });
      expect(denied.headers.get('cache-control')).toBe('private, no-store');
    }
  });
});

it('concurrent attempts converge; recovery preserves payload, capacity and original expiry', async () => {
  const operation = await pending(' James ');
  const responses = await Promise.all([create(operation), create(operation)]);
  const rooms = await Promise.all(responses.map((r) => r.json()));
  expect(rooms[0]).toEqual(rooms[1]);
  const key = `room:${rooms[0].code}`;
  const originalDeadline = await redis.pExpireTime(key);
  expect(originalDeadline).toBe(rooms[0].expiresAt);
  process.env.ROOM_MAX_PARTICIPANTS = '12';
  process.env.ROOM_LIFETIME_DAYS = '1';
  try {
    const recovered = await create({ ...operation, retry: true });
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toEqual(rooms[0]);
    expect(await redis.pExpireTime(key)).toBe(originalDeadline);
    expect(
      (await create({ ...operation, name: 'Other', retry: true })).status,
    ).toBe(409);
  } finally {
    delete process.env.ROOM_MAX_PARTICIPANTS;
    delete process.env.ROOM_LIFETIME_DAYS;
  }
});

it('isolates credentials between rooms and never stores raw credentials or operation secrets', async () => {
  const operation = await pending();
  const first = await create(operation);
  const second = await create(await pending('Sam'));
  const room = await first.json();
  expect((await read(room.code, cookieFrom(second))).status).toBe(401);
  // Storage inspection is limited to the explicit at-rest privacy contract.
  const stored = JSON.stringify(await redis.hGetAll(`room:${room.code}`));
  expect(stored).not.toContain(operation.secret);
  expect(stored).not.toContain(cookieFrom(first).split('=')[1]);
});

it('rejects missing/cross-site origins and invalid input before creating', async () => {
  for (const origin of ['', 'https://elsewhere.example', 'null']) {
    const response = await create(await pending(), { origin });
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  }
  expect(
    (await create(await pending(), { 'sec-fetch-site': 'cross-site' })).status,
  ).toBe(403);
  const invalid = await create({ phase: 'prepare', name: 'A\nB' });
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toMatchObject({
    error: 'invalid_name',
    field: 'name',
  });
});

it('missing/expired rooms are equivalent and reads/recovery never recreate lost data', async () => {
  const operation = await pending();
  const created = await create(operation);
  const room = await created.json();
  await redis.pExpire(`room:${room.code}`, 1);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const expired = await read(room.code, cookieFrom(created));
  expect(expired.status).toBe(404);
  expect(await expired.json()).toEqual(
    await (await read('0'.repeat(24))).json(),
  );
  expect((await create({ ...operation, retry: true })).status).toBe(404);
  expect(await redis.exists(`room:${room.code}`)).toBe(0);
});

it('replaying the original create request cannot resurrect a room after early data loss', async () => {
  const operation = await pending();
  const created = await create(operation);
  expect(created.status).toBe(201);
  const room = await created.json();
  await redis.del(`room:${room.code}`);
  const replay = await create(operation);
  expect(replay.status).toBe(404);
  expect(await redis.exists(`room:${room.code}`)).toBe(0);
});

it('cannot create from a lost or expired reservation, even on the first submission', async () => {
  const preparedAt = Date.now();
  const operation = await pending();
  const key = keyFor(operation);
  const deadline = await redis.pExpireTime(key);
  expect(deadline).toBeGreaterThanOrEqual(preparedAt + 900_000);
  expect(deadline).toBeLessThanOrEqual(Date.now() + 900_000);
  expect((await read(key.slice('room:'.length))).status).toBe(404);
  const stored = JSON.stringify(await redis.hGetAll(key));
  expect(stored).not.toContain(operation.secret);
  expect(stored).not.toContain(operation.name);
  await redis.pExpire(key, 1);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect((await create(operation)).status).toBe(404);
  expect(await redis.exists(key)).toBe(0);
});

it('binds reservations to their original name before the room is created', async () => {
  const operation = await pending('James');
  expect((await create({ ...operation, name: 'Sam' })).status).toBe(409);
  expect((await create(operation)).status).toBe(201);
});

it('expired recovery cannot extend a live room or its operation window', async () => {
  const operation = await pending();
  const created = await create(operation);
  const room = await created.json();
  const key = keyFor(operation);
  const deadline = await redis.pExpireTime(key);
  await redis.hSet(key, 'operationExpiresAt', '1');
  expect((await create(operation)).status).toBe(400);
  expect(await redis.pExpireTime(key)).toBe(deadline);
  expect(await (await read(room.code, cookieFrom(created))).json()).toEqual(
    room,
  );
});

it('rejects recovery when its operation expires while Redis delays the request', async () => {
  const operation = await pending();
  const created = await create(operation);
  const room = await created.json();
  await redis.hSet(
    keyFor(operation),
    'operationExpiresAt',
    String(Date.now() + 150),
  );
  await redis.sendCommand(['CLIENT', 'PAUSE', '300', 'WRITE']);
  const response = await create(operation);
  expect(await response.json()).toMatchObject({ error: 'invalid_operation' });
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(await (await read(room.code, cookieFrom(created))).json()).toEqual(
    room,
  );
});

it('rejects an unreserved secret regardless of caller timestamps or retry flags', async () => {
  const operation = { name: 'James', secret: randomBytes(32).toString('hex') };
  for (const retry of [false, true]) {
    expect(
      (await create({ ...operation, retry, startedAt: Date.now() })).status,
    ).toBe(404);
  }
  expect(await redis.exists(keyFor(operation))).toBe(0);
});

it('preparation rejects cross-site requests and never reuses caller-supplied secrets', async () => {
  expect(
    (
      await create(
        { phase: 'prepare', name: 'James' },
        { origin: 'https://elsewhere.example' },
      )
    ).status,
  ).toBe(403);
  const operation = await pending('James');
  const first = await create(operation);
  expect(first.status).toBe(201);
  await redis.del(keyFor(operation));
  const prepared = await create({ ...operation, phase: 'prepare' });
  const nextOperation = await prepared.json();
  expect(nextOperation.secret === operation.secret).toBe(false);
  expect((await create(operation)).status).toBe(404);
  const nextRoom = await create(nextOperation);
  expect(nextRoom.status).toBe(201);
  expect((await nextRoom.json()).code).not.toBe((await first.json()).code);
});

it('retries an uncommitted reservation without requiring another preparation', async () => {
  const operation = await pending();
  const response = await create({ ...operation, retry: true });
  expect(response.status).toBe(201);
  const room = await response.json();
  const recovered = await create(operation);
  expect(recovered.status).toBe(200);
  expect(await recovered.json()).toEqual(room);
});

it('snapshots lifetime and capacity across later configuration, joins, drawing, recovery and revisits', async () => {
  process.env.ROOM_MAX_PARTICIPANTS = '3';
  process.env.ROOM_LIFETIME_DAYS = '2';
  try {
    const operation = await pending('Owner');
    const response = await create(operation);
    const original = await response.json();
    expect(original).toMatchObject({ capacity: 3, lifetimeDays: 2 });
    const cookie = cookieFrom(response);
    const context = { params: Promise.resolve({ code: original.code }) };
    const joining = (name: string) =>
      join(
        new NextRequest(`${origin}/api/rooms/${original.code}/join`, {
          method: 'POST',
          headers: { origin, 'content-type': 'application/json' },
          body: JSON.stringify({
            name,
            secret: randomBytes(32).toString('hex'),
          }),
        }),
        context,
      );
    process.env.ROOM_MAX_PARTICIPANTS = '10';
    process.env.ROOM_LIFETIME_DAYS = '1';
    const snapshot = {
      expiresAt: original.expiresAt,
      capacity: 3,
      lifetimeDays: 2,
    };
    for (const name of ['Sam', 'Alex']) {
      const joined = await joining(name);
      expect(await joined.json()).toMatchObject(snapshot);
      expect(joined.headers.get('set-cookie')).toContain(
        new Date(original.expiresAt).toUTCString(),
      );
    }
    expect(await (await joining('Too many')).json()).toMatchObject({
      error: 'room_full',
    });
    const drawn = await draw(
      new NextRequest(`${origin}/api/rooms/${original.code}/draw`, {
        method: 'POST',
        headers: { origin, cookie },
      }),
      context,
    );
    expect(await drawn.json()).toMatchObject({ ...snapshot, state: 'drawn' });
    const recovered = await create(operation);
    expect(await recovered.json()).toMatchObject({
      ...snapshot,
      state: 'drawn',
    });
    expect(recovered.headers.get('set-cookie')).toContain(
      new Date(original.expiresAt).toUTCString(),
    );
    expect(await (await read(original.code, cookie)).json()).toMatchObject({
      ...snapshot,
      state: 'drawn',
    });
    const next = await create(await pending('New owner'));
    expect(await next.json()).toMatchObject({ capacity: 10, lifetimeDays: 1 });
  } finally {
    delete process.env.ROOM_MAX_PARTICIPANTS;
    delete process.env.ROOM_LIFETIME_DAYS;
  }
});
