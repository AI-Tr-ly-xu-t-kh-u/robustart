import type { Results } from "./schema";

export const PRICE_GRID = [0.8, 0.9, 1.0, 1.1, 1.2];
export const RAIN_GRID = [-100, -50, 0, 50, 100];

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function bracket(grid: number[], x: number): [number, number, number] {
  const v = clamp(x, grid[0], grid[grid.length - 1]);
  let i = 0;
  while (i < grid.length - 2 && v > grid[i + 1]) i++;
  const t = (v - grid[i]) / (grid[i + 1] - grid[i]);
  return [i, i + 1, t];
}

/**
 * Nội suy song tuyến tính dự báo p50 tổng xuất khẩu 6 tháng tới theo hệ số giá Robusta và độ lệch mưa (mm).
 * Ngoài lưới thì giữ ở biên (không ngoại suy).
 */
export function interpolateScenario(scenarios: Results["scenarios"], priceMult: number, rainMm: number): number[] {
  const [p0, p1, tp] = bracket(PRICE_GRID, priceMult);
  const [r0, r1, tr] = bracket(RAIN_GRID, rainMm);
  const key = (p: number, r: number) => `${PRICE_GRID[p].toFixed(1)}|${RAIN_GRID[r]}`;
  const g = (p: number, r: number) => scenarios[key(p, r)];
  const a = g(p0, r0), b = g(p0, r1), c = g(p1, r0), d = g(p1, r1);
  return a.map((_, i) => {
    const top = a[i] * (1 - tr) + b[i] * tr;
    const bot = c[i] * (1 - tr) + d[i] * tr;
    return top * (1 - tp) + bot * tp;
  });
}
