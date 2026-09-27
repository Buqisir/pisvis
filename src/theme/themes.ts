import { checkTheme } from './tokens.js';
import type { ThemeDefinition } from './tokens.js';

// Both themes are CANDIDATES awaiting maintainer review — never mark approved.
// srgb fallbacks are the in-gamut conversion of the authored OKLCH values.

export const CANDIDATE_ILLUSTRATED: ThemeDefinition = checkTheme({
  id: 'candidate-illustrated',
  version: 1,
  status: 'candidate',
  name: '轻质感科学插画',
  color: {
    paper: { oklch: 'oklch(97.4% 0.012 85)', srgb: '#faf6ee' },
    ink: { oklch: 'oklch(27% 0.035 260)', srgb: '#1c2738' },
    muted: { oklch: 'oklch(52% 0.02 260)', srgb: '#626975' },
    grid: { oklch: 'oklch(91% 0.012 85)', srgb: '#e5e1d9' },
    axis: { oklch: 'oklch(45% 0.02 260)', srgb: '#4f5661' },
    input: { oklch: 'oklch(57% 0.12 165)', srgb: '#008d65' },
    derived: { oklch: 'oklch(47% 0.15 265)', srgb: '#3054ae' },
    component: { oklch: 'oklch(38% 0.08 62)', srgb: '#60370b' },
    guide: { oklch: 'oklch(62% 0.03 70)', srgb: '#928373' },
    selection: { oklch: 'oklch(27% 0.035 260)', srgb: '#1c2738' },
    error: { oklch: 'oklch(55% 0.2 27)', srgb: '#cc2827' },
    focus: { oklch: 'oklch(55% 0.15 250)', srgb: '#0f74c5' },
  },
  stroke: { main: 3, aux: 2, axis: 1.5, grid: 1 },
  arrow: { headLength: 16, headWidth: 12 },
  point: { radius: 5, handleRadius: 8, hitRadius: 16 },
  dash: { guide: '7 6', component: '4 4' },
  text: {
    family: 'ui-rounded, "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif',
    variableFamily: 'ui-serif, Georgia, "Songti SC", serif',
    label: 17, value: 14, caption: 12,
  },
  space: { labelOffset: 10, safeMargin: 36 },
  material: 'soft',
  motion: { emphasisMs: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
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
