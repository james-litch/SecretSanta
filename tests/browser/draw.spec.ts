import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
const origin = 'http://127.0.0.1:3100';
async function create(page: Page) {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Owner');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your room' })).toBeFocused();
  return (await page.getByRole('main').getByLabel('Room code').textContent())!;
}
async function join(page: Page, code: string, name: string) {
  await page.goto(origin);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('main').getByLabel('Room code').fill(code);
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your room' })).toBeFocused();
}
async function ready(page: Page) {
  const code = await create(page);
  for (const name of ['Sam', 'Alex']) {
    // Fresh API clients have separate cookie jars, like separate browsers.
    const context = await page.context().browser()!.newContext();
    const guest = await context.newPage();
    await join(guest, code, name);
    await context.close();
  }
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Draw names', exact: true }),
  ).toBeEnabled();
  return code;
}
async function confirm(page: Page) {
  await page.getByRole('button', { name: 'Draw names', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm draw' }).click();
}

test('separate participants and competing owner tabs see only stable private results', async ({
  page,
  browser,
  context,
}) => {
  const code = await create(page);
  await expect(page.getByRole('button', { name: 'Draw names' })).toBeDisabled();
  const guests = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  try {
    const pages = await Promise.all(guests.map((c) => c.newPage()));
    for (const [i, guest] of pages.entries()) {
      await join(guest, code, ['Sam', 'Alex'][i]);
      await expect(
        guest.getByRole('button', { name: 'Draw names' }),
      ).toHaveCount(0);
    }
    await page.reload();
    const other = await context.newPage();
    await other.goto(page.url());
    const trigger = page.getByRole('button', {
      name: 'Draw names',
      exact: true,
    });
    await trigger.click();
    await expect(
      page.getByRole('button', { name: 'Close modal' }),
    ).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(
      page.getByRole('button', { name: 'Confirm draw' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Close modal' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole('button', { name: 'Close modal' }).click();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.mouse.click(5, 5);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await trigger.click();
    expect(
      await page
        .getByRole('dialog')
        .evaluate((element) => getComputedStyle(element).transitionDuration),
    ).toBe('0s');
    await page.getByRole('button', { name: 'Close modal' }).click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(trigger).toBeFocused();
    await Promise.all([confirm(page), confirm(other)]);
    const privateViews = [];
    for (const participant of [page, ...pages]) {
      if (participant !== page) await participant.reload();
      await expect(
        participant.getByRole('heading', { name: 'Your gift recipient' }),
      ).toBeFocused();
      await expect(
        participant.getByRole('button', { name: 'Draw names' }),
      ).toHaveCount(0);
      await expect(
        participant.getByRole('list', { name: 'Participants' }),
      ).toBeVisible();
      const response = await participant.request.get(`/api/rooms/${code}`);
      expect(response.headers()['cache-control']).toBe('private, no-store');
      const view = await response.json();
      expect(view.recipient.id).not.toBe(view.currentParticipantId);
      expect(Object.keys(view).sort()).toEqual([
        'capacity',
        'code',
        'currentParticipantId',
        'expiresAt',
        'isOwner',
        'lifetimeDays',
        'ownerId',
        'participants',
        'recipient',
        'state',
      ]);
      privateViews.push(view);
      await participant.goto('/');
      await participant.goto(`${origin}/rooms/${code}`);
      await expect(
        participant.getByRole('region', {
          name: 'Your private gift recipient',
        }),
      ).toContainText(view.recipient.name);
    }
    expect(new Set(privateViews.map((v) => v.recipient.id)).size).toBe(3);
    await expect(
      other.getByRole('region', { name: 'Your private gift recipient' }),
    ).toContainText(privateViews[0].recipient.name);
  } finally {
    await Promise.all(guests.map((c) => c.close()));
  }
});

test('a lost draw response checks and recovers the saved outcome without another draw', async ({
  page,
}) => {
  const code = await ready(page);
  let savedRecipient = '';
  let posts = 0;
  await page.route('**/api/rooms/*/draw', async (route) => {
    posts++;
    const response = await route.fetch();
    savedRecipient = (await response.json()).recipient.name;
    await route.abort('failed');
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/rooms/${code}`, async (route) => {
    await gate;
    await route.continue();
  });
  await confirm(page);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Checking whether the draw completed…',
  );
  release();
  await expect(
    page.getByRole('heading', { name: 'Your gift recipient' }),
  ).toBeFocused();
  await expect(
    page.getByRole('region', { name: 'Your private gift recipient' }),
  ).toContainText(savedRecipient);
  expect(posts).toBe(1);
});

test('uncertain uncommitted draws retry safely, while definitive errors keep their reason', async ({
  page,
  context,
}) => {
  const code = await ready(page);
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Draw names' })).toBeDisabled();
  await context.setOffline(false);
  await page.route('**/api/rooms/*/draw', (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'insufficient_membership',
        message: 'A draw needs at least three participants.',
      }),
    }),
  );
  await confirm(page);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'A draw needs at least three participants.',
  );
  await expect(page.getByRole('main').getByRole('alert')).not.toContainText(
    'Checking whether',
  );
  await page.unroute('**/api/rooms/*/draw');
  await page.route('**/api/rooms/*/draw', (route) => route.abort('failed'));
  await confirm(page);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'No saved draw was found yet',
  );
  await page.unroute('**/api/rooms/*/draw');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your gift recipient' }),
  ).toBeFocused();
  // The same known deadline still applies to drawn content while offline.
  const view = await (await page.request.get(`/api/rooms/${code}`)).json();
  await context.setOffline(true);
  await page.clock.install({ time: view.expiresAt + 1000 });
  await page.clock.runFor(1100);
  await expect(
    page.getByText('This room doesn’t exist or has expired.'),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Your private gift recipient' }),
  ).toHaveCount(0);
});
