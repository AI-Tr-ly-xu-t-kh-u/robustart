import { z } from "zod";
import { getData } from "@/lib/data";
import { chatCompletion, openAiCompat } from "@/lib/llm";
import { DEFAULT_CONTEXT, runAgentLlm, runAgentRules, type AgentEvent } from "@/lib/agent";

const Body = z.object({
  question: z.string().trim().min(1).max(500),
  document: z.string().max(20000).optional(),
  scenario: z.object({
    price_change_pct: z.number().min(-20).max(20),
    rain_mm: z.number().min(-100).max(100),
    source: z.string().max(200).optional(),
    signals: z.array(z.object({ driver: z.string().max(20), direction: z.string().max(10), magnitude: z.number().nullable(), evidence: z.string().max(500) })).max(6).optional(),
  }).optional(), // gửi tối đa 20.000 ký tự, nhưng chỉ phần đầu được đưa cho mô hình (giới hạn token của nhà cung cấp)
  context: z.object({ share_pct: z.number().min(1).max(5), lead_weeks: z.number().min(4).max(20), service_level: z.number().min(0.85).max(0.995) }).default(DEFAULT_CONTEXT),
});
const DOC_LLM_CHARS = 6000;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 8;
}

/** Trả về luồng NDJSON: mỗi dòng là một AgentEvent (step, result, final, error). */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return Response.json({ error: "Bạn hỏi quá nhanh, vui lòng thử lại sau ít giây." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Yêu cầu không hợp lệ (câu hỏi 1–500 ký tự, tham số trong giới hạn)." }, { status: 400 });
  const { question, context, document, scenario } = parsed.data;
  const d = getData();

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        // Mô hình ngôn ngữ xử lý mọi câu hỏi (dùng công cụ khi liên quan dữ liệu, kiến thức chung khi không); bộ luật chỉ là dự phòng
        let done = false;
        if (openAiCompat()) {
          emit({ type: "mode", mode: "llm" });
          done = await runAgentLlm(question, context, d, (b) => chatCompletion(b), emit, document?.slice(0, DOC_LLM_CHARS), scenario);
        }
        if (!done) {
          emit({ type: "mode", mode: "rules" });
          runAgentRules(question, context, d, emit, scenario);
        }
      } catch {
        emit({ type: "error", message: "Agent gặp lỗi, vui lòng thử lại." });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
