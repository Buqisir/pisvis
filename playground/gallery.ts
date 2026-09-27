import {
  CANDIDATE_ILLUSTRATED, CANDIDATE_LINEWORK, CANDIDATE_THEMES,
  add, fitViewport, magnitude, renderSceneSvg, themeToCssText, vec2,
} from '../src/index.js';
import type { SceneItem, SceneRole, ThemeDefinition, Vec2 } from '../src/index.js';
import { fmt } from './format.js';

function element<T extends HTMLElement>(id: string, kind: { new(): T }): T {
  const found = document.getElementById(id);
  if (!(found instanceof kind)) throw new Error(`Missing element: ${id}`);
  return found;
}
const controls = element('gallery-controls', HTMLFormElement);
const scenesRoot = element('scenes', HTMLDivElement);
const optGray = element('opt-gray', HTMLInputElement);
const optMotion = element('opt-motion', HTMLInputElement);
const optLong = element('opt-long', HTMLInputElement);

// Same margin for every render so theme switching never moves geometry.
const MARGIN = Math.max(...CANDIDATE_THEMES.map((t) => t.space.safeMargin));
const ZERO = vec2(0, 0);

interface Slot {
  readonly key: string;       // unique inside the section; part of instanceId
  readonly caption?: string;  // HTML caption under the cell/panel (not SVG text)
  readonly widthPx: number;
  readonly heightPx: number;
  readonly points: Vec2[];    // world extent for fitViewport
  readonly items: (long: boolean) => SceneItem[];
}
interface SectionDef {
  readonly key: string;
  readonly title: string;
  readonly layout: 'cells' | 'panels' | 'single';
  readonly slots: Slot[];
  readonly readout: string;
}

const angle = (v: Vec2) => `${((Math.atan2(v.y, v.x) * 180) / Math.PI).toFixed(1)}°`;

const arrowCell = (
  key: string, caption: string, role: SceneRole,
  extra: Partial<Extract<SceneItem, { kind: 'arrow' }>> = {},
): Slot => ({
  key,
  caption,
  widthPx: 150,
  heightPx: 110,
  points: [vec2(-1.6, -0.4), vec2(1.6, 0.4)],
  items: () => [{
    kind: 'arrow', id: key, role, from: vec2(-1, 0), to: vec2(1, 0), ...extra,
  }],
});

const A = vec2(2, 1);
const B = vec2(0.5, 1.8);
const R = add(A, B);
const V = vec2(2.4, 1.6);

const SCENES: SectionDef[] = [
  {
    key: 'prims',
    title: '图元与状态',
    layout: 'cells',
    slots: [
      arrowCell('role-input', '输入', 'input'),
      arrowCell('role-derived', '派生', 'derived'),
      arrowCell('role-component', '分量（虚线）', 'component', { dashed: true }),
      arrowCell('role-guide', '辅助（虚线）', 'guide', { dashed: true }),
      {
        key: 'role-point', caption: '点', widthPx: 150, heightPx: 110,
        points: [vec2(-1.6, -0.4), vec2(1.6, 0.4)],
        items: () => [{ kind: 'point', id: 'role-point', role: 'component', at: ZERO }],
      },
      {
        key: 'role-segment', caption: '虚线段', widthPx: 150, heightPx: 110,
        points: [vec2(-1.6, -0.4), vec2(1.6, 0.4)],
        items: () => [{ kind: 'segment', id: 'role-segment', role: 'guide', from: vec2(-1, 0), to: vec2(1, 0), dashed: true }],
      },
      arrowCell('st-default', '默认', 'input', { handle: true }),
      arrowCell('st-selected', '选中', 'input', { handle: true, state: 'selected' }),
      arrowCell('st-dragging', '拖动', 'input', { handle: true, state: 'dragging' }),
      arrowCell('st-readonly', '只读', 'derived', { state: 'readonly' }),
      arrowCell('st-error', '错误', 'input', { handle: true, state: 'error' }),
      arrowCell('st-focus', '键盘焦点', 'input', { handle: true, state: 'focus' }),
      {
        key: 'axes', caption: '坐标轴与网格', widthPx: 200, heightPx: 140,
        points: [vec2(-2, -1.5), vec2(2, 1.5)],
        items: () => [
          { kind: 'axes', id: 'axes', x: [-2, 2], y: [-1.5, 1.5], tick: 1, grid: true },
          { kind: 'arrow', id: 'axes-v', role: 'input', from: ZERO, to: vec2(1.2, 0.8) },
        ],
      },
    ],
    readout: '四种角色、六种状态、坐标轴各自独立呈现；同一套几何，两种主题。',
  },
  {
    key: 'sum',
    title: '场景一 · 向量合成',
    layout: 'single',
    slots: [{
      key: 'main', widthPx: 720, heightPx: 420,
      points: [vec2(-1, -1), vec2(3.5, 3.5)],
      items: (long) => [
        { kind: 'axes', id: 'ax', x: [-1, 3.5], y: [-1, 3.5], tick: 1, grid: true },
        { kind: 'arrow', id: 'sum-a', role: 'input', from: ZERO, to: A, handle: true, state: 'selected', label: { text: long ? '分向量 A（输入，可编辑）' : 'A', anchor: 'end' } },
        { kind: 'arrow', id: 'sum-b', role: 'input', from: ZERO, to: B, handle: true, label: { text: 'B', anchor: 'end' } },
        { kind: 'arrow', id: 'sum-bt', role: 'guide', from: A, to: R, dashed: true, label: { text: long ? 'B 的平移（平行四边形法则）' : 'B′', anchor: 'mid' } },
        { kind: 'segment', id: 'sum-para', role: 'guide', from: B, to: R, dashed: true },
        { kind: 'arrow', id: 'sum-r', role: 'derived', from: ZERO, to: R, state: 'readonly', label: long
          ? { text: '合向量 R（由平行四边形法则得到，无量纲）', anchor: 'mid', offsetPx: vec2(0, 30) }
          : { text: 'R', anchor: 'end' } },
        { kind: 'point', id: 'sum-o', role: 'component', at: ZERO, label: { text: 'O', anchor: 'start', offsetPx: vec2(0, 16) } },
      ],
    }],
    readout: `A=(${fmt(A.x)}, ${fmt(A.y)})　B=(${fmt(B.x)}, ${fmt(B.y)})　` +
      `R=A+B=(${fmt(R.x)}, ${fmt(R.y)})　|R|=${magnitude(R).toFixed(3)}　方向 ${angle(R)}`,
  },
  {
    key: 'decomp',
    title: '场景二 · 正交分解',
    layout: 'single',
    slots: [{
      key: 'main', widthPx: 720, heightPx: 380,
      points: [vec2(-1, -1), vec2(3.5, 2.5)],
      items: (long) => [
        { kind: 'axes', id: 'ax', x: [-1, 3.5], y: [-1, 2.5], tick: 1, grid: true },
        { kind: 'arrow', id: 'dec-v', role: 'input', from: ZERO, to: V, handle: true, label: { text: 'V', anchor: 'end' } },
        { kind: 'arrow', id: 'dec-vx', role: 'component', from: ZERO, to: vec2(V.x, 0), dashed: true, label: { text: long ? '水平分量 Vx（只读派生）' : 'Vx', anchor: 'mid', offsetPx: vec2(0, 20) } },
        { kind: 'arrow', id: 'dec-vy', role: 'component', from: ZERO, to: vec2(0, V.y), dashed: true, label: { text: 'Vy', anchor: 'mid', offsetPx: vec2(0, 26) } },
        { kind: 'segment', id: 'dec-gx', role: 'guide', from: V, to: vec2(V.x, 0), dashed: true },
        { kind: 'segment', id: 'dec-gy', role: 'guide', from: V, to: vec2(0, V.y), dashed: true },
        { kind: 'point', id: 'dec-o', role: 'component', at: ZERO, label: { text: 'O', anchor: 'start', offsetPx: vec2(0, 16) } },
      ],
    }],
    readout: `V=(${fmt(V.x)}, ${fmt(V.y)})　Vx=(${fmt(V.x)}, 0)　Vy=(0, ${fmt(V.y)})　` +
      `|V|=${magnitude(V).toFixed(3)}　方向 ${angle(V)}`,
  },
  {
    key: 'edge',
    title: '退化与边界',
    layout: 'panels',
    slots: [
      {
        key: 'e-zero', caption: '零向量：方向未定义', widthPx: 300, heightPx: 220,
        points: [vec2(-2, -1.5), vec2(2, 1.5)],
        items: (long) => [
          { kind: 'axes', id: 'ax', x: [-2, 2], y: [-1.5, 1.5], tick: 1, grid: true },
          { kind: 'arrow', id: 'z', role: 'input', from: ZERO, to: ZERO, label: { text: long ? '零向量（无方向）' : '0', anchor: 'mid' } },
        ],
      },
      {
        key: 'e-opposite', caption: '反向合成：A+B=0', widthPx: 300, heightPx: 220,
        points: [vec2(-2.5, -1.5), vec2(2.5, 1.5)],
        items: () => [
          { kind: 'axes', id: 'ax', x: [-2.5, 2.5], y: [-1.5, 1.5], tick: 1, grid: true },
          { kind: 'arrow', id: 'a', role: 'input', from: ZERO, to: vec2(1.5, 0.5), label: { text: 'A', anchor: 'end' } },
          { kind: 'arrow', id: 'b', role: 'input', from: ZERO, to: vec2(-1.5, -0.5), label: { text: 'B', anchor: 'end', offsetPx: vec2(-4, 10) } },
          { kind: 'arrow', id: 'r0', role: 'derived', from: ZERO, to: ZERO, state: 'readonly', label: { text: 'R=0', anchor: 'mid', offsetPx: vec2(-6, -4) } },
        ],
      },
      {
        key: 'e-short', caption: '极短向量 (0.05, 0.02)', widthPx: 300, heightPx: 220,
        points: [vec2(-0.4, -0.3), vec2(0.4, 0.3)],
        items: () => [
          { kind: 'axes', id: 'ax', x: [-0.4, 0.4], y: [-0.3, 0.3], tick: 0.2, grid: true },
          { kind: 'arrow', id: 's', role: 'input', from: ZERO, to: vec2(0.05, 0.02), label: { text: 'v', anchor: 'end' } },
        ],
      },
      {
        key: 'e-bound', caption: '边界：R=(8, 8) 完整显示不裁剪', widthPx: 300, heightPx: 220,
        points: [vec2(-1, -1), vec2(9, 9)],
        items: () => [
          { kind: 'axes', id: 'ax', x: [-1, 9], y: [-1, 9], tick: 2, grid: true },
          { kind: 'arrow', id: 'a8', role: 'input', from: ZERO, to: vec2(4, 4), label: { text: 'A', anchor: 'mid' } },
          { kind: 'arrow', id: 'b8', role: 'guide', from: vec2(4, 4), to: vec2(8, 8), dashed: true, label: { text: 'B', anchor: 'mid' } },
          { kind: 'arrow', id: 'e-r8', role: 'derived', from: ZERO, to: vec2(8, 8), state: 'readonly', label: { text: 'R', anchor: 'mid', offsetPx: vec2(12, 10) } },
        ],
      },
    ],
    readout: '零向量不伪造方向（显示为点）；反向合成 R=0；极短箭头缩小头部不露馅；边界结果由 fitViewport 完整容纳。',
  },
];

// Theme styles are injected once; scopes keep side-by-side instances isolated.
const styleEl = document.createElement('style');
styleEl.textContent = CANDIDATE_THEMES
  .map((t) => themeToCssText(t, `[data-pv-theme="${t.id}"]`))
  .join('\n');
document.head.append(styleEl);

function mountSvg(container: HTMLElement, svgText: string): void {
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) throw new Error('SVG serialization failed');
  container.replaceChildren(document.importNode(parsed.documentElement, true));
}

function themeMode(): 'a' | 'b' | 'both' {
  const picked = controls.querySelector<HTMLInputElement>('input[name="theme"]:checked');
  const v = picked?.value;
  return v === 'b' || v === 'both' ? v : 'a';
}

function render(): void {
  const mode = themeMode();
  const long = optLong.checked;
  const variants: ThemeDefinition[] =
    mode === 'a' ? [CANDIDATE_ILLUSTRATED]
    : mode === 'b' ? [CANDIDATE_LINEWORK]
    : [...CANDIDATE_THEMES];
  scenesRoot.replaceChildren();
  scenesRoot.classList.toggle('pv-grayscale', optGray.checked);
  scenesRoot.classList.toggle('pv-reduced-motion', optMotion.checked);
  for (const def of SCENES) {
    const section = document.createElement('section');
    section.className = `specimen layout-${def.layout}`;
    const heading = document.createElement('h3');
    heading.textContent = def.title;
    const wrap = document.createElement('div');
    wrap.className = def.layout === 'cells' ? 'cell-grid'
      : def.layout === 'panels' ? 'panel-grid' : 'stage-single';
    for (const slot of def.slots) {
      const viewport = fitViewport(slot.points, slot.widthPx, slot.heightPx, MARGIN);
      const pair = document.createElement('div');
      pair.className = mode === 'both' ? 'stage-pair' : '';
      for (const theme of variants) {
        const figure = document.createElement('figure');
        const stage = document.createElement('div');
        stage.className = 'stage';
        stage.setAttribute('data-pv-theme', theme.id);
        const variant = theme === CANDIDATE_ILLUSTRATED ? 'a' : 'b';
        mountSvg(stage, renderSceneSvg({
          instanceId: `${def.key}-${slot.key}-${variant}`,
          title: `${def.title} · ${theme.name}`,
          widthPx: slot.widthPx,
          heightPx: slot.heightPx,
          viewport,
          theme,
          items: slot.items(long),
        }));
        figure.append(stage);
        if (mode === 'both') {
          const caption = document.createElement('figcaption');
          caption.textContent = `${theme.name} · 候选`;
          figure.append(caption);
        }
        pair.append(figure);
      }
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.append(pair);
      if (slot.caption !== undefined) {
        const caption = document.createElement('p');
        caption.className = 'cell-caption';
        caption.textContent = slot.caption;
        cell.append(caption);
      }
      wrap.append(cell);
    }
    const readout = document.createElement('p');
    readout.className = 'scene-readout';
    readout.textContent = def.readout;
    section.append(heading, wrap, readout);
    scenesRoot.append(section);
  }
}

controls.addEventListener('input', render);
render();
