import { expect, test, type Page } from '@playwright/test';
import type { RoomView } from '../../lib/rooms/types';

const code = 'ABCDEF0123456789ABCDEF01';
const room: RoomView = {
  code,
  state: 'waiting',
  expiresAt: Date.now() + 86_400_000,
  capacity: 12,
  lifetimeDays: 1,
  ownerId: 'owner',
  currentParticipantId: 'owner',
  isOwner: true,
  participants: [{ id: 'owner', name: 'James' }],
};
async function open(page: Page) {
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await page.goto(`/rooms/${code}`);
  await expect(
    page.getByRole('heading', { name: 'Your room', exact: true }),
  ).toBeFocused();
}

test('visible waiting rooms discover participants and the saved result on the three-second cadence', async ({
  page,
}) => {
  let reads = 0;
  let view = room;
  await page.route(`**/api/rooms/${code}`, (route) => {
    reads++;
    return route.fulfill({ json: view });
  });
  await open(page);
  const initial = reads;
  await page.getByRole('button', { name: 'Copy', exact: true }).focus();
  await page.clock.runFor(2999);
  expect(reads).toBe(initial);
  view = {
    ...room,
    participants: [...room.participants, { id: 'sam', name: 'Sam' }],
  };
  await page.clock.runFor(1);
  await expect(page.getByRole('list', { name: 'Participants' })).toContainText(
    'Sam',
  );
  await expect(
    page.getByRole('button', { name: 'Copy', exact: true }),
  ).toBeFocused();
  await expect(page.getByRole('status', { name: 'Room updates' })).toHaveText(
    'Sam joined the room.',
  );
  await page.clock.runFor(3000);
  await expect.poll(() => reads).toBe(initial + 2);
  await expect(page.getByRole('status', { name: 'Room updates' })).toHaveText(
    'Sam joined the room.',
  );
  view = {
    ...view,
    state: 'drawn',
    recipient: { id: 'sam', name: 'Sam' },
  };
  await page.clock.runFor(3000);
  await expect(
    page.getByRole('heading', { name: 'Your gift recipient' }),
  ).toBeFocused();
  const stopped = reads;
  await page.clock.runFor(60_000);
  expect(reads).toBe(stopped);
});

async function settleResponse(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          channel.port1.close();
          channel.port2.close();
          resolve();
        };
        channel.port2.postMessage(null);
      }),
  );
}

async function advanceRead(page: Page, milliseconds: number) {
  const response = page.waitForResponse((response) =>
    response.url().endsWith(`/api/rooms/${code}`),
  );
  await page.clock.runFor(milliseconds);
  await (await response).finished();
  // Let the browser consume the response and schedule its next request.
  await settleResponse(page);
}

test('transient errors retain content and retry after 6, 12, 24 and capped 30 seconds; success resets cadence', async ({
  page,
}) => {
  let reads = 0;
  let failing = false;
  await page.route(`**/api/rooms/${code}`, (route) => {
    reads++;
    return route.fulfill(
      failing
        ? { status: 503, json: { error: 'service_unavailable' } }
        : { json: room },
    );
  });
  await open(page);
  failing = true;
  await page.clock.runFor(3000);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Reconnecting automatically',
  );
  await expect(page.getByRole('list')).toContainText('James');
  for (const delay of [6000, 12000, 24000, 30000, 30000]) {
    const before = reads;
    await page.clock.runFor(delay - 1);
    expect(reads).toBe(before);
    await advanceRead(page, 1);
    expect(reads).toBe(before + 1);
  }
  failing = false;
  await advanceRead(page, 30000);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  const before = reads;
  await advanceRead(page, 3000);
  expect(reads).toBe(before + 1);
});

async function visibility(page: Page, state: 'visible' | 'hidden') {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

test('hidden/offline pauses retain membership and resume once without overlapping a delayed response', async ({
  page,
  context,
}) => {
  let reads = 0;
  let release: (() => void) | undefined;
  let delayed = false;
  await page.route(`**/api/rooms/${code}`, async (route) => {
    reads++;
    if (delayed)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({
      json: {
        ...room,
        participants: [
          ...room.participants,
          { id: 'sam', name: 'Sam' },
          { id: 'alex', name: 'Alex' },
        ],
      },
    });
  });
  await open(page);
  const initial = reads;
  await visibility(page, 'hidden');
  await page.clock.runFor(60_000);
  expect(reads).toBe(initial);
  delayed = true;
  await visibility(page, 'visible');
  await expect.poll(() => reads).toBe(initial + 1);
  await visibility(page, 'hidden');
  await visibility(page, 'visible');
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Draw names' })).toBeDisabled();
  await expect(page.getByRole('list')).toContainText('James');
  delayed = false;
  const pendingResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/rooms/${code}`),
  );
  release!();
  await (await pendingResponse).finished();
  await settleResponse(page);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'You’re offline',
  );
  await page.clock.runFor(60_000);
  expect(reads).toBe(initial + 1);
  await context.setOffline(false);
  await expect.poll(() => reads).toBe(initial + 2);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Draw names' })).toBeEnabled();
  await advanceRead(page, 3000);
  expect(reads).toBe(initial + 3);
});

for (const status of [401, 404]) {
  test(`polling stops on terminal HTTP ${status}`, async ({ page }) => {
    let reads = 0;
    let terminal = false;
    await page.route(`**/api/rooms/${code}`, (route) => {
      reads++;
      return route.fulfill(
        terminal
          ? {
              status,
              json: {
                message:
                  status === 401
                    ? 'Your saved access is missing or invalid.'
                    : 'This room doesn’t exist or has expired.',
              },
            }
          : { json: room },
      );
    });
    await open(page);
    terminal = true;
    await page.clock.runFor(3000);
    await expect(page.getByRole('list', { name: 'Participants' })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('heading', { name: 'Room unavailable' }),
    ).toBeFocused();
    const stopped = reads;
    await visibility(page, 'hidden');
    await visibility(page, 'visible');
    await page.clock.runFor(60_000);
    expect(reads).toBe(stopped);
  });
}

test('known expiry stops waiting-room requests and removes content while offline', async ({
  page,
  context,
}) => {
  let reads = 0;
  await page.route(`**/api/rooms/${code}`, (route) => {
    reads++;
    return route.fulfill({ json: { ...room, expiresAt: Date.now() + 15_000 } });
  });
  await open(page);
  await context.setOffline(true);
  const stopped = reads;
  await page.clock.runFor(16_000);
  await expect(
    page.getByText('This room doesn’t exist or has expired.'),
  ).toBeVisible();
  await expect(page.getByRole('list', { name: 'Participants' })).toHaveCount(0);
  await context.setOffline(false);
  await page.clock.runFor(60_000);
  expect(reads).toBe(stopped);
});

test('navigation away cancels a pending read and prevents further polling', async ({
  page,
}) => {
  let reads = 0;
  let delayed = false;
  let release!: () => void;
  await page.route(`**/api/rooms/${code}`, async (route) => {
    reads++;
    if (delayed)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({ json: room });
  });
  await open(page);
  const initial = reads;
  delayed = true;
  await page.clock.runFor(3000);
  await expect.poll(() => reads).toBe(initial + 1);
  await page.getByRole('link', { name: 'FAQ', exact: true }).click();
  await expect(page).toHaveURL(/\/faq$/);
  delayed = false;
  release();
  await page.clock.runFor(60_000);
  expect(reads).toBe(initial + 1);
  await expect(page.getByRole('list', { name: 'Participants' })).toHaveCount(0);
});

test('returning during an active read queues one immediate refresh and keeps drawing available', async ({
  page,
}) => {
  let reads = 0;
  let delayed = false;
  let release!: () => void;
  await page.route(`**/api/rooms/${code}`, async (route) => {
    reads++;
    if (delayed)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({
      json: {
        ...room,
        participants: [
          ...room.participants,
          { id: 'sam', name: 'Sam' },
          { id: 'alex', name: 'Alex' },
        ],
      },
    });
  });
  await open(page);
  const initial = reads;
  delayed = true;
  await page.getByRole('button', { name: 'Draw names' }).focus();
  await page.clock.runFor(3000);
  await expect.poll(() => reads).toBe(initial + 1);
  await expect(page.getByRole('button', { name: 'Draw names' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Draw names' })).toBeEnabled();
  await visibility(page, 'hidden');
  await visibility(page, 'visible');
  await visibility(page, 'hidden');
  await visibility(page, 'visible');
  expect(reads).toBe(initial + 1);
  const response = page.waitForResponse((response) =>
    response.url().endsWith(`/api/rooms/${code}`),
  );
  delayed = false;
  release();
  await (await response).finished();
  await settleResponse(page);
  await page.clock.runFor(1);
  await expect.poll(() => reads).toBe(initial + 2);
  await advanceRead(page, 3000);
  expect(reads).toBe(initial + 3);
});

test('confirming during a slow poll shows pending state and prevents repeat submissions', async ({
  page,
}) => {
  let delayed = false;
  let reads = 0;
  let posts = 0;
  let release!: () => void;
  const ready = {
    ...room,
    participants: [
      ...room.participants,
      { id: 'sam', name: 'Sam' },
      { id: 'alex', name: 'Alex' },
    ],
  };
  await page.route(`**/api/rooms/${code}`, async (route) => {
    reads++;
    if (delayed)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({ json: ready });
  });
  await page.route(`**/api/rooms/${code}/draw`, async (route) => {
    posts++;
    await route.fulfill({
      json: { ...ready, state: 'drawn', recipient: { id: 'sam', name: 'Sam' } },
    });
  });
  await open(page);
  await page.getByRole('button', { name: 'Draw names' }).click();
  delayed = true;
  const initial = reads;
  await page.clock.runFor(3000);
  await expect.poll(() => reads).toBe(initial + 1);
  await page.getByRole('button', { name: 'Confirm draw' }).click();
  await expect(page.getByRole('button', { name: 'Draw names' })).toBeDisabled();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Drawing names',
  );
  expect(posts).toBe(0);
  delayed = false;
  release();
  await expect(
    page.getByRole('heading', { name: 'Your gift recipient' }),
  ).toBeFocused();
  expect(posts).toBe(1);
});

test('a saved result clears offline feedback on reconnection without restarting polling', async ({
  page,
  context,
}) => {
  let reads = 0;
  await page.route(`**/api/rooms/${code}`, (route) => {
    reads++;
    return route.fulfill({
      json: { ...room, state: 'drawn', recipient: { id: 'sam', name: 'Sam' } },
    });
  });
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await page.goto(`/rooms/${code}`);
  await expect(
    page.getByRole('heading', { name: 'Your gift recipient' }),
  ).toBeFocused();
  const stopped = reads;
  await context.setOffline(true);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'You’re offline',
  );
  await context.setOffline(false);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Room updates' })).toHaveText(
    'You’re back online. Your saved result is shown.',
  );
  await page.clock.runFor(60_000);
  expect(reads).toBe(stopped);
  await expect(
    page.getByRole('region', { name: 'Your private gift recipient' }),
  ).toContainText('Sam');
});
