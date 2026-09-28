// Presentation-only motion layer for the playground pages. Uses the Web
// Animations API with fill:'none' so the final DOM state always equals the
// static serializer output — no inline styles, no leftover animations.

export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.getElementById('scenes')?.classList.contains('pv-reduced-motion') === true;
}

function cleanup(anim: Animation): Animation {
  anim.finished.then(() => anim.cancel()).catch(() => {});
  return anim;
}

function fade(el: Element, delay: number, ms: number, easing: string): Animation {
  return cleanup(el.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: ms, delay, easing, fill: 'none' },
  ));
}

function drawIn(line: SVGLineElement, delay: number, ms: number, easing: string): Animation {
  let len = 0;
  try { len = line.getTotalLength(); } catch { return fade(line, delay, ms, easing); }
  return cleanup(line.animate(
    [{ strokeDasharray: `${len}`, strokeDashoffset: len },
     { strokeDasharray: `${len}`, strokeDashoffset: 0 }],
    { duration: ms, delay, easing, fill: 'none' },
  ));
}

function popIn(el: Element, origin: string, delay: number, ms: number, easing: string): Animation {
  return cleanup(el.animate(
    [{ transformBox: 'view-box', transformOrigin: origin, transform: 'scale(0.6)', opacity: 0 },
     { transformBox: 'view-box', transformOrigin: origin, transform: 'scale(1)', opacity: 1 }],
    { duration: ms, delay, easing, fill: 'none' },
  ));
}

function animatePart(
  el: Element, delay: number, ms: number, easing: string, anims: Animation[],
): void {
  if (el.classList.contains('pv-label')) return; // labels are their own stage
  if (el instanceof SVGLineElement && !el.hasAttribute('stroke-dasharray') &&
      !el.classList.contains('pv-gridline')) {
    anims.push(drawIn(el, delay, ms, easing));
    return;
  }
  if (el instanceof SVGPolygonElement) {
    const tip = el.getAttribute('points')?.split(' ')[0] ?? '0,0';
    anims.push(popIn(el, `${tip.replace(',', 'px ')}px`, delay, ms, easing));
    return;
  }
  if (el instanceof SVGCircleElement) {
    anims.push(popIn(el, `${el.cx.baseVal.value}px ${el.cy.baseVal.value}px`, delay, ms, easing));
    return;
  }
  if (el instanceof SVGGElement) {
    for (const child of el.children) animatePart(child, delay, ms, easing, anims);
    return;
  }
  anims.push(fade(el, delay, ms, easing)); // dashed lines, texts, axes parts
}

/**
 * Staged entrance for one svg. `stages` lists item-id groups in order; the
 * entry '*' means "every remaining .pv-item". A final implicit stage fades in
 * all .pv-label texts. Stagger = 0.5 * ms between stages.
 */
export function runEntrance(
  svg: SVGSVGElement,
  stages: readonly (readonly string[])[],
): Animation[] {
  const style = getComputedStyle(svg);
  const ms = Number.parseFloat(style.getPropertyValue('--pv-motion-ms')) || 200;
  const easing = style.getPropertyValue('--pv-easing').trim()
    || 'cubic-bezier(0.16, 1, 0.2, 1)';
  const anims: Animation[] = [];
  const seen = new Set<Element>();
  stages.forEach((ids, stageIndex) => {
    const delay = stageIndex * ms * 0.5;
    const targets = ids.includes('*')
      ? [...svg.querySelectorAll('.pv-item')]
      : ids.map((id) => svg.querySelector(`[data-item-id="${id}"]`))
        .filter((el): el is Element => el !== null);
    for (const item of targets) {
      if (seen.has(item)) continue;
      seen.add(item);
      for (const child of item.children) {
        animatePart(child, delay, ms, easing, anims);
      }
    }
  });
  const labelDelay = stages.length * ms * 0.5;
  for (const t of svg.querySelectorAll('.pv-label')) {
    anims.push(fade(t, labelDelay, ms * 0.7, easing));
  }
  return anims;
}

/** rAF loop calling apply(elapsedSeconds). Returns a stop function. */
export function linkageLoop(apply: (tSeconds: number) => void): () => void {
  let raf = 0;
  const t0 = performance.now();
  const frame = (now: number) => {
    apply((now - t0) / 1000);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
