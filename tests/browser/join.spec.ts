import { expect, test } from '@playwright/test';

test('a separate browser joins while the owner is offline, then both see the roster on refresh', async ({
  page,
  browser,
  context,
}) => {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Owner');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your room' })).toBeFocused();
  const code = await page
    .getByRole('main')
    .getByLabel('Room code')
    .textContent();
  await context.setOffline(true);
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto('http://127.0.0.1:3100');
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(guest.getByLabel('Your name')).toBeFocused();
  await guest.getByLabel('Your name').fill('Sam');
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(guest.getByRole('main').getByLabel('Room code')).toBeFocused();
  await guest
    .getByRole('main')
    .getByLabel('Room code')
    .fill(code!.toLowerCase());
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(guest.getByRole('heading', { name: 'Your room' })).toBeFocused();
  await expect(guest.getByRole('list', { name: 'Participants' })).toContainText(
    'Sam',
  );
  await expect(
    guest.getByText('Waiting for the room owner to draw.'),
  ).toBeVisible();
  await guest.reload();
  await expect(guest.getByText('2 participants · up to 12')).toBeVisible();
  await guest.goto('http://127.0.0.1:3100');
  await guest.getByLabel('Your name').fill('Different');
  await guest.getByRole('main').getByLabel('Room code').fill(code!);
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(guest.getByText('2 participants · up to 12')).toBeVisible();
  await expect(guest.getByText('Different', { exact: true })).toHaveCount(0);
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText('2 participants · up to 12')).toBeVisible();
  await expect(page.getByText('Sam', { exact: true })).toBeVisible();
  await guestContext.close();
});

test('uncertain joining retains the same operation across refresh and recovers one membership', async ({
  page,
}) => {
  const headers = { origin: 'http://127.0.0.1:3100' };
  const prepared = await page.request.post('/api/rooms', {
    headers,
    data: { phase: 'prepare', name: 'Owner' },
  });
  const created = await page.request.post('/api/rooms', {
    headers,
    data: await prepared.json(),
  });
  const room = await created.json();
  await page.context().clearCookies();
  await page.goto('/');
  let originalBody = '';
  let participantId = '';
  await page.route('**/api/rooms/*/join', async (route) => {
    originalBody = route.request().postData()!;
    const response = await route.fetch();
    participantId = (await response.json()).currentParticipantId;
    await page.context().clearCookies();
    await route.abort('failed');
    await page.unroute('**/api/rooms/*/join');
  });
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('main').getByLabel('Room code').fill(room.code);
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'We couldn’t confirm joining',
  );
  await expect(
    page.getByRole('button', { name: 'Create room', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Your name')).toHaveValue('Sam');
  await expect(page.getByRole('main').getByLabel('Room code')).toHaveAttribute(
    'readonly',
  );
  const request = page.waitForRequest('**/api/rooms/*/join');
  const response = page.waitForResponse('**/api/rooms/*/join');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  expect((await request).postData()).toBe(originalBody);
  expect((await (await response).json()).currentParticipantId).toBe(
    participantId,
  );
  await expect(page.getByText('2 participants · up to 12')).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem('secret-santa:pending-join'),
    ),
  ).toBeNull();
});

test('duplicate and unavailable errors preserve inputs and permit correction', async ({
  page,
}) => {
  const headers = { origin: 'http://127.0.0.1:3100' };
  const prepared = await page.request.post('/api/rooms', {
    headers,
    data: { phase: 'prepare', name: 'Owner' },
  });
  const created = await page.request.post('/api/rooms', {
    headers,
    data: await prepared.json(),
  });
  const room = await created.json();
  await page.context().clearCookies();
  await page.goto('/');
  await page.getByLabel('Your name').fill('OWNER');
  await page.getByRole('main').getByLabel('Room code').fill(room.code);
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page.getByLabel('Your name')).toBeFocused();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'already uses that name',
  );
  await expect(page.getByLabel('Your name')).toBeEditable();
  await expect(page.getByRole('main').getByLabel('Room code')).toHaveValue(
    room.code,
  );
  await page.getByRole('main').getByLabel('Room code').fill('0'.repeat(24));
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'doesn’t exist or has expired',
  );
  await expect(page.getByLabel('Your name')).toHaveValue('OWNER');
});
