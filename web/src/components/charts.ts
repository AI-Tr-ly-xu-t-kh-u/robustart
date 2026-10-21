import type { EChartsCoreOption } from "echarts/core";
import type { BacktestPoint, ForecastPoint, Results } from "@/lib/schema";
import { MODEL_LABEL, MODELS, type Market } from "@/lib/constants";
import { fmt, monthLabel } from "@/lib/format";

export const COLORS = {
  espresso: "#2A1810",
  roast: "#3E2415",
  caramel: "#C98F55",
  caramelLight: "#E2B98A",
  leaf: "#3F6B3A",
  bad: "#C0392B",
  grid: "rgba(42,24,16,0.12)",
  axis: "#6F5A4A",
};

const axisBase = {
  axisLine: { lineStyle: { color: COLORS.axis } },
  axisLabel: { color: COLORS.axis },
  splitLine: { lineStyle: { color: COLORS.grid } },
};

export function sparkOption(values: number[], color = COLORS.caramel): EChartsCoreOption {
  return {
    grid: { left: 2, right: 2, top: 4, bottom: 2 },
    xAxis: { type: "category", show: false, data: values.map((_, i) => i) },
    yAxis: { type: "value", show: false, scale: true },
    series: [{ type: "line", data: values, smooth: true, showSymbol: false, lineStyle: { width: 2.5, color }, areaStyle: { color, opacity: 0.12 } }],
  };
}

export interface ForecastChartInput {
  d: Results;
  market: Market;
  backtest: "off" | "h1" | "h3";
  showSarima: boolean;
}

const MARKET_VOL: Record<Market, keyof Results["history"]> = {
  Total: "vol_kt", EU: "vol_EU_kt", US: "vol_US_kt", JP: "vol_JP_kt", KR: "vol_KR_kt", CN: "vol_CN_kt",
};

/** Lịch sử 36 tháng + dự báo 6 tháng với dải p10–p90; tuỳ chọn backtest và đường SARIMA. */
export function forecastOption({ d, market, backtest, showSarima }: ForecastChartInput): EChartsCoreOption {
  const h = d.history;
  const hist = (h[MARKET_VOL[market]] as number[]).slice(-36);
  const histM = h.month.slice(-36);
  const fc: ForecastPoint[] = d.forecast[market];
  const months = [...histM, ...fc.map((f) => f.month)];
  const padH = fc.map(() => null);
  const padF = histM.map(() => null);
  const lastHist = hist[hist.length - 1];

  const bt: BacktestPoint[] = backtest === "off" ? [] : d.backtest[market][backtest].filter((b) => months.includes(b.month));
  const btMap = new Map(bt.map((b) => [b.month, b]));

  const series: unknown[] = [
    { name: "Thực tế", type: "line", data: [...hist, ...padH], showSymbol: false, lineStyle: { width: 2.6, color: COLORS.espresso }, z: 5 },
    // dải p10–p90 bằng hai đường xếp chồng
    { name: "p10", type: "line", data: [...padF.slice(0, -1), lastHist, ...fc.map((f) => f.p10)], stack: "band", lineStyle: { opacity: 0 }, showSymbol: false, silent: true, tooltip: { show: false } },
    { name: "Khoảng có thể xảy ra (80%)", type: "line", data: [...padF.slice(0, -1), 0, ...fc.map((f) => f.p90 - f.p10)], stack: "band", lineStyle: { opacity: 0 }, areaStyle: { color: COLORS.caramel, opacity: 0.28 }, showSymbol: false, silent: true },
    { name: "Dự báo", type: "line", data: [...padF.slice(0, -1), lastHist, ...fc.map((f) => f.p50)], showSymbol: true, symbolSize: 7, lineStyle: { width: 3, color: COLORS.caramel, type: "solid" }, itemStyle: { color: COLORS.caramel }, z: 6 },
  ];
  if (showSarima) {
    series.push({ name: "SARIMA (đối chứng)", type: "line", data: [...padF.slice(0, -1), lastHist, ...fc.map((f) => f.sarima)], showSymbol: false, lineStyle: { width: 2, color: COLORS.leaf, type: "dashed" } });
  }
  series.push({ name: "Cùng tháng năm trước", type: "line", data: months.map((m, i) => (i >= histM.length ? fc[i - histM.length].ly : null)), showSymbol: true, symbolSize: 5, lineStyle: { width: 1.5, color: COLORS.axis, type: "dotted" }, itemStyle: { color: COLORS.axis } });
  if (backtest !== "off") {
    series.push({ name: `Backtest p50 (trước ${backtest === "h1" ? 1 : 3} tháng)`, type: "line", data: months.map((m) => btMap.get(m)?.p50 ?? null), showSymbol: true, symbolSize: 5, lineStyle: { width: 1.8, color: COLORS.bad, type: "dashed" }, itemStyle: { color: COLORS.bad } });
  }

  return {
    color: [COLORS.espresso, COLORS.caramel],
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: unknown) => (typeof v === "number" ? `${fmt(v, 1)} kt` : "—"),
    },
    legend: { top: 0, type: "scroll", data: ["Thực tế", "Khoảng có thể xảy ra (80%)", "Dự báo", ...(showSarima ? ["SARIMA (đối chứng)"] : []), "Cùng tháng năm trước", ...(backtest !== "off" ? [`Backtest p50 (trước ${backtest === "h1" ? 1 : 3} tháng)`] : [])], textStyle: { color: COLORS.axis } },
    grid: { left: 54, right: 20, top: 54, bottom: 56 },
    xAxis: { type: "category", data: months.map(monthLabel), ...axisBase, axisLabel: { color: COLORS.axis, interval: 5 } },
    yAxis: { type: "value", name: "kt", scale: true, ...axisBase },
    series,
  } as EChartsCoreOption;
}

export function compareOption(d: Results, market: Market, horizon: "h1" | "h3" | "h6", metric: "MAE" | "RMSE" | "sMAPE" | "MASE"): EChartsCoreOption {
  const t = d.metrics[market][`${horizon}_test`];
  const vals = MODELS.map((m) => t[m][metric]);
  const best = Math.min(...vals);
  return {
    grid: { left: 54, right: 20, top: 20, bottom: 40 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: unknown) => (typeof v === "number" ? fmt(v, 2) : "—") },
    xAxis: { type: "category", data: MODELS.map((m) => MODEL_LABEL[m]), ...axisBase },
    yAxis: { type: "value", name: metric === "sMAPE" ? "%" : metric === "MASE" ? "" : "kt", ...axisBase },
    series: [{ type: "bar", data: vals.map((v) => ({ value: v, itemStyle: { color: v === best ? COLORS.leaf : COLORS.caramelLight, borderRadius: [8, 8, 0, 0] } })), barWidth: "46%", label: { show: true, position: "top", formatter: (p: { value: number }) => fmt(p.value, 1), color: COLORS.espresso } }],
  } as EChartsCoreOption;
}

export function shapGlobalOption(g: Record<string, number>, top = 10): EChartsCoreOption {
  const e = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, top).reverse();
  return {
    grid: { left: 250, right: 30, top: 10, bottom: 30 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: unknown) => (typeof v === "number" ? `${fmt(v, 2)} kt` : "—") },
    xAxis: { type: "value", name: "kt", ...axisBase },
    yAxis: { type: "category", data: e.map((x) => x[0]), axisLabel: { color: COLORS.espresso, width: 230, overflow: "truncate" }, axisLine: axisBase.axisLine },
    series: [{ type: "bar", data: e.map((x) => x[1]), itemStyle: { color: COLORS.caramel, borderRadius: [0, 8, 8, 0] }, label: { show: true, position: "right", formatter: (p: { value: number }) => fmt(p.value, 1), color: COLORS.espresso } }],
  } as EChartsCoreOption;
}

export function inventoryOption(months: string[], a: number[], b: number[], ss: number[]): EChartsCoreOption {
  return {
    color: [COLORS.bad, COLORS.leaf, COLORS.caramel],
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => (typeof v === "number" ? `${fmt(v * 1000, 0)} tấn` : "—") },
    legend: { top: 0, textStyle: { color: COLORS.axis } },
    grid: { left: 54, right: 20, top: 44, bottom: 40 },
    xAxis: { type: "category", data: months.map(monthLabel), ...axisBase, axisLabel: { color: COLORS.axis, interval: 2 } },
    yAxis: { type: "value", name: "kt", ...axisBase },
    series: [
      { name: "A · chính sách kinh nghiệm", type: "line", data: a, showSymbol: false, lineStyle: { width: 2.6 } },
      { name: "B · chính sách theo dự báo AI", type: "line", data: b, showSymbol: false, lineStyle: { width: 2.6 } },
      { name: "Tồn kho an toàn (B)", type: "line", data: ss, showSymbol: false, lineStyle: { width: 1.6, type: "dashed" } },
    ],
  } as EChartsCoreOption;
}

export function mapOption(values: Record<string, { name: string; value: number; extra: string }>, metric: "vol" | "yoy", names: Record<string, string[]>): EChartsCoreOption {
  const data = Object.entries(names).flatMap(([mk, countries]) => countries.map((c) => ({ name: c, value: values[mk].value, market: mk, extra: values[mk].extra, label: values[mk].name })));
  const all = Object.values(values).map((v) => v.value);
  const min = Math.min(...all), max = Math.max(...all);
  return {
    tooltip: {
      trigger: "item",
      formatter: (p: { data?: { label: string; extra: string } }) => (p.data ? `<strong>${p.data.label}</strong><br/>${p.data.extra}` : ""),
    },
    visualMap: {
      min: metric === "yoy" ? Math.min(min, 0) : 0, max, text: ["Cao", "Thấp"], calculable: true, orient: "horizontal", left: "center", bottom: 4,
      inRange: { color: ["#F4E6D6", "#E2B98A", "#C98F55", "#8A5A2B", "#3E2415"] }, textStyle: { color: COLORS.axis },
    },
    series: [{
      type: "map", map: "world", roam: false, data,
      emphasis: { label: { show: false }, itemStyle: { areaColor: COLORS.leaf } },
      itemStyle: { areaColor: "#EADBC8", borderColor: "#FAF2E8", borderWidth: 0.6 },
      select: { disabled: true },
    }],
  } as EChartsCoreOption;
}
