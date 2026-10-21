import { describe, expect, it } from "vitest";
import { getData } from "./data";
import { loaded } from "./validate";
import { parseResults } from "./schema";
import { bestModelByHorizon, buildAlerts, horizonSum, simSummary } from "./derived";

describe("results.json", () => {
  it("đúng cấu trúc", () => {
    expect(loaded.ok).toBe(true);
    const d = getData();
    expect(d.meta.data_mode).toBe("mock");
    expect(d.history.month).toHaveLength(198);
    expect(d.history.month[0]).toBe("2010-01");
    expect(d.history.month.at(-1)).toBe("2026-06");
  });
  it("báo lỗi rõ khi thiếu khóa", () => {
    const d = JSON.parse(JSON.stringify(getData()));
    delete d.shap;
    delete d.sim["2|0.95"];
    const r = parseResults(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join(" ")).toContain("shap");
  });
});

describe("các con số kết quả phải khớp file", () => {
  const d = getData();
  it("sMAPE tập test, tổng xuất khẩu", () => {
    const m = d.metrics.Total;
    const r1 = (x: number) => Math.round(x * 10) / 10;
    expect([m.h1_test.sarima, m.h1_test.lgbm, m.h1_test.snaive, m.h1_test.ma3].map((x) => r1(x.sMAPE))).toEqual([6.4, 7.5, 11.0, 12.8]);
    expect([m.h3_test.sarima, m.h3_test.lgbm, m.h3_test.snaive, m.h3_test.ma3].map((x) => r1(x.sMAPE))).toEqual([8.5, 8.9, 11.0, 22.0]);
    expect(r1(m.h6_test.lgbm.sMAPE)).toBe(8.5);
    expect(r1(m.h6_test.sarima.sMAPE)).toBe(8.6);
    expect(r1(m.h6_test.snaive.sMAPE)).toBe(11.0);
    expect(r1(m.h6_test.ma3.sMAPE)).toBe(25.4);
  });
  it("mô hình tốt nhất theo mốc: SARIMA ở 1 và 3 tháng, LightGBM ở 6 tháng", () => {
    const b = bestModelByHorizon(d);
    expect(b.map((x) => x.best)).toEqual(["sarima", "sarima", "lgbm"]);
  });
  it("độ phủ khoảng 80%", () => {
    expect(Math.round(d.metrics.Total.cover80_h1 * 100)).toBe(57);
    expect(Math.round(d.metrics.Total.cover80_h3 * 100)).toBe(80);
  });
  it("dự báo tổng xuất khẩu và quý tới", () => {
    expect(d.forecast.Total.map((x) => Math.round(x.p50 * 10) / 10)).toEqual([130.6, 131.2, 133.9, 142.0, 162.2, 179.9]);
    expect(Math.round(horizonSum(d, "Total", 3).change * 1000) / 10).toBe(8.7);
  });
  it("mô phỏng L = 2, 95%", () => {
    const s = simSummary(d, 2, 0.95)!;
    expect(Math.round(s.A.total)).toBe(6976);
    expect(Math.round(s.B.total)).toBe(4294);
    expect(Math.round(s.reduction * 1000) / 10).toBe(38.4);
    expect(Math.round(s.A.fill * 1000) / 10).toBe(96.8);
    expect(Math.round(s.B.fill * 1000) / 10).toBe(99.4);
    expect([s.A.stockout_months, s.B.stockout_months]).toEqual([4, 3]);
    expect([Math.round(s.A.avg_inv * 100) / 100, Math.round(s.B.avg_inv * 100) / 100]).toEqual([1.94, 1.17]);
    expect([Math.round(s.A.turns * 10) / 10, Math.round(s.B.turns * 10) / 10]).toEqual([17.9, 29.6]);
  });
  it("cảnh báo chỉ hiện khi thỏa điều kiện và luôn có ngưỡng", () => {
    for (const a of buildAlerts(d)) {
      expect(a.rule).toMatch(/Ngưỡng/);
      expect(["attention", "critical"]).toContain(a.severity);
    }
  });
});

describe("quy tắc cảnh báo", () => {
  const clone = () => JSON.parse(JSON.stringify(getData())) as ReturnType<typeof getData>;
  it("dữ liệu hiện tại không thỏa ngưỡng nào", () => expect(buildAlerts(getData())).toEqual([]));
  it("giá đổi hơn 10% trong 3 tháng", () => {
    const d = clone();
    d.history.price_usd_t[d.history.price_usd_t.length - 1] = d.history.price_usd_t.at(-4)! * 1.15;
    const a = buildAlerts(d);
    expect(a.map((x) => x.id)).toEqual(["price"]);
    expect(a[0].severity).toBe("attention");
  });
  it("cước cao hơn 30% trung bình 12 tháng, mưa thấp, nhu cầu lệch, tồn kho dưới SS", () => {
    const d = clone();
    const n = d.history.month.length;
    d.history.freight_idx[n - 1] = 1.5 * (d.history.freight_idx.slice(n - 12).reduce((x, y) => x + y, 0) / 12);
    for (let i = n - 9; i < n - 5; i++) d.history.rain_anom_mm[i] = -80;
    d.forecast.Total.forEach((f) => { f.ly = f.p50 / 1.25; });
    const last = d.sim.base_series.B.at(-1)!;
    last.ss = last.end_inv + 1;
    const ids = buildAlerts(d).map((x) => x.id).sort();
    expect(ids).toEqual(["demand", "freight", "rain", "stock"]);
    expect(buildAlerts(d).find((x) => x.id === "demand")!.severity).toBe("critical");
  });
});
