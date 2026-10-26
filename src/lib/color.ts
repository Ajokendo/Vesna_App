// Цвета темы салона из одного основного цвета: тёмный оттенок для текста-ссылок и мягкий фон для плашек.

function parse(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (c: number[]) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a: number[], b: number[], t: number) => a.map((x, i) => x + (b[i] - x) * t);

export function isHexColor(v: string) { return !!parse(v); }

export function themeVars(accent: string) {
  const c = parse(accent) ?? parse('#4e6b45')!;
  return {
    '--accent': toHex(c),
    '--accent-dark': toHex(mix(c, [0, 0, 0], 0.2)),
    '--accent-soft': toHex(mix(c, [255, 255, 255], 0.87)),
  };
}
