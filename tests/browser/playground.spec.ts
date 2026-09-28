import { expect, test } from '@playwright/test';
import { authoring } from '../../dist/agent.js';

// Smoke test of the existing playground page. World default: start (-2,-1),
// end (2,1), zoom 50 px/unit, SVG origin (320,180) -> tip at (420,130).
// The polygon `points` attribute starts with the arrow tip in screen px.
test('arrow renders, inputs redraw, invalid input keeps last graphic, zoom and reset work', async ({
  page,
}) => {
  await page.goto('/');

  const status = page.locator('#status');
  const readout = page.locator('#readout');
  const svg = page.locator('#canvas svg');
  // scene svg contains axis-head polygons too; the role arrow head is .pv-head
  const tip = svg.locator('polygon.pv-head');

  await expect(svg).toBeVisible();
  await expect(tip).toBeVisible();
  await expect(readout).toHaveText(/长度 4\.472/);
  await expect(readout).toHaveText(/方向 26\.6°/);
  await expect(tip).toHaveAttribute('points', /^420,130 /);

  await page.screenshot({
    path: 'test-results/screenshots/playground-arrow.png',
    fullPage: true,
  });

  // Editing a number input redraws the arrow (bx 2 -> 1: tip x 420 -> 370).
  await page.locator('#bx').fill('1');
  await expect(readout).toHaveText(/长度 3\.606/);
  await expect(tip).toHaveAttribute('points', /^370,130 /);

  // Out-of-range input reports the error and keeps the last valid drawing.
  await page.locator('#ax').fill('9');
  await expect(status).toHaveText(/请填写范围内的有限数值/);
  await expect(tip).toHaveAttribute('points', /^370,130 /);

  // Empty input is equally invalid; a valid value recovers the drawing.
  await page.locator('#ax').fill('');
  await expect(status).toHaveText(/请填写范围内的有限数值/);
  await page.locator('#ax').fill('-2');
  await expect(status).toHaveText('');
  await expect(readout).toHaveText(/长度 3\.606/);

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
  await expect(status).toHaveText('');
  await expect(readout).toHaveText(/长度 4\.472/);
  await expect(tip).toHaveAttribute('points', /^420,130 /);
});

async function worldToClient(page: import('@playwright/test').Page, x: number, y: number) {
  return page.evaluate(([wx, wy]) => {
    const svg = document.querySelector('#canvas svg') as SVGSVGElement | null;
    if (!svg) throw new Error('no svg');
    const zoom = parseFloat((document.getElementById('zoom') as HTMLInputElement).value);
    const ctm = svg.getScreenCTM();
    if (!ctm) throw new Error('no CTM');
    const p = new DOMPoint(320 + wx * zoom, 180 - wy * zoom).matrixTransform(ctm);
    return { x: p.x, y: p.y };
  }, [x, y]);
}

// The page runs on the same scene-document boundary the API exposes to agents:
// __pvDocument() is the live document; it must re-validate and its derived
// values must equal what the readout displays.
test('playground state IS an authoring document: validates, derived matches readout', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#bx').fill('3');
  await page.locator('#by').fill('1.5');
  await page.locator('#zoom').fill('40');
  const doc = await page.evaluate(() => window.__pvDocument());
  const checked = authoring.validateScene({ document: doc });
  expect(checked.ok).toBe(true);
  if (checked.ok) {
    expect(checked.documentHash).toBeDefined();
    const length = (checked.derived as { length: number }).length;
    const direction = (checked.derived as { direction: { degrees: number } }).direction.degrees;
    await expect(page.locator('#readout')).toHaveText(new RegExp(`长度 ${length.toFixed(3)}`));
    await expect(page.locator('#readout')).toHaveText(new RegExp(`方向 ${direction.toFixed(1)}°`));
    // document params echo what the inputs show
    expect((doc.params as { end: { x: number; y: number } }).end).toEqual({ x: 3, y: 1.5 });
    const vp = doc.presentation.viewport as { mode: string; pixelsPerUnit: number };
    expect(vp.pixelsPerUnit).toBe(40);
  }
  // a drag goes through the same boundary: document changes, still validates
  await page.locator('#sel-start').check();
  const a = await worldToClient(page, -2, -1);
  const b = await worldToClient(page, -1, 0);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  const doc2 = await page.evaluate(() => window.__pvDocument());
  expect(doc2.instanceId).toBe(doc.instanceId);
  const checked2 = authoring.validateScene({ document: doc2 });
  expect(checked2.ok).toBe(true);
  expect((doc2.params as { start: { x: number } }).start.x).toBeCloseTo(-1, 1);
});
