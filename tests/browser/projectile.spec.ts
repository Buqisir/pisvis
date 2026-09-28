import { expect, test } from '@playwright/test';
import { authoring } from '../../dist/agent.js';

interface PanelSnap {
  questionId: string;
  mode: string;
  modifiedParams: string[];
  params: Record<string, number>;
  derived: Record<string, unknown>;
  graphParams: Record<string, number>;
}
const snaps = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __pvPanels: () => PanelSnap[] }).__pvPanels());

// Two panels share the template + session layer but never share state.
test('projectile page: two question panels are fully isolated', async ({ page }) => {
  await page.goto('/projectile.html');
  const panels = page.locator('.qpanel');
  await expect(panels).toHaveCount(2);
  const a = page.locator('[data-panel="p-a"]');
  const b = page.locator('[data-panel="p-b"]');

  // Defaults: A = q-landing-time (h=45 → T=3), B = q-range (h=20 → T=2).
  await expect(a.locator('.p-readout')).toHaveText(/t = 0 s \/ T = 3 s/);
  await expect(b.locator('.p-readout')).toHaveText(/t = 0 s \/ T = 2 s/);
  await expect(a.locator('.mode-badge')).toHaveText(/原题/);
  // Original mode locks condition inputs; unlock offers explore.
  await expect(a.locator('.in-h')).toBeDisabled();
  await expect(a.locator('.q-unlock')).toBeVisible();
  await expect(a.locator('.q-restore')).toBeHidden();

  // Each panel renders both views of the same snapshot.
  await expect(a.locator('[data-view="scene"] svg')).toHaveCount(1);
  await expect(a.locator('[data-view="graph"] svg')).toHaveCount(1);
  await expect(a.locator('[data-view="graph"] svg text')).toContainText(['vx', 'vy']);

  // Enter explore in A and change a condition — badge marks modified fields.
  await a.locator('.q-unlock').click();
  await expect(a.locator('.mode-badge')).toHaveText(/探索 · 条件未改动/);
  await expect(a.locator('.in-h')).toBeEnabled();
  await a.locator('.in-h').fill('80');
  await a.locator('.in-h').dispatchEvent('change');
  await expect(a.locator('.mode-badge')).toHaveText(/探索 · 已修改条件：h/);
  await expect(a.locator('.p-readout')).toHaveText(/T = 4 s/);
  await expect(a.locator('.q-restore')).toBeVisible();

  // Panel B is untouched by A's edits.
  await expect(b.locator('.mode-badge')).toHaveText(/原题/);
  await expect(b.locator('.p-readout')).toHaveText(/t = 0 s \/ T = 2 s/);
  const [sa, sb] = await snaps(page);
  expect(sa.mode).toBe('explore');
  expect(sa.params.h).toBe(80);
  expect(sa.graphParams.h).toBe(80);
  expect(sb.mode).toBe('original');
  expect(sb.params.h).toBe(20);
  expect(sb.graphParams.h).toBe(20);

  // Restore brings A back to the source question without losing the instance.
  await a.locator('.q-restore').click();
  await expect(a.locator('.mode-badge')).toHaveText(/原题/);
  await expect(a.locator('.p-readout')).toHaveText(/T = 3 s/);
  await expect(a.locator('.in-h')).toBeDisabled();
  await expect(a.locator('.in-h')).toHaveValue('45');
  const [sa2] = await snaps(page);
  expect(sa2.mode).toBe('original');
  expect(sa2.params).toEqual({ h: 45, u: 10, g: 10, t: 0 });
});

test('projectile page: t slider drives ball, readout and graph cursor together', async ({ page }) => {
  await page.goto('/projectile.html');
  const a = page.locator('[data-panel="p-a"]');
  const slider = a.locator('.in-t');

  await slider.fill('1.5');
  await expect(a.locator('.p-readout')).toHaveText(/t = 1.5 s/);
  await expect(a.locator('.p-readout')).toHaveText(/P \(15, 33.75\) m/);
  // Graph cursor segment exists and tracks the same t.
  const cursor = a.locator('[data-view="graph"] [data-item-id="t-cursor"]');
  await expect(cursor).toHaveCount(1);
  const [s] = await snaps(page);
  expect(s.graphParams.t).toBeCloseTo(1.5, 9);
  expect(s.graphDerived.vx).toBe(10);
  expect(s.graphDerived.vy).toBeCloseTo(-15, 9);
  expect(s.derived.position.x).toBeCloseTo(15, 9);

  // u=0 ∧ t=0 makes vx(t)=vy(t)=0: the zero-length cursor segment drops,
  // the two reading points stay.
  await a.locator('.q-unlock').click();
  await a.locator('.in-u').fill('0');
  await a.locator('.in-u').dispatchEvent('change');
  await slider.fill('0');
  const [s0] = await snaps(page);
  expect(s0.graphParams.u).toBe(0);
  expect(s0.graphParams.t).toBe(0);
  await expect(a.locator('[data-view="graph"] [data-item-id="t-cursor"]')).toHaveCount(0);
  await expect(a.locator('[data-view="graph"] [data-item-id="vx-t"]')).toHaveCount(1);
  await expect(a.locator('[data-view="graph"] [data-item-id="vy-t"]')).toHaveCount(1);
});

test('projectile page: playback lands exactly at T; switching questions rebuilds a session', async ({
  page,
}) => {
  await page.goto('/projectile.html');
  const a = page.locator('[data-panel="p-a"]');
  const b = page.locator('[data-panel="p-b"]');

  // B plays from t=0 at 2x and stops exactly at T=2.
  await b.locator('.in-rate').selectOption('2');
  await b.locator('.btn-play').click();
  await expect(b.locator('.p-readout')).toHaveText(/t = 2 s \/ T = 2 s/, { timeout: 5000 });
  await expect(b.locator('.p-readout')).toHaveText(/已落地/);
  await expect(b.locator('.btn-play')).toHaveText('播放', { timeout: 3000 });
  await page.waitForTimeout(400);
  await expect(b.locator('.p-readout')).toHaveText(/t = 2 s \/ T = 2 s/);

  // A switches to the velocity-decompose question (starts at t=1, T=2).
  await a.locator('.q-select').selectOption('q-velocity-decompose');
  await expect(a.locator('.p-readout')).toHaveText(/t = 1 s \/ T = 2 s/);
  await expect(a.locator('.p-readout')).toHaveText(/v \(10, -10\) m\/s/);
  await expect(a.locator('.in-t')).toHaveAttribute('max', '2');
  // Same question can open twice on the page — SVG title ids stay unique.
  await a.locator('.q-select').selectOption('q-range');
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('svg title[id]')].map((el) => el.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test('projectile page: formula panel tracks the same t; u=0 shows precondition text', async ({
  page,
}) => {
  await page.goto('/projectile.html');
  const a = page.locator('[data-panel="p-a"]');
  const formula = a.locator('.qp-formula');

  // 10 registered formulas render KaTeX (or an explicit not-applicable note).
  await expect(formula.locator('.f-item')).toHaveCount(10);
  await expect(formula.locator('.f-item .katex').first()).toBeVisible();
  const vyItem = formula.locator('.f-item[data-formula="vy"]');
  await expect(vyItem).toContainText('0'); // vy = -g·0 = 0 at t=0

  // Scrub t: formulas re-render off the same snapshot (vy = -10·1.5 = -15).
  await a.locator('.in-t').fill('1.5');
  await expect(vyItem).toContainText('15');
  const [s] = await snaps(page);
  expect(s.derived.velocity).toEqual({ x: 10, y: -15 });

  // u=0 free fall: ÷u formulas degrade to an honest not-applicable note,
  // not a fake result.
  await a.locator('.q-unlock').click();
  await a.locator('.in-u').fill('0');
  await a.locator('.in-u').dispatchEvent('change');
  await expect(formula.locator('.f-item.f-na')).toHaveCount(2); // traj + tan-alpha
  await expect(formula.locator('.f-item[data-formula="traj"]')).toContainText('u=0');
});

test('projectile page: guided teaching walks steps with cues bound to t/formula/view', async ({
  page,
}) => {
  await page.goto('/projectile.html');
  const a = page.locator('[data-panel="p-a"]'); // q-landing-time: T=3, R=30
  const teach = a.locator('.q-teach');

  // Enter guide: step 1/3 highlights, cue points at the conditions form.
  await teach.click();
  await expect(teach).toHaveText('结束讲解');
  await expect(a.locator('.q-guide')).toBeVisible();
  await expect(a.locator('.g-counter')).toHaveText('讲解 1 / 3');
  await expect(a.locator('.g-prev')).toBeDisabled();
  await expect(a.locator('.q-steps li').nth(0)).toHaveClass(/s-current/);
  await expect(a.locator('.qp-controls')).toHaveClass(/teach-focus/);

  // Step 2: the T formula lights up in the formula panel.
  await a.locator('.g-next').click();
  await expect(a.locator('.g-counter')).toHaveText('讲解 2 / 3');
  await expect(a.locator('.q-steps li').nth(1)).toHaveClass(/s-current/);
  await expect(a.locator('.f-item[data-formula="T"]')).toHaveClass(/f-focus/);
  await expect(a.locator('.qp-formula')).toHaveClass(/teach-focus/);

  // Step 3: cue drives t to 3 through the session boundary — ball lands,
  // scene gets the focus, R formula lights.
  await a.locator('.g-next').click();
  await expect(a.locator('.g-next')).toHaveText('完成');
  await expect(a.locator('.p-readout')).toHaveText(/t = 3 s \/ T = 3 s/);
  await expect(a.locator('.p-readout')).toHaveText(/已落地/);
  await expect(a.locator('[data-view="scene"]')).toHaveClass(/teach-focus/);
  await expect(a.locator('.f-item[data-formula="R"]')).toHaveClass(/f-focus/);
  const [s] = await snaps(page);
  expect(s.params.t).toBe(3);

  // 上一步 returns to step 2 (formula focus back); 完成 exits cleanly.
  await a.locator('.g-prev').click();
  await expect(a.locator('.g-counter')).toHaveText('讲解 2 / 3');
  await a.locator('.g-next').click();
  await a.locator('.g-next').click(); // 完成
  await expect(a.locator('.q-guide')).toBeHidden();
  await expect(teach).toHaveText('讲解演示');
  await expect(a.locator('.f-item.f-focus')).toHaveCount(0);
  await expect(a.locator('.teach-focus')).toHaveCount(0);
});

test('projectile page: reduced-motion guide still applies step cues instantly', async ({ page }) => {
  await page.goto('/projectile.html');
  const a = page.locator('[data-panel="p-a"]');
  await page.locator('#opt-motion').check();

  await a.locator('.q-teach').click();
  // Stepping is content, not motion: focus classes land synchronously.
  await expect(a.locator('.g-counter')).toHaveText('讲解 1 / 3');
  await expect(a.locator('.qp-controls')).toHaveClass(/teach-focus/);
  await a.locator('.g-exit').click();
  await expect(a.locator('.q-guide')).toBeHidden();

  // Switching question mid-guide exits cleanly and rebuilds the session.
  await a.locator('.q-teach').click();
  await a.locator('.q-select').selectOption('q-range');
  await expect(a.locator('.q-guide')).toBeHidden();
  await expect(a.locator('.q-teach')).toHaveText('讲解演示');
  await expect(a.locator('.p-readout')).toHaveText(/t = 0 s \/ T = 2 s/);
});

test('projectile page: live documents validate through authoring boundary', async ({ page }) => {
  await page.goto('/projectile.html');
  const [sa, sb] = await snaps(page);
  for (const s of [sa, sb]) {
    expect(s.mode).toBe('original');
    const sceneChecked = authoring.validateScene({
      document: {
        schemaVersion: 1,
        instanceId: `${s.questionId}-check`,
        templateId: 'horizontal-projectile',
        templateVersion: 1,
        unit: 'si',
        params: s.params,
        presentation: {
          theme: { id: 'illustrated', version: 2 },
          canvas: { width: 640, height: 360 },
          viewport: { mode: 'fit' },
        },
      },
    });
    expect(sceneChecked.ok).toBe(true);
    if (sceneChecked.ok) expect(sceneChecked.derived.T).toBeCloseTo(s.derived.T, 10);
  }
  await page.screenshot({
    path: 'test-results/screenshots/projectile-panels.png',
    fullPage: true,
  });
});
