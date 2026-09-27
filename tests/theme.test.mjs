import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANDIDATE_THEMES, COLOR_ROLES, themeToCssText,
} from '../dist/index.js';

// Independent OKLCH -> sRGB conversion (Björn Ottosson / CSS Color 4 matrices)
// so the stored hex fallbacks are checked, not trusted.
function parseOklch(str) {
  const m = /^oklch\((\d+(?:\.\d+)?)% (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)\)$/.exec(str);
  assert.ok(m, `bad oklch string: ${str}`);
  return { L: Number(m[1]) / 100, C: Number(m[2]), H: Number(m[3]) };
}
function oklchToSrgb({ L, C, H }) {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr), b = C * Math.sin(hr);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541729 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}
const gamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const hexToChannels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(hex) {
  const lin = hexToChannels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

for (const theme of CANDIDATE_THEMES) {
  test(`${theme.id}: every color role present with valid formats`, () => {
    assert.equal(theme.status, 'candidate');
    for (const role of COLOR_ROLES) {
      const token = theme.color[role];
      assert.ok(token, `missing ${role}`);
      assert.match(token.srgb, /^#[0-9a-f]{6}$/);
      assert.match(token.oklch, /^oklch\(\d+(\.\d+)?% \d+(\.\d+)? \d+(\.\d+)?\)$/);
    }
  });

  test(`${theme.id}: srgb fallbacks match the authored oklch and stay in gamut`, () => {
    for (const role of COLOR_ROLES) {
      const token = theme.color[role];
      const linear = oklchToSrgb(parseOklch(token.oklch));
      for (const x of linear) {
        assert.ok(x >= -0.001 && x <= 1.001, `${role} out of gamut: ${linear}`);
      }
      const computed = linear.map((x) => Math.round(Math.min(1, Math.max(0, gamma(x))) * 255));
      const stored = hexToChannels(token.srgb);
      computed.forEach((v, i) => {
        assert.ok(Math.abs(v - stored[i]) <= 2, `${role}: ${v} vs ${stored[i]} (${token.srgb})`);
      });
    }
  });

  test(`${theme.id}: contrast thresholds hold`, () => {
    const paper = theme.color.paper.srgb;
    for (const role of ['input', 'derived', 'component', 'axis', 'error', 'focus']) {
      const ratio = contrast(theme.color[role].srgb, paper);
      assert.ok(ratio >= 3, `${role} contrast ${ratio.toFixed(2)} < 3`);
    }
    for (const role of ['ink', 'muted']) {
      const ratio = contrast(theme.color[role].srgb, paper);
      assert.ok(ratio >= 4.5, `${role} contrast ${ratio.toFixed(2)} < 4.5`);
    }
  });

  test(`${theme.id}: input/derived/component differ in lightness by >= 0.08`, () => {
    const L = ['input', 'derived', 'component'].map((r) => parseOklch(theme.color[r].oklch).L);
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      assert.ok(Math.abs(L[i] - L[j]) >= 0.08, `L diff ${L[i]} vs ${L[j]}`);
    }
  });
}

test('themeToCssText emits sRGB fallbacks first, then an oklch @supports block', () => {
  const theme = CANDIDATE_THEMES[0];
  const css = themeToCssText(theme, '[data-pv-theme="candidate-illustrated"]');
  assert.ok(css.indexOf(theme.color.input.srgb) < css.indexOf('@supports'));
  assert.ok(css.indexOf('@supports (color: oklch(0% 0 0))') > 0);
  assert.ok(css.includes(`--pv-input:${theme.color.input.srgb}`));
  assert.ok(css.includes(`--pv-input:${theme.color.input.oklch}`));
  assert.ok(css.includes(`--pv-stroke-main:${theme.stroke.main}px`));
  assert.ok(css.includes(`--pv-motion-ms:${theme.motion.emphasisMs}ms`));
});

test('themeToCssText rejects unsafe selectors and bad token strings', () => {
  const theme = CANDIDATE_THEMES[0];
  for (const bad of ['div', '[data-pv-theme="BAD"]', 'x{color:red}', '[data-pv-theme="a"];body{}']) {
    assert.throws(() => themeToCssText(theme, bad), RangeError);
  }
  for (const mutate of [
    (t) => ({ ...t, color: { ...t.color, input: { ...t.color.input, srgb: 'red' } } }),
    (t) => ({ ...t, color: { ...t.color, input: { ...t.color.input, oklch: 'oklch(50% 0.1 0);color:red' } } }),
    (t) => ({ ...t, text: { ...t.text, family: 'x;background:url(evil)' } }),
    (t) => ({ ...t, motion: { ...t.motion, easing: 'cubic-bezier(0,0,0,0);x{y:z}' } }),
    (t) => ({ ...t, dash: { ...t.dash, guide: '4 4!important' } }),
  ]) {
    assert.throws(() => themeToCssText(mutate(theme), '[data-pv-theme="t-ok"]'), RangeError);
  }
});
