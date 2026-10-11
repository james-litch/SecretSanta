import { expect, test } from '@playwright/test';

test('the FAQ explains the saved draw and private recipients', async ({
  page,
}) => {
  await page.goto('/faq#draw');
  await expect(page.locator('#draw')).toBeVisible();
  await expect(page.locator('#draw')).toContainText('cannot be undone');
  await expect(page.locator('#draw')).toContainText(
    'everyone gives and receives exactly once',
  );
  await expect(page.locator('#draw')).toContainText('Reciprocal pairs');
  await page.goto('/faq#privacy');
  await expect(page.locator('#privacy')).toBeVisible();
  await expect(page.locator('#privacy')).toContainText(
    'including the room owner',
  );
  await expect(
    page.getByText('Drawing is coming in a later update.'),
  ).toHaveCount(0);
});

for (const anchor of [
  'browser',
  'devices',
  'owner',
  'changes',
  'capacity',
  'sharing',
  'draw',
  'privacy',
  'expiry',
  'connection',
]) {
  test(`direct arrival reveals the ${anchor} answer`, async ({ page }) => {
    await page.goto(`/faq#${anchor}`);
    const answer = page.locator(`#${anchor}`);
    await expect(answer).toBeVisible();
    await expect(answer).toBeInViewport();
    await expect(
      page.locator('details').filter({ has: answer }),
    ).toHaveAttribute('open', '');
  });
}

for (const mode of ['animated', 'reduced', 'fallback'] as const) {
  test(`disclosure opens and closes in ${mode} mode`, async ({ page }) => {
    if (mode === 'reduced')
      await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/faq');
    if (mode === 'fallback') {
      // Simulate the browser dropping the progressive animation enhancement.
      await page.evaluate(() => {
        const removeEnhancement = (rules: CSSRuleList) => {
          for (const rule of Array.from(rules)) {
            if (
              rule instanceof CSSStyleRule &&
              rule.selectorText.includes('::details-content')
            )
              rule.style.cssText = '';
            if ('cssRules' in rule)
              removeEnhancement((rule as CSSGroupingRule).cssRules);
          }
        };
        for (const sheet of Array.from(document.styleSheets))
          removeEnhancement(sheet.cssRules);
      });
    }
    const answer = page.locator('#browser');
    const details = page.locator('details').filter({ has: answer });
    const question = details.locator('summary');
    await question.focus();
    await question.press('Enter');
    await expect(answer).toBeVisible();
    await expect(question).toBeFocused();
    const duration = await details.evaluate(
      (el) => getComputedStyle(el, '::details-content').transitionDuration,
    );
    if (mode === 'reduced' || mode === 'fallback') expect(duration).toBe('0s');
    else expect(duration).not.toBe('0s');
    await question.press('Space');
    await expect(answer).not.toBeVisible();
    await expect(question).toBeFocused();
  });
}

for (const path of ['/', '/rooms/ABCDEF0123456789ABCDEF01', '/faq']) {
  test(`header FAQ navigation works from ${path}`, async ({ page }) => {
    await page.route('**/api/rooms/*', (route) =>
      route.fulfill({ status: 404, json: { error: 'unavailable' } }),
    );
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    const faq = page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'FAQ', exact: true });
    await faq.focus();
    await faq.press('Enter');
    await expect(page).toHaveURL(/\/faq$/);
    await expect(
      page.getByRole('heading', { name: 'A few helpful answers' }),
    ).toBeVisible();
  });
}

test('native keyboard disclosure keeps focus and skips closed answer links', async ({
  page,
}) => {
  await page.goto('/faq');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const details = page
    .locator('details')
    .filter({ has: page.locator('#devices') });
  const summary = details.locator('summary');
  const next = page
    .locator('details')
    .filter({ has: page.locator('#owner') })
    .locator('summary');
  const link = page.getByRole('link', { name: 'returning to your room' });
  await summary.focus();
  await page.keyboard.press('Tab');
  await expect(next).toBeFocused();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(details).toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  await expect(summary).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Space');
  await expect(details).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(next).toBeFocused();
});
