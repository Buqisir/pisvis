import { expect, test, type Page } from '@playwright/test';

// Gallery is the second vite page; scene SVGs are pure-string renders mounted
// into themed stage containers. Geometry lives in the viewBox coordinate space.

const THEMES = [
  ['#theme-a', 'illustrated'],
  ['#theme-b', 'linework'],
] as const;
const SVG_COUNT = 19; // 13 specimen cells + 1 composition + 1 decomposition + 4 edge panels

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
          poly.getAttribute('points')!.split(' ')[0]!,
        ];
      }
    }
    return out;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/gallery.html');
});

test('loads; both themes render; compare shows 2 stages per scene', async ({ page }) => {
  // screenshots are taken of the final static state; reduce motion so no
  // entrance is in flight and the linkage demo never autostarts
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();

  await expect(page.locator('.specimen')).toHaveCount(4);
  // default load renders under DEFAULT_THEME's scope (illustrated@v2;
  // Node-side tests assert DEFAULT_THEME === THEME_ILLUSTRATED)
  await expect(page.locator('[data-pv-theme="illustrated"] svg')).toHaveCount(SVG_COUNT);
  await expect(page.locator('.specimen svg.pv-scene')).toHaveCount(SVG_COUNT);
  await page.screenshot({ path: 'test-results/screenshots/gallery-a.png', fullPage: true });

  await page.locator('#theme-b').check();
  await page.screenshot({ path: 'test-results/screenshots/gallery-b.png', fullPage: true });

  await page.locator('#theme-both').check();
  await expect(page.locator('svg.pv-scene')).toHaveCount(2 * SVG_COUNT);
  for (const [, id] of THEMES) {
    await expect(page.locator(`[data-pv-theme="${id}"] svg`)).toHaveCount(SVG_COUNT);
  }
  await page.screenshot({ path: 'test-results/screenshots/gallery-compare.png', fullPage: true });
});

for (const [radio] of THEMES) {
  test(`every painted shape has a role/axis fill, never default black (${radio})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.locator(radio).check();
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      // var(--pv-role) lives on the role group, so probes must be mounted
      // inside the element whose scope we want to resolve
      const probe = (host: Element, varName: string): string => {
        const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        (tmp as SVGRectElement).style.fill = `var(${varName})`;
        host.append(tmp);
        const v = getComputedStyle(tmp).fill;
        tmp.remove();
        return v;
      };
      for (const svg of document.querySelectorAll('svg')) {
        const paper = probe(svg, '--pv-paper');
        const axis = probe(svg, '--pv-axis');
        for (const el of svg.querySelectorAll(
          '.pv-head, .pv-dot, .pv-handle-dot, .pv-zero, .pv-axis-head')) {
          const cls = el.getAttribute('class')!;
          const fill = getComputedStyle(el).fill;
          const group = el.closest('[class*="pv-role-"]');
          const stroke = getComputedStyle(el).stroke;
          const isGradient = fill.startsWith('url(');
          const hollowByDesign = fill === paper; // flat dots are hollow: stroke carries the role
          let paintedOk: boolean;
          if (cls.includes('axis-head')) {
            paintedOk = isGradient || fill === axis;
          } else {
            // role fill; selected states may legitimately paint --pv-selection
            const accepts = group
              ? [probe(group, '--pv-role'), probe(group, '--pv-selection')]
              : [];
            paintedOk = isGradient || accepts.includes(fill) ||
              (hollowByDesign && accepts.includes(stroke));
          }
          if (!paintedOk || fill === 'none' || fill === 'rgb(0, 0, 0)') {
            out.push(`${svg.getAttribute('aria-labelledby')}:${cls} fill=${fill} stroke=${stroke}`);
          }
        }
      }
      return out;
    });
    expect(bad).toEqual([]);
  });
}

test('labels and ticks read >=13px effective at 1280px wide', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('#theme-a').check();
  const minFont = await page.evaluate(() => {
    let min = Infinity;
    for (const t of document.querySelectorAll('svg .pv-label, svg .pv-tick')) {
      const svg = t.closest('svg')!;
      const scale = svg.getBoundingClientRect().width / (svg as SVGSVGElement).viewBox.baseVal.width;
      const eff = Number.parseFloat(getComputedStyle(t).fontSize) * scale;
      if (eff < min) min = eff;
    }
    return min;
  });
  expect(minFont).toBeGreaterThanOrEqual(12.5); // ~13 nominal with rounding slack
});


for (const [radio] of THEMES) {
  test(`no two text elements overlap within any svg (${radio})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.locator(radio).check();
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
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const geoA = await arrowGeo(page);
  const readoutsA = await page.locator('.scene-readout').allTextContents();
  for (const [radio] of [['#theme-b'], ['#theme-a']] as const) {
    await page.locator(radio).check();
    expect(await arrowGeo(page)).toEqual(geoA);
    expect(await page.locator('.scene-readout').allTextContents()).toEqual(readoutsA);
  }
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

test('reduced-motion checkbox zeroes transitions and disables the demo', async ({ page }) => {
  await page.locator('#opt-motion').check();
  const dur = await page.locator('.pv-ring').first()
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(dur).toBe('0s');
  // scroll everything into view — nothing may animate and the demo stays off
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.cell, .stage-outer')) el.scrollIntoView();
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator('#demo-toggle')).toBeDisabled();
  await expect(page.locator('#demo-note')).toHaveText('减少动效已开启');
  expect(await page.evaluate(() => window.__pvDemo.loops)).toBe(0);
});

test.describe('emulated reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('prefers-reduced-motion: no entrance, no autostart, demo disabled', async ({ page }) => {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('.cell, .stage-outer')) el.scrollIntoView();
    });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page.locator('#demo-toggle')).toBeDisabled();
    expect(await page.evaluate(() => window.__pvDemo.loops)).toBe(0);
  });
});

for (const size of [{ width: 1280, height: 800 }, { width: 600, height: 900 }]) {
  test(`long labels stay inside the viewBox at ${size.width}x${size.height}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(size);
    await page.reload();
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
  const stops: Array<[string, string]> = [];
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => {
      const el = document.activeElement;
      return [el?.id ?? '', el ? getComputedStyle(el).outlineStyle : 'none'];
    }));
  }
  // the theme radio group is one Tab stop landing on the checked member;
  // its siblings are reached with arrow keys; toolbar buttons follow the form
  for (const id of ['theme-a', 'opt-gray', 'opt-motion', 'opt-long']) {
    expect(stops.map(([id]) => id)).toContain(id);
  }
  const axStop = stops.find(([id]) => id === 'opt-gray');
  expect(axStop?.[1]).not.toBe('none');

  await page.locator('#theme-a').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#theme-b')).toBeChecked();
  await expect(page.locator('svg.pv-scene')).toHaveCount(SVG_COUNT);
});

test('boundary scene keeps the (8,8) derived tip inside the viewBox', async ({ page }) => {
  const inside = await page.evaluate(() => {
    const g = document.querySelector('[data-item-id="e-r8"]');
    const poly = g?.querySelector('polygon');
    const svg = g?.closest('svg') as SVGSVGElement | null;
    if (!poly || !svg) return false;
    const tip = poly.getAttribute('points')!.split(' ')[0]!.split(',').map(Number);
    const vb = svg.viewBox.baseVal;
    return tip[0]! <= vb.width && tip[0]! >= 0 && tip[1]! <= vb.height && tip[1]! >= 0;
  });
  expect(inside).toBe(true);
});

// ----- motion layer --------------------------------------------------------

test('entrance animations settle into exactly the static render', async ({ page }) => {
  const before = await arrowGeo(page);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.cell, .stage-outer')) el.scrollIntoView();
  });
  await page.waitForFunction(() => window.__pvDemo.entrances > 0, { timeout: 5000 });
  await page.waitForFunction(() => document.getAnimations().length === 0, { timeout: 20000 });
  // geometry untouched, no inline animation styles left behind
  expect(await arrowGeo(page)).toEqual(before);
  expect(await page.evaluate(() =>
    document.querySelectorAll('svg [style]').length)).toBe(0);
  const opacities = await page.evaluate(() =>
    [...document.querySelectorAll('.pv-shaft, .pv-head, .pv-dot, .pv-label')]
      .map((el) => getComputedStyle(el).opacity));
  for (const o of opacities) expect(o).toBe('1');
});

test('linkage demo: R = A + B in readout and in the svg', async ({ page }) => {
  await page.locator('.specimen[data-key="sum"] .stage-outer').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__pvDemo.loops === 1, { timeout: 15000 });
  await page.waitForFunction(() => window.__pvDemo.frames > 5, { timeout: 10000 });
  await page.locator('#demo-toggle').click(); // pause
  const res = await page.evaluate(() => {
    const text = document.querySelector('.specimen[data-key="sum"] .scene-readout')!.textContent!;
    const m = /B=\((-?[\d.]+), (-?[\d.]+)\).*R=A\+B=\((-?[\d.]+), (-?[\d.]+)\)/.exec(text);
    const svg = document.querySelector<SVGSVGElement>('.specimen[data-key="sum"] svg')!;
    const tip = (id: string) =>
      svg.querySelector(`[data-item-id="${id}"] polygon`)!
        .getAttribute('points')!.split(' ')[0]!.split(',').map(Number);
    const o = svg.querySelector<SVGCircleElement>('[data-item-id="sum-o"] .pv-dot')!;
    return {
      readout: m ? m.slice(1).map(Number) : null,
      a: tip('sum-a'), b: tip('sum-b'), r: tip('sum-r'),
      ox: o.cx.baseVal.value, oy: o.cy.baseVal.value,
    };
  });
  expect(res.readout).not.toBeNull();
  const [bx, by, rx, ry] = res.readout!;
  expect(Math.abs(2 + bx - rx)).toBeLessThan(0.001);
  expect(Math.abs(1 + by - ry)).toBeLessThan(0.001);
  // worldToScreen is linear: tipR = tipA + tipB - origin
  expect(res.r[0]!).toBeCloseTo(res.a[0]! + res.b[0]! - res.ox, 0);
  expect(res.r[1]!).toBeCloseTo(res.a[1]! + res.b[1]! - res.oy, 0);
});

test('theme switch while the demo plays keeps exactly one rAF loop', async ({ page }) => {
  await page.locator('.specimen[data-key="sum"] .stage-outer').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__pvDemo.loops === 1, { timeout: 15000 });
  const framesBefore = await page.evaluate(() => window.__pvDemo.frames);
  await page.locator('#theme-b').check();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__pvDemo.loops)).toBe(1);
  expect(await page.evaluate(() => window.__pvDemo.frames)).toBeGreaterThan(framesBefore);
  // no leftover animations after a re-render while the demo keeps playing
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('replaying twice quickly does not stack animations', async ({ page }) => {
  const cell = page.locator('.specimen[data-key="decomp"] .stage-outer');
  await cell.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__pvDemo.entrances > 0, { timeout: 5000 });
  await page.waitForFunction(() => document.getAnimations().length === 0, { timeout: 20000 });
  await page.locator('.specimen[data-key="decomp"] .replay').click();
  await page.waitForTimeout(60);
  const once = await page.evaluate(() => document.getAnimations().length);
  await page.locator('.specimen[data-key="decomp"] .replay').click();
  await page.waitForTimeout(60);
  const twice = await page.evaluate(() => document.getAnimations().length);
  expect(once).toBeGreaterThan(0);
  expect(twice).toBe(once); // second replay cancels the first, not stacks
});

test('reset returns the demo to the default parameters', async ({ page }) => {
  await page.locator('.specimen[data-key="sum"] .stage-outer').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__pvDemo.loops === 1, { timeout: 15000 });
  await page.waitForFunction(() => window.__pvDemo.frames > 5, { timeout: 10000 });
  await page.locator('#demo-reset').click();
  await expect(page.locator('.specimen[data-key="sum"] .scene-readout'))
    .toContainText('B=(0.5, 1.8)');
  expect(await page.evaluate(() => window.__pvDemo.loops)).toBe(0);
});
