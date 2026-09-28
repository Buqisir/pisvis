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
  /** 'variable' renders in italic serif (single math symbols); default 'text'. */
  readonly style?: 'variable' | 'text';
}

export type SceneItem =
  | {
      readonly kind: 'axes';
      readonly id: string;
      readonly x: readonly [number, number];
      readonly y: readonly [number, number];
      readonly tick?: number;
      /** Per-axis tick overrides — function graphs with mixed units. */
      readonly xTick?: number;
      readonly yTick?: number;
      /** Axis names, validated/escaped like label text; default 'x' / 'y'. */
      readonly xName?: string;
      readonly yName?: string;
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
    }
  | {
      readonly kind: 'path';
      readonly id: string;
      readonly role: SceneRole;
      /** 2..4096 world points joined as an open polyline (never filled). */
      readonly points: readonly Vec2[];
      readonly dashed?: boolean;
      readonly label?: SceneLabel;
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
const LABEL_STYLES = new Set(['variable', 'text']);
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
  if (label.style !== undefined && !LABEL_STYLES.has(label.style)) {
    throw new RangeError(`unknown label style: ${String(label.style)}`);
  }
  if (label.offsetPx !== undefined) vec2(label.offsetPx.x, label.offsetPx.y);
  return label;
}

// Axis names obey the label-text rule: plain string, length cap, XML-escaped
// at emit time (xml() also rejects characters XML cannot represent).
function checkAxisName(name: string | undefined, fallback: string): string {
  if (name === undefined) return fallback;
  if (typeof name !== 'string' || name.length > MAX_LABEL_CHARS) {
    throw new RangeError(`axis name must be a string of at most ${MAX_LABEL_CHARS} chars`);
  }
  return name;
}

function dashFor(role: SceneRole, theme: ThemeDefinition): string {
  return role === 'component' ? theme.dash.component : theme.dash.guide;
}

interface Ctx {
  readonly iid: string;
  readonly view: Viewport;
  readonly theme: ThemeDefinition;
  readonly soft: boolean;
  readonly linecap: 'round' | 'butt';
  readonly linejoin: 'round' | 'miter';
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
  labelPx: number,
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
        // diagonal: perpendicular, at least clearance + half the label's own
        // height so the text bbox never touches the shaft; side picked to
        // maximize distance from the axes (and thereby the origin corner)
        const gap = clearance + labelPx / 2;
        const a = vec2(-dir.y, dir.x);
        const b = vec2(dir.y, -dir.x);
        const away = (n: Vec2) => Math.min(Math.abs(p.x + n.x * gap), Math.abs(p.y + n.y * gap));
        const n = away(b) > away(a) ? b : a;
        x += n.x * gap; y += n.y * gap;
        textAnchor = n.x > 0.3 ? 'start' : n.x < -0.3 ? 'end' : 'middle';
        baseline = central;
      }
    }
  }
  x += manual.x;
  y += manual.y;
  const varCls = label.style === 'variable' ? ' pv-label-var' : '';
  return `<text class="pv-label${varCls}" x="${x}" y="${y}" text-anchor="${textAnchor}"${baseline}>${xml(label.text)}</text>`;
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
  const parts = [
    `<circle class="pv-hit" cx="${p.x}" cy="${p.y}" r="${point.hitRadius}" fill="transparent" pointer-events="all"/>`,
  ];
  // 'soft' gets a whisper of halo behind the handle dot — the only halo left
  if (ctx.soft) {
    parts.push(`<circle class="pv-halo" cx="${p.x}" cy="${p.y}" r="${point.handleRadius + 5}"/>`);
  }
  parts.push(`<circle class="pv-handle-dot" cx="${p.x}" cy="${p.y}" r="${point.handleRadius}"/>`);
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
    geom.push(`<polygon class="pv-head" points="${shape.tip.x},${shape.tip.y} ${shape.left.x},${shape.left.y} ${shape.right.x},${shape.right.y}" stroke-linejoin="${ctx.linejoin}"/>`);
  }
  const parts: string[] = [geom.join('')];
  if (label !== undefined) {
    const anchorPx = label.anchor === 'start' ? s
      : label.anchor === 'end' ? e
      : scale(add(s, e), 0.5);
    parts.push(labelTag(label, anchorPx, dir, clearance, theme.text.label));
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
  const parts: string[] = [];
  if (state === 'error') {
    parts.push(errorUnderlay(
      `<circle cx="${p.x}" cy="${p.y}" r="${theme.point.radius + 2.5}" stroke-width="${theme.stroke.aux}" stroke-dasharray="2 3" fill="none"/>`,
    ));
  }
  parts.push(`<circle class="pv-dot" cx="${p.x}" cy="${p.y}" r="${theme.point.radius}" stroke-width="${theme.stroke.aux}"/>`);
  if (state === 'focus') {
    parts.push(`<circle class="pv-ring" cx="${p.x}" cy="${p.y}" r="${theme.point.handleRadius + 4}"/>`);
  }
  if (label !== undefined) {
    parts.push(labelTag(label, p, null, labelClearance(theme, false), theme.text.label));
  }
  return `<g class="pv-item pv-point pv-role-${role} ${stateClass(state)}" data-item-id="${item.id}">${parts.join('')}</g>`;
}

const MAX_PATH_POINTS = 4096;

function renderPath(ctx: Ctx, item: Extract<SceneItem, { kind: 'path' }>): string {
  const { theme, view } = ctx;
  const role = item.role;
  checkRole(role);
  const label = checkLabel(item.label);
  if (item.points.length < 2 || item.points.length > MAX_PATH_POINTS) {
    throw new RangeError(`path needs 2..${MAX_PATH_POINTS} points (received ${item.points.length})`);
  }
  const pts = item.points.map((p) => worldToScreen(p, view));
  const attr = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const dash = item.dashed ? ` stroke-dasharray="${dashFor(role, theme)}"` : '';
  const parts = [
    `<polyline class="pv-path" points="${attr}" fill="none" stroke-width="${theme.stroke.aux}"${dash}` +
      ` stroke-linecap="${ctx.linecap}" stroke-linejoin="${ctx.linejoin}"/>`,
  ];
  if (label !== undefined) {
    const last = pts.length - 1;
    const { anchorPx, dir } =
      label.anchor === 'start'
        ? { anchorPx: pts[0]!, dir: normalize(sub(pts[1]!, pts[0]!)) }
        : label.anchor === 'mid'
          ? {
              anchorPx: pts[last >> 1]!,
              dir: normalize(sub(pts[(last >> 1) + 1]!, pts[last >> 1]!)),
            }
          : { anchorPx: pts[last]!, dir: normalize(sub(pts[last]!, pts[last - 1]!)) };
    parts.push(labelTag(label, anchorPx, dir, labelClearance(theme, false), theme.text.label));
  }
  return `<g class="pv-item pv-path-item pv-role-${role} ${stateClass('default')}" data-item-id="${item.id}">${parts.join('')}</g>`;
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
  if (item.tick !== undefined) positive(item.tick, 'tick');
  if (item.xTick !== undefined) positive(item.xTick, 'xTick');
  if (item.yTick !== undefined) positive(item.yTick, 'yTick');
  const tickX = item.xTick ?? item.tick;
  const tickY = item.yTick ?? item.tick;
  const xAxisName = checkAxisName(item.xName, 'x');
  const yAxisName = checkAxisName(item.yName, 'y');
  // Axes sit on world 0 when visible, else on the nearest range edge.
  const axisY = Math.min(yMax, Math.max(yMin, 0));
  const axisX = Math.min(xMax, Math.max(xMin, 0));
  const parts: string[] = [];

  if (item.grid === true && (tickX !== undefined || tickY !== undefined)) {
    const gridParts: string[] = [];
    if (tickX !== undefined) {
      for (let i = Math.ceil(xMin / tickX); i * tickX <= xMax + 1e-9; i++) {
        const t = i * tickX;
        const a = worldToScreen(vec2(t, yMin), view);
        const b = worldToScreen(vec2(t, yMax), view);
        gridParts.push(`<line class="pv-gridline" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="${theme.stroke.grid}"/>`);
      }
    }
    if (tickY !== undefined) {
      for (let i = Math.ceil(yMin / tickY); i * tickY <= yMax + 1e-9; i++) {
        const t = i * tickY;
        const a = worldToScreen(vec2(xMin, t), view);
        const b = worldToScreen(vec2(xMax, t), view);
        gridParts.push(`<line class="pv-gridline" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="${theme.stroke.grid}"/>`);
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

  if (tickX !== undefined || tickY !== undefined) {
    const ticks: string[] = [];
    // Corner cells collide: skip the x tick just left of the y axis and the
    // y tick just below the x axis (alongside the already-skipped origin).
    if (tickX !== undefined) {
      const cornerX = (t: number) => t < axisX && axisX - t <= tickX * 1.001;
      for (let i = Math.ceil(xMin / tickX); i * tickX <= xMax + 1e-9; i++) {
        const t = i * tickX;
        if (Math.abs(t) < tickX / 2 || cornerX(t)) continue;
        const p = worldToScreen(vec2(t, axisY), view);
        ticks.push(`<text class="pv-tick" x="${p.x}" y="${p.y + 14}" text-anchor="middle">${xml(String(Math.round(t * 1e6) / 1e6))}</text>`);
      }
    }
    if (tickY !== undefined) {
      const cornerY = (t: number) => t < axisY && axisY - t <= tickY * 1.001;
      for (let i = Math.ceil(yMin / tickY); i * tickY <= yMax + 1e-9; i++) {
        const t = i * tickY;
        if (Math.abs(t) < tickY / 2 || cornerY(t)) continue;
        const p = worldToScreen(vec2(axisX, t), view);
        ticks.push(`<text class="pv-tick" x="${p.x - 6}" y="${p.y + 4}" text-anchor="end">${xml(String(Math.round(t * 1e6) / 1e6))}</text>`);
      }
    }
    parts.push(`<g class="pv-ticks">${ticks.join('')}</g>`);
  }

  const xNameAt = worldToScreen(vec2(xMax, axisY), view);
  const yNameAt = worldToScreen(vec2(axisX, yMax), view);
  parts.push(`<text class="pv-axis-name" x="${xNameAt.x - 4}" y="${xNameAt.y - 8}" text-anchor="end">${xml(xAxisName)}</text>`);
  parts.push(`<text class="pv-axis-name" x="${yNameAt.x + 8}" y="${yNameAt.y + 12}" text-anchor="start">${xml(yAxisName)}</text>`);
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
    if (!['axes', 'arrow', 'point', 'segment', 'path'].includes(item.kind)) {
      throw new RangeError(`unknown scene item kind: ${String(item.kind)}`);
    }
  }

  const ctx: Ctx = {
    iid, view: options.viewport, theme,
    soft: theme.material === 'soft',
    linecap: theme.material === 'flat' ? 'butt' : 'round',
    linejoin: theme.material === 'flat' ? 'miter' : 'round',
  };

  const parts: string[] = [
    `<rect class="pv-paper" width="${options.widthPx}" height="${options.heightPx}"/>`,
  ];
  for (const item of options.items) {
    switch (item.kind) {
      case 'axes': parts.push(renderAxes(ctx, item)); break;
      case 'arrow': parts.push(renderArrow(ctx, item)); break;
      case 'point': parts.push(renderPoint(ctx, item)); break;
      case 'segment': parts.push(renderSegment(ctx, item)); break;
      case 'path': parts.push(renderPath(ctx, item)); break;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.widthPx}" height="${options.heightPx}" ` +
    `viewBox="0 0 ${options.widthPx} ${options.heightPx}" role="img" aria-labelledby="${iid}-title" ` +
    `class="pv-scene pv-material-${theme.material}">` +
    `<title id="${iid}-title">${title}</title>` +
    `${parts.join('')}</svg>`;
}
