import { afterEach, describe, expect, it, vi } from "vitest";
import { getData } from "./data";
import { answerByRules, norm, SUGGESTIONS } from "./chat";
import { POST } from "@/app/api/chat/route";

const d = getData();
const ask = (q: string) => answerByRules(d, q);

describe("chatbot bộ luật", () => {
  it("chuẩn hóa tiếng Việt", () => expect(norm("Vì sao dự báo Đã tăng?")).toBe("vi sao du bao da tang?"));

  it("Vì sao dự báo tháng 9 tăng? – dùng SHAP local, có nguồn, nêu lưu ý không nhân quả", () => {
    const a = ask("Vì sao dự báo tháng 9 tăng?");
    expect(a.refused).toBe(false);
    expect(a.answer).toContain("133,9 kt");
    expect(a.answer).toContain("+4,9%");
    expect(a.answer).toContain("không phải quan hệ nhân quả");
    expect(a.sources.join(" ")).toContain("shap.h3_local");
  });
  it("tháng không có giải thích thì từ chối", () => {
    const a = ask("Vì sao dự báo tháng 11 giảm?");
    expect(a.refused).toBe(true);
    expect(a.answer).toContain("Chưa có dữ liệu");
  });

  it("VND mất giá: không đổi lượng tồn kho, chỉ đổi chi phí quy ra đồng", () => {
    const a = ask("Nếu VND mất giá 3% thì tồn kho đổi thế nào?");
    expect(a.answer).toContain("không làm đổi nhu cầu hay lượng tồn kho");
    expect(a.answer).toContain("chi phí USD không đổi");
    expect(a.sources.length).toBeGreaterThan(0);
  });

  it("Mô hình nào chính xác nhất? – không nói LightGBM tốt nhất mọi mốc", () => {
    const a = ask("Mô hình nào chính xác nhất?");
    expect(a.answer).toContain("Không có mô hình nào tốt nhất ở mọi mốc");
    expect(a.answer).toMatch(/trước 1 tháng: SARIMA nhỉnh nhất \(sMAPE 6,4%\)/);
    expect(a.answer).toMatch(/trước 6 tháng: LightGBM nhỉnh nhất \(sMAPE 8,5%\)/);
    expect(a.answer).toContain("57%");
  });

  it("Giá tăng 10% – đọc từ scenarios", () => {
    const a = ask("Giá tăng 10% thì dự báo 3 tháng tới đổi bao nhiêu?");
    const base = d.scenarios["1.0|0"].slice(0, 3).reduce((x, y) => x + y, 0);
    const up = d.scenarios["1.1|0"].slice(0, 3).reduce((x, y) => x + y, 0);
    expect(a.answer).toContain(`${base.toFixed(1).replace(".", ",")} kt`);
    expect(a.answer).toContain(`${up.toFixed(1).replace(".", ",")} kt`);
    expect(a.sources.join(" ")).toContain("scenarios");
  });
  it("giá ngoài ±20% thì từ chối", () => expect(ask("Giá tăng 50% thì sao?").refused).toBe(true));

  it("Thị trường nào tăng nhanh nhất?", () => {
    const a = ask("Thị trường nào tăng nhanh nhất?");
    expect(a.answer).toContain("Hàn");
    expect(a.answer).toContain("+11,0%");
  });

  it("EUDR: trả lời chung, không nêu ngày áp dụng, nói cần kiểm tra văn bản chính thức", () => {
    const a = ask("EUDR áp dụng từ ngày nào và thuế bao nhiêu?");
    expect(a.refused).toBe(true);
    expect(a.answer).toContain("kiểm tra văn bản chính thức");
    expect(a.answer).not.toMatch(/20\d\d|\d+%/);
  });

  it("câu ngoài phạm vi thì từ chối, không bịa số", () => {
    const a = ask("Giá cà phê ở Brazil tuần sau là bao nhiêu?");
    expect(a.refused).toBe(true);
    expect(a.answer).toContain("chưa có dữ liệu");
  });

  it("mọi câu gợi ý đều trả lời được và có nguồn", () => {
    for (const s of SUGGESTIONS) {
      const a = ask(s);
      expect(a.refused, s).toBe(false);
      expect(a.sources.length, s).toBeGreaterThan(0);
    }
  });
});

describe("POST /api/chat", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  const call = (body: unknown, ip = "9.9.9.9") => POST(new Request("http://x/api/chat", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }));

  it("không có khóa: chạy bộ luật", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    const r = await call({ question: "Mô hình nào chính xác nhất?" }, "1.1.1.1");
    const j = await r.json();
    expect(j.mode).toBe("rules");
    expect(j.sources.length).toBeGreaterThan(0);
  });
  it("câu hỏi không hợp lệ", async () => {
    expect((await call({ question: "" }, "2.2.2.2")).status).toBe(400);
    expect((await call({ question: "x".repeat(501) }, "2.2.2.2")).status).toBe(400);
  });
  it("khóa chỉ được gửi tới nhà cung cấp, không có trong phản hồi", async () => {
    vi.stubEnv("LLM_API_KEY", "khoa-bi-mat-123");
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("LLM_MODEL", "mo-hinh-thu");
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: "Trả lời từ mô hình.\nNguồn: scenarios" }] })));
    const r = await call({ question: "Giá tăng 10% thì dự báo 3 tháng tới đổi bao nhiêu?" }, "3.3.3.3");
    const text = await r.text();
    expect(text).not.toContain("khoa-bi-mat-123");
    expect(JSON.parse(text).mode).toBe("llm");
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ "x-api-key": "khoa-bi-mat-123" });
  });
  it("câu ngoài dữ liệu vẫn được mô hình trả lời bằng kiến thức chung và gắn nhãn", async () => {
    vi.stubEnv("LLM_API_KEY", "k"); vi.stubEnv("LLM_PROVIDER", "anthropic"); vi.stubEnv("LLM_MODEL", "m");
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: "Ngoài dữ liệu BeanCast (kiến thức chung): FOB là điều kiện giao hàng." }] })));
    const j = await (await call({ question: "FOB là gì?" }, "4.4.4.4")).json();
    expect(j.general).toBe(true);
    expect(j.refused).toBe(false);
    expect(f).toHaveBeenCalled();
  });
  it("không có mô hình thì câu ngoài dữ liệu vẫn bị từ chối lịch sự", async () => {
    vi.stubEnv("LLM_API_KEY", ""); vi.stubEnv("LLM_PROVIDER", ""); vi.stubEnv("LLM_MODEL", "");
    const j = await (await call({ question: "FOB là gì?" }, "4.4.4.5")).json();
    expect(j.refused).toBe(true);
    expect(j.general).toBe(false);
  });
  it("giới hạn tần suất", async () => {
    let last = 200;
    for (let i = 0; i < 22; i++) last = (await call({ question: "Mô hình nào chính xác nhất?" }, "5.5.5.5")).status;
    expect(last).toBe(429);
  });
});
