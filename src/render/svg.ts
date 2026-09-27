import { worldToScreen } from '../core/viewport.js';
import type { Viewport } from '../core/viewport.js';
import { positive } from '../math/vec2.js';
import type { Vec2 } from '../math/vec2.js';
import { buildArrow } from '../primitives/arrow.js';

export interface ArrowSvgOptions {
  readonly start: Vec2;
  readonly end: Vec2;
  readonly viewport: Viewport;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly label?: string;
}

function xml(text: string): string {
  // Reject characters XML 1.0 cannot represent; never accept raw SVG/HTML markup.
  if (/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u.test(text)) {
    throw new RangeError('label contains an invalid XML character');
  }
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

/** Pure SVG serialization. No DOM access, IDs, fonts, network, scripts or foreignObject. */
export function renderArrowSvg(options: ArrowSvgOptions): string {
  positive(options.widthPx, 'widthPx'); positive(options.heightPx, 'heightPx');
  const label = xml(options.label ?? 'Vector');
  const shape = buildArrow(
    worldToScreen(options.start, options.viewport),
    worldToScreen(options.end, options.viewport),
  );
  // Arrowhead dimensions stay in SVG viewport pixels, independent of world zoom.
  const drawing = shape.kind === 'zero'
    ? `<circle cx="${shape.point.x}" cy="${shape.point.y}" r="3" fill="currentColor"/>`
    : `<line x1="${shape.start.x}" y1="${shape.start.y}" x2="${shape.base.x}" y2="${shape.base.y}" stroke="currentColor" stroke-width="2"/><polygon points="${shape.tip.x},${shape.tip.y} ${shape.left.x},${shape.left.y} ${shape.right.x},${shape.right.y}" fill="currentColor"/>`;
  // A fixed caption is intentional in this seed. Automatic label placement is NOT implemented.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.widthPx}" height="${options.heightPx}" viewBox="0 0 ${options.widthPx} ${options.heightPx}" role="img" aria-label="${label}"><title>${label}</title>${drawing}<text x="16" y="28" fill="currentColor" font-size="16">${label}</text></svg>`;
}
