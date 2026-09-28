// Static appearance rules for every pv-scene SVG: role/state/axis/text styling.
// Interactive rules (cursor, hover, transitions, reduced-motion, grayscale)
// stay in playground/theme.css — this string must remain free of '<' and '&'
// so it can be embedded verbatim inside an SVG <style> element.
export const SCENE_BASE_CSS = `
.pv-scene { font-family: var(--pv-font-family); color: var(--pv-ink); }
.pv-scene text { user-select: none; }
.pv-paper { fill: var(--pv-paper); }

.pv-role-input { --pv-role: var(--pv-input); }
.pv-role-derived { --pv-role: var(--pv-derived); }
.pv-role-component { --pv-role: var(--pv-component); }
.pv-role-guide { --pv-role: var(--pv-guide); }

.pv-shaft, .pv-seg, .pv-path { stroke: var(--pv-role); }
.pv-gridline { stroke: var(--pv-grid); }
.pv-axis-line { stroke: var(--pv-axis); }
.pv-axis-head { fill: var(--pv-axis); }
.pv-head { fill: var(--pv-role); }
.pv-material-flat .pv-dot { fill: var(--pv-paper); stroke: var(--pv-role); }
.pv-material-soft .pv-dot { fill: var(--pv-role); stroke: var(--pv-paper); stroke-width: 1.5px; }
.pv-zero { fill: var(--pv-role); }
.pv-material-flat .pv-zero { fill: var(--pv-role); stroke: none; }
.pv-halo { fill: var(--pv-role); fill-opacity: 0.10; }

/* error must not be color-only: role stroke stays, error underlay adds a dash */
.pv-error-underlay > * { stroke: var(--pv-error); fill: none; }

.pv-handle-dot { fill: var(--pv-role); }
.pv-state-selected .pv-handle-dot, .pv-state-dragging .pv-handle-dot {
  fill: var(--pv-selection);
}
.pv-ring {
  fill: none; stroke: var(--pv-selection); stroke-width: 2px;
  transform-box: fill-box; transform-origin: center;
}
.pv-state-focus .pv-ring { stroke: var(--pv-focus); }

.pv-label { fill: var(--pv-ink); font-size: var(--pv-text-label); }
.pv-tick {
  fill: var(--pv-muted); font-size: var(--pv-text-value);
  font-family: var(--pv-font-numeric); font-variant-numeric: tabular-nums;
}
.pv-axis-name {
  fill: var(--pv-muted); font-size: var(--pv-text-value);
  font-family: var(--pv-font-variable); font-style: italic;
}
/* variable labels: italic serif (scientific illustration convention) */
.pv-label-var { font-family: var(--pv-font-variable); font-style: italic; }

/* per-theme adjustments kept inside the one shared stylesheet */
[data-pv-theme="illustrated"] .pv-ticks { display: none; }
[data-pv-theme="illustrated"] .pv-ring { stroke-width: 1.5px; }
[data-pv-theme="linework"] .pv-role-derived .pv-shaft {
  stroke-width: calc(var(--pv-stroke-main) + 0.75px);
}
`;
