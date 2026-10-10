import { expect, test } from '@playwright/test';
import { createClient } from 'redis';
import { randomBytes } from 'node:crypto';
import type { RoomView } from '../../lib/rooms/types';

for (const state of ['full', 'drawn'] as const) {
  test(`a lost join response and cookie recover the same participant after the room is ${state}`, async ({
    page,
    request,
    playwright,
  }) => {
    const headers = { origin: 'http://127.0.0.1:3100' };
    const prepared = await request.post('/api/rooms', {
      headers,
      data: { phase: 'prepare', name: 'Owner' },
    });
    const created = await request.post('/api/rooms', {
      headers,
      data: await prepared.json(),
    });
    const room: RoomView = await created.json();
    await page.goto('/');
    let committed!: RoomView;
    let payload = '';
    await page.route('**/api/rooms/*/join', async (route) => {
      payload = route.request().postData()!;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      committed = await response.json();
      await page.context().clearCookies();
      await route.abort('failed');
      await page.unroute('**/api/rooms/*/join');
    });
    await page.getByLabel('Your name').fill('Sam');
    await page.getByRole('main').getByLabel('Room code').fill(room.code);
    await page.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'couldn’t confirm joining',
    );
    expect(await page.context().cookies()).toEqual([]);
    const count = state === 'full' ? room.capacity : 3;
    for (let i = 2; i < count; i++) {
      const guest = await playwright.request.newContext();
      try {
        const joined = await guest.post(
          `http://127.0.0.1:3100/api/rooms/${room.code}/join`,
          {
            headers,
            data: {
              name: `Guest ${i}`,
              secret: randomBytes(32).toString('hex'),
            },
          },
        );
        expect(joined.status()).toBe(201);
      } finally {
        await guest.dispose();
      }
    }
    if (state === 'drawn')
      expect(
        (
          await request.post(`/api/rooms/${room.code}/draw`, { headers })
        ).status(),
      ).toBe(200);
    const before = await (await request.get(`/api/rooms/${room.code}`)).json();
    await page.reload();
    await expect(page.getByLabel('Your name')).toHaveValue('Sam');
    await expect(page.getByLabel('Your name')).toHaveAttribute('readonly');
    await page.context().setOffline(true);
    await expect(
      page.getByRole('button', { name: 'Try again', exact: true }),
    ).toBeDisabled();
    await page.context().setOffline(false);
    const retry = page.waitForRequest('**/api/rooms/*/join');
    const recovered = page.waitForResponse('**/api/rooms/*/join');
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    expect((await retry).postData()).toBe(payload);
    const response = await recovered;
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('private, no-store');
    const view: RoomView = await response.json();
    expect(view.currentParticipantId).toBe(committed.currentParticipantId);
    expect(view.expiresAt).toBe(room.expiresAt);
    expect(view.participants).toHaveLength(count);
    expect(JSON.stringify(view)).not.toContain(JSON.parse(payload).secret);
    expect(view).not.toHaveProperty('assignments');
    await expect(page).toHaveURL(`/rooms/${room.code}`);
    expect(await (await request.get(`/api/rooms/${room.code}`)).json()).toEqual(
      before,
    );
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem('secret-santa:pending-join'),
      ),
    ).toBeNull();
    await page.reload();
    if (state === 'drawn') {
      await expect(
        page.getByRole('region', { name: 'Your private gift recipient' }),
      ).toContainText(view.recipient!.name);
    } else {
      await expect(
        page.getByRole('heading', { name: 'Your room', exact: true }),
      ).toBeVisible();
    }
    expect(
      await (await page.request.get(`/api/rooms/${room.code}`)).json(),
    ).toEqual(view);
  });
}

test('an expired create attempt reports definitive failure and permits a fresh operation', async ({
  page,
}) => {
  const redis = createClient({ url: 'redis://127.0.0.1:6380' });
  await redis.connect();
  try {
    await page.goto('/');
    let code = '';
    await page.route('**/api/rooms', async (route) => {
      if (route.request().postDataJSON().phase === 'prepare')
        return route.continue();
      const response = await route.fetch();
      code = (await response.json()).code;
      await page.context().clearCookies();
      await route.abort('failed');
      await page.unroute('**/api/rooms');
    });
    await page.getByLabel('Your name').fill('Owner');
    await page
      .getByRole('button', { name: 'Create room', exact: true })
      .click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'couldn’t confirm creation',
    );
    await redis.hSet(`room:${code}`, 'operationExpiresAt', '1');
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'attempt has expired',
    );
    await expect(page.getByLabel('Your name')).toBeEditable();
    await expect(page.getByLabel('Your name')).toHaveValue('Owner');
    await expect(
      page.getByRole('button', { name: 'Try again', exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem('secret-santa:pending-create'),
      ),
    ).toBeNull();
  } finally {
    await redis.quit();
  }
});
