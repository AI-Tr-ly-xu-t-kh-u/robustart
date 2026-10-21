import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getData } from "./data";
import { answerByRules } from "./chat";
import { chatCompletion, openAiCompat } from "./llm";
import { DEFAULT_CONTEXT, runAgentLlm, runAgentRules, type AgentEvent } from "./agent";

/** Chạy: EVAL=1 npx vitest run src/lib/agent.eval.test.ts  → ghi src/data/agent_eval.json (gọi mô hình thật nếu có khóa). */
const d = getData();

interface Case { q: string; tools: string[]; refuse?: boolean }
const CASES: Case[] = [
  { q: "Tháng tới tôi nên đặt thêm bao nhiêu tấn để không thiếu hàng?", tools: ["plan_inventory"] },
  { q: "Tồn kho an toàn nên giữ bao nhiêu?", tools: ["plan_inventory"] },
  { q: "Nên ưu tiên thị trường nào trong 3 tháng tới?", tools: ["rank_markets"] },
  { q: "Nếu giá giảm 10% thì nhu cầu thay đổi thế nào?", tools: ["run_scenario"] },
  { q: "Nếu giá giảm 10% và mưa thiếu 40 mm thì kế hoạch nhập kho đổi thế nào?", tools: ["plan_inventory"] },
  { q: "Hiện có rủi ro nào tôi cần xử lý?", tools: ["get_alerts"] },
  { q: "Dùng dự báo AI thay cho kinh nghiệm thì tiết kiệm được bao nhiêu?", tools: ["compare_policies"] },
  { q: "Mô hình nào chính xác nhất?", tools: ["get_model_accuracy"] },
  { q: "Nếu lead time là 3 tháng thì AI tiết kiệm bao nhiêu so với kinh nghiệm?", tools: ["compare_policies"] },
  { q: "Quy định EUDR áp dụng từ ngày nào?", tools: [], refuse: true },
  { q: "Giá cà phê Indonesia tuần sau là bao nhiêu?", tools: [], refuse: true },
  { q: "Giá tăng 50% thì sao?", tools: [] },
];

async function run(c: Case, useLlm: boolean) {
  const ev: AgentEvent[] = [];
  const emit = (e: AgentEvent) => ev.push(e);
  const rules = answerByRules(d, c.q);
  if (rules.refused && rules.intent !== "unknown") {
    emit({ type: "final", mode: "rules", rec: null, text: rules.answer, sources: [], grounding: { checked: 0, matched: 0, unmatched: [] }, steps: 0 });
  } else if (useLlm) {
    const ok = await runAgentLlm(c.q, DEFAULT_CONTEXT, d, (b) => chatCompletion(b), emit);
    if (!ok) runAgentRules(c.q, DEFAULT_CONTEXT, d, emit);
  } else runAgentRules(c.q, DEFAULT_CONTEXT, d, emit);
  const used = ev.filter((e) => e.type === "step").map((e) => (e as { name: string }).name);
  const fin = ev.find((e) => e.type === "final") as Extract<AgentEvent, { type: "final" }> | undefined;
  const toolOk = c.tools.every((t) => used.includes(t));
  const refusedOk = c.refuse ? used.length === 0 : true;
  const grounded = (fin?.grounding.unmatched.length ?? 0) === 0;
  return { question: c.q, mode: fin?.mode ?? "rules", tools_used: used, expected_tools: c.tools, tool_ok: toolOk, refusal_ok: refusedOk, grounded, unmatched: fin?.grounding.unmatched ?? [], steps: fin?.steps ?? 0, pass: toolOk && refusedOk && grounded };
}

describe.skipIf(!process.env.EVAL)("đánh giá agent", () => {
  it("chạy bộ câu hỏi và ghi kết quả", { timeout: 300000 }, async () => {
    const useLlm = Boolean(openAiCompat());
    const rows = [];
    for (const c of CASES) rows.push(await run(c, useLlm));
    const rulesRows = [];
    for (const c of CASES) rulesRows.push(await run(c, false));
    const sum = (r: { pass: boolean; grounded: boolean; tool_ok: boolean }[]) => ({ total: r.length, pass: r.filter((x) => x.pass).length, grounded: r.filter((x) => x.grounded).length, tool_ok: r.filter((x) => x.tool_ok).length });
    const out = { generated_at: new Date().toISOString().slice(0, 10), data_mode: d.meta.data_mode, llm: useLlm ? process.env.LLM_MODEL : null, agent: { summary: sum(rows), rows }, rules_baseline: { summary: sum(rulesRows), rows: rulesRows } };
    writeFileSync("src/data/agent_eval.json", JSON.stringify(out, null, 2), "utf-8");
    expect(rows.length).toBe(CASES.length);
  });
});
