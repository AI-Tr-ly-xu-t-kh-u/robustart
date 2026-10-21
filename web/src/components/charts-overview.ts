import type { EChartsCoreOption } from "echarts/core";
import type { Results } from "@/lib/schema";
import { MARKET_SHORT } from "@/lib/constants";
import { marketRanking, sum } from "@/lib/derived";
import { fmt, monthLabel, signedPct } from "@/lib/format";
import { seasonalIndex } from "@/lib/insights";
import { COLORS } from "./charts";

const axis = {
  axisLine: { lineStyle: { color: COLORS.axis } },
  axisLabel: { color: COLORS.axis },
  splitLine: { lineStyle: { color: COLORS.grid } },
};

const MIX_COLORS = ["#3E2415", "#8A5A2B", "#C98F55", "#E2B98A", "#7FA66B", "#B9A58F"];

/** Chỉ số mùa vụ trung bình (cột) và 12 tháng gần nhất (đường); tháng nằm trong kỳ dự báo được tô đậm. */
export function seasonalityOption(d: Results): EChartsCoreOption {
  const { index } = seasonalIndex(d);
  const horizon = new Set(d.forecast.Total.map((f) => Number(f.month.slice(5, 7)) - 1));
  const n = d.history.month.length;
  const last12 = d.history.vol_kt.slice(n - 12);
  const mean12 = sum(last12) / 12;
  const recent: (number | null)[] = Array(12).fill(null);
  last12.forEach((v, i) => { recent[Number(d.history.month[n - 12 + i].slice(5, 7)) - 1] = (v / mean12 - 1) * 100; });
  const labels = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);
  return {
    color: [COLORS.caramel, COLORS.espresso],
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${fmt(v, 1)}%` : "—") },
    legend: { top: 0, textStyle: { color: COLORS.axis } },
    grid: { left: 52, right: 16, top: 40, bottom: 30 },
    xAxis: { type: "category", data: labels, ...axis },
    yAxis: { type: "value", name: "% so với TB năm", ...axis },
    series: [
      { name: "Chỉ số mùa vụ trung bình", type: "bar", barWidth: "52%", data: index.map((v, i) => ({ value: (v - 1) * 100, itemStyle: { color: horizon.has(i) ? COLORS.caramel : "#E7D3B8", borderRadius: [6, 6, 0, 0] } })) },
      { name: "12 tháng gần nhất", type: "line", data: recent, symbolSize: 6, lineStyle: { width: 2.5 }, connectNulls: true },
    ],
  } as EChartsCoreOption;
}

/** Cơ cấu thị trường theo thời gian (48 tháng gần nhất), diện tích xếp chồng. */
export function marketMixOption(d: Results): EChartsCoreOption {
  const h = d.history;
  const k = 48;
  const s = (a: number[]) => a.slice(-k);
  const series = [
    ["EU", s(h.vol_EU_kt)], ["Mỹ", s(h.vol_US_kt)], ["Nhật", s(h.vol_JP_kt)], ["Hàn", s(h.vol_KR_kt)], ["Trung Quốc", s(h.vol_CN_kt)], ["Khác", s(h.vol_other_kt)],
  ] as const;
  return {
    color: MIX_COLORS,
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => (typeof v === "number" ? `${fmt(v, 1)} kt` : "—") },
    legend: { top: 0, textStyle: { color: COLORS.axis } },
    grid: { left: 52, right: 16, top: 40, bottom: 30 },
    xAxis: { type: "category", boundaryGap: false, data: h.month.slice(-k).map(monthLabel), ...axis, axisLabel: { color: COLORS.axis, interval: 5 } },
    yAxis: { type: "value", name: "kt", ...axis },
    series: series.map(([name, data]) => ({ name, type: "line", stack: "mix", data, showSymbol: false, smooth: 0.25, lineStyle: { width: 1 }, areaStyle: { opacity: 0.9 } })),
  } as EChartsCoreOption;
}

/** Khối lượng xuất khẩu (trái) và giá Robusta (phải), 60 tháng gần nhất. */
export function priceVolumeOption(d: Results): EChartsCoreOption {
  const h = d.history;
  const k = 60;
  return {
    color: [COLORS.caramel, COLORS.espresso],
    tooltip: { trigger: "axis" },
    legend: { top: 0, textStyle: { color: COLORS.axis } },
    grid: { left: 52, right: 56, top: 40, bottom: 30 },
    xAxis: { type: "category", data: h.month.slice(-k).map(monthLabel), ...axis, axisLabel: { color: COLORS.axis, interval: 7 } },
    yAxis: [
      { type: "value", name: "kt", ...axis },
      { type: "value", name: "USD/tấn", scale: true, ...axis, splitLine: { show: false } },
    ],
    series: [
      { name: "Khối lượng xuất khẩu (kt)", type: "line", data: h.vol_kt.slice(-k), showSymbol: false, smooth: 0.2, lineStyle: { width: 2.2 }, areaStyle: { opacity: 0.18 }, tooltip: { valueFormatter: (v: unknown) => (typeof v === "number" ? `${fmt(v, 1)} kt` : "—") } },
      { name: "Giá Robusta (USD/tấn)", type: "line", yAxisIndex: 1, data: h.price_usd_t.slice(-k), showSymbol: false, smooth: 0.2, lineStyle: { width: 2.2 }, tooltip: { valueFormatter: (v: unknown) => (typeof v === "number" ? `${fmt(v, 0)} USD/tấn` : "—") } },
    ],
  } as EChartsCoreOption;
}

/** Backtest trên tập test: thực tế so với dự báo p50 trước 1 tháng và dải p10–p90. */
export function backtestOption(d: Results): EChartsCoreOption {
  const bt = d.backtest.Total.h1.filter((b) => b.split === "test");
  return {
    color: [COLORS.espresso, COLORS.caramel],
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => (typeof v === "number" ? `${fmt(v, 1)} kt` : "—") },
    legend: { top: 0, data: ["Thực tế", "Dự báo p50 (trước 1 tháng)", "Khoảng 80%"], textStyle: { color: COLORS.axis } },
    grid: { left: 52, right: 16, top: 40, bottom: 30 },
    xAxis: { type: "category", data: bt.map((b) => monthLabel(b.month)), ...axis, axisLabel: { color: COLORS.axis, interval: 3 } },
    yAxis: { type: "value", name: "kt", scale: true, ...axis },
    series: [
      { name: "p10", type: "line", data: bt.map((b) => b.p10), stack: "band", lineStyle: { opacity: 0 }, showSymbol: false, silent: true, tooltip: { show: false } },
      { name: "Khoảng 80%", type: "line", data: bt.map((b) => b.p90 - b.p10), stack: "band", lineStyle: { opacity: 0 }, areaStyle: { color: COLORS.caramel, opacity: 0.25 }, showSymbol: false, silent: true },
      { name: "Thực tế", type: "line", data: bt.map((b) => b.actual), showSymbol: false, lineStyle: { width: 2.6 }, z: 5 },
      { name: "Dự báo p50 (trước 1 tháng)", type: "line", data: bt.map((b) => b.p50), showSymbol: false, lineStyle: { width: 2.2, type: "dashed" }, z: 6 },
    ],
  } as EChartsCoreOption;
}

/** Dự báo 3 tháng tới theo thị trường kèm % thay đổi so với cùng kỳ. */
export function contributionOption(d: Results): EChartsCoreOption {
  const rank = marketRanking(d, 3).sort((a, b) => a.p50 - b.p50);
  return {
    grid: { left: 70, right: 120, top: 10, bottom: 24 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (p: unknown) => {
      const i = (p as { dataIndex: number }[])[0].dataIndex;
      const r = rank[i];
      return `<b>${MARKET_SHORT[r.market]}</b><br/>${fmt(r.p50, 1)} kt (khoảng 80%: ${fmt(r.p10, 0)}–${fmt(r.p90, 0)})<br/>So với cùng kỳ: ${signedPct(r.change)}`;
    } },
    xAxis: { type: "value", name: "kt", ...axis },
    yAxis: { type: "category", data: rank.map((r) => MARKET_SHORT[r.market]), axisLabel: { color: COLORS.espresso, fontWeight: 600 }, axisLine: axis.axisLine },
    series: [{
      type: "bar", barWidth: "56%",
      data: rank.map((r) => ({ value: r.p50, itemStyle: { color: r.change >= 0 ? COLORS.caramel : COLORS.bad, borderRadius: [0, 8, 8, 0] } })),
      label: { show: true, position: "right", color: COLORS.espresso, formatter: (p: { dataIndex: number; value: number }) => `${fmt(p.value, 1)} kt · ${signedPct(rank[p.dataIndex].change)}` },
    }],
  } as EChartsCoreOption;
}
