import { MARKETS, MARKET_LABEL, simPairAt, type Market } from "./constants";
import type { Results } from "./schema";
import { fmt, monthLabel, pct, signedPct } from "./format";
import { computeInventory, weeksToMonths, zFor } from "./inventory";

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const last = <T,>(a: T[], k = 1) => a[a.length - k];

/** Tổng p50 và cùng kỳ năm trước của `n` tháng đầu dự báo cho một thị trường. */
export function horizonSum(d: Results, market: Market, n = 3) {
  const f = d.forecast[market].slice(0, n);
  const p50 = sum(f.map((x) => x.p50));
  const ly = sum(f.map((x) => x.ly));
  return { p50, ly, p10: sum(f.map((x) => x.p10)), p90: sum(f.map((x) => x.p90)), change: ly ? p50 / ly - 1 : NaN };
}

export function marketRanking(d: Results, n = 3) {
  return MARKETS.filter((m) => m !== "Total")
    .map((m) => ({ market: m, ...horizonSum(d, m, n) }))
    .sort((a, b) => b.change - a.change);
}

export function seriesTail(d: Results, key: "price_usd_t" | "usdvnd" | "rain_anom_mm" | "freight_idx", n = 24) {
  return { months: d.history.month.slice(-n), values: d.history[key].slice(-n) };
}

export function changeOver(d: Results, key: "price_usd_t" | "usdvnd" | "freight_idx", months = 3) {
  const v = d.history[key];
  return v[v.length - 1] / v[v.length - 1 - months] - 1;
}

export type Severity = "ok" | "attention" | "critical";
export interface Alert {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  rule: string;
}

export const DEFAULT_LEAD_WEEKS = 8.7;
export const DEFAULT_SERVICE = 0.95;

export function defaultInventory(d: Results) {
  return computeInventory({
    forecastP50: d.forecast.Total.map((x) => x.p50),
    sigH: d.meta.sig_h,
    share: d.meta.share,
    firmNoise: d.meta.firm_noise,
    leadMonths: weeksToMonths(DEFAULT_LEAD_WEEKS),
    z: zFor(DEFAULT_SERVICE, d.meta.z),
  });
}

/** Cảnh báo theo quy tắc rõ ràng; chỉ trả về những cảnh báo thỏa điều kiện. */
export function buildAlerts(d: Results): Alert[] {
  const out: Alert[] = [];
  const h = d.history;
  const n = h.month.length;

  // 1. Nhu cầu 3 tháng tới lệch > 10% so với cùng kỳ
  const hs = horizonSum(d, "Total", 3);
  if (Math.abs(hs.change) > 0.1) {
    out.push({
      id: "demand", severity: Math.abs(hs.change) > 0.2 ? "critical" : "attention",
      title: hs.change > 0 ? "Nhu cầu quý tới tăng mạnh" : "Nhu cầu quý tới giảm mạnh",
      detail: `Dự báo 3 tháng tới ${fmt(hs.p50, 1)} kt, ${hs.change > 0 ? "cao" : "thấp"} hơn cùng kỳ năm trước (${fmt(hs.ly, 1)} kt) ${signedPct(hs.change)}.`,
      rule: "Ngưỡng: lệch hơn 10% so với cùng kỳ năm trước (nghiêm trọng khi hơn 20%).",
    });
  }

  // 2. Giá đổi > 10% trong 3 tháng
  const dp = changeOver(d, "price_usd_t", 3);
  if (Math.abs(dp) > 0.1) {
    out.push({
      id: "price", severity: Math.abs(dp) > 0.2 ? "critical" : "attention",
      title: dp > 0 ? "Giá Robusta tăng nhanh" : "Giá Robusta giảm nhanh",
      detail: `Giá ${fmt(last(h.price_usd_t), 0)} USD/tấn, ${signedPct(dp)} so với 3 tháng trước (${monthLabel(h.month[n - 4])}).`,
      rule: "Ngưỡng: giá đổi hơn 10% trong 3 tháng (nghiêm trọng khi hơn 20%).",
    });
  }

  // 3. Mưa bất thường trung bình 6–9 tháng trước tháng dự báo đầu tiên < -50 mm
  const win = h.rain_anom_mm.slice(n - 9, n - 5); // tháng t−9..t−6 so với tháng dự báo đầu tiên (chỉ số n)
  const rainAvg = sum(win) / win.length;
  if (rainAvg < -50) {
    out.push({
      id: "rain", severity: rainAvg < -100 ? "critical" : "attention",
      title: "Mưa bất thường thấp ở giai đoạn ảnh hưởng vụ mùa",
      detail: `Trung bình lệch mưa ${monthLabel(h.month[n - 9])}–${monthLabel(h.month[n - 6])} là ${fmt(rainAvg, 1)} mm (6–9 tháng trước tháng dự báo đầu tiên).`,
      rule: "Ngưỡng: lệch mưa trung bình thấp hơn -50 mm (nghiêm trọng khi thấp hơn -100 mm).",
    });
  }

  // 4. Cước cao hơn 30% so với trung bình 12 tháng
  const fr = h.freight_idx;
  const avg12 = sum(fr.slice(n - 12)) / 12;
  const ratio = last(fr) / avg12 - 1;
  if (ratio > 0.3) {
    out.push({
      id: "freight", severity: ratio > 0.6 ? "critical" : "attention",
      title: "Cước vận tải cao bất thường",
      detail: `Chỉ số cước ${fmt(last(fr), 0)}, cao hơn ${pct(ratio, 0)} so với trung bình 12 tháng (${fmt(avg12, 0)}).`,
      rule: "Ngưỡng: cao hơn 30% so với trung bình 12 tháng (nghiêm trọng khi hơn 60%).",
    });
  }

  // 5. Tồn kho cuối kỳ mô phỏng (chính sách B) thấp hơn safety stock
  const lastRow = last(d.sim.base_series.B);
  if (lastRow.end_inv < lastRow.ss) {
    out.push({
      id: "stock", severity: "critical",
      title: "Tồn kho cuối kỳ mô phỏng dưới mức an toàn",
      detail: `Tháng ${monthLabel(lastRow.month)}: tồn kho cuối ${fmt(lastRow.end_inv * 1000, 0)} tấn, thấp hơn tồn kho an toàn ${fmt(lastRow.ss * 1000, 0)} tấn (chính sách theo dự báo AI, L = 2 tháng, mức dịch vụ 95%).`,
      rule: "Ngưỡng: tồn kho cuối kỳ của chính sách B thấp hơn safety stock.",
    });
  }
  return out;
}

export interface Kpi {
  label: string;
  value: string;
  note: string;
}

export function buildKpis(d: Results): Kpi[] {
  const f1 = d.forecast.Total[0];
  const h3 = horizonSum(d, "Total", 3);
  const inv = defaultInventory(d);
  return [
    { label: `Dự báo tháng ${monthLabel(f1.month)}`, value: `${fmt(f1.p50, 1)} kt`, note: `${signedPct(f1.p50 / f1.ly - 1)} so với cùng tháng năm trước (${fmt(f1.ly, 1)} kt)` },
    { label: "Tổng 3 tháng tới", value: `${fmt(h3.p50, 1)} kt`, note: `${signedPct(h3.change)} so với cùng kỳ năm trước · khoảng 80%: ${fmt(h3.p10, 0)}–${fmt(h3.p90, 0)} kt` },
    { label: "Tồn kho an toàn", value: `${fmt(inv.safetyStock * 1000, 0)} tấn`, note: "Đệm để không thiếu hàng trong thời gian chờ hàng về, mức dịch vụ 95%" },
    { label: "Tồn kho khuyến nghị (mức tối đa)", value: `${fmt(inv.orderUpTo * 1000, 0)} tấn`, note: `Doanh nghiệp giả định ${pct(d.meta.share, 0)} thị phần · lead time ≈ ${fmt(DEFAULT_LEAD_WEEKS, 1)} tuần · dịch vụ 95%` },
  ];
}

/** Mô hình có sMAPE thấp nhất trong hai mô hình thống kê/học máy ở từng mốc (đối chiếu với kết luận trung thực của đề tài). */
export function bestModelByHorizon(d: Results, market: Market = "Total") {
  const m = d.metrics[market];
  return (["h1", "h3", "h6"] as const).map((h) => {
    const t = m[`${h}_test`];
    const entries = (Object.keys(t) as (keyof typeof t)[]).map((k) => [k, t[k].sMAPE] as const).sort((a, b) => a[1] - b[1]);
    return { horizon: h, best: entries[0][0], second: entries[1][0], gap: entries[1][1] - entries[0][1], table: t };
  });
}

export function simSummary(d: Results, L = 2, svc = 0.95) {
  const p = simPairAt(d, L, svc);
  if (!p) return null;
  return { ...p, reduction: 1 - p.B.total / p.A.total };
}

export const marketName = (m: Market) => MARKET_LABEL[m];
