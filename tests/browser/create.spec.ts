import { expect, test } from '@playwright/test';

test('create, refresh, another tab and revisit retain the room owner', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByLabel('Your name')).toBeFocused();
  await expect(page.getByLabel('Your name')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await page.getByLabel('Your name').fill('  E\u0301lodie 🎁  ');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your room' })).toBeFocused();
  await expect(page.getByText('Élodie 🎁', { exact: true })).toBeVisible();
  await expect(page.getByText('You · Room owner')).toBeVisible();
  await expect(page.getByText('1 participant · up to 12')).toBeVisible();
  await expect(
    page.getByText('This room will be deleted after 1 day.'),
  ).toBeVisible();
  const url = page.url();
  const code = await page
    .getByRole('main')
    .getByLabel('Room code')
    .textContent();
  const roomCookie = (
    await context.cookies('http://127.0.0.1:3100/api/rooms/' + code)
  ).find((c) => c.name === 'room_access');
  expect(roomCookie?.httpOnly).toBe(true);
  await page.reload();
  await expect(page.getByText('You · Room owner')).toBeVisible();
  const tab = await context.newPage();
  await tab.goto(url);
  await expect(tab.getByText('You · Room owner')).toBeVisible();
  await page.goto('/');
  await page.goto(url);
  await expect(page.getByRole('main').getByLabel('Room code')).toHaveText(
    code!,
  );
  await expect(
    page.getByText(
      'Return using this same browser. Clearing its saved data loses your access.',
    ),
  ).toBeVisible();
});

test('lost create response recovers the same operation after refresh', async ({
  page,
}) => {
  await page.goto('/');
  let originalBody = '';
  let committedCode = '';
  await page.route('**/api/rooms', async (route) => {
    if (route.request().postDataJSON().phase === 'prepare') {
      await route.continue();
      return;
    }
    originalBody = route.request().postData()!;
    const response = await route.fetch();
    committedCode = (await response.json()).code;
    // route.fetch can apply Set-Cookie even though the response is aborted.
    // Drop it explicitly to exercise recovery using only the pending secret.
    await page.context().clearCookies();
    await route.abort('failed');
    await page.unroute('**/api/rooms');
  });
  await page.getByLabel('Your name').fill('James');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'We couldn’t confirm creation',
  );
  await page.reload();
  await expect(page.getByLabel('Your name')).toHaveValue('James');
  await expect(page.getByLabel('Your name')).toHaveAttribute('readonly', '');
  const request = page.waitForRequest('**/api/rooms');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  expect((await request).postDataJSON()).toEqual(JSON.parse(originalBody));
  await expect(page.getByRole('main').getByLabel('Room code')).toHaveText(
    committedCode,
  );
  await expect(page.getByText('1 participant · up to 12')).toBeVisible();
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === 'room_access',
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem('secret-santa:pending-create'),
    ),
  ).toBeNull();
});

test('offline and pending states prevent repeat submissions', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByLabel('Your name').fill('James');
  await context.setOffline(true);
  await expect(
    page.getByRole('button', { name: 'Create room', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('offline');
  await context.setOffline(false);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route('**/api/rooms', async (route) => {
    if (route.request().postDataJSON().phase === 'prepare') {
      await route.continue();
      return;
    }
    requests++;
    await gate;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Creating your room…' }),
  ).toBeDisabled();
  await page.getByLabel('Your name').press('Enter');
  await expect.poll(() => requests).toBe(1);
  release();
  await expect(page.getByRole('heading', { name: 'Your room' })).toBeVisible();
});

test('invalid access exposes no membership and links to an open FAQ answer', async ({
  page,
}) => {
  const prepared = await page.request.post('/api/rooms', {
    headers: { origin: 'http://127.0.0.1:3100' },
    data: { phase: 'prepare', name: 'Private participant' },
  });
  const response = await page.request.post('/api/rooms', {
    headers: { origin: 'http://127.0.0.1:3100' },
    data: await prepared.json(),
  });
  const room = await response.json();
  await page.context().clearCookies();
  await page.goto(`/rooms/${room.code}`);
  await expect(
    page.getByRole('heading', { name: 'Room unavailable' }),
  ).toBeFocused();
  await expect(page.getByText('Private participant')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'cannot recover',
  );
  await page.getByRole('link', { name: 'About room access' }).click();
  await expect(
    page.locator('details').filter({ has: page.locator('#browser') }),
  ).toHaveAttribute('open', '');
});

test('known expiry replaces loaded membership while offline', async ({
  page,
  context,
}) => {
  await page.clock.install();
  const code = 'B'.repeat(24);
  await page.route(`**/api/rooms/${code}`, (route) =>
    route.fulfill({
      json: {
        code,
        state: 'waiting',
        capacity: 30,
        lifetimeDays: 7,
        expiresAt: Date.now() + 60_000,
        ownerId: 'owner',
        currentParticipantId: 'owner',
        isOwner: true,
        participants: [{ id: 'owner', name: 'James' }],
      },
    }),
  );
  await page.goto(`/rooms/${code}`);
  await expect(page.getByText('You · Room owner')).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'offline',
  );
  await page.clock.fastForward(61_000);
  await expect(
    page.getByRole('heading', { name: 'Room unavailable' }),
  ).toBeFocused();
  await expect(page.getByText('James', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'doesn’t exist or has expired',
  );
});

test('copy fallback and FAQ disclosures work by keyboard', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your name').fill('James');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your room' })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
      configurable: true,
    });
  });
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Select and copy' }),
  ).toBeVisible();
  await expect(page.getByRole('main').getByLabel('Room code')).toBeVisible();
  await page.getByRole('link', { name: 'FAQ', exact: true }).click();
  const question = page
    .locator('details')
    .filter({ has: page.locator('#browser') })
    .locator('summary');
  await question.focus();
  await question.press('Enter');
  await expect(
    page.locator('details').filter({ has: page.locator('#browser') }),
  ).toHaveAttribute('open', '');
  await question.press('Enter');
  await expect(
    page.locator('details').filter({ has: page.locator('#browser') }),
  ).not.toHaveAttribute('open', '');
});

test('FAQ fragment links reveal native disclosure content on load and hash changes', async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat/i.test(message.text()))
      hydrationErrors.push(message.text());
  });
  await page.goto('/faq#connection');
  await expect(page.locator('#connection')).toBeVisible();
  await expect(
    page.locator('details').filter({ has: page.locator('#connection') }),
  ).toHaveAttribute('open', '');
  await expect(
    page.getByRole('heading', { name: 'A few helpful answers' }),
  ).toBeFocused();
  expect(hydrationErrors).toEqual([]);
  await page.evaluate(() => {
    window.location.hash = 'browser';
  });
  await expect(page.locator('#browser')).toBeVisible();
  await expect(
    page.locator('details').filter({ has: page.locator('#browser') }),
  ).toHaveAttribute('open', '');
});

test('returning home after creation starts a fresh attempt', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Your name').fill('James');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your room' })).toBeVisible();
  const firstRoom = page.url();
  await page.getByRole('link', { name: 'Secret Santa home' }).click();
  await expect(page.getByLabel('Your name')).toBeEditable();
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your room' })).toBeVisible();
  expect(page.url()).not.toBe(firstRoom);
});

for (const offset of [60_000, -1_800_000]) {
  test(`creation tolerates a browser clock offset of ${offset}ms`, async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date(Date.now() + offset));
    await page.goto('/');
    await page.getByLabel('Your name').fill('James');
    await page
      .getByRole('button', { name: 'Create room', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Your room' }),
    ).toBeVisible();
  });
}

test('a lost preparation response leaves the name editable and creates no room', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Your name').fill('James');
  let commits = 0;
  page.on('request', (request) => {
    if (
      request.url().endsWith('/api/rooms') &&
      request.method() === 'POST' &&
      request.postDataJSON().phase !== 'prepare'
    )
      commits++;
  });
  await page.route(
    '**/api/rooms',
    async (route) => {
      await route.fetch();
      await route.abort('failed');
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'We couldn’t prepare',
  );
  await expect(page.getByLabel('Your name')).toBeEditable();
  expect(commits).toBe(0);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem('secret-santa:pending-create'),
    ),
  ).toBeNull();
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your room' })).toBeVisible();
  expect(commits).toBe(1);
});
