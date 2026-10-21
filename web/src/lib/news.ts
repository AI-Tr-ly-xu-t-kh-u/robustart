import { z } from "zod";
import { norm } from "./chat";

/** Tín hiệu rút ra từ bản tin. Chỉ giá và mưa có thể đưa vào kịch bản của mô hình; còn lại được ghi nhận nhưng không định lượng. */
export const SignalSchema = z.object({
  driver: z.enum(["price", "rain", "other"]),
  direction: z.enum(["up", "down"]),
  magnitude: z.number().nullable(),
  evidence: z.string().min(3),
  rationale: z.string().default(""),
});
export type Signal = z.infer<typeof SignalSchema>;

export interface NewsScenario {
  price_change_pct: number;
  rain_mm: number;
  clamped: boolean;
  unquantified: Signal[];
}

export const PRICE_LIMIT = 20;
export const RAIN_LIMIT = 100;

export const NEWS_SYSTEM = `Bạn rút tín hiệu từ bản tin cà phê để chỉnh kịch bản dự báo. Chỉ trả về một đối tượng JSON: {"signals":[{"driver":"price"|"rain"|"other","direction":"up"|"down","magnitude":số hoặc null,"evidence":"trích NGUYÊN VĂN một đoạn trong bản tin","rationale":"vì sao tác động"}]}.
Quy tắc: price = thay đổi giá Robusta, magnitude là phần trăm (dương); rain = lượng mưa lệch so với bình thường, magnitude là mm (dương), direction down nghĩa là thiếu mưa/hạn; other = yếu tố khác (quy định, thuế, vận tải, tỷ giá...) và magnitude = null. Không suy đoán con số không có trong bản tin: nếu bản tin không nêu mức độ thì magnitude = null. evidence phải sao chép đúng từng chữ từ bản tin. Tối đa 6 tín hiệu.`;

const squash = (s: string) => norm(s).replace(/\s+/g, " ").trim();

/** Giữ tín hiệu có bằng chứng thật sự nằm trong bản tin; tín hiệu bịa bị loại. */
export function validateSignals(raw: unknown, text: string): { kept: Signal[]; dropped: number } {
  const arr = Array.isArray((raw as { signals?: unknown })?.signals) ? ((raw as { signals: unknown[] }).signals) : [];
  const hay = squash(text);
  const kept: Signal[] = [];
  let dropped = 0;
  for (const item of arr.slice(0, 6)) {
    const p = SignalSchema.safeParse(item);
    if (!p.success || !hay.includes(squash(p.data.evidence))) { dropped++; continue; }
    const s = p.data;
    if (s.driver === "other") s.magnitude = null;
    else if (s.magnitude !== null) s.magnitude = Math.abs(s.magnitude);
    // magnitude có nhưng không xuất hiện trong bản tin thì coi là chưa rõ mức độ
    if (s.magnitude !== null && !squash(text).replace(/,/g, ".").includes(String(s.magnitude).replace(",", "."))) s.magnitude = null;
    kept.push(s);
  }
  return { kept, dropped };
}

const UP = /(tang|len gia|phuc hoi|leo thang|cao hon|vuot)/;
const DOWN = /(giam|ha|roi|sut|thap hon|mat gia)/;

/** Bộ luật dự phòng khi không có mô hình ngôn ngữ: tách câu và bắt mẫu từ khóa + số. */
export function extractSignalsRules(text: string): Signal[] {
  const out: Signal[] = [];
  const sentences = text.split(/(?<=[.!?;\n])\s+/).map((s) => s.trim()).filter(Boolean);
  for (const sent of sentences) {
    const n = squash(sent);
    const pct = /(\d+(?:[.,]\d+)?)\s*%/.exec(n);
    const mm = /(\d+(?:[.,]\d+)?)\s*mm/.exec(n);
    const num = (m: RegExpExecArray | null) => (m ? Number(m[1].replace(",", ".")) : null);
    if (/(\bgia\b|robusta|london|ice)/.test(n) && (UP.test(n) || DOWN.test(n)) && !/(thue|cuoc|ty gia)/.test(n)) {
      out.push({ driver: "price", direction: DOWN.test(n) && !UP.test(n) ? "down" : UP.test(n) && !DOWN.test(n) ? "up" : DOWN.test(n) ? "down" : "up", magnitude: num(pct), evidence: sent, rationale: "Bản tin nói về biến động giá Robusta." });
    } else if (/(mua|han han|el nino|la nina|kho han|thieu nuoc)/.test(n)) {
      const dry = /(thieu mua|han|kho|it mua|giam|el nino)/.test(n);
      out.push({ driver: "rain", direction: dry ? "down" : "up", magnitude: num(mm), evidence: sent, rationale: dry ? "Thiếu mưa có thể ảnh hưởng nguồn cung." : "Mưa nhiều hơn bình thường." });
    } else if (/(eudr|thue|cuoc|container|ty gia|quy dinh|cam van|logistics|van tai)/.test(n)) {
      out.push({ driver: "other", direction: /(giam|ha|noi long)/.test(n) ? "down" : "up", magnitude: null, evidence: sent, rationale: "Yếu tố ngoài mô hình, không đưa vào kịch bản định lượng." });
    }
  }
  return out.slice(0, 6);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Gộp tín hiệu có mức độ rõ thành tham số kịch bản, kẹp trong khoảng mô hình hỗ trợ. */
export function toScenario(signals: Signal[]): NewsScenario {
  let price = 0, rain = 0;
  const unquantified: Signal[] = [];
  for (const s of signals) {
    if (s.driver === "other" || s.magnitude === null) { unquantified.push(s); continue; }
    const v = s.direction === "down" ? -s.magnitude : s.magnitude;
    if (s.driver === "price") price += v; else rain += v;
  }
  const p = clamp(price, -PRICE_LIMIT, PRICE_LIMIT), r = clamp(rain, -RAIN_LIMIT, RAIN_LIMIT);
  return { price_change_pct: Math.round(p * 10) / 10, rain_mm: Math.round(r), clamped: p !== price || r !== rain, unquantified };
}

/** Bản tin MẪU do nhóm soạn để minh họa, không phải tin thật. */
export const SAMPLE_NEWS: { title: string; text: string }[] = [
  { title: "Giá giảm, mưa thiếu (mẫu)", text: "Giá cà phê Robusta trên sàn London giảm 10% trong tháng qua do dự báo vụ mùa Brazil bội thu. Tại Tây Nguyên, lượng mưa tháng này thấp hơn trung bình khoảng 50 mm, nhiều vùng lo ngại thiếu nước tưới. Cước container đi châu Âu vẫn ở mức cao." },
  { title: "Giá tăng, mưa nhiều (mẫu)", text: "Giá Robusta tăng 10% sau khi tồn kho sàn giao dịch xuống thấp. Mưa tại Đắk Lắk cao hơn bình thường 50 mm giúp cây phục hồi." },
  { title: "Tin không định lượng (mẫu)", text: "Liên minh châu Âu thảo luận lại quy định EUDR về truy xuất nguồn gốc. Cước vận tải biển có dấu hiệu tăng nhưng chưa có số liệu cụ thể." },
];
