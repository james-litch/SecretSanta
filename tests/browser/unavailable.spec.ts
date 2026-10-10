import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { createClient } from 'redis';
import type { RoomView } from '../../lib/rooms/types';

const code = 'ABCDEF0123456789ABCDEF01';
const unavailable = 'This room doesn’t exist or has expired.';

for (const state of ['waiting', 'drawn'] as const) {
  test(`${state} content expires at its original deadline offline and stays unavailable through connectivity changes`, async ({
    page,
    context,
  }) => {
    const now = Date.now();
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now);
    let reads = 0;
    const room: RoomView = {
      code,
      state,
      expiresAt: now + 15_250,
      capacity: 12,
      lifetimeDays: 1,
      ownerId: 'owner',
      currentParticipantId: 'owner',
      isOwner: true,
      participants: [
        { id: 'owner', name: 'Private owner' },
        { id: 'sam', name: 'Sam' },
        { id: 'alex', name: 'Alex' },
      ],
      ...(state === 'drawn'
        ? { recipient: { id: 'sam', name: 'Private recipient' } }
        : {}),
    };
    await page.route(`**/api/rooms/${code}`, (route) => {
      reads++;
      return route.fulfill({ json: room });
    });
    await page.goto(`/rooms/${code}`);
    await expect(
      page.getByRole('list', { name: 'Participants' }),
    ).toBeVisible();
    if (state === 'waiting') {
      await page.getByRole('button', { name: 'Draw names' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
    await context.setOffline(true);
    const stopped = reads;
    await page.clock.runFor(15_249);
    await expect(
      page.getByRole('list', { name: 'Participants' }),
    ).toBeVisible();
    await page.clock.runFor(1);
    await expect(
      page.getByRole('heading', { name: 'Room unavailable' }),
    ).toBeFocused();
    await expect(page.getByText(unavailable, { exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Participants' })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('region', { name: 'Your private gift recipient' }),
    ).toHaveCount(0);
    await context.setOffline(false);
    await context.setOffline(true);
    await page.clock.runFor(60_000);
    await expect(page.getByText(unavailable, { exact: true })).toBeVisible();
    expect(reads).toBe(stopped);
  });
}

const origin = 'http://127.0.0.1:3100';
async function createRoom(
  page: Page,
  guest: BrowserContext,
  state: RoomView['state'],
) {
  const prepared = await page.request.post('/api/rooms', {
    headers: { origin },
    data: { phase: 'prepare', name: 'Private owner' },
  });
  expect(prepared.status()).toBe(201);
  const created = await page.request.post('/api/rooms', {
    headers: { origin },
    data: await prepared.json(),
  });
  expect(created.status()).toBe(201);
  const room: RoomView = await created.json();
  for (const name of ['Sam', 'Alex']) {
    await guest.clearCookies();
    const joined = await guest.request.post(
      `${origin}/api/rooms/${room.code}/join`,
      {
        headers: { origin },
        data: {
          name,
          secret: crypto.randomUUID().replaceAll('-', '').repeat(2),
        },
      },
    );
    expect(joined.status()).toBe(201);
  }
  if (state === 'drawn') {
    expect(
      (
        await page.request.post(`/api/rooms/${room.code}/draw`, {
          headers: { origin },
        })
      ).ok(),
    ).toBe(true);
  }
  return room;
}
for (const state of ['waiting', 'drawn'] as const) {
  test(`${state} access loss explains recovery limits without exposing private content or affecting other participants`, async ({
    page,
    context,
    browser,
  }) => {
    const guest = await browser.newContext();
    const outsider = await browser.newContext();
    try {
      const room = await createRoom(page, guest, state);
      const guestBefore = await (
        await guest.request.get(`${origin}/api/rooms/${room.code}`)
      ).json();
      await page.goto(`/rooms/${room.code}`);
      await expect(
        page.getByRole('list', { name: 'Participants' }),
      ).toBeVisible();
      const cookie = (await context.cookies()).find(
        (c) => c.name === 'room_access',
      )!;
      await context.addCookies([{ ...cookie, value: 'invalid-saved-access' }]);
      await page.reload();
      await expect(
        page.getByRole('heading', { name: 'Room unavailable' }),
      ).toBeFocused();
      await expect(
        page.getByText(
          'Your saved access is missing or invalid. Your name and room code cannot recover it.',
        ),
      ).toBeVisible();
      await expect(
        page.getByRole('list', { name: 'Participants' }),
      ).toHaveCount(0);
      await expect(
        page.getByText('Private owner', { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText('There is no identity recovery or ownership transfer.'),
      ).toBeVisible();
      await expect(
        page.getByText(
          'If the room owner loses access before drawing, the group needs a new room. After drawing, other participants can still see their own saved recipients.',
        ),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'About lost owner access' }),
      ).toHaveAttribute('href', '/faq#owner');
      await context.clearCookies();
      await page.reload();
      const message =
        state === 'drawn'
          ? 'This room has already drawn. Open it in the browser you used to join.'
          : 'Your saved access is missing or invalid. Your name and room code cannot recover it.';
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      const otherPage = await outsider.newPage();
      await otherPage.goto(`${origin}/rooms/${room.code}`);
      await expect(otherPage.getByText(message, { exact: true })).toBeVisible();
      for (const client of [context, outsider]) {
        const denied = await client.request.get(
          `${origin}/api/rooms/${room.code}`,
        );
        expect(denied.status()).toBe(401);
        expect(denied.headers()['cache-control']).toBe('private, no-store');
        expect(Object.keys(await denied.json()).sort()).toEqual([
          'error',
          'message',
        ]);
      }
      expect(
        await (
          await guest.request.get(`${origin}/api/rooms/${room.code}`)
        ).json(),
      ).toEqual(guestBefore);
      await page.getByRole('link', { name: 'About room access' }).click();
      await expect(page.locator('#browser')).toBeVisible();
      await page.goto(`/rooms/${room.code}`);
      await page
        .getByRole('link', { name: 'Back to the landing page' })
        .click();
      await expect(page.getByLabel('Your name')).toBeEditable();
    } finally {
      await guest.close();
      await outsider.close();
    }
  });
}

for (const state of ['waiting', 'drawn'] as const) {
  test(`early Redis loss of a ${state} room is unavailable on revisit and links to expiry help`, async ({
    page,
  }) => {
    const guest = await page.context().browser()!.newContext();
    let room: RoomView;
    try {
      room = await createRoom(page, guest, state);
    } finally {
      await guest.close();
    }
    await page.goto(`/rooms/${room.code}`);
    await expect(
      page.getByRole('list', { name: 'Participants' }),
    ).toBeVisible();
    const redis = createClient({ url: 'redis://127.0.0.1:6380' });
    await redis.connect();
    try {
      await redis.del(`room:${room.code}`);
      await page.reload();
      await expect(
        page.getByRole('heading', { name: 'Room unavailable' }),
      ).toBeFocused();
      await expect(page.getByText(unavailable, { exact: true })).toBeVisible();
      await expect(
        page.getByRole('list', { name: 'Participants' }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('region', { name: 'Your private gift recipient' }),
      ).toHaveCount(0);
      await page.getByRole('link', { name: 'About room expiry' }).click();
      await expect(page.locator('#expiry')).toBeVisible();
      await page.goto(`/rooms/${room.code}`);
      await expect(page.getByText(unavailable, { exact: true })).toBeVisible();
      const response = await page.request.get(`/api/rooms/${room.code}`);
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({
        error: 'unavailable',
        message: unavailable,
      });
    } finally {
      await redis.quit();
    }
  });
}

test('a temporary failure on revisit offers retry without claiming the room or access is lost', async ({
  page,
}) => {
  await page.route(`**/api/rooms/${code}`, (route) =>
    route.fulfill({ status: 503, json: { error: 'service_unavailable' } }),
  );
  await page.goto(`/rooms/${code}`);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'couldn’t check your room',
  );
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
  await expect(
    page.getByRole('heading', { name: 'Room unavailable' }),
  ).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Participants' })).toHaveCount(0);
  await expect(page.getByText(unavailable, { exact: true })).toHaveCount(0);
});

for (const days of [1, 7]) {
  test(`waiting and drawn revisits show the snapshotted ${days}-day lifetime`, async ({
    page,
  }) => {
    let state: 'waiting' | 'drawn' = 'waiting';
    const expiresAt = Date.now() + days * 86_400_000;
    await page.route(`**/api/rooms/${code}`, (route) =>
      route.fulfill({
        json: {
          code,
          state,
          expiresAt,
          capacity: 12,
          lifetimeDays: days,
          ownerId: 'owner',
          currentParticipantId: 'owner',
          isOwner: true,
          participants: [{ id: 'owner', name: 'Owner' }],
          ...(state === 'drawn'
            ? { recipient: { id: 'sam', name: 'Sam' } }
            : {}),
        },
      }),
    );
    await page.goto(`/rooms/${code}`);
    const copy =
      days === 1
        ? 'This room will be deleted after 1 day.'
        : 'This room will be deleted after 7 days.';
    await expect(page.getByText(copy, { exact: true })).toBeVisible();
    state = 'drawn';
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Your gift recipient' }),
    ).toBeFocused();
    await expect(page.getByText(copy, { exact: true })).toBeVisible();
    await page.goto('/');
    await page.goto(`/rooms/${code}`);
    await expect(page.getByText(copy, { exact: true })).toBeVisible();
  });
}
