/** Định dạng số kiểu Việt Nam: dấu chấm ngăn nghìn, dấu phẩy thập phân. Không phụ thuộc ICU. */
export function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "Chưa có dữ liệu";
  const neg = n < 0 ? "-" : "";
  const [int, dec] = Math.abs(n).toFixed(digits).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const out = dec ? `${grouped},${dec}` : grouped;
  return /^[0,.]+$/.test(out) ? out : neg + out;
}

export const pct = (x: number | null | undefined, digits = 1) => (x === null || x === undefined ? "Chưa có dữ liệu" : `${fmt(x * 100, digits)}%`);

export function signedPct(x: number, digits = 1): string {
  const s = fmt(Math.abs(x * 100), digits);
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${s}%`;
}

/** Khối lượng: kt (nghìn tấn); dưới 1 kt hiển thị bằng tấn. */
export function fmtVol(kt: number, digits = 1): string {
  if (!Number.isFinite(kt)) return "Chưa có dữ liệu";
  if (Math.abs(kt) < 1) return `${fmt(kt * 1000, 0)} tấn`;
  return `${fmt(kt, digits)} kt`;
}

export const fmtUsdK = (v: number, digits = 0) => `${fmt(v, digits)} nghìn USD`;

/** nghìn USD, tỷ giá VND/USD -> tỷ đồng */
export const toBillionVnd = (thousandUsd: number, usdvnd: number) => (thousandUsd * 1000 * usdvnd) / 1e9;

export function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return `${mo}/${y}`;
}
