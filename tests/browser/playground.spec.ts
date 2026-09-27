import { expect, test } from '@playwright/test';

// Smoke test of the existing playground page. World default: start (-2,-1),
// end (2,1), zoom 50 px/unit, SVG origin (320,180) -> tip at (420,130).
// The polygon `points` attribute starts with the arrow tip in screen px.
test('arrow renders, inputs redraw, invalid input keeps last graphic, zoom and reset work', async ({
  page,
}) => {
  await page.goto('/');

  const status = page.locator('#status');
  const svg = page.locator('#canvas svg');
  const tip = svg.locator('polygon');

  await expect(svg).toBeVisible();
  await expect(tip).toBeVisible();
  await expect(status).toHaveText(/长度 4\.472/);
  await expect(tip).toHaveAttribute('points', /^420,130 /);

  await page.screenshot({
    path: 'test-results/screenshots/playground-arrow.png',
    fullPage: true,
  });

  // Editing a number input redraws the arrow (bx 2 -> 1: tip x 420 -> 370).
  await page.locator('#bx').fill('1');
  await expect(status).toHaveText(/长度 3\.606/);
  await expect(tip).toHaveAttribute('points', /^370,130 /);

  // Out-of-range input reports the error and keeps the last valid drawing.
  await page.locator('#ax').fill('9');
  await expect(status).toHaveText(/请填写范围内的有限数值/);
  await expect(tip).toHaveAttribute('points', /^370,130 /);

  // Empty input is equally invalid; a valid value recovers the drawing.
  await page.locator('#ax').fill('');
  await expect(status).toHaveText(/请填写范围内的有限数值/);
  await page.locator('#ax').fill('-2');
  await expect(status).toHaveText(/长度 3\.606/);

  // Zoom slider rescales the drawing (zoom 50 -> 20: tip x 370 -> 340).
  await page.locator('#zoom').fill('20');
  await expect(tip).toHaveAttribute('points', /^340,160 /);

  // Reset restores defaults and clears the error state.
  await page.locator('#ax').fill('9');
  await expect(status).toHaveText(/请填写范围内的有限数值/);
  await page.getByRole('button', { name: '重置' }).click();
  await expect(page.locator('#ax')).toHaveValue('-2');
  await expect(page.locator('#bx')).toHaveValue('2');
  await expect(page.locator('#zoom')).toHaveValue('50');
  await expect(status).toHaveText(/长度 4\.472/);
  await expect(tip).toHaveAttribute('points', /^420,130 /);
});
