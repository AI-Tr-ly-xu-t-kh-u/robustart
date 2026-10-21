import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildLlmContext, LLM_GENERAL_SYSTEM, LLM_SYSTEM, type ChatAnswer } from "./chat";
import type { Results } from "./schema";

let parentEnvLoaded = false;
/** Dùng chung một tệp .env ở thư mục beancast/ (nằm ngoài web/, đã trong .gitignore). Chỉ đọc ở server, chỉ điền biến còn thiếu. */
function loadParentEnv() {
  if (parentEnvLoaded) return;
  parentEnvLoaded = true;
  try {
    const text = readFileSync(resolve(process.cwd(), "..", ".env"), "utf-8");
    for (const raw of text.split("\n")) {
      const m = /^\s*(LLM_[A-Z_]+)\s*=\s*([^#\r]*?)\s*(?:#.*)?$/.exec(raw);
      if (m && process.env[m[1]] === undefined && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* không có .env: chatbot chạy bằng bộ luật */
  }
}

/** Cấu hình cho các nhà cung cấp tương thích OpenAI (groq, openai); anthropic chưa hỗ trợ gọi công cụ ở bản này. */
export function openAiCompat(): { key: string; model: string; base: string; provider: string } | null {
  loadParentEnv();
  const key = process.env.LLM_API_KEY;
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const model = process.env.LLM_MODEL;
  if (!key || !model || !provider || provider === "anthropic") return null;
  const base = process.env.LLM_BASE_URL || (provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1");
  return { key, model, base, provider };
}

/** Gọi chat/completions (có thể kèm tools). Trả về message của mô hình hoặc null khi lỗi. */
export async function chatCompletion(body: Record<string, unknown>, timeoutMs = 40000, retry = true): Promise<{ message: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } } | null> {
  const c = openAiCompat();
  if (!c) return null;
  try {
    const r = await fetch(`${c.base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${c.key}` },
      body: JSON.stringify({ model: c.model, temperature: 0.2, ...(c.provider === "groq" ? { reasoning_effort: "low" } : {}), ...body }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) {
      if (retry && (r.status === 429 || r.status >= 500)) { await new Promise((ok) => setTimeout(ok, 1500)); return chatCompletion(body, timeoutMs, false); }
      return null;
    }
    const j = (await r.json()) as { choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] };
    const message = j.choices?.[0]?.message;
    return message ? { message } : null;
  } catch {
    return null;
  }
}

/** Adapter mô hình ngôn ngữ. Khóa chỉ đọc từ biến môi trường ở server, không bao giờ gửi ra trình duyệt hay ghi log. */
export function llmConfigured(): boolean {
  loadParentEnv();
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_PROVIDER && process.env.LLM_MODEL);
}

export async function askLlm(d: Results, question: string, draft: ChatAnswer, general = false, retry = true): Promise<string | null> {
  const system = general ? LLM_GENERAL_SYSTEM : LLM_SYSTEM;
  loadParentEnv();
  const key = process.env.LLM_API_KEY;
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const model = process.env.LLM_MODEL;
  if (!key || !provider || !model) return null;

  const user = general
    ? `NGỮ CẢNH (results.json rút gọn):
${buildLlmContext(d)}

CÂU HỎI: ${question}`
    : `NGỮ CẢNH (results.json rút gọn):\n${buildLlmContext(d)}\n\nBẢN NHÁP TỪ BỘ LUẬT (đã tính từ dữ liệu; hãy giữ đúng các con số):\n${draft.answer}\nNguồn nháp: ${draft.sources.join("; ")}\n\nCÂU HỎI: ${question}`;
  try {
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 700, system, messages: [{ role: "user", content: user }] }),
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) return null;
      const j = (await r.json()) as { content?: { type: string; text?: string }[] };
      return j.content?.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim() || null;
    }
    // Các nhà cung cấp tương thích OpenAI (OpenAI, Groq, ...)
    const base = process.env.LLM_BASE_URL || (provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1");
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: 1800, temperature: 0.2, ...(provider === "groq" ? { reasoning_effort: "low" } : {}), messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) {
      if (retry && (r.status === 429 || r.status >= 500)) { await new Promise((ok) => setTimeout(ok, 1500)); return askLlm(d, question, draft, general, false); }
      return null;
    }
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export interface WebLink { title: string; url: string }
export interface WebAnswer { answer: string; links: WebLink[] }

export const WEB_SYSTEM = `Bạn là trợ lý tra cứu tin tức và thông tin thị trường cho doanh nghiệp xuất khẩu cà phê Robusta Việt Nam. Hãy dùng công cụ tìm kiếm cho mọi câu hỏi về giá, tin tức, thời tiết, cước vận tải, quy định (như EUDR), sự kiện hay số liệu hiện tại. Trả lời tiếng Việt, ngắn gọn, nêu rõ ngày của thông tin. Không bịa: nếu không tìm thấy thì nói không tìm thấy. Số liệu trên dashboard BeanCast là dữ liệu mẫu nên không dùng để trả lời giá thật.`;

const safeUrl = (u: unknown): string | null => {
  if (typeof u !== "string") return null;
  try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:" ? x.toString() : null; } catch { return null; }
};

/** Tra cứu trực tiếp trên web bằng công cụ tìm kiếm của Groq (chỉ khi nhà cung cấp là groq). Trả null khi không khả dụng hoặc lỗi. */
export async function webSearchAnswer(question: string): Promise<WebAnswer | null> {
  const c = openAiCompat();
  if (!c || c.provider !== "groq" || !/gpt-oss/.test(c.model)) return null;
  try {
    const r = await fetch(`${c.base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${c.key}` },
      body: JSON.stringify({ model: c.model, temperature: 0.2, reasoning_effort: "low", max_tokens: 1500, tools: [{ type: "browser_search" }], tool_choice: "auto", messages: [{ role: "system", content: WEB_SYSTEM }, { role: "user", content: question }] }),
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { choices?: { message?: { content?: string | null; executed_tools?: { search_results?: { results?: { title?: string; url?: string }[] } }[] } }[] };
    const m = j.choices?.[0]?.message;
    const text = (m?.content ?? "").replace(/【[^】]*】/g, "").trim();
    if (!text) return null;
    const seen = new Set<string>();
    const links: WebLink[] = [];
    for (const t of m?.executed_tools ?? []) for (const x of t.search_results?.results ?? []) {
      const url = safeUrl(x.url);
      if (!url || seen.has(url) || /^https?:\/\/exa\.ai\//.test(url)) continue;
      seen.add(url);
      links.push({ title: (x.title ?? url).replace(/\s+/g, " ").slice(0, 120), url });
    }
    return { answer: text, links: links.slice(0, 6) };
  } catch {
    return null;
  }
}
