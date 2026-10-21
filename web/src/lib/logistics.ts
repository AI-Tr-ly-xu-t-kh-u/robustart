import type { Results } from "./schema";
import { monthLabel } from "./format";

/**
 * Logistics: (1) triển vọng cước từ chuỗi chỉ số cước có trong dữ liệu; (2) so sánh tuyến vận chuyển nội địa bằng
 * bảng giả định CÓ THỂ SỬA. Các số trong bảng tuyến là giả định minh họa, không phải báo giá hay đo đạc thật.
 */
export interface Leg { mode: "road" | "barge" | "rail"; km: number; usd_per_tkm: number; g_co2_per_tkm: number }
export interface RouteOption { id: string; name: string; legs: Leg[]; fixed_usd_per_t: number; extra_days: number; note: string }

export const DEFAULT_ROUTES: RouteOption[] = [
  { id: "catlai", name: "Xe tải thẳng cảng Cát Lái (TP.HCM)", legs: [{ mode: "road", km: 350, usd_per_tkm: 0.06, g_co2_per_tkm: 80 }], fixed_usd_per_t: 12, extra_days: 0, note: "Gần thị trường, nhưng dễ ùn tắc ở cảng." },
  { id: "caimep", name: "Xe tải thẳng cảng Cái Mép", legs: [{ mode: "road", km: 420, usd_per_tkm: 0.06, g_co2_per_tkm: 80 }], fixed_usd_per_t: 9, extra_days: 0, note: "Tàu lớn đi thẳng châu Âu, ít phải chuyển tải." },
  { id: "quynhon", name: "Xe tải đến Quy Nhơn rồi tàu nhỏ", legs: [{ mode: "road", km: 300, usd_per_tkm: 0.06, g_co2_per_tkm: 80 }], fixed_usd_per_t: 22, extra_days: 3, note: "Quãng đường bộ ngắn nhưng phải chuyển tải." },
  { id: "barge", name: "Xe tải đến kho nội địa rồi sà lan đến Cái Mép", legs: [{ mode: "road", km: 330, usd_per_tkm: 0.06, g_co2_per_tkm: 80 }, { mode: "barge", km: 90, usd_per_tkm: 0.025, g_co2_per_tkm: 30 }], fixed_usd_per_t: 14, extra_days: 1, note: "Giảm khí thải ở chặng cuối, thêm một lần bốc xếp." },
];

export interface RouteResult { id: string; name: string; total_km: number; usd_per_ton: number; total_usd: number; co2_kg: number; co2_kg_per_ton: number; extra_days: number; note: string }

export function evaluateRoutes(routes: RouteOption[], tons: number): RouteResult[] {
  return routes.map((r) => {
    const cost = r.legs.reduce((a, l) => a + l.km * l.usd_per_tkm, 0) + r.fixed_usd_per_t;
    const co2perT = r.legs.reduce((a, l) => a + (l.km * l.g_co2_per_tkm) / 1000, 0);
    return { id: r.id, name: r.name, total_km: r.legs.reduce((a, l) => a + l.km, 0), usd_per_ton: Math.round(cost * 10) / 10, total_usd: Math.round(cost * tons), co2_kg: Math.round(co2perT * tons), co2_kg_per_ton: Math.round(co2perT * 10) / 10, extra_days: r.extra_days, note: r.note };
  });
}

/** Tuyến rẻ nhất, ít khí thải nhất và cân bằng (tổng hạng thấp nhất; hòa thì chọn rẻ hơn). */
export function pickRoutes(res: RouteResult[]) {
  const by = (f: (r: RouteResult) => number) => [...res].sort((a, b) => f(a) - f(b));
  const cost = by((r) => r.usd_per_ton), co2 = by((r) => r.co2_kg_per_ton);
  const rank = (r: RouteResult) => cost.indexOf(r) + co2.indexOf(r);
  const balanced = [...res].sort((a, b) => rank(a) - rank(b) || a.usd_per_ton - b.usd_per_ton)[0];
  return { cheapest: cost[0], greenest: co2[0], balanced };
}

export interface FreightOutlook {
  latest: number; change_3m_pct: number; change_12m_pct: number; avg_12m: number;
  seasonal: { month: string; index: number }[];
  high_months: string[]; low_months: string[];
}

/** Chỉ số cước theo mùa (trung bình tháng / trung bình năm của các năm đủ 12 tháng) áp cho 6 tháng dự báo. */
export function freightOutlook(d: Results): FreightOutlook {
  const h = d.history;
  const n = h.month.length;
  const f = h.freight_idx;
  const byYear = new Map<string, number[]>();
  h.month.forEach((m, i) => {
    const y = m.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)![Number(m.slice(5, 7)) - 1] = f[i];
  });
  const full = [...byYear.values()].filter((v) => v.length === 12 && v.every((x) => typeof x === "number"));
  const idx = Array.from({ length: 12 }, (_, k) => (full.length ? full.reduce((a, v) => a + v[k] / (v.reduce((x, y) => x + y, 0) / 12), 0) / full.length : 1));
  const seasonal = d.forecast.Total.map((x) => ({ month: x.month, index: Math.round(idx[Number(x.month.slice(5, 7)) - 1] * 100) / 100 }));
  const sorted = [...seasonal].sort((a, b) => b.index - a.index);
  const avg12 = f.slice(n - 12).reduce((a, b) => a + b, 0) / 12;
  return {
    latest: f[n - 1],
    change_3m_pct: Math.round((f[n - 1] / f[n - 4] - 1) * 1000) / 10,
    change_12m_pct: Math.round((f[n - 1] / f[n - 13] - 1) * 1000) / 10,
    avg_12m: Math.round(avg12 * 10) / 10,
    seasonal, high_months: sorted.slice(0, 2).map((s) => monthLabel(s.month)), low_months: sorted.slice(-2).map((s) => monthLabel(s.month)),
  };
}
