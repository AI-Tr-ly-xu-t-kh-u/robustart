import { z } from "zod";
import { getData } from "@/lib/data";
import { answerByRules } from "@/lib/chat";
import { askLlm, llmConfigured, webSearchAnswer } from "@/lib/llm";

const Body = z.object({ question: z.string().trim().min(1).max(500) });
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 20;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return Response.json({ error: "Bạn hỏi quá nhanh, vui lòng thử lại sau ít giây." }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Câu hỏi không hợp lệ (1–500 ký tự)." }, { status: 400 });

  // Ưu tiên tra cứu trực tiếp trên web (giá, tin tức, quy định hiện tại)
  const web = await webSearchAnswer(parsed.data.question);
  if (web) return Response.json({ answer: web.answer, sources: [], links: web.links, refused: false, mode: "web", general: false });

  const d = getData();
  const rules = answerByRules(d, parsed.data.question);
  let answer = rules.answer;
  let mode: "rules" | "llm" = "rules";
  // Câu bộ luật không có dữ liệu vẫn được trả lời bằng kiến thức chung (có gắn nhãn), thay vì chỉ từ chối
  let general = false;
  if (llmConfigured()) {
    general = rules.refused;
    const out = await askLlm(d, parsed.data.question, rules, general);
    if (out) {
      answer = out;
      mode = "llm";
    } else general = false;
  }
  return Response.json({ answer, sources: general ? [] : rules.sources, links: [], refused: rules.refused && !general, mode, general, offline: true });
}
