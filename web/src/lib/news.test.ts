import { describe, expect, it } from "vitest";
import { extractSignalsRules, SAMPLE_NEWS, toScenario, validateSignals } from "./news";

describe("tin tức thành kịch bản", () => {
  it("bộ luật rút giá giảm 10% và mưa thiếu 50 mm từ bản tin mẫu", () => {
    const sc = toScenario(extractSignalsRules(SAMPLE_NEWS[0].text));
    expect(sc.price_change_pct).toBe(-10);
    expect(sc.rain_mm).toBe(-50);
  });
  it("tin không có mức độ thì không đưa vào kịch bản", () => {
    const sc = toScenario(extractSignalsRules(SAMPLE_NEWS[2].text));
    expect(sc.price_change_pct).toBe(0);
    expect(sc.rain_mm).toBe(0);
    expect(sc.unquantified.length).toBeGreaterThan(0);
  });
  it("loại tín hiệu có trích dẫn không nằm trong bản tin", () => {
    const text = "Giá Robusta giảm 5% tuần này.";
    const v = validateSignals({ signals: [
      { driver: "price", direction: "down", magnitude: 5, evidence: "Giá Robusta giảm 5% tuần này" },
      { driver: "price", direction: "up", magnitude: 30, evidence: "Giá tăng 30% vì hạn hán" },
    ] }, text);
    expect(v.kept).toHaveLength(1);
    expect(v.dropped).toBe(1);
  });
  it("mức độ không có trong bản tin bị bỏ", () => {
    const v = validateSignals({ signals: [{ driver: "price", direction: "down", magnitude: 18, evidence: "Giá Robusta giảm mạnh" }] }, "Giá Robusta giảm mạnh tuần này.");
    expect(v.kept[0].magnitude).toBeNull();
  });
  it("kẹp kịch bản trong miền hỗ trợ", () => {
    const sc = toScenario([{ driver: "price", direction: "up", magnitude: 45, evidence: "abc", rationale: "" }]);
    expect(sc.price_change_pct).toBe(20);
    expect(sc.clamped).toBe(true);
  });
});
