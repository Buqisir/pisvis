import { expect, test, type Page } from '@playwright/test';

// Drag tests use real mouse drags. World (x,y) is converted to client px via
// the LIVE getScreenCTM: SVG px = (320 + x*zoom, 180 - y*zoom), then CTM.
// Resulting state is read back from the inputs; tolerance is 0.01 world units.

const EPS = 0.01;

async function worldToClient(page: Page, x: number, y: number) {
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

async function dragWorld(
  page: Page,
  from: [number, number],
  to: [number, number],
) {
  const a = await worldToClient(page, from[0], from[1]);
  const b = await worldToClient(page, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

async function inputNumber(page: Page, id: string) {
  return parseFloat(await page.locator(`#${id}`).inputValue());
}

function near(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(EPS);
}

async function expectEndpoint(page: Page, which: 'start' | 'end', x: number, y: number) {
  const [xId, yId] = which === 'start' ? ['ax', 'ay'] : ['bx', 'by'];
  near(await inputNumber(page, xId), x);
  near(await inputNumber(page, yId), y);
}

async function installPointerIdProbe(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __pid: number | null }).__pid = null;
    document.getElementById('canvas')!.addEventListener('pointerdown', (e) => {
      (window as unknown as { __pid: number | null }).__pid =
        (e as PointerEvent).pointerId;
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('dragging each endpoint updates inputs, readout and handle position', async ({ page }) => {
  await page.screenshot({
    path: 'test-results/screenshots/drag-default.png',
    fullPage: true,
  });

  await dragWorld(page, [2, 1], [1.5, -0.5]);
  await expectEndpoint(page, 'end', 1.5, -0.5);
  await expect(page.locator('#readout')).toHaveText(/终点 \(1\.5, -0\.5\)/);
  await expect(page.locator('#status')).toHaveText(/终点移到 \(1\.5, -0\.5\)/);
  // world (1.5,-0.5) at zoom 50 -> svg (395, 205)
  const dot = page.locator('[data-handle="end"] .dot');
  near(parseFloat((await dot.getAttribute('cx'))!), 395);
  near(parseFloat((await dot.getAttribute('cy'))!), 205);

  // grabbing the start handle selects it automatically
  await dragWorld(page, [-2, -1], [-3, 1.5]);
  await expectEndpoint(page, 'start', -3, 1.5);
  await expect(page.locator('#sel-start')).toBeChecked();
  await expect(page.locator('#status')).toHaveText(/起点移到/);
});

test('number input moves the handle and dragging writes the input back', async ({ page }) => {
  await page.locator('#bx').fill('3');
  await expect(page.locator('[data-handle="end"] .dot')).toHaveAttribute('cx', '470');
  await dragWorld(page, [3, 1], [0.5, 0.5]);
  await expectEndpoint(page, 'end', 0.5, 0.5);
});

test('continuous decimals land without step mismatch or error', async ({ page }) => {
  await dragWorld(page, [2, 1], [1.237, 0.613]);
  const bx = page.locator('#bx');
  await expect(bx).toHaveValue('1.237');
  expect(await bx.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(true);
  await expect(page.locator('#status')).toHaveText(/终点移到 \(1\.237, 0\.613\)/);
});

test('coincident endpoints separate via the endpoint radios', async ({ page }) => {
  for (const id of ['ax', 'ay', 'bx', 'by']) {
    await page.locator(`#${id}`).fill('0');
  }
  await page.locator('#sel-start').check();
  // (0,0) is one drawn point; the selected 起点 handle is on top there.
  await dragWorld(page, [0, 0], [1, 1]);
  await expectEndpoint(page, 'start', 1, 1);
  await expectEndpoint(page, 'end', 0, 0);
  await page.screenshot({
    path: 'test-results/screenshots/coincident-separated.png',
    fullPage: true,
  });
});

test('invalid input keeps the last graphic; dragging the endpoint recovers', async ({ page }) => {
  // the scene svg now also contains axis-head polygons; the role arrow head is .pv-head
  const tip = page.locator('#canvas svg polygon.pv-head');
  await expect(tip).toHaveAttribute('points', /^420,130 /);
  await page.locator('#bx').fill('9');
  await expect(page.locator('#status')).toHaveText(/请填写范围内的有限数值/);
  await expect(page.locator('#bx')).toHaveAttribute('aria-invalid', 'true');
  await expect(tip).toHaveAttribute('points', /^420,130 /);
  await page.screenshot({
    path: 'test-results/screenshots/invalid-input.png',
    fullPage: true,
  });

  await dragWorld(page, [2, 1], [3, 1]);
  await expect(page.locator('#status')).toHaveText(/终点移到/);
  await expect(page.locator('#bx')).not.toHaveAttribute('aria-invalid', 'true');
  await expectEndpoint(page, 'end', 3, 1);
});

test('reset restores defaults and ends an in-progress drag', async ({ page }) => {
  await dragWorld(page, [2, 1], [1, 0]);
  await page.getByRole('button', { name: '重置' }).click();
  await expect(page.locator('#ax')).toHaveValue('-2');
  await expect(page.locator('#bx')).toHaveValue('2');
  await expect(page.locator('#zoom')).toHaveValue('50');
  await expect(page.locator('#sel-end')).toBeChecked();
  await expect(page.locator('#status')).toHaveText('');
  await expect(page.locator('#readout')).toHaveText(/长度 4\.472/);

  // reset while the mouse button is still held mid-drag
  const a = await worldToClient(page, 2, 1);
  const far = await worldToClient(page, -3, 1.9);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.evaluate(() => {
    (document.getElementById('controls') as HTMLFormElement).reset();
  });
  await page.mouse.move(far.x, far.y, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('#bx')).toHaveValue('2');
  await dragWorld(page, [2, 1], [0.5, -1]);
  await expectEndpoint(page, 'end', 0.5, -1);
});

for (const viewportSize of [
  { width: 1280, height: 800 },
  { width: 600, height: 900 },
]) {
  for (const zoom of [20, 35, 60]) {
    test(`drag lands on world coordinates at zoom ${zoom}, viewport ${viewportSize.width}x${viewportSize.height}`, async ({ page }) => {
      await page.setViewportSize(viewportSize);
      await page.locator('#zoom').fill(String(zoom));
      await dragWorld(page, [2, 1], [-1.4, 1.7]);
      await expectEndpoint(page, 'end', -1.4, 1.7);
      if (viewportSize.width === 600 && zoom === 60) {
        await page.screenshot({
          path: 'test-results/screenshots/mobile-layout.png',
          fullPage: true,
        });
      }
    });
  }
}

test('dragging still lands correctly after the page is scrolled', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 420 });
  await page.evaluate(() => window.scrollTo(0, 240));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const a = await worldToClient(page, 2, 1);
  expect(a.y).toBeGreaterThan(0);
  expect(a.y).toBeLessThan(420);
  await dragWorld(page, [2, 1], [-0.5, 1.5]);
  await expectEndpoint(page, 'end', -0.5, 1.5);
});

test('dragging out of the canvas clamps to the bounds and releases cleanly', async ({ page }) => {
  const a = await worldToClient(page, 2, 1);
  const beyond = await worldToClient(page, 6, 2.5); // inside the svg, past world bounds
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(beyond.x, beyond.y, { steps: 6 });
  // leave the canvas entirely on the +x/+y side (still inside the viewport,
  // still inside the world x>4 / y>2 region) and release there
  const box = (await page.locator('#canvas').boundingBox())!;
  const outX = Math.min(box.x + box.width + 30, 1279);
  const outY = Math.max(box.y - 30, 5);
  await page.mouse.move(outX, outY, { steps: 2 });
  await page.mouse.up();
  await expectEndpoint(page, 'end', 4, 2);

  await dragWorld(page, [4, 2], [0, 0]);
  await expectEndpoint(page, 'end', 0, 0);
});

test('pointercancel ends the drag and a later drag works', async ({ page }) => {
  await installPointerIdProbe(page);
  const a = await worldToClient(page, 2, 1);
  const mid = await worldToClient(page, 1, 0.5);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(mid.x, mid.y, { steps: 3 });
  const pid = await page.evaluate(() => (window as unknown as { __pid: number }).__pid);
  await page.evaluate((id) => {
    document.getElementById('canvas')!.dispatchEvent(
      new PointerEvent('pointercancel', { pointerId: id, bubbles: true }),
    );
  }, pid);
  const other = await worldToClient(page, -2, -1.5);
  await page.mouse.move(other.x, other.y, { steps: 3 });
  await page.mouse.up();
  near(await inputNumber(page, 'bx'), 1);
  await dragWorld(page, [1, 0.5], [2.5, 1.5]);
  await expectEndpoint(page, 'end', 2.5, 1.5);
});

test('lostpointercapture ends the drag and a later drag works', async ({ page }) => {
  await installPointerIdProbe(page);
  const a = await worldToClient(page, 2, 1);
  const mid = await worldToClient(page, 0, 0);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(mid.x, mid.y, { steps: 3 });
  const pid = await page.evaluate(() => (window as unknown as { __pid: number }).__pid);
  await page.evaluate((id) => {
    document.getElementById('canvas')!.releasePointerCapture(id);
  }, pid);
  const other = await worldToClient(page, -3, -1);
  await page.mouse.move(other.x, other.y, { steps: 3 });
  await page.mouse.up();
  near(await inputNumber(page, 'bx'), 0);
  await dragWorld(page, [0, 0], [-1, -1]);
  await expectEndpoint(page, 'end', -1, -1);
});

test('a second pointer and the secondary mouse button are ignored', async ({ page }) => {
  const a = await worldToClient(page, 2, 1);
  const mid = await worldToClient(page, 0.5, 0.5);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(mid.x, mid.y, { steps: 3 });
  // a non-primary touch pointer tries to grab the start handle mid-drag
  await page.evaluate(() => {
    const g = document.querySelector('[data-handle="start"]')!;
    for (const type of ['pointerdown', 'pointermove']) {
      g.dispatchEvent(new PointerEvent(type, {
        pointerId: 77, pointerType: 'touch', isPrimary: false, bubbles: true,
        clientX: 100, clientY: 100, button: 0,
      }));
    }
  });
  await page.mouse.up();
  await expectEndpoint(page, 'end', 0.5, 0.5);
  await expectEndpoint(page, 'start', -2, -1);

  // right mouse button does not start a drag
  const b = await worldToClient(page, -2, -1);
  const c = await worldToClient(page, 0, 0);
  await page.mouse.move(b.x, b.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(c.x, c.y, { steps: 3 });
  await page.mouse.up({ button: 'right' });
  await expectEndpoint(page, 'start', -2, -1);
});

test('keyboard reaches inputs and radios; focus stays visible', async ({ page }) => {
  const stops: Array<[string, string]> = [];
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => {
      const el = document.activeElement;
      return [el?.id ?? '', el ? getComputedStyle(el).outlineStyle : 'none'];
    }));
  }
  for (const id of ['ax', 'ay', 'bx', 'by', 'zoom', 'sel-end']) {
    expect(stops.map(([id]) => id)).toContain(id);
  }

  // a focused element shows a visible outline (not suppressed)
  const axStop = stops.find(([id]) => id === 'ax');
  expect(axStop?.[1]).not.toBe('none');

  // arrow keys move the radio selection to 起点
  await page.locator('#sel-end').focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#sel-start')).toBeChecked();
  await expect(page.locator('[data-handle="start"].selected')).toHaveCount(1);

  // typing into a field updates the drawing
  await page.locator('#ax').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('-3.5');
  await expect(page.locator('#ax')).toHaveValue('-3.5');
  await expect(page.locator('#readout')).toHaveText(/起点 \(-3\.5, -1\)/);
});
