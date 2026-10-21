import type { Results } from "./schema";
import { MARKET_LABEL } from "./constants";
import { changeOver, defaultInventory, horizonSum, marketRanking, sum } from "./derived";
import { fmt, monthLabel, pct, signedPct } from "./format";
import { planTable, weeksToMonths } from "./inventory";
import { DEFAULT_LEAD_WEEKS } from "./derived";

export type Tone = "up" | "down" | "warn" | "info";
export interface Insight {
  id: string;
  title: string;
  text: string;
  tone: Tone;
  source: string;
}

const MONTH_NAMES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

/** Chỉ số mùa vụ: trung bình (khối lượng tháng / trung bình năm đó) trên các năm đủ 12 tháng. */
export function seasonalIndex(d: Results): { index: number[]; years: number } {
  const byYear = new Map<string, number[]>();
  d.history.month.forEach((m, i) => {
    const y = m.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)![Number(m.slice(5, 7)) - 1] = d.history.vol_kt[i];
  });
  const full = [...byYear.values()].filter((v) => v.length === 12 && v.every((x) => typeof x === "number"));
  const index = Array.from({ length: 12 }, (_, k) => full.reduce((a, v) => a + v[k] / (sum(v) / 12), 0) / full.length);
  return { index, years: full.length };
}

export function buildInsights(d: Results): Insight[] {
  const out: Insight[] = [];
  const h = d.history;
  const n = h.month.length;
  const f = d.forecast.Total;
  const q = horizonSum(d, "Total", 3);
  const half = horizonSum(d, "Total", 6);

  // 1. Xu hướng và nhịp cao điểm
  const peak = f.reduce((a, b) => (b.p50 > a.p50 ? b : a));
  const low = f.reduce((a, b) => (b.p50 < a.p50 ? b : a));
  out.push({
    id: "trend", tone: q.change >= 0 ? "up" : "down", source: "forecast.Total",
    title: `Quý tới ${q.change >= 0 ? "tăng" : "giảm"} ${signedPct(q.change)} so với cùng kỳ`,
    text: `Dự báo 3 tháng tới là ${fmt(q.p50, 1)} kt (khoảng 80%: ${fmt(q.p10, 0)}–${fmt(q.p90, 0)} kt), cả 6 tháng là ${fmt(half.p50, 1)} kt (${signedPct(half.change)}). Đỉnh rơi vào ${monthLabel(peak.month)} (${fmt(peak.p50, 1)} kt), thấp nhất ${monthLabel(low.month)} (${fmt(low.p50, 1)} kt), chênh ${pct(peak.p50 / low.p50 - 1, 0)}.`,
  });

  // 2. Mùa vụ
  const { index, years } = seasonalIndex(d);
  const ranked = index.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  out.push({
    id: "season", tone: "info", source: `history.vol_kt, ${years} năm đủ 12 tháng`,
    title: "Mùa vụ là yếu tố chi phối nhịp xuất khẩu",
    text: `Cao điểm trung bình ở ${ranked.slice(0, 3).map((r) => `${MONTH_NAMES[r.i]} (${signedPct(r.v - 1, 0)})`).join(", ")}; thấp nhất ở ${ranked.slice(-2).map((r) => `${MONTH_NAMES[r.i]} (${signedPct(r.v - 1, 0)})`).join(", ")} so với trung bình năm. Biến «mùa vụ của tháng dự báo» cũng là biến quan trọng nhất của mô hình.`,
  });

  // 3. Tập trung thị trường
  const rank = marketRanking(d, 3);
  const byVol = [...rank].sort((a, b) => b.p50 - a.p50);
  const share = (x: number) => x / (byVol.reduce((a, r) => a + r.p50, 0));
  const fastest = rank[0];
  const slowest = rank[rank.length - 1];
  out.push({
    id: "markets", tone: "info", source: "forecast.EU/US/JP/KR/CN, so với ly",
    title: `${MARKET_LABEL[byVol[0].market].replace(" (EU-27)", "")} chiếm ${pct(share(byVol[0].p50), 0)} trong 5 thị trường chính`,
    text: `Tăng nhanh nhất là ${MARKET_LABEL[fastest.market].replace(" (EU-27)", "")} (${signedPct(fastest.change)}), chậm nhất là ${MARKET_LABEL[slowest.market].replace(" (EU-27)", "")} (${signedPct(slowest.change)}). Thị trường tăng nhanh chưa chắc đóng góp nhiều nhất về lượng: ${MARKET_LABEL[fastest.market].replace(" (EU-27)", "")} chỉ chiếm ${pct(share(fastest.p50), 0)}.`,
  });

  // 4. Độ bất định
  const w1 = (f[0].p90 - f[0].p10) / f[0].p50;
  const w6 = (f[5].p90 - f[5].p10) / f[5].p50;
  out.push({
    id: "uncertainty", tone: "warn", source: "forecast.Total p10–p90",
    title: "Càng xa, dự báo càng bất định",
    text: `Khoảng nhu cầu có thể xảy ra rộng ${pct(w1, 0)} giá trị dự báo ở tháng đầu và ${pct(w6, 0)} ở tháng thứ 6. Thực tế đã có lúc nằm ngoài khoảng này, nên hãy xem đây là mức rủi ro tối thiểu, chốt chắc phần gần và giữ linh hoạt phần xa.`,
  });

  // 5. Tín hiệu thị trường
  const dp = changeOver(d, "price_usd_t");
  const fr = h.freight_idx[n - 1] / (sum(h.freight_idx.slice(n - 12)) / 12) - 1;
  const rainWin = h.rain_anom_mm.slice(n - 9, n - 5);
  const rain = sum(rainWin) / rainWin.length;
  const calm = Math.abs(dp) <= 0.1 && fr <= 0.3 && rain >= -50;
  out.push({
    id: "signals", tone: calm ? "info" : "warn", source: "history.price_usd_t, freight_idx, rain_anom_mm",
    title: calm ? "Các biến thị trường đang ở vùng bình thường" : "Có tín hiệu thị trường cần theo dõi",
    text: `Giá Robusta ${signedPct(dp)} trong 3 tháng (${fmt(h.price_usd_t[n - 1], 0)} USD/tấn), chỉ số cước ${signedPct(fr)} so với trung bình 12 tháng, lệch mưa trung bình giai đoạn 6–9 tháng trước ${fmt(rain, 1)} mm. ${calm ? "Không biến nào vượt ngưỡng cảnh báo." : "Có biến vượt ngưỡng, xem mục Cảnh báo."}`,
  });

  // 6. Hàm ý tồn kho
  const inv = defaultInventory(d);
  const plan = planTable(inv.F, inv.safetyStock, weeksToMonths(DEFAULT_LEAD_WEEKS));
  const first = sum(plan.slice(0, 3).map((r) => r.inbound));
  const second = sum(plan.slice(3).map((r) => r.inbound));
  out.push({
    id: "inventory", tone: second > first ? "up" : "info", source: "Công thức tồn kho (meta.sig_h, meta.z), doanh nghiệp giả định",
    title: second > first ? "Cần dồn lượng về kho vào nửa cuối kỳ" : "Lượng về kho khá đều giữa hai quý",
    text: `Với doanh nghiệp giả định ${pct(d.meta.share, 0)} thị phần, lead time ≈ ${fmt(DEFAULT_LEAD_WEEKS, 1)} tuần, dịch vụ 95%: tồn kho an toàn ${fmt(inv.safetyStock * 1000, 0)} tấn, mức tối đa ${fmt(inv.orderUpTo * 1000, 0)} tấn. Lượng cần về kho ${fmt(first * 1000, 0)} tấn trong 3 tháng đầu và ${fmt(second * 1000, 0)} tấn trong 3 tháng sau (${signedPct(second / first - 1, 0)}).`,
  });

  return out;
}
