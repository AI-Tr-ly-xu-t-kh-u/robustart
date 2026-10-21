import { MARKETS, MARKET_LABEL, MARKET_SHORT, MODEL_LABEL } from "./constants";
import type { Results } from "./schema";
import { bestModelByHorizon, buildAlerts, defaultInventory, DEFAULT_LEAD_WEEKS, horizonSum, marketRanking, simSummary, sum } from "./derived";
import { fmt, monthLabel, pct, signedPct } from "./format";
import { interpolateScenario } from "./scenario";

export interface ChatAnswer {
  answer: string;
  sources: string[];
  refused: boolean;
  intent: string;
}

export const SUGGESTIONS = [
  "Vì sao dự báo tháng 9 tăng?",
  "Nếu VND mất giá 3% thì tồn kho đổi thế nào?",
  "Tồn kho an toàn nên giữ bao nhiêu?",
  "Giá tăng 10% thì dự báo 3 tháng tới đổi bao nhiêu?",
  "Thị trường nào tăng nhanh nhất?",
];

/** Hạ chữ thường, bỏ dấu tiếng Việt để so khớp từ khóa. */
export function norm(s: string): string {
  return s.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

const ok = (intent: string, answer: string, sources: string[]): ChatAnswer => ({ intent, answer, sources, refused: false });
const refuse = (intent: string, answer: string, sources: string[] = []): ChatAnswer => ({ intent, answer, sources, refused: true });

function whyMonth(d: Results, q: string): ChatAnswer {
  const m = /thang\s*(\d{1,2})|\bt(\d{1,2})\b/.exec(q);
  const month = m ? Number(m[1] ?? m[2]) : NaN;
  const local = month === 7 ? { key: "h1_local" as const, idx: 0, h: "trước 1 tháng" } : month === 9 ? { key: "h3_local" as const, idx: 2, h: "trước 3 tháng" } : null;
  if (!local) {
    return refuse("why-month", "Chưa có dữ liệu giải thích cho tháng bạn hỏi. Gói kết quả chỉ có phần giải thích từng biến (SHAP) cho dự báo tháng 07/2026 và tháng 09/2026. Hãy hỏi một trong hai tháng đó.", ["Mục «Dự báo» › Biến quan trọng · shap.h1_local, shap.h3_local"]);
  }
  const f = d.forecast.Total[local.idx];
  const sh = d.shap[local.key];
  const yoy = f.p50 / f.ly - 1;
  const up = sh.items.filter((i) => i.kt > 0).sort((a, b) => b.kt - a.kt).slice(0, 3);
  const down = sh.items.filter((i) => i.kt < 0).sort((a, b) => a.kt - b.kt).slice(0, 3);
  const list = (xs: typeof up) => xs.map((i) => `${i.feature} (${i.kt > 0 ? "+" : "−"}${fmt(Math.abs(i.kt), 1)} kt)`).join("; ");
  const parts = [
    `Dự báo tổng xuất khẩu tháng ${monthLabel(f.month)} (LightGBM, ${local.h}) là ${fmt(f.p50, 1)} kt, khoảng 80% từ ${fmt(f.p10, 1)} đến ${fmt(f.p90, 1)} kt. So với cùng tháng năm trước (${fmt(f.ly, 1)} kt) là ${signedPct(yoy)}${yoy > 0 ? ", tức tăng" : yoy < 0 ? ", tức giảm" : ""}.`,
    `Mức nền của mô hình là ${fmt(sh.base, 1)} kt. Các biến đóng góp lớn nhất: ${down.length ? `kéo xuống: ${list(down)}` : "không có biến nào kéo xuống đáng kể"}${up.length ? `; đẩy lên: ${list(up)}` : ""}.`,
    "Lưu ý: đây là giải thích hành vi của mô hình (mức đóng góp của từng biến so với mức nền), không phải quan hệ nhân quả ngoài đời thực. Dữ liệu là dữ liệu mẫu.",
  ];
  return ok("why-month", parts.join("\n\n"), [`Mục «Dự báo» › Vì sao dự báo tháng này như vậy · shap.${local.key}`, "forecast.Total", "Mô hình: LightGBM"]);
}

function fxQuestion(d: Results, q: string): ChatAnswer {
  const m = /(\d+(?:[.,]\d+)?)\s*%/.exec(q);
  const x = m ? Number(m[1].replace(",", ".")) / 100 : 0.03;
  const inv = defaultInventory(d);
  const price = d.history.price_usd_t.at(-1)!;
  const fx = d.history.usdvnd.at(-1)!;
  const holdUsdK = inv.avgInventory * (0.008 * price + 6);
  const vndBase = (holdUsdK * 1000 * fx) / 1e9;
  return ok(
    "fx",
    `Trong mô hình này, tỷ giá USD/VND không làm đổi nhu cầu hay lượng tồn kho: tồn kho khuyến nghị vẫn là ${fmt(inv.orderUpTo * 1000, 0)} tấn (mức tối đa) và tồn kho an toàn ${fmt(inv.safetyStock * 1000, 0)} tấn. Tỷ giá chỉ đổi chi phí quy ra đồng.\n\nVí dụ với cấu hình mặc định (tồn kho bình quân ${fmt(inv.avgInventory * 1000, 0)} tấn, chi phí vốn 0,8%/tháng): chi phí lưu kho khoảng ${fmt(holdUsdK, 1)} nghìn USD/tháng, tương đương ${fmt(vndBase, 2)} tỷ đồng; nếu VND mất giá ${fmt(x * 100, 1)}% thì con số quy đồng tăng ${fmt(x * 100, 1)}% lên khoảng ${fmt(vndBase * (1 + x), 2)} tỷ đồng, còn chi phí USD không đổi.`,
    ["Mục «Tồn kho» › What-if (thanh trượt tỷ giá)", "meta.sig_h, meta.z, forecast.Total, history.usdvnd", "Công thức tồn kho ở trang «Giới thiệu»"],
  );
}

function bestModel(d: Results): ChatAnswer {
  const labels: Record<string, string> = { h1: "trước 1 tháng", h3: "trước 3 tháng", h6: "trước 6 tháng" };
  const rows = bestModelByHorizon(d).map((b) => {
    const t = b.table;
    return `• ${labels[b.horizon]}: ${MODEL_LABEL[b.best]} nhỉnh nhất (sMAPE ${fmt(t[b.best].sMAPE, 1)}%), kế đến ${MODEL_LABEL[b.second]} (${fmt(t[b.second].sMAPE, 1)}%); naive theo mùa ${fmt(t.snaive.sMAPE, 1)}%, trung bình 3 tháng ${fmt(t.ma3.sMAPE, 1)}%.`;
  });
  return ok(
    "best-model",
    `Không có mô hình nào tốt nhất ở mọi mốc. Trên tập test (30 tháng, tổng xuất khẩu):\n${rows.join("\n")}\n\nSARIMA và LightGBM cho độ chính xác gần nhau và cùng tốt hơn rõ rệt hai mô hình đơn giản. Hệ thống dùng LightGBM để ra khuyến nghị tồn kho vì có khoảng dự báo. Khoảng 80% thực tế phủ ${pct(d.metrics.Total.cover80_h1, 0)} (trước 1 tháng) và ${pct(d.metrics.Total.cover80_h3, 0)} (trước 3 tháng), nên không nên hiểu là "chính xác 80%".`,
    ["Mục «Dự báo» › So sánh mô hình · metrics.Total.h1_test/h3_test/h6_test", "metrics.Total.cover80_h1, cover80_h3"],
  );
}

function priceScenario(d: Results, q: string): ChatAnswer {
  const m = /(\d+(?:[.,]\d+)?)\s*%/.exec(q);
  const x = m ? Number(m[1].replace(",", ".")) / 100 : 0.1;
  const dir = /giam/.test(q) ? -1 : 1;
  const mult = 1 + dir * x;
  if (mult < 0.8 - 1e-9 || mult > 1.2 + 1e-9) {
    return refuse("price", "Kịch bản giá chỉ có trong khoảng −20% đến +20% so với giá hiện tại; ngoài khoảng này chưa có dữ liệu.", ["Mục «Tồn kho» › What-if · scenarios"]);
  }
  const base = interpolateScenario(d.scenarios, 1, 0);
  const sc = interpolateScenario(d.scenarios, mult, 0);
  const b3 = sum(base.slice(0, 3));
  const s3 = sum(sc.slice(0, 3));
  return ok(
    "price",
    `Nếu giá Robusta ${dir > 0 ? "tăng" : "giảm"} ${fmt(x * 100, 0)}% (các yếu tố khác giữ nguyên), dự báo p50 tổng xuất khẩu 3 tháng tới đổi từ ${fmt(b3, 1)} kt xuống/lên ${fmt(s3, 1)} kt, tức ${signedPct(s3 / b3 - 1)} (${s3 - b3 >= 0 ? "+" : "−"}${fmt(Math.abs(s3 - b3), 1)} kt). Kịch bản được tính sẵn bằng mô hình LightGBM và nội suy giữa các điểm lưới 80%, 90%, 100%, 110%, 120% của giá.`,
    ["Mục «Tồn kho» › What-if · scenarios (khóa «giá|mưa»)", "Mô hình: LightGBM"],
  );
}

function rainScenario(d: Results, q: string): ChatAnswer {
  const m = /(\d+(?:[.,]\d+)?)\s*mm/.exec(q);
  const x = m ? Number(m[1].replace(",", ".")) : 50;
  const dir = /giam|thap|han/.test(q) ? -1 : 1;
  const mm = dir * x;
  if (Math.abs(mm) > 100) return refuse("rain", "Kịch bản mưa chỉ có trong khoảng −100 đến +100 mm so với bình thường; ngoài khoảng này chưa có dữ liệu.", ["scenarios"]);
  const base = interpolateScenario(d.scenarios, 1, 0);
  const sc = interpolateScenario(d.scenarios, 1, mm);
  const b6 = sum(base), s6 = sum(sc);
  return ok("rain", `Nếu lượng mưa lệch ${mm > 0 ? "+" : "−"}${fmt(Math.abs(mm), 0)} mm so với bình thường (cộng vào 12 tháng gần nhất), dự báo p50 tổng xuất khẩu 6 tháng tới đổi từ ${fmt(b6, 1)} kt thành ${fmt(s6, 1)} kt (${signedPct(s6 / b6 - 1)}).`, ["Mục «Tồn kho» › What-if · scenarios", "Mô hình: LightGBM"]);
}

function fastestMarket(d: Results): ChatAnswer {
  const r = marketRanking(d, 3);
  const lines = r.map((x, i) => `${i + 1}. ${MARKET_LABEL[x.market]}: ${fmt(x.p50, 1)} kt, ${signedPct(x.change)} so với cùng kỳ năm trước`);
  return ok("fastest", `Theo dự báo 3 tháng tới (p50), thị trường tăng nhanh nhất là ${MARKET_SHORT[r[0].market]} (${signedPct(r[0].change)}). Xếp hạng:\n${lines.join("\n")}\n\nĐây là mức thay đổi theo tỷ lệ so với cùng kỳ năm trước, trên dữ liệu mẫu.`, ["Mục «Thị trường» · forecast.EU/US/JP/KR/CN (p50, ly)", "Mô hình: LightGBM"]);
}

function regulation(): ChatAnswer {
  return {
    intent: "regulation", refused: true, sources: ["Chưa nạp tài liệu quy định vào hệ thống"],
    answer: "Quy định về chống phá rừng của EU (EUDR) và thuế quan nhập khẩu nhìn chung nhằm bảo đảm hàng hóa không gắn với phá rừng và điều tiết thương mại. Hệ thống chưa nạp văn bản nào về các quy định này nên tôi không nêu mốc áp dụng, mức thuế hay yêu cầu chi tiết. Hãy kiểm tra văn bản chính thức của cơ quan có thẩm quyền.",
  };
}

function alertsAnswer(d: Results): ChatAnswer {
  const a = buildAlerts(d);
  if (!a.length) return ok("alerts", "Hiện không có cảnh báo nào thỏa ngưỡng.", ["Mục «Dashboard» › Cảnh báo"]);
  return ok("alerts", a.map((x) => `• [${x.severity === "critical" ? "Nghiêm trọng" : "Chú ý"}] ${x.title}: ${x.detail}`).join("\n"), ["Mục «Dashboard» › Cảnh báo", "history, forecast.Total, sim.base_series"]);
}

function inventoryAnswer(d: Results): ChatAnswer {
  const inv = defaultInventory(d);
  const s = simSummary(d, 2, 0.95);
  return ok("inventory", `Với doanh nghiệp giả định (thị phần ${pct(d.meta.share, 0)}), lead time ≈ ${fmt(DEFAULT_LEAD_WEEKS, 1)} tuần, mức dịch vụ 95%: tồn kho an toàn ${fmt(inv.safetyStock * 1000, 0)} tấn, điểm đặt hàng lại ${fmt(inv.rop * 1000, 0)} tấn, mức tồn kho tối đa ${fmt(inv.orderUpTo * 1000, 0)} tấn.${s ? ` Trong mô phỏng 2024–2026, chính sách theo dự báo AI giảm chi phí ${pct(s.reduction, 1)} so với chính sách kinh nghiệm (chỉ đúng trong mô phỏng này, trên dữ liệu mẫu có mùa vụ rất rõ).` : ""}`, ["Mục «Tồn kho» · meta.sig_h, meta.z, forecast.Total", "Mục «Mô phỏng» · sim.2|0.95"]);
}

function overview(d: Results): ChatAnswer {
  const h = horizonSum(d, "Total", 3);
  return ok("overview", `Dự báo tổng xuất khẩu 3 tháng tới là ${fmt(h.p50, 1)} kt (khoảng 80%: ${fmt(h.p10, 0)}–${fmt(h.p90, 0)} kt), ${signedPct(h.change)} so với cùng kỳ năm trước. Tháng gần nhất ${monthLabel(d.forecast.Total[0].month)}: ${fmt(d.forecast.Total[0].p50, 1)} kt.`, ["Mục «Dashboard» · forecast.Total", "Mô hình: LightGBM"]);
}

export function answerByRules(d: Results, question: string): ChatAnswer {
  const q = norm(question);
  if (/eudr|chong pha rung|thue quan|thue nhap khau|quy dinh|phap luat|bien phap phi thue/.test(q)) return regulation();
  if (/(vi sao|tai sao|giai thich|nguyen nhan|do dau)/.test(q) && /(thang\s*\d|\bt\d{1,2}\b|du bao)/.test(q)) return whyMonth(d, q);
  if (/vnd|ty gia|usd\/vnd|mat gia|len gia/.test(q)) return fxQuestion(d, q);
  if (/(chinh xac nhat|tot nhat|mo hinh nao|sarima|lightgbm|so sanh mo hinh)/.test(q)) return bestModel(d);
  if (/(thi truong|nuoc|khu vuc).*(tang|manh|nhanh)|tang nhanh nhat|tang manh nhat/.test(q)) return fastestMarket(d);
  if (/mua/.test(q) && /mm/.test(q)) return rainScenario(d, q);
  if (/gia/.test(q) && /(tang|giam)/.test(q) && /%/.test(q)) return priceScenario(d, q);
  if (/canh bao/.test(q)) return alertsAnswer(d);
  if (/(ton kho|safety|an toan|diem dat hang|rop|dat hang lai)/.test(q)) return inventoryAnswer(d);
  if (/(du bao|3 thang|quy toi|tong quan|nhu cau)/.test(q)) return overview(d);
  return refuse(
    "unknown",
    `Tôi chưa có dữ liệu để trả lời câu hỏi này. Tôi chỉ trả lời dựa trên gói kết quả của BeanCast: dự báo theo thị trường, yếu tố tác động, kịch bản giá và mưa, và tồn kho. Bạn thử hỏi: ${SUGGESTIONS.slice(0, 3).map((s) => `«${s}»`).join(", ")}.`,
  );
}

/** Ngữ cảnh gọn đưa cho mô hình ngôn ngữ (khi có khóa): chỉ gồm số liệu trong results.json. */
export function buildLlmContext(d: Results): string {
  const ctx = {
    meta: { data_mode: d.meta.data_mode, last_month: d.meta.last_month, share: d.meta.share },
    forecast: Object.fromEntries(MARKETS.map((m) => [m, d.forecast[m].map((x) => ({ month: x.month, p10: +x.p10.toFixed(1), p50: +x.p50.toFixed(1), p90: +x.p90.toFixed(1), ly: x.ly }))])),
    metrics_test_sMAPE_total: bestModelByHorizon(d).map((b) => ({ horizon: b.horizon, ...Object.fromEntries(Object.entries(b.table).map(([k, v]) => [k, +v.sMAPE.toFixed(2)])) })),
    cover80: { h1: d.metrics.Total.cover80_h1, h3: d.metrics.Total.cover80_h3 },
    shap: { h3_global: d.shap.h3_global, h1_local: d.shap.h1_local, h3_local: d.shap.h3_local },
    scenarios_total_6m: d.scenarios,
    sim_L2_svc95: d.sim["2|0.95"],
  };
  return JSON.stringify(ctx);
}

/** Dùng khi bộ luật không có dữ liệu cho câu hỏi: vẫn trả lời hữu ích bằng kiến thức chung, nhưng gắn nhãn rõ và không gán số cho BeanCast. */
export const LLM_GENERAL_SYSTEM = `Bạn là trợ lý của dashboard BeanCast (dự báo nhu cầu xuất khẩu cà phê Robusta Việt Nam, doanh nghiệp giả định). Người dùng hỏi một câu mà gói kết quả BeanCast không có dữ liệu. Đừng từ chối: hãy trả lời hữu ích, ngắn gọn bằng tiếng Việt dựa trên kiến thức chung về cà phê, xuất nhập khẩu, logistics, tài chính, quy định. Bắt đầu bằng "Ngoài dữ liệu BeanCast (kiến thức chung, nên kiểm chứng thêm):". Không nhắc số liệu như thể đó là kết quả của BeanCast; với quy định, giá, ngày tháng cụ thể có thể đã thay đổi thì nói rõ cần kiểm tra nguồn chính thức. Với EUDR, thuế quan và quy định có lịch hay thay đổi, không khẳng định ngày hoặc mức cụ thể như sự thật chắc chắn mà nói cần kiểm tra văn bản chính thức. Nếu NGỮ CẢNH có dữ liệu liên quan, có thể dẫn kèm và ghi rõ là từ BeanCast.`;

export const LLM_SYSTEM = `Bạn là trợ lý của dashboard BeanCast (dự báo nhu cầu xuất khẩu cà phê Robusta Việt Nam). Dữ liệu là DỮ LIỆU MẪU mô phỏng.
Quy tắc bắt buộc: (1) chỉ dùng số liệu trong NGỮ CẢNH và BẢN NHÁP; không bịa số, không dùng kiến thức ngoài; (2) nếu thiếu dữ liệu, nói "Chưa có dữ liệu" và từ chối; (3) kết thúc bằng một dòng "Nguồn: ..." nêu mục trên web và khóa trong results.json đã dùng, cùng mô hình; (4) không nói LightGBM tốt nhất ở mọi mốc, không nói dữ liệu là thật, không nhắc mô hình ngoài gói; (5) tỷ giá không đổi nhu cầu hay tồn kho, chỉ đổi chi phí quy VND; (6) không nêu ngày áp dụng hay mức thuế của EUDR/thuế quan; (7) trả lời tiếng Việt, ngắn gọn.`;
