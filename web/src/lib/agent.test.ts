import { describe, expect, it } from "vitest";
import { getData } from "./data";
import { groundingCheck, numbersInText, runTool, TOOLS } from "./tools";
import { DEFAULT_CONTEXT, planCalls, runAgentLlm, runAgentRules, type AgentEvent, type Completion } from "./agent";

const d = getData();

describe("công cụ của agent", () => {
  it("mọi công cụ chạy được với tham số mặc định và có nguồn", () => {
    for (const t of TOOLS) {
      const out = runTool(t.name, t.name === "plan_inventory" ? { lead_weeks: 8.7, service_level: 0.95, share_pct: 2 } : {}, d);
      expect(out.ok, t.name).toBe(true);
      if (out.ok) expect(out.source.length).toBeGreaterThan(0);
    }
  });
  it("từ chối công cụ lạ và tham số sai", () => {
    expect(runTool("delete_everything", {}, d).ok).toBe(false);
    expect(runTool("plan_inventory", { lead_weeks: "abc" }, d).ok).toBe(false);
  });
  it("giá/mưa ngoài khoảng bị giới hạn, không ngoại suy", () => {
    const out = runTool("run_scenario", { price_change_pct: 80, rain_mm: -500 }, d);
    expect(out.ok).toBe(true);
    if (out.ok) {
      const a = (out.data as { applied: { price_change_pct: number; rain_mm: number } }).applied;
      expect(a.price_change_pct).toBeLessThanOrEqual(20);
      expect(a.rain_mm).toBeGreaterThanOrEqual(-100);
    }
  });
});

describe("đối chiếu số liệu", () => {
  it("đọc số kiểu Việt Nam", () => {
    expect(numbersInText("nhập 8 725 tấn, 1.234,5 kt và 12,3%")).toEqual([8725, 1234.5, 12.3]);
  });
  it("số có trong kết quả công cụ thì khớp, số bịa thì bị đánh dấu", () => {
    const g = groundingCheck("Tồn kho 671 tấn và 99999 tấn", [{ a: 671.2 }]);
    expect(g.matched).toBe(1);
    expect(g.unmatched).toEqual([99999]);
  });
});

describe("agent dự phòng bộ luật", () => {
  const run = (q: string) => {
    const ev: AgentEvent[] = [];
    runAgentRules(q, DEFAULT_CONTEXT, d, (e) => ev.push(e));
    return ev;
  };
  it("câu hỏi tồn kho gọi plan_inventory và mọi số đều khớp công cụ", () => {
    const ev = run("Tháng tới nên đặt bao nhiêu tấn?");
    expect(ev.some((e) => e.type === "step" && e.name === "plan_inventory")).toBe(true);
    const f = ev.find((e) => e.type === "final");
    expect(f && f.type === "final" && f.grounding.unmatched).toEqual([]);
    expect(f && f.type === "final" && f.rec?.actions.length).toBeGreaterThan(0);
  });
  it("câu hỏi ngoài phạm vi không bịa", () => {
    expect(planCalls("kể chuyện cười đi", DEFAULT_CONTEXT)).toBeNull();
    const f = run("kể chuyện cười đi").find((e) => e.type === "final");
    expect(f && f.type === "final" && f.rec).toBeNull();
  });
});

describe("vòng lặp agent với mô hình giả", () => {
  it("gọi công cụ rồi kết luận, ghi nhận số bịa", async () => {
    let n = 0;
    const complete: Completion = async () => {
      n++;
      if (n === 1) return { message: { tool_calls: [{ id: "1", function: { name: "get_alerts", arguments: "{}" } }] } };
      return { message: { content: JSON.stringify({ headline: "Tồn kho cần 123456 tấn", actions: [], reasons: [], risks: [], confidence: "vừa", assumptions: [] }) } };
    };
    const ev: AgentEvent[] = [];
    const ok = await runAgentLlm("rủi ro?", DEFAULT_CONTEXT, d, complete, (e) => ev.push(e));
    expect(ok).toBe(true);
    const f = ev.find((e) => e.type === "final");
    expect(f && f.type === "final" && f.grounding.unmatched).toContain(123456);
  });
  it("mô hình lỗi thì trả false để chuyển sang bộ luật", async () => {
    expect(await runAgentLlm("x", DEFAULT_CONTEXT, d, async () => null, () => {})).toBe(false);
  });
});

describe("phát hiện đầu ra hỏng", () => {
  it("bắt từ lặp và JSON hỏng, bỏ qua câu bình thường", async () => {
    const { looksBroken } = await import("./agent");
    expect(looksBroken("kế hoạch inbound inbound inbound", null)).toBe(true);
    expect(looksBroken("{ không phải json", null)).toBe(true);
    expect(looksBroken("Nên giữ tồn kho 671 tấn.", null)).toBe(false);
  });
});

describe("kịch bản chuyển từ tin tức", () => {
  const scn = { price_change_pct: -10, rain_mm: -50, source: "bản tin mẫu", signals: [{ driver: "price", direction: "down", magnitude: 10, evidence: "Giá Robusta giảm 10% trong tháng qua" }] };
  it("LLM: chạy sẵn công cụ với đúng giá trị kịch bản và đưa bằng chứng vào lời nhắc", async () => {
    const seen: string[] = [];
    const complete: Completion = async (body) => {
      seen.push(JSON.stringify(body.messages));
      return { message: { content: JSON.stringify({ headline: "Cần về kho nhiều hơn", actions: [], reasons: [], risks: [], confidence: "vừa", assumptions: [] }) } };
    };
    const ev: AgentEvent[] = [];
    await runAgentLlm("kế hoạch?", DEFAULT_CONTEXT, d, complete, (e) => ev.push(e), undefined, scn);
    const steps = ev.filter((e) => e.type === "step") as Extract<AgentEvent, { type: "step" }>[];
    expect(steps.map((s) => s.name)).toEqual(["run_scenario", "plan_inventory", "plan_inventory"]);
    expect(steps[0].args).toMatchObject({ price_change_pct: -10, rain_mm: -50 });
    expect(seen[0]).toContain("Giá Robusta giảm 10% trong tháng qua");
    const f = ev.find((e) => e.type === "final");
    expect(f && f.type === "final" && f.scenario?.rain_mm).toBe(-50);
    expect(f && f.type === "final" && f.general).toBe(false);
  });
  it("bộ luật dự phòng cũng dùng kịch bản và so với kế hoạch gốc", () => {
    const ev: AgentEvent[] = [];
    runAgentRules("bất kỳ", DEFAULT_CONTEXT, d, (e) => ev.push(e), scn);
    const f = ev.find((e) => e.type === "final");
    expect(f && f.type === "final" && f.rec?.reasons.join(" ")).toContain("Kịch bản");
    expect(f && f.type === "final" && f.grounding.unmatched).toEqual([]);
  });
});
