import { expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST as create } from '../../app/api/rooms/route';
import { POST as join } from '../../app/api/rooms/[code]/join/route';
import { GET as read } from '../../app/api/rooms/[code]/route';
import { POST as draw } from '../../app/api/rooms/[code]/draw/route';
import type { RoomView } from '../../lib/rooms/types';

process.env.REDIS_URL = 'redis://127.0.0.1:6380';
const origin = 'http://localhost:3000';
const secret = () => randomBytes(32).toString('hex');
const cookie = (response: Response) =>
  response.headers.get('set-cookie')!.split(';')[0];
function request(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`${origin}${path}`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
const context = (code: string) => ({ params: Promise.resolve({ code }) });
async function setup(size = 3) {
  const prepared = await create(
    request('/api/rooms', { phase: 'prepare', name: 'Owner' }),
  );
  const created = await create(request('/api/rooms', await prepared.json()));
  const room: RoomView = await created.json();
  const members = [{ cookie: cookie(created), id: room.currentParticipantId }];
  for (let i = 1; i < size; i++) {
    const response = await joining(room.code, {
      name: `Guest ${i}`,
      secret: secret(),
    });
    members.push({
      cookie: cookie(response),
      id: (await response.json()).currentParticipantId,
    });
  }
  return { room, members };
}
const joining = (code: string, body: unknown) =>
  join(request(`/api/rooms/${code}/join`, body), context(code));
const drawing = (code: string, access: string, headers = {}) =>
  draw(
    request(`/api/rooms/${code}/draw`, undefined, {
      cookie: access,
      ...headers,
    }),
    context(code),
  );
const reading = (code: string, access: string) =>
  read(
    new NextRequest(`${origin}/api/rooms/${code}`, {
      headers: { cookie: access },
    }),
    context(code),
  );

it('commits one draw and gives each browser only its own stable recipient', async () => {
  const { room, members } = await setup(4);
  const response = await drawing(room.code, members[0].cookie);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const result = await response.json();
  expect(result.state).toBe('drawn');
  expect(Object.keys(result).sort()).toEqual(
    [...Object.keys(room), 'recipient'].sort(),
  );
  const recipients = [];
  for (const member of members) {
    const view = await (await reading(room.code, member.cookie)).json();
    expect(view.recipient.id).not.toBe(member.id);
    expect(view.expiresAt).toBe(room.expiresAt);
    expect(Object.keys(view.recipient).sort()).toEqual(['id', 'name']);
    expect(await (await reading(room.code, member.cookie)).json()).toEqual(
      view,
    );
    recipients.push(view.recipient.id);
  }
  expect(recipients.sort()).toEqual(members.map((m) => m.id).sort());
  expect(await (await drawing(room.code, members[0].cookie)).json()).toEqual(
    result,
  );
});

it('requires same-origin owner access and minimum membership without leaking results', async () => {
  const { room, members } = await setup(2);
  for (const headers of [
    { origin: '' },
    { origin: 'https://elsewhere.example' },
    { 'sec-fetch-site': 'cross-site' },
  ]) {
    expect((await drawing(room.code, members[0].cookie, headers)).status).toBe(
      403,
    );
  }
  for (const [access, status, error] of [
    ['', 401, 'invalid_identity'],
    ['room_access=wrong', 401, 'invalid_identity'],
    [members[1].cookie, 403, 'owner_only'],
    [members[0].cookie, 409, 'insufficient_membership'],
  ] as const) {
    const response = await drawing(room.code, access);
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(Object.keys(await response.clone().json()).sort()).toEqual([
      'error',
      'message',
    ]);
    expect(await response.json()).toMatchObject({ error });
  }
  expect(
    (await (await reading(room.code, members[0].cookie)).json()).state,
  ).toBe('waiting');
});

it('competing owner requests converge, include committed joins and close new joining', async () => {
  const { room, members } = await setup();
  const operation = { name: 'Last guest', secret: secret() };
  const joined = await joining(room.code, operation);
  const guest = await joined.json();
  const responses = await Promise.all(
    Array.from({ length: 12 }, () => drawing(room.code, members[0].cookie)),
  );
  const views = await Promise.all(responses.map((r) => r.json()));
  for (const view of views) expect(view).toEqual(views[0]);
  expect(views[0].participants).toHaveLength(4);
  expect(
    (await (await reading(room.code, cookie(joined))).json()).recipient,
  ).toBeDefined();
  const recovered = await joining(room.code, operation);
  expect(recovered.status).toBe(200);
  expect(await recovered.json()).toMatchObject({
    state: 'drawn',
    currentParticipantId: guest.currentParticipantId,
  });
  expect(
    await (
      await joining(room.code, { name: 'Too late', secret: secret() })
    ).json(),
  ).toMatchObject({ error: 'joining_closed' });
  expect((await drawing(room.code, members[1].cookie)).status).toBe(403);
});

it('racing joins are either included in the entire saved draw or rejected', async () => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { room, members } = await setup();
    const joins = Array.from({ length: 6 }, (_, i) =>
      joining(room.code, { name: `Racing ${i}`, secret: secret() }),
    );
    const draws = Array.from({ length: 3 }, () =>
      drawing(room.code, members[0].cookie),
    );
    const joined = await Promise.all(joins);
    await Promise.all(draws);
    const view = await (await reading(room.code, members[0].cookie)).json();
    const accepted = joined.filter((r) => r.status === 201);
    expect(view.participants).toHaveLength(3 + accepted.length);
    const accesses = [...members.map((m) => m.cookie), ...accepted.map(cookie)];
    const recipients = [];
    for (const access of accesses) {
      const participant = await (await reading(room.code, access)).json();
      expect(participant.state).toBe('drawn');
      expect(participant.recipient.id).not.toBe(
        participant.currentParticipantId,
      );
      recipients.push(participant.recipient.id);
    }
    expect(new Set(recipients).size).toBe(view.participants.length);
    for (const rejected of joined.filter((r) => r.status !== 201))
      expect(await rejected.json()).toMatchObject({ error: 'joining_closed' });
  }
});

it('preserves the original Redis deadline and cannot draw or recover after expiry or data loss', async () => {
  const { createClient } = await import('redis');
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  try {
    const { room, members } = await setup();
    const key = `room:${room.code}`;
    // Shorten the fixture TTL, then observe expiry only through public operations.
    await redis.pExpire(key, 200);
    expect(
      await (await drawing(room.code, members[0].cookie)).json(),
    ).toMatchObject({ state: 'drawn', expiresAt: room.expiresAt });
    await new Promise((resolve) => setTimeout(resolve, 250));
    for (const member of members) {
      expect((await reading(room.code, member.cookie)).status).toBe(404);
      expect((await drawing(room.code, member.cookie)).status).toBe(404);
    }
    await redis.del(key);
    expect((await drawing(room.code, members[0].cookie)).status).toBe(404);
    expect((await reading(room.code, members[0].cookie)).status).toBe(404);
  } finally {
    await redis.quit();
  }
});

it('checks expiry at atomic commit even when Redis delays the write', async () => {
  const { createClient } = await import('redis');
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  try {
    const { room, members } = await setup();
    const key = `room:${room.code}`;
    await redis.hSet(key, 'expiresAt', String(Date.now() + 150));
    // Delay mutations, leaving snapshot reads available. The room is live when
    // proposed but expired when the atomic script is permitted to execute.
    await redis.sendCommand(['CLIENT', 'PAUSE', '300', 'WRITE']);
    expect(
      await (await drawing(room.code, members[0].cookie)).json(),
    ).toMatchObject({ error: 'unavailable' });
    // Restore only the fixture deadline so the public view can demonstrate that
    // the rejected commit did not save a result.
    await redis.hSet(key, 'expiresAt', String(room.expiresAt));
    const view = await (await reading(room.code, members[0].cookie)).json();
    expect(view.state).toBe('waiting');
    expect(view).not.toHaveProperty('recipient');
  } finally {
    await redis.quit();
  }
});

it('explains a drawn room to a browser with no saved access without disclosing membership', async () => {
  const { room, members } = await setup();
  await drawing(room.code, members[0].cookie);
  const missing = await reading(room.code, '');
  expect(missing.status).toBe(401);
  expect(missing.headers.get('cache-control')).toBe('private, no-store');
  expect(await missing.json()).toEqual({
    error: 'invalid_identity',
    message:
      'This room has already drawn. Open it in the browser you used to join.',
  });
  expect(await (await reading(room.code, 'room_access=wrong')).json()).toEqual({
    error: 'invalid_identity',
    message:
      'Your saved access is missing or invalid. Your name and room code cannot recover it.',
  });
});
