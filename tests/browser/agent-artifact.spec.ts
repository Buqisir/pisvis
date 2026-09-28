import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// End-to-end acceptance: the built CLI produces a standalone SVG that renders
// correctly (themed, not black) when opened in a real browser — no page, no CSS link.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = join(ROOT, 'dist/cli/pisvis.js');
const OUT_DIR = join(ROOT, 'test-results', 'agent');

const CAPS: readonly { id: string; create: unknown; shaftGapCheck: boolean }[] = [
  {
    id: 'arrow',
    create: { templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 }, end: { x: 3, y: 4 } } },
    shaftGapCheck: true,
  },
  {
    id: 'vector-add',
    create: { templateId: 'vector-add', templateVersion: 1, params: { a: { x: 2, y: 1 }, b: { x: 0.5, y: 1.8 } } },
    shaftGapCheck: false,
  },
  {
    id: 'vector-decompose',
    create: { templateId: 'vector-decompose', templateVersion: 1, params: { v: { x: 2.4, y: 1.6 } } },
    shaftGapCheck: false,
  },
];

for (const cap of CAPS) {
  test(`agent-produced ${cap.id} svg renders themed in Chromium`, async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true });
    const createOut = execFileSync(process.execPath, [CLI, 'create', '--input', '-'], {
      input: JSON.stringify(cap.create), encoding: 'utf8',
    });
    const created = JSON.parse(createOut);
    expect(created.ok).toBe(true);
    const docFile = join(OUT_DIR, `${cap.id}-doc.json`);
    writeFileSync(docFile, JSON.stringify({ document: created.document }));
    execFileSync(process.execPath, [CLI, 'render', '--input', docFile, '--out-dir', OUT_DIR, '--overwrite'], {
      encoding: 'utf8',
    });
    const svg = readFileSync(join(OUT_DIR, `${created.document.instanceId}.svg`), 'utf8');

    await page.setContent(svg, { waitUntil: 'load' });
    // shaft stroke and head fill are the theme's input color, not default black
    const paint = await page.evaluate(() => {
      const shaft = document.querySelector('.pv-shaft')!;
      const head = document.querySelector('.pv-head')!;
      return {
        stroke: getComputedStyle(shaft).stroke,
        fill: getComputedStyle(head).fill,
      };
    });
    expect(paint.stroke).not.toBe('rgb(0, 0, 0)');
    expect(paint.fill).toBe(paint.stroke); // input role color on both

    const overflow = await page.evaluate(() => {
      const svg = document.querySelector('svg') as SVGSVGElement;
      const vb = svg.viewBox.baseVal;
      const bad: string[] = [];
      for (const t of svg.querySelectorAll('text')) {
        const b = t.getBBox();
        if (b.x < -1 || b.y < -1 || b.x + b.width > vb.width + 1 || b.y + b.height > vb.height + 1) {
          bad.push(`${t.textContent}`);
        }
      }
      return bad;
    });
    expect(overflow).toEqual([]);

    if (cap.shaftGapCheck) {
      // the mid label must clear the shaft: min distance from its bbox to the segment >= 4px
      const gap = await page.evaluate(() => {
        const svg = document.querySelector('svg') as SVGSVGElement;
        const shaft = svg.querySelector<SVGLineElement>('.pv-shaft')!;
        const label = svg.querySelector<SVGTextElement>('.pv-label')!;
        const a = { x: shaft.x1.baseVal.value, y: shaft.y1.baseVal.value };
        const b = { x: shaft.x2.baseVal.value, y: shaft.y2.baseVal.value };
        const r = label.getBBox();
        const dist = (px: number, py: number) => {
          const dx = b.x - a.x, dy = b.y - a.y;
          const t = Math.max(0, Math.min(1,
            ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy)));
          const cx = a.x + t * dx, cy = a.y + t * dy;
          return Math.hypot(px - cx, py - cy);
        };
        // segment-rect intersection collapses the gap to 0
        const cross = (o: { x: number; y: number }, p: { x: number; y: number }, q: { x: number; y: number }) =>
          (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
        const segInt = (p1: typeof a, p2: typeof a, p3: typeof a, p4: typeof a) =>
          cross(p1, p2, p3) * cross(p1, p2, p4) < 0 && cross(p3, p4, p1) * cross(p3, p4, p2) < 0;
        const corners = [
          { x: r.x, y: r.y }, { x: r.x + r.width, y: r.y },
          { x: r.x, y: r.y + r.height }, { x: r.x + r.width, y: r.y + r.height },
        ];
        const edges = [[corners[0], corners[1]], [corners[1], corners[3]],
          [corners[3], corners[2]], [corners[2], corners[0]]] as const;
        for (const [e1, e2] of edges) if (segInt(a, b, e1!, e2!)) return 0;
        // shaft endpoints inside the rect → 0
        for (const p of [a, b]) {
          if (p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height) return 0;
        }
        return Math.min(...corners.map((c) => dist(c.x, c.y)),
          dist(r.x + r.width / 2, r.y), dist(r.x + r.width / 2, r.y + r.height),
          dist(r.x, r.y + r.height / 2), dist(r.x + r.width, r.y + r.height / 2));
      });
      expect(gap).toBeGreaterThanOrEqual(4);
    }
    await page.screenshot({ path: `test-results/screenshots/agent-${cap.id}.png` });
  });
}
