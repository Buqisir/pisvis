import { worldToScreen } from '../core/viewport.js';
import type { Viewport } from '../core/viewport.js';
import { add, normalize, positive, scale, sub, vec2 } from '../math/vec2.js';
import type { Vec2 } from '../math/vec2.js';
import { buildArrow } from '../primitives/arrow.js';
import { xml } from './escape.js';
import { checkTheme } from '../theme/tokens.js';
import type { ThemeDefinition } from '../theme/tokens.js';

/** Semantic roles: input vectors, derived results, auxiliary components, guides. */
export type SceneRole = 'input' | 'derived' | 'component' | 'guide';
export type SceneState =
  'default' | 'selected' | 'dragging' | 'readonly' | 'error' | 'focus';

export interface SceneLabel {
  readonly text: string;
  readonly anchor: 'start' | 'mid' | 'end';
  /** Manual SVG-px offset applied after the theme's labelOffset. */
  readonly offsetPx?: Vec2;
}

export type SceneItem =
  | {
      readonly kind: 'axes';
      readonly id: string;
      readonly x: readonly [number, number];
      readonly y: readonly [number, number];
      readonly tick?: number;
      readonly grid?: boolean;
    }
  | {
      readonly kind: 'arrow';
      readonly id: string;
      readonly role: SceneRole;
      readonly from: Vec2;
      readonly to: Vec2;
      readonly dashed?: boolean;
      readonly label?: SceneLabel;
      readonly state?: SceneState;
      readonly handle?: boolean;
    }
  | {
      readonly kind: 'point';
      readonly id: string;
      readonly role: SceneRole;
      readonly at: Vec2;
      readonly label?: SceneLabel;
      readonly state?: SceneState;
    }
  | {
      readonly kind: 'segment';
      readonly id: string;
      readonly role: SceneRole;
      readonly from: Vec2;
      readonly to: Vec2;
      readonly dashed?: boolean;
    };

export interface SceneSvgOptions {
  readonly instanceId: string;
  readonly title: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly viewport: Viewport;
  readonly theme: ThemeDefinition;
  readonly items: readonly SceneItem[];
}

const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const ROLES = new Set(['input', 'derived', 'component', 'guide']);
const STATES = new Set(['default', 'selected', 'dragging', 'readonly', 'error', 'focus']);
const ANCHORS = new Set(['start', 'mid', 'end']);
const MAX_LABEL_CHARS = 200;

function checkId(id: string, what: string): string {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new RangeError(`${what} must match ${ID_PATTERN}`);
  }
  return id;
}

function checkRole(role: SceneRole): void {
  if (!ROLES.has(role)) throw new RangeError(`unknown scene role: ${String(role)}`);
}

function checkState(state: SceneState | undefined): SceneState {
  if (state === undefined) return 'default';
  if (!STATES.has(state)) throw new RangeError(`unknown scene state: ${String(state)}`);
  return state;
}

function checkLabel(label: SceneLabel | undefined): SceneLabel | undefined {
  if (label === undefined) return undefined;
  if (typeof label.text !== 'string' || label.text.length > MAX_LABEL_CHARS) {
    throw new RangeError(`label text must be a string of at most ${MAX_LABEL_CHARS} chars`);
  }
  if (!ANCHORS.has(label.anchor)) throw new RangeError(`unknown label anchor: ${String(label.anchor)}`);
  if (label.offsetPx !== undefined) vec2(label.offsetPx.x, label.offsetPx.y);
  return label;
}

function dashFor(role: SceneRole, theme: ThemeDefinition): string {
  return role === 'component' ? theme.dash.component : theme.dash.guide;
}

interface Ctx {
  readonly iid: string;
  readonly view: Viewport;
  readonly theme: ThemeDefinition;
  readonly soft: boolean;
  readonly glow: boolean;
  readonly linecap: 'round' | 'butt';
  readonly linejoin: 'round' | 'miter';
}

// Glow applies to luminous geometry only — never to labels, ticks or axes.
const GLOW_ROLES = new Set(['input', 'derived', 'component']);
function glowWrap(ctx: Ctx, role: SceneRole, inner: string): string {
  if (!ctx.glow || !GLOW_ROLES.has(role)) return inner;
  return `<g class="pv-glow" filter="url(#${ctx.iid}-glow)">${inner}</g>`;
}

function stateClass(state: SceneState): string {
  return `pv-state-${state}`;
}

// Label placement in SVG px. `dir` is the item's screen-space unit direction
// (null for points and zero vectors); `clearance` is the distance to keep so
// handles/rings/dots never sit under the text.
function labelTag(
  label: SceneLabel,
  p: Vec2,
  dir: Vec2 | null,
  clearance: number,
): string {
  const manual = label.offsetPx ?? { x: 0, y: 0 };
  const central = ' dominant-baseline="central"';
  let x = p.x;
  let y = p.y;
  let textAnchor = 'middle';
  let baseline = '';
  switch (label.anchor) {
    case 'start': {
      if (dir === null) { x -= clearance; textAnchor = 'end'; baseline = central; break; }
      x -= dir.x * clearance; y -= dir.y * clearance;
      textAnchor = dir.x > 0.3 ? 'end' : dir.x < -0.3 ? 'start' : 'middle';
      baseline = central;
      break;
    }
    case 'end': {
      if (dir === null) { x += clearance; textAnchor = 'start'; baseline = central; break; }
      // beyond the tip along the vector, nudged to the side
      x += dir.x * clearance - dir.y * clearance * 0.35;
      y += dir.y * clearance + dir.x * clearance * 0.35;
      textAnchor = dir.x > 0.3 ? 'start' : dir.x < -0.3 ? 'end' : 'middle';
      baseline = central;
      break;
    }
    default: { // 'mid'
      if (dir === null) { y -= clearance; break; }
      if (Math.abs(dir.y) < 0.35) {
        // horizontal item: below, away from a horizontal axis it may lie on
        y += clearance;
        baseline = ' dominant-baseline="hanging"';
      } else if (Math.abs(dir.x) < 0.35) {
        // vertical item: left, away from a vertical axis it may lie on
        x -= clearance;
        textAnchor = 'end';
        baseline = central;
      } else {
        const px = -dir.y;
        const py = dir.x;
        x += px * clearance; y += py * clearance;
        textAnchor = px > 0.3 ? 'start' : px < -0.3 ? 'end' : 'middle';
        baseline = central;
      }
    }
  }
  x += manual.x;
  y += manual.y;
  return `<text class="pv-label" x="${x}" y="${y}" text-anchor="${textAnchor}"${baseline}>${xml(label.text)}</text>`;
}

// Handle items need the label past the visible ring, not just labelOffset.
function labelClearance(theme: ThemeDefinition, hasHandle: boolean): number {
  const off = theme.space.labelOffset;
  if (hasHandle) {
    return Math.max(off, theme.point.handleRadius + 4 + off / 2);
  }
  return Math.max(off, theme.point.radius + off / 2);
}

function handleGroup(ctx: Ctx, p: Vec2, state: SceneState): string {
  const { point } = ctx.theme;
  const glow = ctx.glow ? ` filter="url(#${ctx.iid}-glow)"` : '';
  const parts = [
    `<circle class="pv-hit" cx="${p.x}" cy="${p.y}" r="${point.hitRadius}" fill="transparent" pointer-events="all"/>`,
    `<circle class="pv-handle-dot" cx="${p.x}" cy="${p.y}" r="${point.handleRadius}"${glow}/>`,
  ];
  if (state === 'selected' || state === 'dragging' || state === 'focus') {
    parts.push(`<circle class="pv-ring" cx="${p.x}" cy="${p.y}" r="${point.handleRadius + 4}"/>`);
  }
  return `<g class="pv-handle">${parts.join('')}</g>`;
}

function errorUnderlay(shape: string): string {
  return `<g class="pv-error-underlay">${shape}</g>`;
}

function renderArrow(ctx: Ctx, item: Extract<SceneItem, { kind: 'arrow' }>): string {
  const { theme, view } = ctx;
  const role = item.role;
  checkRole(role);
  const state = checkState(item.state);
  const label = checkLabel(item.label);
  const s = worldToScreen(item.from, view);
  const e = worldToScreen(item.to, view);
  const shape = buildArrow(s, e, theme.arrow.headLength, theme.arrow.headWidth);
  const dir = normalize(sub(e, s));
  const hasHandle = item.handle === true && state !== 'readonly';
  const clearance = labelClearance(theme, hasHandle);
  const dash = item.dashed ? ` stroke-dasharray="${dashFor(role, theme)}"` : '';
  const grad = ctx.soft ? ` fill="url(#${ctx.iid}-grad-${role})"` : '';
  const geom: string[] = [];
  if (shape.kind === 'zero') {
    geom.push(`<circle class="pv-zero" cx="${shape.point.x}" cy="${shape.point.y}" r="${theme.point.radius}"/>`);
  } else {
    const shaft = `<line class="pv-shaft" x1="${shape.start.x}" y1="${shape.start.y}" x2="${shape.base.x}" y2="${shape.base.y}" stroke-width="${theme.stroke.main}"${dash} stroke-linecap="${ctx.linecap}"/>`;
    if (state === 'error') {
      geom.push(errorUnderlay(
        `<line x1="${shape.start.x}" y1="${shape.start.y}" x2="${shape.base.x}" y2="${shape.base.y}" stroke-width="${theme.stroke.main + 2.5}" stroke-dasharray="2 3" stroke-linecap="butt"/>`,
      ));
    }
    geom.push(shaft);
    geom.push(`<polygon class="pv-head" points="${shape.tip.x},${shape.tip.y} ${shape.left.x},${shape.left.y} ${shape.right.x},${shape.right.y}"${grad} stroke-linejoin="${ctx.linejoin}"/>`);
  }
  const parts: string[] = [glowWrap(ctx, role, geom.join(''))];
  if (label !== undefined) {
    const anchorPx = label.anchor === 'start' ? s
      : label.anchor === 'end' ? e
      : scale(add(s, e), 0.5);
    parts.push(labelTag(label, anchorPx, dir, clearance));
  }
  if (hasHandle) {
    parts.push(handleGroup(ctx, e, state));
  }
  return `<g class="pv-item pv-arrow pv-role-${role} ${stateClass(state)}" data-item-id="${item.id}">${parts.join('')}</g>`;
}

function renderPoint(ctx: Ctx, item: Extract<SceneItem, { kind: 'point' }>): string {
  const { theme, view } = ctx;
  const role = item.role;
  checkRole(role);
  const state = checkState(item.state);
  const label = checkLabel(item.label);
  const p = worldToScreen(item.at, view);
  const geom: string[] = [];
  if (ctx.soft) {
    geom.push(`<circle class="pv-halo" cx="${p.x}" cy="${p.y}" r="${theme.point.radius * 2.2}"/>`);
  }
  if (state === 'error') {
    geom.push(errorUnderlay(
      `<circle cx="${p.x}" cy="${p.y}" r="${theme.point.radius + 2.5}" stroke-width="${theme.stroke.aux}" stroke-dasharray="2 3" fill="none"/>`,
    ));
  }
  geom.push(`<circle class="pv-dot" cx="${p.x}" cy="${p.y}" r="${theme.point.radius}" stroke-width="${theme.stroke.aux}"/>`);
  const parts: string[] = [
    ctx.glow
      ? `<g class="pv-glow" filter="url(#${ctx.iid}-glow)">${geom.join('')}</g>`
      : geom.join(''),
  ];
  if (state === 'focus') {
    parts.push(`<circle class="pv-ring" cx="${p.x}" cy="${p.y}" r="${theme.point.handleRadius + 4}"/>`);
  }
  if (label !== undefined) {
    parts.push(labelTag(label, p, null, labelClearance(theme, false)));
  }
  return `<g class="pv-item pv-point pv-role-${role} ${stateClass(state)}" data-item-id="${item.id}">${parts.join('')}</g>`;
}

function renderSegment(ctx: Ctx, item: Extract<SceneItem, { kind: 'segment' }>): string {
  const { theme, view } = ctx;
  const role = item.role;
  checkRole(role);
  const s = worldToScreen(item.from, view);
  const e = worldToScreen(item.to, view);
  const dash = item.dashed ? ` stroke-dasharray="${dashFor(role, theme)}"` : '';
  const line = `<line class="pv-seg" x1="${s.x}" y1="${s.y}" x2="${e.x}" y2="${e.y}" stroke-width="${theme.stroke.aux}"${dash} stroke-linecap="${ctx.linecap}"/>`;
  return `<g class="pv-item pv-segment pv-role-${role} ${stateClass('default')}" data-item-id="${item.id}">${line}</g>`;
}

function renderAxes(ctx: Ctx, item: Extract<SceneItem, { kind: 'axes' }>): string {
  const { theme, view } = ctx;
  const [xMin, xMax] = [item.x[0], item.x[1]];
  const [yMin, yMax] = [item.y[0], item.y[1]];
  vec2(xMin, yMin); vec2(xMax, yMax);
  if (!(xMax > xMin) || !(yMax > yMin)) throw new RangeError('axes ranges must be increasing');
  // Axes sit on world 0 when visible, else on the nearest range edge.
  const axisY = Math.min(yMax, Math.max(yMin, 0));
  const axisX = Math.min(xMax, Math.max(xMin, 0));
  const parts: string[] = [];

  if (item.grid === true && item.tick !== undefined) {
    positive(item.tick, 'tick');
    const gridParts: string[] = [];
    for (let i = Math.ceil(xMin / item.tick); i * item.tick <= xMax + 1e-9; i++) {
      const t = i * item.tick;
      const a = worldToScreen(vec2(t, yMin), view);
      const b = worldToScreen(vec2(t, yMax), view);
      gridParts.push(`<line class="pv-gridline" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="${theme.stroke.grid}"/>`);
    }
    for (let i = Math.ceil(yMin / item.tick); i * item.tick <= yMax + 1e-9; i++) {
      const t = i * item.tick;
      const a = worldToScreen(vec2(xMin, t), view);
      const b = worldToScreen(vec2(xMax, t), view);
      gridParts.push(`<line class="pv-gridline" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="${theme.stroke.grid}"/>`);
    }
    if (ctx.glow) {
      const half = item.tick / 2;
      for (let i = Math.ceil(xMin / half); i * half <= xMax + 1e-9; i++) {
        if (i % 2 === 0) continue; // multiples of tick are the major lines above
        const t = i * half;
        const a = worldToScreen(vec2(t, yMin), view);
        const b = worldToScreen(vec2(t, yMax), view);
        gridParts.push(`<line class="pv-gridline pv-gridline-minor" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="${theme.stroke.grid}"/>`);
      }
      for (let i = Math.ceil(yMin / half); i * half <= yMax + 1e-9; i++) {
        if (i % 2 === 0) continue;
        const t = i * half;
        const a = worldToScreen(vec2(xMin, t), view);
        const b = worldToScreen(vec2(xMax, t), view);
        gridParts.push(`<line class="pv-gridline pv-gridline-minor" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="${theme.stroke.grid}"/>`);
      }
    }
    parts.push(`<g class="pv-grid">${gridParts.join('')}</g>`);
  }

  const axisLine = (from: Vec2, to: Vec2): string => {
    const s = worldToScreen(from, view);
    const e = worldToScreen(to, view);
    const shape = buildArrow(s, e, theme.arrow.headLength, theme.arrow.headWidth);
    if (shape.kind === 'zero') return '';
    return `<line class="pv-axis-line" x1="${shape.start.x}" y1="${shape.start.y}" x2="${shape.base.x}" y2="${shape.base.y}" stroke-width="${theme.stroke.axis}"/>` +
      `<polygon class="pv-axis-head" points="${shape.tip.x},${shape.tip.y} ${shape.left.x},${shape.left.y} ${shape.right.x},${shape.right.y}"/>`;
  };
  if (xMax > 0) parts.push(axisLine(vec2(xMin, axisY), vec2(xMax, axisY)));
  if (yMax > 0) parts.push(axisLine(vec2(axisX, yMin), vec2(axisX, yMax)));

  if (item.tick !== undefined) {
    const tick = item.tick;
    positive(tick, 'tick');
    const ticks: string[] = [];
    // Corner cells collide: skip the x tick just left of the y axis and the
    // y tick just below the x axis (alongside the already-skipped origin).
    const cornerX = (t: number) => t < axisX && axisX - t <= tick * 1.001;
    const cornerY = (t: number) => t < axisY && axisY - t <= tick * 1.001;
    for (let i = Math.ceil(xMin / tick); i * tick <= xMax + 1e-9; i++) {
      const t = i * tick;
      if (Math.abs(t) < tick / 2 || cornerX(t)) continue;
      const p = worldToScreen(vec2(t, axisY), view);
      ticks.push(`<text class="pv-tick" x="${p.x}" y="${p.y + 14}" text-anchor="middle">${xml(String(Math.round(t * 1e6) / 1e6))}</text>`);
    }
    for (let i = Math.ceil(yMin / tick); i * tick <= yMax + 1e-9; i++) {
      const t = i * tick;
      if (Math.abs(t) < tick / 2 || cornerY(t)) continue;
      const p = worldToScreen(vec2(axisX, t), view);
      ticks.push(`<text class="pv-tick" x="${p.x - 6}" y="${p.y + 4}" text-anchor="end">${xml(String(Math.round(t * 1e6) / 1e6))}</text>`);
    }
    parts.push(`<g class="pv-ticks">${ticks.join('')}</g>`);
  }

  const xName = worldToScreen(vec2(xMax, axisY), view);
  const yName = worldToScreen(vec2(axisX, yMax), view);
  parts.push(`<text class="pv-axis-name" x="${xName.x - 4}" y="${xName.y - 8}" text-anchor="end">x</text>`);
  parts.push(`<text class="pv-axis-name" x="${yName.x + 8}" y="${yName.y + 12}" text-anchor="start">y</text>`);
  return `<g class="pv-item pv-axes ${stateClass('default')}" data-item-id="${item.id}">${parts.join('')}</g>`;
}

/**
 * Deterministic pure SVG serializer for multi-item scenes. Colors come only
 * from CSS classes (pv-role-, pv-state- prefixes); geometry from the theme numbers.
 * All emitted ids are `${instanceId}-...`; url(#...) refs stay inside the svg.
 */
export function renderSceneSvg(options: SceneSvgOptions): string {
  const theme = checkTheme(options.theme);
  const iid = checkId(options.instanceId, 'instanceId');
  positive(options.widthPx, 'widthPx');
  positive(options.heightPx, 'heightPx');
  const title = xml(options.title);

  const seen = new Set<string>();
  for (const item of options.items) {
    checkId(item.id, 'item.id');
    if (seen.has(item.id)) throw new RangeError(`duplicate item id: ${item.id}`);
    seen.add(item.id);
    if (!['axes', 'arrow', 'point', 'segment'].includes(item.kind)) {
      throw new RangeError(`unknown scene item kind: ${String(item.kind)}`);
    }
  }

  const ctx: Ctx = {
    iid, view: options.viewport, theme,
    soft: theme.material === 'soft',
    glow: theme.material === 'glow',
    linecap: theme.material === 'flat' ? 'butt' : 'round',
    linejoin: theme.material === 'flat' ? 'miter' : 'round',
  };

  const defs: string[] = [];
  if (ctx.soft) {
    for (const role of ROLES) {
      defs.push(`<linearGradient id="${iid}-grad-${role}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" class="pv-grad-top pv-role-${role}"/>` +
        `<stop offset="1" class="pv-grad-bot pv-role-${role}"/></linearGradient>`);
    }
    defs.push(`<pattern id="${iid}-dots" width="16" height="16" patternUnits="userSpaceOnUse">` +
      `<circle class="pv-paper-dot" cx="3" cy="3" r="1.1"/></pattern>`);
  }
  if (ctx.glow) {
    defs.push(`<filter id="${iid}-glow" x="-50%" y="-50%" width="200%" height="200%">` +
      `<feGaussianBlur stdDeviation="2.2" result="pv-glow-blur"/>` +
      `<feMerge><feMergeNode in="pv-glow-blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
  }

  const parts: string[] = [
    `<rect class="pv-paper" width="${options.widthPx}" height="${options.heightPx}"/>`,
  ];
  if (ctx.soft) {
    parts.push(`<rect class="pv-texture" width="${options.widthPx}" height="${options.heightPx}" fill="url(#${iid}-dots)"/>`);
  }
  for (const item of options.items) {
    switch (item.kind) {
      case 'axes': parts.push(renderAxes(ctx, item)); break;
      case 'arrow': parts.push(renderArrow(ctx, item)); break;
      case 'point': parts.push(renderPoint(ctx, item)); break;
      case 'segment': parts.push(renderSegment(ctx, item)); break;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.widthPx}" height="${options.heightPx}" ` +
    `viewBox="0 0 ${options.widthPx} ${options.heightPx}" role="img" aria-labelledby="${iid}-title" ` +
    `class="pv-scene pv-material-${theme.material}">` +
    `<title id="${iid}-title">${title}</title>` +
    `<defs>${defs.join('')}</defs>${parts.join('')}</svg>`;
}
