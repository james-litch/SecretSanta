import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createClient } from 'redis';
import { NextRequest } from 'next/server';
import { POST as create } from '../../app/api/rooms/route';
import { POST as join } from '../../app/api/rooms/[code]/join/route';
import { POST as draw } from '../../app/api/rooms/[code]/draw/route';
import { GET as read } from '../../app/api/rooms/[code]/route';

process.env.REDIS_URL = 'redis://127.0.0.1:6380';
const redis = createClient({ url: process.env.REDIS_URL });
const origin = 'http://localhost:3000';
const secret = () => randomBytes(32).toString('hex');
const cookie = (response: Response) =>
  response.headers.get('set-cookie')!.split(';')[0];
function request(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`${origin}${path}`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
async function room() {
  const prepared = await create(
    request('/api/rooms', { phase: 'prepare', name: 'Owner' }),
  );
  const response = await create(request('/api/rooms', await prepared.json()));
  return { view: await response.json(), cookie: cookie(response) };
}
function joining(
  code: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return join(request(`/api/rooms/${code}/join`, body, headers), {
    params: Promise.resolve({ code }),
  });
}
function reading(code: string, credential = '') {
  return read(
    new NextRequest(`${origin}/api/rooms/${code}`, {
      headers: { cookie: credential },
    }),
    { params: Promise.resolve({ code }) },
  );
}
beforeAll(async () => {
  await redis.connect();
});
afterAll(async () => {
  await redis.quit();
});

it('joins from a separate browser and exposes the roster only with private access', async () => {
  const owner = await room();
  const operation = { name: '  E\u0301lodie 🎁  ', secret: secret() };
  const response = await joining(owner.view.code, operation);
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  const participant = await response.json();
  expect(participant).toMatchObject({
    isOwner: false,
    ownerId: owner.view.ownerId,
    participants: [{ name: 'Owner' }, { name: 'Élodie 🎁' }],
  });
  expect(Object.keys(participant).sort()).toEqual(
    Object.keys(owner.view).sort(),
  );
  expect(
    await (await reading(owner.view.code, cookie(response))).json(),
  ).toEqual(participant);
  expect((await reading(owner.view.code)).status).toBe(401);
  expect(
    (await (await reading(owner.view.code, owner.cookie)).json()).participants,
  ).toEqual(participant.participants);
  const stored = JSON.stringify(await redis.hGetAll(`room:${owner.view.code}`));
  expect(stored).not.toContain(operation.secret);
  expect(stored).not.toContain(cookie(response).split('=')[1]);
  expect(await redis.pExpireTime(`room:${owner.view.code}`)).toBe(
    owner.view.expiresAt,
  );
});

it('returns the existing participant without changing their credential or name', async () => {
  const owner = await room();
  const first = await joining(owner.view.code, {
    name: 'Sam',
    secret: secret(),
  });
  const view = await first.json();
  for (const [access, id] of [
    [cookie(first), view.currentParticipantId],
    [owner.cookie, owner.view.currentParticipantId],
  ]) {
    const repeated = await joining(
      owner.view.code,
      { name: 'Different', secret: secret() },
      { cookie: access },
    );
    expect(repeated.status).toBe(200);
    expect(cookie(repeated)).toBe(access);
    expect(await repeated.json()).toMatchObject({
      currentParticipantId: id,
      participants: view.participants,
    });
  }
});

it('concurrent retries converge and retain payload binding and the original deadline', async () => {
  const owner = await room();
  const operation = { name: 'Sam', secret: secret() };
  const responses = await Promise.all([
    joining(owner.view.code, operation),
    joining(owner.view.code, operation),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
  expect(cookie(responses[0])).toBe(cookie(responses[1]));
  expect(await responses[0].json()).toEqual(await responses[1].json());
  const changed = await joining(owner.view.code, {
    ...operation,
    name: 'Taylor',
  });
  expect(await changed.json()).toMatchObject({ error: 'operation_conflict' });
  expect(await redis.pExpireTime(`room:${owner.view.code}`)).toBe(
    owner.view.expiresAt,
  );
  expect(await redis.hGet(`room:${owner.view.code}`, 'rosterVersion')).toBe(
    '2',
  );
});

it('normalizes duplicate names atomically across browsers without reclaiming identity', async () => {
  const owner = await room();
  const responses = await Promise.all(
    [' Élodie ', 'E\u0301LODIE'].map((name) =>
      joining(owner.view.code, { name, secret: secret() }),
    ),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  const denied = responses.find((r) => r.status === 409)!;
  expect(await denied.json()).toMatchObject({ error: 'duplicate_name' });
  expect(denied.headers.get('set-cookie')).toBeNull();
  expect(
    (await (await reading(owner.view.code, owner.cookie)).json()).participants,
  ).toHaveLength(2);
});

it('enforces snapshotted capacity under races and recovers a committed join after filling', async () => {
  process.env.ROOM_MAX_PARTICIPANTS = '3';
  let owner;
  try {
    owner = await room();
  } finally {
    delete process.env.ROOM_MAX_PARTICIPANTS;
  }
  const operation = { name: 'Sam', secret: secret() };
  const first = await joining(owner.view.code, operation);
  const view = await first.json();
  const responses = await Promise.all(
    ['Alex', 'Taylor', 'Robin'].map((name) =>
      joining(owner.view.code, { name, secret: secret() }),
    ),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  for (const response of responses.filter((r) => r.status === 409))
    expect(await response.json()).toMatchObject({ error: 'room_full' });
  const recovered = await joining(owner.view.code, operation);
  expect(recovered.status).toBe(200);
  expect(await recovered.json()).toMatchObject({
    currentParticipantId: view.currentParticipantId,
  });
  expect(
    (await (await reading(owner.view.code, owner.cookie)).json()).participants,
  ).toHaveLength(3);
  expect(await redis.pExpireTime(`room:${owner.view.code}`)).toBe(
    owner.view.expiresAt,
  );
});

it('rejects closed, missing and expired rooms without creating or extending data', async () => {
  const owner = await room();
  const operation = { name: 'Sam', secret: secret() };
  // Fault injection: drawing is delivered in the next slice.
  await redis.hSet(`room:${owner.view.code}`, 'state', 'drawn');
  expect(
    await (await joining(owner.view.code, operation)).json(),
  ).toMatchObject({ error: 'joining_closed' });
  await redis.hSet(
    `room:${owner.view.code}`,
    'expiresAt',
    String(Date.now() - 1),
  );
  expect(
    await (await joining(owner.view.code, operation)).json(),
  ).toMatchObject({ error: 'unavailable' });
  const missing = await joining('0'.repeat(24), operation);
  expect(missing.status).toBe(404);
  expect(await missing.json()).toMatchObject({ error: 'unavailable' });
  expect(await redis.exists('room:' + '0'.repeat(24))).toBe(0);
});

it('validates origin, code, name and operation without exposing private information', async () => {
  const owner = await room();
  const operation = { name: 'Sam', secret: secret() };
  for (const headers of [
    { origin: '' },
    { origin: 'https://elsewhere.example' },
    { 'sec-fetch-site': 'cross-site' },
  ] as Record<string, string>[]) {
    expect((await joining(owner.view.code, operation, headers)).status).toBe(
      403,
    );
  }
  for (const [code, body, error] of [
    ['bad', operation, 'invalid_code'],
    [owner.view.code, { ...operation, name: 'A\nB' }, 'invalid_name'],
    [owner.view.code, { ...operation, secret: '' }, 'invalid_operation'],
  ] as const) {
    const response = await joining(code, body);
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toMatchObject({ error });
  }
});

it('recovers committed membership after joining closes, but never after expiry or data loss', async () => {
  const owner = await room();
  const operation = { name: 'Sam', secret: secret() };
  const joined = await joining(owner.view.code, operation);
  const member = await joined.json();
  const key = `room:${owner.view.code}`;
  await joining(owner.view.code, { name: 'Third', secret: secret() });
  await draw(
    request(`/api/rooms/${owner.view.code}/draw`, {}, { cookie: owner.cookie }),
    { params: Promise.resolve({ code: owner.view.code }) },
  );
  const recovered = await joining(owner.view.code, operation);
  expect(recovered.status).toBe(200);
  expect(cookie(recovered)).toBe(cookie(joined));
  expect(await recovered.json()).toMatchObject({
    currentParticipantId: member.currentParticipantId,
    state: 'drawn',
  });
  expect(await redis.pExpireTime(key)).toBe(owner.view.expiresAt);
  await redis.pExpire(key, 1);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect((await joining(owner.view.code, operation)).status).toBe(404);
  expect(await redis.exists(key)).toBe(0);
});
