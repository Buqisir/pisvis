import { checkTheme } from './tokens.js';
import type { ThemeDefinition } from './tokens.js';

// Both themes are CANDIDATES awaiting maintainer review — never mark approved.
// srgb fallbacks are the in-gamut conversion of the authored OKLCH values.

// v2 (2026-09-28): maintainer picked A's direction but asked to remove the
// "plastic" feel — gradients/texture/halo blobs and the thick round strokes are
// gone; palette airier; component is soft terracotta instead of dark bronze.
export const CANDIDATE_ILLUSTRATED: ThemeDefinition = checkTheme({
  id: 'candidate-illustrated',
  version: 2,
  status: 'candidate',
  name: '轻质感科学插画',
  color: {
    paper: { oklch: 'oklch(98.6% 0.008 85)', srgb: '#fdfaf4' },
    ink: { oklch: 'oklch(30% 0.03 260)', srgb: '#252e3d' },
    muted: { oklch: 'oklch(52% 0.02 260)', srgb: '#626975' },
    grid: { oklch: 'oklch(93.5% 0.008 85)', srgb: '#ece9e4' },
    axis: { oklch: 'oklch(52% 0.02 260)', srgb: '#626975' },
    input: { oklch: 'oklch(63% 0.1 168)', srgb: '#409c7d' },
    derived: { oklch: 'oklch(45% 0.13 265)', srgb: '#31509d' },
    component: { oklch: 'oklch(54% 0.11 50)', srgb: '#a1592e' },
    guide: { oklch: 'oklch(66% 0.02 70)', srgb: '#9a9085' },
    selection: { oklch: 'oklch(30% 0.03 260)', srgb: '#252e3d' },
    error: { oklch: 'oklch(55% 0.19 27)', srgb: '#c9302d' },
    focus: { oklch: 'oklch(55% 0.15 250)', srgb: '#0f74c5' },
  },
  stroke: { main: 2, aux: 1.4, axis: 1.2, grid: 0.75 },
  arrow: { headLength: 13, headWidth: 9 },
  point: { radius: 4, handleRadius: 7, hitRadius: 16 },
  dash: { guide: '6 5', component: '4 4' },
  text: {
    family: 'ui-rounded, "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif',
    variableFamily: 'ui-serif, Georgia, "Songti SC", serif',
    numericFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    label: 16, value: 13, caption: 11.5,
  },
  space: { labelOffset: 10, safeMargin: 36 },
  material: 'soft',
  motion: { emphasisMs: 260, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)' },
});

export const CANDIDATE_LINEWORK: ThemeDefinition = checkTheme({
  id: 'candidate-linework',
  version: 1,
  status: 'candidate',
  name: '精密清爽线描',
  color: {
    paper: { oklch: 'oklch(99% 0.003 250)', srgb: '#fafcfe' },
    ink: { oklch: 'oklch(22% 0.01 250)', srgb: '#171b1f' },
    muted: { oklch: 'oklch(50% 0.01 250)', srgb: '#5f6469' },
    grid: { oklch: 'oklch(93% 0.005 250)', srgb: '#e5e8eb' },
    axis: { oklch: 'oklch(22% 0.01 250)', srgb: '#171b1f' },
    input: { oklch: 'oklch(52% 0.17 255)', srgb: '#0267c7' },
    derived: { oklch: 'oklch(22% 0.01 250)', srgb: '#171b1f' },
    component: { oklch: 'oklch(61% 0.11 150)', srgb: '#4d965f' },
    guide: { oklch: 'oklch(65% 0.01 250)', srgb: '#8b9095' },
    selection: { oklch: 'oklch(22% 0.01 250)', srgb: '#171b1f' },
    error: { oklch: 'oklch(52% 0.21 25)', srgb: '#c50220' },
    focus: { oklch: 'oklch(55% 0.15 250)', srgb: '#0f74c5' },
  },
  stroke: { main: 1.75, aux: 1.25, axis: 1, grid: 0.75 },
  arrow: { headLength: 14, headWidth: 6 },
  point: { radius: 3.5, handleRadius: 7, hitRadius: 16 },
  dash: { guide: '4 4', component: '5 3' },
  text: {
    family: 'system-ui, "PingFang SC", "Hiragino Sans GB", sans-serif',
    variableFamily: 'ui-serif, Georgia, "Songti SC", serif',
    numericFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    label: 15, value: 13, caption: 11,
  },
  space: { labelOffset: 8, safeMargin: 32 },
  material: 'flat',
  motion: { emphasisMs: 160, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
});


export const CANDIDATE_THEMES: readonly ThemeDefinition[] = [
  CANDIDATE_ILLUSTRATED,
  CANDIDATE_LINEWORK,
];
