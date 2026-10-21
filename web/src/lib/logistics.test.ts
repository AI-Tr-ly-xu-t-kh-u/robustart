import { describe, expect, it } from "vitest";
import { getData } from "./data";
import { DEFAULT_ROUTES, evaluateRoutes, freightOutlook, pickRoutes } from "./logistics";
import { runTool } from "./tools";

const d = getData();

describe("logistics", () => {
  it("tính chi phí và CO2 theo công thức", () => {
    const r = evaluateRoutes(DEFAULT_ROUTES, 100).find((x) => x.id === "catlai")!;
    expect(r.usd_per_ton).toBeCloseTo(350 * 0.06 + 12, 1);
    expect(r.co2_kg_per_ton).toBeCloseTo(28, 1);
    expect(r.total_usd).toBe(Math.round((350 * 0.06 + 12) * 100));
  });
  it("chọn tuyến rẻ nhất và ít khí thải nhất khác nhau khi có đánh đổi", () => {
    const p = pickRoutes(evaluateRoutes(DEFAULT_ROUTES, 500));
    expect(p.cheapest.usd_per_ton).toBeLessThanOrEqual(p.greenest.usd_per_ton);
    expect(p.greenest.co2_kg_per_ton).toBeLessThanOrEqual(p.cheapest.co2_kg_per_ton);
  });
  it("triển vọng cước có 6 tháng mùa vụ và tháng cao/thấp", () => {
    const o = freightOutlook(d);
    expect(o.seasonal).toHaveLength(6);
    expect(o.high_months).toHaveLength(2);
    expect(Number.isFinite(o.change_3m_pct)).toBe(true);
  });
  it("công cụ của agent chạy và kẹp khối lượng lô", () => {
    expect(runTool("get_freight_outlook", {}, d).ok).toBe(true);
    const r = runTool("plan_logistics", { tons: 999999 }, d);
    expect(r.ok && (r.data as { tons: number }).tons).toBe(5000);
  });
});
