import { z } from "zod";

import type { Market } from "./constants";

export type { Market };

const num = z.number();
const numArr = z.array(num);

const history = z.object({
  month: z.array(z.string()),
  vol_kt: numArr,
  vol_EU_kt: numArr,
  vol_US_kt: numArr,
  vol_JP_kt: numArr,
  vol_KR_kt: numArr,
  vol_CN_kt: numArr,
  vol_other_kt: numArr,
  price_usd_t: numArr,
  usdvnd: numArr,
  rain_mm: numArr,
  rain_anom_mm: numArr,
  freight_idx: numArr,
});

const fcPoint = z.object({ month: z.string(), p10: num, p50: num, p90: num, sarima: num, ly: num });
const btPoint = z.object({ month: z.string(), actual: num, p10: num, p50: num, p90: num, sarima: num, snaive: num, split: z.enum(["val", "test"]) });
const score = z.object({ MAE: num, RMSE: num, sMAPE: num, MASE: num });
const modelScores = z.object({ snaive: score, ma3: score, sarima: score, lgbm: score });
const marketMetrics = z.object({
  h1_test: modelScores, h3_test: modelScores, h6_test: modelScores,
  h1_val: modelScores, h3_val: modelScores, h6_val: modelScores,
  cover80_h1: num, cover80_h3: num,
});
const bt = z.object({ h1: z.array(btPoint), h3: z.array(btPoint) });
const shapLocal = z.object({ base: num, items: z.array(z.object({ feature: z.string(), kt: num })) });
const simStats = z.object({ fill: num, stockout_months: num, avg_inv: num, turns: num, hold: num, short: num, total: num });
const simPair = z.object({ A: simStats, B: simStats });
const simRow = z.object({
  month: z.string(), demand: num, sales: num, lost: num, end_inv: num, order: num, target: num, ss: num, hold: num, short: num,
});

export const ResultsSchema = z.object({
  meta: z.object({
    generated: z.string(),
    data_mode: z.enum(["mock", "live"]),
    last_month: z.string(),
    val_start: z.string(),
    test_start: z.string(),
    share: num,
    firm_noise: num,
    sig_h: z.record(z.string(), num),
    z: z.record(z.string(), num),
  }),
  history,
  forecast: z.object({ Total: z.array(fcPoint), EU: z.array(fcPoint), US: z.array(fcPoint), JP: z.array(fcPoint), KR: z.array(fcPoint), CN: z.array(fcPoint) }),
  backtest: z.object({ Total: bt, EU: bt, US: bt, JP: bt, KR: bt, CN: bt }),
  metrics: z.object({ Total: marketMetrics, EU: marketMetrics, US: marketMetrics, JP: marketMetrics, KR: marketMetrics, CN: marketMetrics }),
  shap: z.object({ h1_global: z.record(z.string(), num), h3_global: z.record(z.string(), num), h1_local: shapLocal, h3_local: shapLocal }),
  scenarios: z.record(z.string(), z.array(num)),
  sim: z.object({ base_series: z.object({ A: z.array(simRow), B: z.array(simRow) }) }).catchall(z.unknown()),
});

export type Results = z.infer<typeof ResultsSchema>;
export type ForecastPoint = z.infer<typeof fcPoint>;
export type BacktestPoint = z.infer<typeof btPoint>;
export type SimStats = z.infer<typeof simStats>;
export type SimPair = z.infer<typeof simPair>;
export type SimRow = z.infer<typeof simRow>;

export type LoadResult = { ok: true; data: Results } | { ok: false; issues: string[] };

export function parseResults(raw: unknown): LoadResult {
  const r = ResultsSchema.safeParse(raw);
  if (!r.success) {
    return { ok: false, issues: r.error.issues.slice(0, 12).map((i) => `${i.path.join(".") || "(gốc)"}: ${i.message}`) };
  }
  // Kiểm tra thêm các khóa bắt buộc của sim và scenarios
  const issues: string[] = [];
  for (const l of [1, 2, 3, 4]) for (const s of [0.9, 0.95, 0.98]) {
    const k = `${l}|${s}`;
    const v = (r.data.sim as Record<string, unknown>)[k];
    if (!simPair.safeParse(v).success) issues.push(`sim.${k}: thiếu hoặc sai cấu trúc`);
  }
  for (const p of [0.8, 0.9, 1.0, 1.1, 1.2]) for (const m of [-100, -50, 0, 50, 100]) {
    const v = r.data.scenarios[`${p.toFixed(1)}|${m}`];
    if (!v || v.length !== 6) issues.push(`scenarios.${p.toFixed(1)}|${m}: thiếu hoặc không đủ 6 tháng`);
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, data: r.data };
}
