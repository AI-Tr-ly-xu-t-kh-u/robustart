import { z } from "zod";
import { chatCompletion, openAiCompat } from "@/lib/llm";
import { extractSignalsRules, NEWS_SYSTEM, toScenario, validateSignals, type Signal } from "@/lib/news";

const Body = z.object({ text: z.string().trim().min(20).max(20000) });
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 8;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return Response.json({ error: "Bạn gửi quá nhanh, vui lòng thử lại sau ít giây." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bản tin cần từ 20 đến 20.000 ký tự." }, { status: 400 });
  const { text } = parsed.data;

  let signals: Signal[] | null = null;
  let dropped = 0;
  let mode: "llm" | "rules" = "rules";
  if (openAiCompat()) {
    const res = await chatCompletion({ messages: [{ role: "system", content: NEWS_SYSTEM }, { role: "user", content: `BẢN TIN:\n"""\n${text.slice(0, 6000)}\n"""` }], max_tokens: 1500, response_format: { type: "json_object" } });
    const m = /\{[\s\S]*\}/.exec(res?.message.content ?? "");
    if (m) {
      try {
        const v = validateSignals(JSON.parse(m[0]), text);
        signals = v.kept; dropped = v.dropped; mode = "llm";
      } catch { /* JSON hỏng: dùng bộ luật */ }
    }
  }
  if (!signals) signals = extractSignalsRules(text);
  return Response.json({ mode, signals, dropped, scenario: toScenario(signals) });
}
