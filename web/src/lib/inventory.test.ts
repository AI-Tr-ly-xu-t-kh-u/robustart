import { describe, expect, it } from "vitest";
import { computeInventory, holdingCost, normInv, planTable, weeksToMonths, windowSum, zFor } from "./inventory";
import { interpolateScenario } from "./scenario";
import { fmt, fmtVol, signedPct } from "./format";

const sigH = { "1": 8, "2": 10, "3": 10, "4": 10, "5": 11, "6": 10 };
const base = { forecastP50: [100, 100, 100, 100, 100, 100], sigH, share: 0.02, firmNoise: 0.05, z: 1.6449 };

describe("windowSum", () => {
  it("cộng tháng nguyên và phần lẻ", () => {
    expect(windowSum([10, 20, 30, 40], 2)).toBe(30);
    expect(windowSum([10, 20, 30, 40], 2.5)).toBeCloseTo(30 + 0.5 * 30, 10);
  });
  it("vượt tháng cuối thì lặp lại giá trị tháng cuối", () => {
    expect(windowSum([10, 20], 4)).toBe(10 + 20 + 20 + 20);
    expect(windowSum([10, 20, 30], 2, 3)).toBe(30 + 30);
  });
  it("độ dài 0 thì bằng 0", () => expect(windowSum([1, 2], 0)).toBe(0));
});

describe("z", () => {
  it("dùng bảng meta.z khi trùng", () => expect(zFor(0.95, { "0.95": 1.6449 })).toBe(1.6449));
  it("nghịch đảo chuẩn khi không có trong bảng", () => {
    expect(zFor(0.99, {})).toBeCloseTo(2.3263, 3);
    expect(normInv(0.5)).toBeCloseTo(0, 9);
    expect(normInv(0.975)).toBeCloseTo(1.95996, 4);
    expect(normInv(0.01)).toBeCloseTo(-2.32635, 4);
  });
  it("báo lỗi khi p ngoài (0,1)", () => expect(() => normInv(1)).toThrow());
});

describe("computeInventory – ví dụ tính tay (L = 2, nhu cầu phẳng 100 kt, s = 2%)", () => {
  // F = 2 kt/tháng; P = 3; D_P = 6; D_L = 4
  // σ_P² = (8·0,02)² + (10·0,02)² + (10·0,02)² + (0,05·2)²·3 = 0,0256 + 0,04 + 0,04 + 0,03 = 0,1356
  const r = computeInventory({ ...base, leadMonths: 2 });
  it("nhu cầu trong khoảng bảo vệ và lead time", () => {
    expect(r.P).toBe(3);
    expect(r.demandP).toBeCloseTo(6, 10);
    expect(r.demandL).toBeCloseTo(4, 10);
  });
  it("σ, safety stock, ROP, mức tối đa", () => {
    expect(r.sigmaP).toBeCloseTo(Math.sqrt(0.1356), 10);
    expect(r.safetyStock).toBeCloseTo(1.6449 * Math.sqrt(0.1356), 10);
    expect(r.rop).toBeCloseTo(4 + r.safetyStock, 10);
    expect(r.orderUpTo).toBeCloseTo(6 + r.safetyStock, 10);
    expect(r.avgInventory).toBeCloseTo(r.safetyStock + 1, 10);
  });
  it("lead time lẻ dùng phần lẻ ở tháng cuối", () => {
    const r2 = computeInventory({ ...base, leadMonths: 1.5 }); // P = 2,5
    expect(r2.demandP).toBeCloseTo(5, 10);
    const variance = 0.16 ** 2 + 0.2 ** 2 + 0.5 * 0.2 ** 2 + 0.1 ** 2 * 2.5;
    expect(r2.sigmaP).toBeCloseTo(Math.sqrt(variance), 10);
  });
  it("mức dịch vụ cao hơn thì tồn kho an toàn cao hơn", () => {
    const hi = computeInventory({ ...base, leadMonths: 2, z: 2.0537 });
    expect(hi.safetyStock).toBeGreaterThan(r.safetyStock);
  });
});

describe("holdingCost", () => {
  it("1 kt × (0,8%/tháng × 3.000 USD/tấn + 6 USD/tấn) = 30 nghìn USD", () => {
    const c = holdingCost({ avgInventoryKt: 1, priceUsdT: 3000, priceChange: 0, capitalCostMonthly: 0.008, usdvnd: 25000, fxChange: 0 });
    expect(c.holdingUsdK).toBeCloseTo(24 + 6, 10);
    expect(c.holdingBillionVnd).toBeCloseTo((30 * 1000 * 25000) / 1e9, 10);
  });
  it("tỷ giá chỉ đổi chi phí quy VND, không đổi chi phí USD", () => {
    const a = holdingCost({ avgInventoryKt: 2, priceUsdT: 3000, priceChange: 0.1, capitalCostMonthly: 0.01, usdvnd: 25000, fxChange: 0 });
    const b = holdingCost({ avgInventoryKt: 2, priceUsdT: 3000, priceChange: 0.1, capitalCostMonthly: 0.01, usdvnd: 25000, fxChange: 0.03 });
    expect(b.holdingUsdK).toBe(a.holdingUsdK);
    expect(b.holdingBillionVnd).toBeCloseTo(a.holdingBillionVnd * 1.03, 10);
  });
});

describe("planTable", () => {
  const F = [2, 2, 2, 4, 6, 8];
  const rows = planTable(F, 1, 2);
  it("mục tiêu cuối tháng = SS + F của 2 tháng kế tiếp (lặp tháng 6 khi vượt)", () => {
    // m=1: 1+2+2 = 5 (F2+F3); m=2: 1+2+4 = 7; m=3: 1+4+6 = 11; m=4: 1+6+8 = 15; m=5: 1+8+8 = 17; m=6: 1+8+8 = 17
    expect(rows.map((r) => r.target)).toEqual([5, 7, 11, 15, 17, 17]);
  });
  it("lượng về kho = nhu cầu + thay đổi mục tiêu, tối thiểu 0", () => {
    // mục tiêu tháng 0 = 1 + F1 + F2 = 5
    expect(rows[0].inbound).toBeCloseTo(2 + (5 - 5), 10);
    expect(rows[1].inbound).toBeCloseTo(2 + (7 - 5), 10);
    expect(rows[3].inbound).toBeCloseTo(4 + (15 - 11), 10);
    expect(rows[5].inbound).toBeCloseTo(8 + 0, 10);
    // với L nguyên, lượng về kho tháng m chính là nhu cầu của tháng m+L (SS triệt tiêu), luôn không âm
    expect(rows.map((r) => r.inbound)).toEqual([2, 4, 6, 8, 8, 8]);
    expect(planTable([10, 1, 1], 0, 1).map((r) => r.inbound)).toEqual([1, 1, 1]);
  });
  it("đổi tuần sang tháng", () => expect(weeksToMonths(8.69)).toBeCloseTo(2, 2));
});

describe("interpolateScenario", () => {
  const mk = (v: number) => [v, v + 1, v + 2, v + 3, v + 4, v + 5];
  const sc: Record<string, number[]> = {};
  [0.8, 0.9, 1.0, 1.1, 1.2].forEach((p, i) => [-100, -50, 0, 50, 100].forEach((r, j) => { sc[`${p.toFixed(1)}|${r}`] = mk(100 + i * 10 + j); }));
  it("trùng điểm lưới thì trả đúng giá trị", () => expect(interpolateScenario(sc, 1.0, 0)).toEqual(mk(122)));
  it("nội suy giữa hai điểm lưới", () => {
    expect(interpolateScenario(sc, 1.05, 0)[0]).toBeCloseTo((122 + 132) / 2, 10);
    expect(interpolateScenario(sc, 1.0, 25)[0]).toBeCloseTo((122 + 123) / 2, 10);
    expect(interpolateScenario(sc, 1.05, 25)[0]).toBeCloseTo((122 + 123 + 132 + 133) / 4, 10);
  });
  it("ngoài lưới thì giữ ở biên", () => expect(interpolateScenario(sc, 2, 500)).toEqual(mk(100 + 40 + 4)));
});

describe("format", () => {
  it("số kiểu Việt Nam", () => {
    expect(fmt(1234567.891, 1)).toBe("1.234.567,9");
    expect(fmt(0.5, 2)).toBe("0,50");
    expect(fmt(-3.25, 1)).toBe("-3,3");
    expect(fmt(NaN)).toBe("Chưa có dữ liệu");
  });
  it("đơn vị khối lượng và phần trăm có dấu", () => {
    expect(fmtVol(0.45)).toBe("450 tấn");
    expect(fmtVol(2.5)).toBe("2,5 kt");
    expect(signedPct(0.087)).toBe("+8,7%");
    expect(signedPct(-0.1)).toBe("−10,0%");
  });
});
