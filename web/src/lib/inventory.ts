/**
 * Công thức tồn kho (doanh nghiệp giả định) – tính ở client.
 * Đơn vị: khối lượng kt (nghìn tấn); tiền nghìn USD.
 */

export const WEEKS_PER_MONTH = 4.345;
export const STORAGE_USD_PER_TON_MONTH = 6;

export const weeksToMonths = (w: number) => w / WEEKS_PER_MONTH;

/** Nghịch đảo phân phối chuẩn (xấp xỉ Acklam, sai số ~1e-9). */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError("p phải nằm trong (0, 1)");
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  return -normInv(1 - p);
}

/** z theo mức dịch vụ: dùng bảng meta.z khi trùng, nếu không dùng nghịch đảo chuẩn. */
export function zFor(service: number, table: Record<string, number>): number {
  for (const [k, v] of Object.entries(table)) if (Math.abs(Number(k) - service) < 1e-9) return v;
  return normInv(service);
}

/** Giá trị tháng i (1-based); vượt tháng cuối thì lặp lại giá trị tháng cuối. */
const at = (arr: number[], i: number) => arr[Math.min(Math.max(i, 1), arr.length) - 1];

/** Tổng của `months` tháng bắt đầu từ tháng start (1-based), phần lẻ tính theo tỉ lệ ở tháng kế tiếp. */
export function windowSum(arr: number[], months: number, start = 1): number {
  if (months <= 0) return 0;
  const whole = Math.floor(months + 1e-12);
  let s = 0;
  for (let i = 0; i < whole; i++) s += at(arr, start + i);
  const frac = months - whole;
  if (frac > 1e-9) s += frac * at(arr, start + whole);
  return s;
}

export interface InventoryInput {
  /** Dự báo p50 tổng xuất khẩu 6 tháng tới (kt), đã nội suy kịch bản. */
  forecastP50: number[];
  /** meta.sig_h: độ lệch chuẩn sai số dự báo quốc gia theo số tháng dự báo trước (kt). */
  sigH: Record<string, number>;
  share: number;
  firmNoise: number;
  leadMonths: number;
  z: number;
}

export interface InventoryResult {
  F: number[];
  P: number;
  demandP: number;
  demandL: number;
  sigmaP: number;
  safetyStock: number;
  rop: number;
  orderUpTo: number;
  avgInventory: number;
}

export function computeInventory(inp: InventoryInput): InventoryResult {
  const F = inp.forecastP50.map((v) => v * inp.share);
  const L = inp.leadMonths;
  const P = L + 1;
  const demandP = windowSum(F, P);
  const demandL = windowSum(F, L);
  const meanF = F.reduce((a, b) => a + b, 0) / F.length;

  // Phương sai sai số dự báo trong khoảng bảo vệ: tháng i dùng sig_h[min(i,6)]·s, tháng lẻ tính theo tỉ lệ
  let variance = 0;
  const whole = Math.floor(P + 1e-12);
  for (let i = 1; i <= whole; i++) variance += (inp.sigH[String(Math.min(i, 6))] * inp.share) ** 2;
  const frac = P - whole;
  if (frac > 1e-9) variance += frac * (inp.sigH[String(Math.min(whole + 1, 6))] * inp.share) ** 2;
  variance += (inp.firmNoise * meanF) ** 2 * P;

  const sigmaP = Math.sqrt(variance);
  const safetyStock = inp.z * sigmaP;
  return { F, P, demandP, demandL, sigmaP, safetyStock, rop: demandL + safetyStock, orderUpTo: demandP + safetyStock, avgInventory: safetyStock + F[0] / 2 };
}

export interface CostInput {
  avgInventoryKt: number;
  priceUsdT: number;
  priceChange: number; // -0.2..+0.2
  capitalCostMonthly: number; // dạng số thập phân, vd 0.008 = 0,8%/tháng
  usdvnd: number;
  fxChange: number; // -0.1..+0.1
}

export interface CostResult {
  holdingUsdK: number;
  holdingBillionVnd: number;
  capitalPart: number;
  storagePart: number;
}

/** Chi phí lưu kho mỗi tháng = tồn kho bình quân × (chi phí vốn × giá + 6 USD/tấn kho). kt × USD/tấn = nghìn USD. */
export function holdingCost(c: CostInput): CostResult {
  const price = c.priceUsdT * (1 + c.priceChange);
  const capitalPart = c.avgInventoryKt * c.capitalCostMonthly * price;
  const storagePart = c.avgInventoryKt * STORAGE_USD_PER_TON_MONTH;
  const holdingUsdK = capitalPart + storagePart;
  const rate = c.usdvnd * (1 + c.fxChange);
  return { holdingUsdK, holdingBillionVnd: (holdingUsdK * 1000 * rate) / 1e9, capitalPart, storagePart };
}

export interface PlanRow {
  month: number; // 1..6
  demand: number;
  target: number;
  inbound: number;
}

/**
 * Bảng 6 tháng: mục tiêu cuối tháng m = SS + tổng F của L tháng kế tiếp (m+1..m+L, vượt tháng 6 thì lặp tháng 6);
 * lượng cần về kho m = max(0, nhu cầu m + mục tiêu m − mục tiêu m−1); mục tiêu tháng 0 tính cùng công thức.
 */
export function planTable(F: number[], safetyStock: number, leadMonths: number): PlanRow[] {
  const target = (m: number) => safetyStock + windowSum(F, leadMonths, m + 1);
  const rows: PlanRow[] = [];
  for (let m = 1; m <= F.length; m++) {
    const t = target(m);
    rows.push({ month: m, demand: F[m - 1], target: t, inbound: Math.max(0, F[m - 1] + (t - target(m - 1))) });
  }
  return rows;
}
