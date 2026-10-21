import { describe, expect, it } from "vitest";
import { getData } from "./data";
import { buildInsights, seasonalIndex } from "./insights";

const d = getData();

describe("insight tổng quan", () => {
  const ins = buildInsights(d);
  it("đủ 6 mục, có nguồn, không có NaN hay undefined", () => {
    expect(ins.map((i) => i.id)).toEqual(["trend", "season", "markets", "uncertainty", "signals", "inventory"]);
    for (const i of ins) {
      expect(i.source.length).toBeGreaterThan(3);
      expect(`${i.title} ${i.text}`).not.toMatch(/NaN|undefined|Infinity|Chưa có dữ liệu/);
    }
  });
  it("xu hướng khớp số liệu đã biết", () => {
    const t = ins[0];
    expect(t.title).toContain("+8,7%");
    expect(t.text).toContain("395,7 kt");
  });
  it("mùa vụ: chỉ số 12 tháng, trung bình xấp xỉ 1", () => {
    const { index, years } = seasonalIndex(d);
    expect(index).toHaveLength(12);
    expect(years).toBeGreaterThanOrEqual(10);
    expect(index.reduce((a, b) => a + b, 0) / 12).toBeCloseTo(1, 6);
  });
  it("độ bất định nói rõ khoảng không phải giới hạn tuyệt đối", () => {
    const u = ins.find((i) => i.id === "uncertainty")!;
    expect(u.text).toContain("nằm ngoài khoảng");
    expect(u.text).not.toMatch(/chính xác 80%/);
  });
  it("tồn kho nêu rõ doanh nghiệp giả định", () => expect(ins.find((i) => i.id === "inventory")!.text).toContain("doanh nghiệp giả định"));
});
