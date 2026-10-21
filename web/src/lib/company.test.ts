import { describe, expect, it } from "vitest";
import { getData } from "./data";
import { parseCompanyCsv } from "./company";

const d = getData();
const m = d.history.month;
const mk = (rows: string[]) => ["month,sales_tons,stock_tons", ...rows].join("\n");

describe("dữ liệu doanh nghiệp (CSV)", () => {
  it("ước tính thị phần từ các tháng trùng", () => {
    const rows = m.slice(-12).map((x, i) => `${x},${Math.round(d.history.vol_kt[d.history.vol_kt.length - 12 + i] * 1000 * 0.03)},500`);
    const r = parseCompanyCsv(mk(rows), d);
    expect("error" in r).toBe(false);
    if (!("error" in r)) { expect(r.share_pct).toBeCloseTo(3, 0); expect(r.overlap_months).toBe(12); expect(r.summary).toContain("Thị phần ước tính"); }
  });
  it("đọc dấu chấm phẩy và tháng dạng MM/YYYY", () => {
    const r = parseCompanyCsv("tháng;bán;tồn\n03/2026;1.234,5;800\n04/2026;1000;700", d);
    if ("error" in r) throw new Error(r.error);
    expect(r.rows[0]).toEqual({ month: "2026-03", sales_tons: 1234.5, stock_tons: 800 });
  });
  it("báo lỗi khi không có dòng hợp lệ", () => {
    expect("error" in parseCompanyCsv("a,b\nx,y", d)).toBe(true);
  });
  it("tháng không trùng thì không ước tính thị phần và có cảnh báo", () => {
    const r = parseCompanyCsv(mk(["1990-01,100,10"]), d);
    if ("error" in r) throw new Error(r.error);
    expect(r.share_pct).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
