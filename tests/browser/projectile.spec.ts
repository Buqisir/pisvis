import { expect, test } from '@playwright/test';
import { authoring } from '../../dist/agent.js';

// Snapshot capability demo: h=20,u=10,g=10 → T=2,R=20 (model card fixture).
test('projectile page: slider/play clock share the authoring boundary and land exactly at T', async ({
  page,
}) => {
  await page.goto('/projectile.html');
  const status = page.locator('#status');
  const readout = page.locator('#readout');
  const slider = page.locator('#in-t');
  const play = page.locator('#btn-play');
  const svg = page.locator('#canvas svg');

  await expect(svg).toBeVisible();
  await expect(readout).toHaveText(/t = 0 s \/ T = 2 s/);
  await expect(readout).toHaveText(/P \(0, 20\) m/);

  // Scrubbing t goes through updateScene: position/velocity track the same t.
  await slider.fill('1');
  await expect(readout).toHaveText(/t = 1 s/);
  await expect(readout).toHaveText(/P \(10, 15\) m/);
  await expect(readout).toHaveText(/v \(10, -10\) m\/s/);
  await expect(svg.locator('polyline.pv-path')).toHaveCount(2);
  await expect(status).toHaveText('');

  // Wall-clock playback from t=1 at 1× lands exactly at T=2 and stops.
  await play.click();
  await expect(play).toHaveText('暂停');
  await expect(readout).toHaveText(/t = 2 s \/ T = 2 s/, { timeout: 5000 });
  await expect(readout).toHaveText(/已落地/);
  await expect(play).toHaveText('播放', { timeout: 3000 });
  // No overshoot past T after the landing frame.
  await page.waitForTimeout(400);
  await expect(readout).toHaveText(/t = 2 s \/ T = 2 s/);

  // h=45 recomputes the domain: T=3, slider max follows, t stays valid.
  await page.locator('#in-h').fill('45');
  await page.locator('#in-h').dispatchEvent('change');
  await expect(readout).toHaveText(/T = 3 s/);
  await expect(readout).toHaveText(/R = 30 m/);
  await expect(slider).toHaveAttribute('max', '3');
  await expect(status).toHaveText('');

  // Theme switch changes the scene surface, never the physics.
  await page.locator('#in-theme').selectOption('linework@1');
  await expect(svg).toHaveAttribute('data-pv-theme', 'linework');
  await expect(readout).toHaveText(/P \(20, 25\) m/);

  // The live page state is a valid authoring document whose derived values
  // equal what the readout displays.
  const doc = await page.evaluate(() => window.__pvDocument());
  const checked = authoring.validateScene({ document: doc });
  expect(checked.ok).toBe(true);
  if (checked.ok) {
    const d = checked.derived as { T: number; R: number; position: { x: number; y: number } };
    expect(d.T).toBeCloseTo(3, 10);
    expect(d.R).toBeCloseTo(30, 10);
    await expect(readout).toHaveText(new RegExp(`P \\(${d.position.x}, ${d.position.y}\\) m`));
  }

  await page.screenshot({
    path: 'test-results/screenshots/projectile-page.png',
    fullPage: true,
  });
});
