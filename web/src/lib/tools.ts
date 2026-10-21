import { z } from "zod";
import { MARKETS, MARKET_LABEL, simPairAt, type Market } from "./constants";
import { buildAlerts, horizonSum, marketRanking } from "./derived";
import { computeInventory, holdingCost, planTable, weeksToMonths, zFor } from "./inventory";
import { interpolateScenario } from "./scenario";
import { DEFAULT_ROUTES, evaluateRoutes, freightOutlook, pickRoutes } from "./logistics";
import type { Results } from "./schema";

/**
 * Bộ công cụ của agent: mọi con số agent nói ra phải đến từ đây (tính xác định từ results.json và công thức tồn kho).
 * Mỗi công cụ kiểm tra tham số, kẹp vào miền có dữ liệu và trả về nguồn để trích dẫn.
 */
export type ToolResult = { ok: true; data: unknown; source: string } | { ok: false; error: string };

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema cho gọi hàm của mô hình ngôn ngữ */
  parameters: Record<string, unknown>;
  run: (args: unknown, d: Results) => ToolResult;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const tons = (kt: number) => Math.round(kt * 1000);
const num = z.coerce.number();
const marketSchema = z.enum(MARKETS as unknown as [Market, ...Market[]]);

const bad = (error: string): ToolResult => ({ ok: false, error });
function parse<T extends z.ZodTypeAny>(schema: T, args: unknown): { ok: true; v: z.infer<T> } | { ok: false; error: string } {
  const r = schema.safeParse(args ?? {});
  return r.success ? { ok: true, v: r.data } : { ok: false, error: r.error.issues.map((i) => `${i.path.join(".") || "tham số"}: ${i.message}`).join("; ") };
}
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

const forecastTool: ToolDef = {
  name: "get_forecast",
  description: "Dự báo nhu cầu xuất khẩu (kt = nghìn tấn) theo tháng cho một thị trường, gồm p10, p50, p90 và cùng tháng năm trước. market: Total, EU, US, JP, KR, CN.",
  parameters: { type: "object", properties: { market: { type: "string", enum: [...MARKETS] }, months: { type: "integer", minimum: 1, maximum: 6 } }, required: [] },
  run(args, d) {
    const p = parse(z.object({ market: marketSchema.default("Total"), months: num.int().min(1).max(6).default(6) }), args);
    if (!p.ok) return bad(p.error);
    const { market, months } = p.v;
    const rows = d.forecast[market].slice(0, months).map((f) => ({ month: f.month, p10_kt: r1(f.p10), p50_kt: r1(f.p50), p90_kt: r1(f.p90), same_month_last_year_kt: r1(f.ly), yoy_pct: r1((f.p50 / f.ly - 1) * 100) }));
    const h = horizonSum(d, market, Math.min(3, months));
    return { ok: true, source: `forecast.${market} (LightGBM, p50)`, data: { market: MARKET_LABEL[market], months: rows, next_3_months_total_kt: r1(h.p50), next_3_months_yoy_pct: r1(h.change * 100) } };
  },
};

const rankTool: ToolDef = {
  name: "rank_markets",
  description: "Xếp hạng 5 thị trường nhập khẩu (EU, US, JP, KR, CN) theo dự báo 3 tháng tới: khối lượng, tỷ trọng, % thay đổi so với cùng kỳ năm trước và độ rộng khoảng bất định. Dùng để chọn thị trường ưu tiên.",
  parameters: { type: "object", properties: {}, required: [] },
  run(_args, d) {
    const rank = marketRanking(d, 3);
    const total = rank.reduce((a, r) => a + r.p50, 0);
    const rows = rank.map((r) => ({
      market: r.market, name: MARKET_LABEL[r.market], p50_kt: r1(r.p50), share_of_5_markets_pct: r1((r.p50 / total) * 100), yoy_pct: r1(r.change * 100),
      uncertainty_band_pct_of_p50: r1(((r.p90 - r.p10) / r.p50) * 100),
    }));
    return { ok: true, source: "forecast.EU/US/JP/KR/CN (p10, p50, p90, ly)", data: { horizon: "3 tháng tới", markets: rows } };
  },
};

const scenarioTool: ToolDef = {
  name: "run_scenario",
  description: "Chạy kịch bản giá Robusta và lượng mưa bất thường, trả về dự báo tổng xuất khẩu 6 tháng tới (kt) so với kịch bản gốc. price_change_pct trong [-20, 20], rain_mm trong [-100, 100]; ngoài khoảng sẽ bị kẹp.",
  parameters: { type: "object", properties: { price_change_pct: { type: "number" }, rain_mm: { type: "number" } }, required: [] },
  run(args, d) {
    const p = parse(z.object({ price_change_pct: num.default(0), rain_mm: num.default(0) }), args);
    if (!p.ok) return bad(p.error);
    const price = clamp(p.v.price_change_pct, -20, 20);
    const rain = clamp(p.v.rain_mm, -100, 100);
    const base = interpolateScenario(d.scenarios, 1, 0);
    const sc = interpolateScenario(d.scenarios, 1 + price / 100, rain);
    const s = (a: number[]) => a.reduce((x, y) => x + y, 0);
    return {
      ok: true, source: "scenarios (khóa «giá|mưa», nội suy song tuyến tính)",
      data: {
        applied: { price_change_pct: price, rain_mm: rain, clamped: price !== p.v.price_change_pct || rain !== p.v.rain_mm },
        monthly_p50_kt: sc.map(r1), base_monthly_p50_kt: base.map(r1),
        next_3_months_kt: r1(s(sc.slice(0, 3))), base_next_3_months_kt: r1(s(base.slice(0, 3))), delta_next_3_months_pct: r1((s(sc.slice(0, 3)) / s(base.slice(0, 3)) - 1) * 100),
        total_6_months_kt: r1(s(sc)), base_total_6_months_kt: r1(s(base)), delta_6_months_pct: r1((s(sc) / s(base) - 1) * 100),
      },
    };
  },
};

const inventoryTool: ToolDef = {
  name: "plan_inventory",
  description: "Tính tồn kho cho doanh nghiệp giả định: tồn kho an toàn, điểm đặt hàng lại (ROP), mức tồn kho tối đa, chi phí lưu kho và lượng cần về kho từng tháng trong 6 tháng tới (đơn vị tấn). lead_weeks 4–20, service_level 0.85–0.995, share_pct 1–5; có thể kèm kịch bản giá và mưa.",
  parameters: { type: "object", properties: { lead_weeks: { type: "number" }, service_level: { type: "number" }, share_pct: { type: "number" }, price_change_pct: { type: "number" }, rain_mm: { type: "number" } }, required: [] },
  run(args, d) {
    const p = parse(z.object({ lead_weeks: num.default(8.7), service_level: num.default(0.95), share_pct: num.default(d.meta.share * 100), price_change_pct: num.default(0), rain_mm: num.default(0) }), args);
    if (!p.ok) return bad(p.error);
    const lead = clamp(p.v.lead_weeks, 4, 20);
    const svc = clamp(p.v.service_level > 1 ? p.v.service_level / 100 : p.v.service_level, 0.85, 0.995);
    const share = clamp(p.v.share_pct, 1, 5);
    const price = clamp(p.v.price_change_pct, -20, 20);
    const rain = clamp(p.v.rain_mm, -100, 100);
    const p50 = interpolateScenario(d.scenarios, 1 + price / 100, rain);
    const L = weeksToMonths(lead);
    const inv = computeInventory({ forecastP50: p50, sigH: d.meta.sig_h, share: share / 100, firmNoise: d.meta.firm_noise, leadMonths: L, z: zFor(svc, d.meta.z) });
    const plan = planTable(inv.F, inv.safetyStock, L);
    const cost = holdingCost({ avgInventoryKt: inv.avgInventory, priceUsdT: d.history.price_usd_t.at(-1)!, priceChange: price / 100, capitalCostMonthly: 0.008, usdvnd: d.history.usdvnd.at(-1)!, fxChange: 0 });
    const months = d.forecast.Total.map((f) => f.month);
    return {
      ok: true, source: "Công thức tồn kho (meta.sig_h, meta.z, forecast.Total) – doanh nghiệp giả định",
      data: {
        assumptions: { lead_weeks: r1(lead), service_level: svc, share_pct: r1(share), price_change_pct: price, rain_mm: rain, clamped: lead !== p.v.lead_weeks || share !== p.v.share_pct || price !== p.v.price_change_pct || rain !== p.v.rain_mm },
        safety_stock_tons: tons(inv.safetyStock), reorder_point_tons: tons(inv.rop), order_up_to_tons: tons(inv.orderUpTo), average_inventory_tons: tons(inv.avgInventory),
        holding_cost_usd_thousand_per_month: r1(cost.holdingUsdK),
        plan: plan.map((r, i) => ({ month: months[i], demand_tons: tons(r.demand), target_end_inventory_tons: tons(r.target), inbound_tons: tons(r.inbound) })),
        inbound_first_3_months_tons: tons(plan.slice(0, 3).reduce((a, r) => a + r.inbound, 0)), inbound_last_3_months_tons: tons(plan.slice(3).reduce((a, r) => a + r.inbound, 0)),
      },
    };
  },
};

const alertsTool: ToolDef = {
  name: "get_alerts",
  description: "Lấy các cảnh báo rủi ro đang thỏa ngưỡng (nhu cầu lệch, giá đổi, mưa thấp, cước cao, tồn kho dưới mức an toàn). Trả về danh sách rỗng nếu không có.",
  parameters: { type: "object", properties: {}, required: [] },
  run(_args, d) {
    const a = buildAlerts(d);
    const h = d.history, n = h.month.length;
    return {
      ok: true, source: "history, forecast.Total, sim.base_series (quy tắc ngưỡng)",
      data: {
        active_alerts: a.map((x) => ({ id: x.id, severity: x.severity, title: x.title, detail: x.detail, rule: x.rule })),
        indicators: { price_usd_t: r1(h.price_usd_t[n - 1]), freight_index: r1(h.freight_idx[n - 1]), usdvnd: Math.round(h.usdvnd[n - 1]) },
      },
    };
  },
};

const policyTool: ToolDef = {
  name: "compare_policies",
  description: "So sánh chính sách tồn kho A (kinh nghiệm) và B (theo dự báo AI) trong mô phỏng 2024–2026 của doanh nghiệp giả định. lead_months ∈ {1,2,3,4}, service_level ∈ {0.9,0.95,0.98}.",
  parameters: { type: "object", properties: { lead_months: { type: "integer", enum: [1, 2, 3, 4] }, service_level: { type: "number", enum: [0.9, 0.95, 0.98] } }, required: [] },
  run(args, d) {
    const p = parse(z.object({ lead_months: num.int().default(2), service_level: num.default(0.95) }), args);
    if (!p.ok) return bad(p.error);
    const pair = simPairAt(d, p.v.lead_months, p.v.service_level);
    if (!pair) return bad("Chưa có dữ liệu cho tổ hợp này; chỉ có lead_months 1–4 và service_level 0.9, 0.95, 0.98.");
    const f = (s: typeof pair.A) => ({ total_cost_usd_thousand: Math.round(s.total), fill_rate_pct: r1(s.fill * 100), stockout_months: s.stockout_months, avg_inventory_kt: r2(s.avg_inv), turns_per_year: r1(s.turns) });
    return { ok: true, source: `sim.${p.v.lead_months}|${p.v.service_level}`, data: { A_experience: f(pair.A), B_ai_forecast: f(pair.B), cost_reduction_pct: r1((1 - pair.B.total / pair.A.total) * 100), note: "Chỉ đúng trong mô phỏng doanh nghiệp giả định trên dữ liệu mẫu." } };
  },
};

const accuracyTool: ToolDef = {
  name: "get_model_accuracy",
  description: "Độ chính xác các mô hình trên tập test (sMAPE %, càng thấp càng tốt) ở mốc 1, 3, 6 tháng và độ phủ thực tế của khoảng 80%.",
  parameters: { type: "object", properties: { market: { type: "string", enum: [...MARKETS] } }, required: [] },
  run(args, d) {
    const p = parse(z.object({ market: marketSchema.default("Total") }), args);
    if (!p.ok) return bad(p.error);
    const m = d.metrics[p.v.market];
    const row = (t: typeof m.h1_test) => ({ snaive: r1(t.snaive.sMAPE), ma3: r1(t.ma3.sMAPE), sarima: r1(t.sarima.sMAPE), lightgbm: r1(t.lgbm.sMAPE) });
    return { ok: true, source: `metrics.${p.v.market}.h1_test/h3_test/h6_test`, data: { market: MARKET_LABEL[p.v.market], smape_pct: { h1: row(m.h1_test), h3: row(m.h3_test), h6: row(m.h6_test) }, interval_80_actual_coverage_pct: { h1: r1(m.cover80_h1 * 100), h3: r1(m.cover80_h3 * 100) } } };
  },
};

const freightTool: ToolDef = {
  name: "get_freight_outlook",
  description: "Lấy chỉ số cước vận tải hiện tại, thay đổi 3 và 12 tháng, và tháng nào trong 6 tháng tới thường có cước cao hoặc thấp theo mùa (chỉ số cước trong dữ liệu mẫu). Không có dữ liệu về tắc nghẽn cảng hay EUDR.",
  parameters: { type: "object", properties: {}, required: [] },
  run(_args, d) {
    return { ok: true, source: "history.freight_idx (chỉ số cước theo tháng, mùa vụ trung bình các năm đủ 12 tháng)", data: freightOutlook(d) };
  },
};

const routeTool: ToolDef = {
  name: "plan_logistics",
  description: "So sánh các tuyến vận chuyển từ kho nội địa ra cảng (Cát Lái, Cái Mép, Quy Nhơn, sà lan) theo chi phí và khí thải CO2 cho một lô hàng. tons là khối lượng lô (10–5000 tấn). Số liệu tuyến là giả định minh họa có thể sửa, không phải báo giá thật.",
  parameters: { type: "object", properties: { tons: { type: "number" } }, required: [] },
  run(args) {
    const p = parse(z.object({ tons: num.default(500) }), args);
    if (!p.ok) return bad(p.error);
    const t = clamp(p.v.tons, 10, 5000);
    const res = evaluateRoutes(DEFAULT_ROUTES, t);
    const pick = pickRoutes(res);
    return { ok: true, source: "Bảng giả định tuyến vận chuyển (có thể sửa trên trang Vận chuyển)", data: { tons: t, routes: res, cheapest: pick.cheapest.name, greenest: pick.greenest.name, balanced: pick.balanced.name, note: "Chi phí là giả định minh họa; cước tàu biển và phí cảng thực tế cần báo giá." } };
  },
};

export const TOOLS: ToolDef[] = [forecastTool, rankTool, scenarioTool, inventoryTool, alertsTool, policyTool, accuracyTool, freightTool, routeTool];

export const toolSpecs = () => TOOLS.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));

export function runTool(name: string, args: unknown, d: Results): ToolResult {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) return bad(`Không có công cụ «${name}».`);
  try {
    return t.run(args, d);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Công cụ gặp lỗi");
  }
}

/** Thu mọi số trong kết quả công cụ để đối chiếu «độ bám dữ liệu» của câu trả lời. */
export function numbersIn(x: unknown, out: number[] = []): number[] {
  if (typeof x === "number" && Number.isFinite(x)) out.push(x);
  else if (Array.isArray(x)) x.forEach((v) => numbersIn(v, out));
  else if (x && typeof x === "object") Object.values(x).forEach((v) => numbersIn(v, out));
  return out;
}

/** Đọc số kiểu Việt Nam (1.234,5) trong văn bản. */
export function numbersInText(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(?<![\w.,\-])\d{1,3}(?:[.   ]\d{3})+(?:,\d+)?|(?<![\w.,\-])\d+(?:,\d+)?/g)) {
    const v = Number(m[0].replace(/[.   ]/g, "").replace(",", "."));
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

export interface Grounding { checked: number; matched: number; unmatched: number[] }

/** Mỗi số lớn trong câu trả lời phải khớp (sai số ≤ 0,6%) với một số trong kết quả công cụ; số nhỏ (≤ 12), năm và tháng bỏ qua. */
export function groundingCheck(answer: string, toolData: unknown[]): Grounding {
  const pool = toolData.flatMap((d) => numbersIn(d)).flatMap((v) => [v, Math.abs(v), v / 1000, v * 1000]);
  const nums = numbersInText(answer).filter((v) => v > 12 && !(v >= 1900 && v <= 2100));
  const unmatched: number[] = [];
  let matched = 0;
  for (const v of nums) {
    const ok = pool.some((p) => Math.abs(p - v) <= Math.max(0.06, Math.abs(v) * 0.006, Number.isInteger(v) ? 0.5 : 0));
    if (ok) matched++;
    else unmatched.push(v);
  }
  return { checked: nums.length, matched, unmatched };
}
