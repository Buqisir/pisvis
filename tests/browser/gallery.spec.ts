import { expect, test, type Page } from '@playwright/test';

// Gallery is the second vite page; scene SVGs are pure-string renders mounted
// into themed stage containers. Geometry lives in the viewBox coordinate space.

async function arrowGeo(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, string[]> = {};
    for (const g of document.querySelectorAll('.pv-arrow')) {
      const id = g.getAttribute('data-item-id');
      const line = g.querySelector('line');
      const poly = g.querySelector('polygon');
      if (id && line && poly) {
        out[id] = [
          line.getAttribute('x1')!, line.getAttribute('y1')!,
          poly.getAttribute('points')!.split(' ')[0],
        ];
      }
    }
    return out;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/gallery.html');
});

test('loads with all four sections; both themes render in compare mode', async ({ page }) => {
  await expect(page.locator('.specimen')).toHaveCount(4);
  // 13 specimen cells + 1 composition + 1 decomposition + 4 edge panels
  await expect(page.locator('.specimen svg.pv-scene')).toHaveCount(19);
  await page.screenshot({ path: 'test-results/screenshots/gallery-a.png', fullPage: true });

  await page.locator('#theme-b').check();
  await page.screenshot({ path: 'test-results/screenshots/gallery-b.png', fullPage: true });

  await page.locator('#theme-both').check();
  await expect(page.locator('svg.pv-scene')).toHaveCount(38);
  await expect(page.locator('[data-pv-theme="candidate-illustrated"] svg')).toHaveCount(19);
  await expect(page.locator('[data-pv-theme="candidate-linework"] svg')).toHaveCount(19);
  await page.screenshot({ path: 'test-results/screenshots/gallery-compare.png', fullPage: true });
});

for (const themeRadio of ['#theme-a', '#theme-b']) {
  test(`no two text elements overlap within any svg (${themeRadio})`, async ({ page }) => {
    await page.locator(themeRadio).check();
    const collisions = await page.evaluate(() => {
      const bad: string[] = [];
      for (const svg of document.querySelectorAll('svg')) {
        const texts = [...svg.querySelectorAll('text')]
          .filter((t) => t.getBBox().width > 0 && t.getBBox().height > 0);
        for (let i = 0; i < texts.length; i++) {
          for (let j = i + 1; j < texts.length; j++) {
            const a = texts[i]!.getBBox();
            const b = texts[j]!.getBBox();
            if (a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 &&
                a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5) {
              bad.push(`${texts[i]!.textContent} × ${texts[j]!.textContent}`);
            }
          }
        }
      }
      return bad;
    });
    expect(collisions).toEqual([]);
  });
}

test('theme switching changes no readouts and no arrow geometry', async ({ page }) => {
  const readoutsA = await page.locator('.scene-readout').allTextContents();
  const geoA = await arrowGeo(page);
  await page.locator('#theme-b').check();
  expect(await arrowGeo(page)).toEqual(geoA);
  expect(await page.locator('.scene-readout').allTextContents()).toEqual(readoutsA);
});

test('side-by-side mode: ids are unique and every url(#) resolves inside its svg', async ({ page }) => {
  await page.locator('#theme-both').check();
  const result = await page.evaluate(() => {
    const all = [...document.querySelectorAll('[id]')].map((e) => e.id);
    const dangling: string[] = [];
    for (const svg of document.querySelectorAll('svg')) {
      const local = new Set([...svg.querySelectorAll('[id]')].map((e) => e.id));
      for (const el of svg.querySelectorAll('*')) {
        for (const attr of el.attributes) {
          const m = /url\(#([^)]+)\)/.exec(attr.value);
          if (m && !local.has(m[1])) dangling.push(m[1]);
        }
      }
    }
    return { count: all.length, unique: new Set(all).size, dangling };
  });
  expect(result.count).toBe(result.unique);
  expect(result.dangling).toEqual([]);
});

test('grayscale toggle applies the filter to the stage root', async ({ page }) => {
  await page.locator('#opt-gray').check();
  const filter = await page.locator('#scenes').evaluate((el) => getComputedStyle(el).filter);
  expect(filter).toBe('grayscale(1)');
  await page.screenshot({ path: 'test-results/screenshots/gallery-grayscale.png', fullPage: true });
});

test('reduced-motion checkbox zeroes transition durations', async ({ page }) => {
  await page.locator('#opt-motion').check();
  const dur = await page.locator('.pv-ring').first()
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(dur).toBe('0s');
});

test.describe('emulated reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('prefers-reduced-motion zeroes transition durations', async ({ page }) => {
    const dur = await page.locator('.pv-ring').first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(dur).toBe('0s');
  });
});

for (const size of [{ width: 1280, height: 800 }, { width: 600, height: 900 }]) {
  test(`long labels stay inside the viewBox at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.locator('#opt-long').check();
    const overflow = await page.evaluate(() => {
      const bad: string[] = [];
      for (const svg of document.querySelectorAll('svg')) {
        const vb = (svg as SVGSVGElement).viewBox.baseVal;
        for (const t of svg.querySelectorAll('text')) {
          const b = (t as SVGTextElement).getBBox();
          if (b.x < -1 || b.y < -1 ||
              b.x + b.width > vb.width + 1 || b.y + b.height > vb.height + 1) {
            bad.push(`${t.textContent} @${b.x.toFixed(0)},${b.y.toFixed(0)} ${b.width.toFixed(0)}x${b.height.toFixed(0)}`);
          }
        }
      }
      return bad;
    });
    expect(overflow).toEqual([]);
    if (size.width === 600) {
      await page.screenshot({ path: 'test-results/screenshots/gallery-mobile.png', fullPage: true });
    } else {
      await page.screenshot({ path: 'test-results/screenshots/gallery-long-labels.png', fullPage: true });
    }
  });
}

test('keyboard reaches every control with a visible focus outline', async ({ page }) => {
  const seen: string[] = [];
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => document.activeElement?.id ?? ''));
  }
  // the theme radio group is one Tab stop landing on the checked member;
  // its siblings are reached with arrow keys
  for (const id of ['theme-a', 'opt-gray', 'opt-motion', 'opt-long']) {
    expect(seen).toContain(id);
  }
  const outline = await page.evaluate(() =>
    getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe('none');

  await page.locator('#theme-a').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#theme-b')).toBeChecked();
  await expect(page.locator('svg.pv-scene')).toHaveCount(19);
});

test('boundary scene keeps the (8,8) derived tip inside the viewBox', async ({ page }) => {
  const inside = await page.evaluate(() => {
    const g = document.querySelector('[data-item-id="e-r8"]');
    const poly = g?.querySelector('polygon');
    const svg = g?.closest('svg') as SVGSVGElement | null;
    if (!poly || !svg) return false;
    const tip = poly.getAttribute('points')!.split(' ')[0].split(',').map(Number);
    const vb = svg.viewBox.baseVal;
    return tip[0]! <= vb.width && tip[0]! >= 0 && tip[1]! <= vb.height && tip[1]! >= 0;
  });
  expect(inside).toBe(true);
});
