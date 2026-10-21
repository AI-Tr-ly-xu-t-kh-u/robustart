"use client";
import { useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconPlayerPlay, IconRobot, IconTool, IconX } from "@tabler/icons-react";
import { FileDrop, type Loaded } from "./FileDrop";
import { getData } from "@/lib/data";
import { parseCompanyCsv, type CompanyData } from "@/lib/company";
import type { AgentEvent, BusinessContext, Recommendation, ScenarioInput } from "@/lib/agent";
import { takeHandoff, type Handoff } from "@/lib/handoff";

const QUESTIONS = [
  "Tháng tới tôi nên đặt thêm bao nhiêu tấn để không thiếu hàng?",
  "Nên ưu tiên thị trường nào trong 3 tháng tới?",
  "Nếu giá giảm 10% và mưa thiếu 40 mm thì kế hoạch nhập kho đổi thế nào?",
  "Hiện có rủi ro nào tôi cần xử lý?",
  "Dùng dự báo AI thay cho kinh nghiệm thì tiết kiệm được bao nhiêu?",
  "Bán sang EU nên dùng điều kiện FOB hay CIF?",
  "Nên chọn tuyến nào từ kho ra cảng để rẻ và ít khí thải?",
];
const TOOL_LABEL: Record<string, string> = {
  get_forecast: "Lấy dự báo",
  rank_markets: "Xếp hạng thị trường",
  run_scenario: "Chạy kịch bản giá/mưa",
  plan_inventory: "Lập kế hoạch tồn kho",
  get_alerts: "Kiểm tra cảnh báo",
  compare_policies: "So sánh chính sách",
  get_model_accuracy: "Đánh giá độ chính xác",
};

interface Step { n: number; name: string; args: unknown; done?: boolean; ok?: boolean; source?: string; data?: unknown; error?: string }
interface Final { mode: "llm" | "rules"; rec: Recommendation | null; text: string; sources: string[]; grounding: { checked: number; matched: number; unmatched: number[] }; steps: number; general?: boolean; scenario?: ScenarioInput }
interface LogEntry { at: string; question: string; headline: string; decision: "chấp nhận" | "từ chối"; scenario?: string }

const LOG_KEY = "beancast-decisions";
function readLog(): LogEntry[] {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch { return []; }
}

export function AgentPanel() {
  const [ctx, setCtx] = useState<BusinessContext>({ share_pct: 2, lead_weeks: 8.7, service_level: 0.95 });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [fin, setFin] = useState<Final | null>(null);
  const [asked, setAsked] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [decided, setDecided] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [company, setCompany] = useState<{ name: string; data: CompanyData } | null>(null);
  const [csvErr, setCsvErr] = useState("");
  const [scn, setScn] = useState<ScenarioInput | null>(null);
  const [from, setFrom] = useState<Handoff | null>(null);
  const started = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  async function loadCsv(file: File) {
    setCsvErr("");
    const r = parseCompanyCsv(await file.text(), getData());
    if ("error" in r) { setCsvErr(r.error); return; }
    setCompany({ name: file.name, data: r });
    if (r.share_pct !== null) setCtx((c) => ({ ...c, share_pct: Math.min(5, Math.max(1, r.share_pct!)) }));
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const h = takeHandoff();
    if (!h) return;
    // đọc từ sessionStorage khi mở trang là đồng bộ với hệ thống bên ngoài: hợp lệ để đặt state một lần
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrom(h); setScn(h.scenario);
    run(h.question, h.scenario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (busy) end.current?.scrollIntoView({ block: "nearest" }); }, [steps, busy]);

  async function run(question: string, scenario: ScenarioInput | null = scn) {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true); setSteps([]); setFin(null); setErr(""); setDecided(null); setAsked(text); setQ(text);
    try {
      const r = await fetch("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, context: ctx, scenario: scenario ?? undefined, document: [company?.data.summary, doc?.text].filter(Boolean).join("\n\n").slice(0, 20000) || undefined }) });
      if (!r.ok || !r.body) throw new Error((await r.json().catch(() => null))?.error || "Không kết nối được agent");
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as AgentEvent;
          if (e.type === "step") setSteps((s) => [...s, { n: e.n, name: e.name, args: e.args }]);
          else if (e.type === "result") setSteps((s) => s.map((x) => (x.n === e.n ? { ...x, done: true, ok: e.ok, source: e.source, data: e.data, error: e.error } : x)));
          else if (e.type === "final") setFin(e);
          else if (e.type === "error") setErr(e.message);
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  function decide(decision: LogEntry["decision"]) {
    if (!fin) return;
    const entry: LogEntry = { at: new Date().toLocaleString("vi-VN"), question: asked, headline: fin.rec?.headline ?? fin.text.slice(0, 120), decision, ...(fin.scenario ? { scenario: `giá ${fin.scenario.price_change_pct}%, mưa ${fin.scenario.rain_mm} mm · ${fin.scenario.source ?? "tin tức"}` } : {}) };
    const next = [entry, ...readLog()].slice(0, 20);
    try { localStorage.setItem(LOG_KEY, JSON.stringify(next)); } catch { /* không lưu được: bỏ qua */ }
    setLog(next); setDecided(decision);
  }

  const rec = fin?.rec;
  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-5 rounded-[20px] bg-cream-soft p-5 shadow-[var(--shadow-soft)]">
        <div>
          <h2 className="font-serif text-xl">Bối cảnh doanh nghiệp</h2>
          <p className="mt-1 text-sm text-ink/70">Doanh nghiệp giả định. Agent phải dùng đúng các tham số này khi lập kế hoạch tồn kho.</p>
        </div>
        <Slider id="share" label="Thị phần" value={ctx.share_pct} min={1} max={5} step={0.5} unit="%" onChange={(v) => setCtx({ ...ctx, share_pct: v })} />
        <Slider id="lead" label="Lead time" value={ctx.lead_weeks} min={4} max={20} step={0.5} unit=" tuần" onChange={(v) => setCtx({ ...ctx, lead_weeks: v })} />
        <Slider id="svc" label="Mức dịch vụ" value={ctx.service_level} min={0.85} max={0.995} step={0.005} unit="" onChange={(v) => setCtx({ ...ctx, service_level: v })} />
        {log.length === 0 && (
          <button type="button" onClick={() => setLog(readLog())} className="chip">Xem nhật ký quyết định</button>
        )}
        {log.length > 0 && (
          <div>
            <h3 className="font-serif text-base">Nhật ký quyết định</h3>
            <ul className="mt-2 space-y-2 text-xs text-ink/75">
              {log.slice(0, 4).map((l, i) => (
                <li key={i} className="rounded-lg bg-cream p-2"><span className={l.decision === "chấp nhận" ? "text-good" : "text-warn"}>{l.decision}</span> · {l.at}<br />{l.headline}{l.scenario && <><br /><em>Căn cứ: kịch bản {l.scenario}</em></>}</li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <div className="min-w-0 space-y-5">
        {scn && (
          <section aria-label="Kịch bản đang áp dụng" className="rounded-[20px] border-l-4 border-caramel bg-cream-soft p-5 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-xl">Kịch bản được lấy từ tin tức bạn gửi</h2>
              <button type="button" onClick={() => { setScn(null); setFrom(null); }} className="chip">Gỡ kịch bản</button>
            </div>
            <p className="mt-2 text-sm">Giá Robusta <strong>{scn.price_change_pct}%</strong>, lượng mưa <strong>{scn.rain_mm} mm</strong> so với bình thường{scn.source ? <> · nguồn: {scn.source}</> : null}{from ? <> · chuyển từ trang Tin tức lúc {from.at}</> : null}.</p>
            {scn.signals && scn.signals.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {scn.signals.map((x, i) => (<li key={i} className="border-l-2 border-caramel pl-3 text-ink/80"><strong>{x.driver} {x.direction}{x.magnitude !== null ? ` ${x.magnitude}` : ""}:</strong> “{x.evidence}”</li>))}
              </ul>
            )}
          </section>
        )}
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="rounded-[20px] bg-cream-soft p-5 shadow-[var(--shadow-soft)]">
          <label htmlFor="agent-q" className="font-serif text-xl">Bạn cần quyết định điều gì?</label>
          <div className="mt-3 flex gap-2">
            <input id="agent-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder="Hỏi bất kỳ điều gì về xuất khẩu cà phê…" className="min-w-0 flex-1 rounded-full border border-espresso/25 bg-cream px-4 py-2.5 text-ink" />
            <button type="submit" disabled={busy || !q.trim()} className="pill pill-caramel disabled:opacity-50"><IconPlayerPlay size={18} stroke={2} aria-hidden="true" />{busy ? "Đang làm việc" : "Hỏi agent"}</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUESTIONS.map((s) => (<button key={s} type="button" onClick={() => run(s)} disabled={busy} className="chip text-left disabled:opacity-50">{s}</button>))}
          </div>
          <div className="mt-5 grid gap-4 border-t border-espresso/10 pt-4 md:grid-cols-2">
            <div>
              <h3 className="font-serif text-base">Đính kèm báo cáo hoặc bài báo</h3>
              <p className="mb-2 text-xs text-ink/65">AI đọc tài liệu cùng dữ liệu BeanCast rồi đưa khuyến nghị.</p>
              <FileDrop onLoaded={setDoc} />
              {doc && <p role="status" className="mt-2 text-sm">Đã đính kèm «{doc.name}»{doc.truncated ? " (chỉ lấy phần đầu)" : ""}. <button type="button" onClick={() => setDoc(null)} className="underline">Gỡ</button></p>}
            </div>
            <div>
              <h3 className="font-serif text-base">Dữ liệu của doanh nghiệp (CSV)</h3>
              <p className="mb-2 text-xs text-ink/65">Cột: tháng, lượng bán (tấn), tồn kho cuối tháng (tấn). <a href="/mau-du-lieu-doanh-nghiep.csv" download className="underline">Tải tệp mẫu</a>. Excel thì lưu thành CSV.</p>
              <label className="chip cursor-pointer">Chọn tệp CSV<input type="file" accept=".csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadCsv(f); e.target.value = ""; }} /></label>
              {csvErr && <p role="alert" className="mt-2 text-sm text-warn">{csvErr}</p>}
              {company && (
                <div role="status" className="mt-2 text-sm">
                  Đã nạp «{company.name}»: {company.data.rows.length} tháng.{company.data.share_pct !== null ? ` Thị phần ước tính ${company.data.share_pct}% (đã đặt vào bối cảnh${company.data.share_pct < 1 || company.data.share_pct > 5 ? ", giới hạn trong 1–5%" : ""}).` : ""}
                  {company.data.warnings.map((w) => (<span key={w} className="block text-xs text-warn">{w}</span>))}
                  <button type="button" onClick={() => setCompany(null)} className="underline">Gỡ</button>
                </div>
              )}
            </div>
          </div>
        </form>

        {(steps.length > 0 || busy) && (
          <section aria-label="Các bước agent thực hiện" className="rounded-[20px] bg-cream-soft p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 font-serif text-xl"><IconRobot size={22} stroke={1.8} aria-hidden="true" />Agent đang làm gì</h2>
            <ol className="mt-3 space-y-2">
              {steps.map((s) => (
                <li key={s.n} className="rounded-xl bg-cream p-3 text-sm">
                  <button type="button" onClick={() => setOpen(open === s.n ? null : s.n)} aria-expanded={open === s.n} className="flex w-full items-center gap-2 text-left">
                    <IconTool size={17} stroke={1.8} aria-hidden="true" className="shrink-0 text-caramel" />
                    <span className="font-medium">{s.n}. {TOOL_LABEL[s.name] ?? s.name}</span>
                    <span className="truncate text-ink/60">{JSON.stringify(s.args)}</span>
                    <span className="ml-auto shrink-0 text-xs">{!s.done ? "đang chạy…" : s.ok ? "xong" : "lỗi"}</span>
                    <IconChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform ${open === s.n ? "rotate-180" : ""}`} />
                  </button>
                  {open === s.n && (
                    <div className="mt-2 space-y-1 border-t border-espresso/10 pt-2">
                      {s.source && <p className="text-xs text-ink/70">Nguồn: {s.source}</p>}
                      {s.error && <p className="text-xs text-warn">{s.error}</p>}
                      <pre className="max-h-64 overflow-auto rounded-lg bg-espresso/90 p-3 text-xs text-cream">{JSON.stringify(s.data ?? s.args, null, 2)}</pre>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <div ref={end} />
          </section>
        )}

        {err && <p role="alert" className="rounded-xl bg-warn/15 p-4">{err}</p>}

        {fin && (
          <section aria-label="Khuyến nghị" className="rounded-[20px] bg-cream-soft p-5 shadow-[var(--shadow-soft)]">
            <p className="text-xs uppercase tracking-widest text-ink/60">Khuyến nghị · {fin.mode === "llm" ? "mô hình ngôn ngữ + công cụ" : "bộ luật + công cụ"} · {fin.steps} bước</p>
            {fin.scenario && (
              <p className="mt-2 rounded-xl bg-cream p-3 text-sm">
                <strong>Căn cứ:</strong> kịch bản giá {fin.scenario.price_change_pct}%, mưa {fin.scenario.rain_mm} mm{fin.scenario.source ? ` (${fin.scenario.source})` : ""}. Các bước 1–3 ở trên là công cụ đã chạy đúng hai giá trị này, so với kế hoạch gốc.
              </p>
            )}
            {rec ? (
              <>
                <h2 className="mt-2 text-2xl leading-snug">{rec.headline}</h2>
                {rec.actions.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead><tr className="border-b border-espresso/20"><th className="py-2 pr-3">Việc cần làm</th><th className="py-2 pr-3">Thời điểm</th><th className="py-2">Số lượng</th></tr></thead>
                      <tbody>{rec.actions.map((a, i) => (<tr key={i} className="border-b border-espresso/10"><td className="py-2 pr-3">{a.what}</td><td className="py-2 pr-3">{a.when ?? "—"}</td><td className="py-2">{a.quantity ?? "—"}</td></tr>))}</tbody>
                    </table>
                  </div>
                )}
                <List title="Vì sao" items={rec.reasons} />
                <List title="Rủi ro cần theo dõi" items={rec.risks} />
                <List title="Giả định" items={rec.assumptions} />
                <p className="mt-3 text-sm">Độ tin cậy của khuyến nghị: <strong>{rec.confidence}</strong></p>
              </>
            ) : (
              <p className="mt-2 whitespace-pre-line leading-relaxed">{fin.text}</p>
            )}
            <div className="mt-4 rounded-xl bg-cream p-3 text-sm">
              {fin.general ? "Câu trả lời này đến từ kiến thức chung của mô hình ngôn ngữ, không lấy từ dữ liệu BeanCast nên chưa được đối chiếu số liệu. Hãy kiểm chứng với nguồn chính thức trước khi dùng." : fin.grounding.checked === 0 ? "Không có con số nào cần đối chiếu." : fin.grounding.unmatched.length === 0 ? `Kiểm tra đối chiếu: cả ${fin.grounding.matched}/${fin.grounding.checked} con số đều khớp kết quả công cụ.` : `Cảnh báo: ${fin.grounding.unmatched.length} con số không tìm thấy trong kết quả công cụ (${fin.grounding.unmatched.join(", ")}). Hãy kiểm tra lại trước khi dùng.`}
              {fin.sources.length > 0 && <div className="mt-1 text-xs text-ink/65">Nguồn: {fin.sources.join(" · ")}</div>}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {decided ? (
                <p className="text-sm" role="status">Đã ghi vào nhật ký: {decided}.</p>
              ) : (
                <>
                  <button type="button" onClick={() => decide("chấp nhận")} className="pill pill-caramel"><IconCheck size={18} stroke={2} aria-hidden="true" />Chấp nhận khuyến nghị</button>
                  <button type="button" onClick={() => decide("từ chối")} className="pill border-[1.5px] border-espresso/40"><IconX size={18} stroke={2} aria-hidden="true" />Không đồng ý</button>
                </>
              )}
              <span className="text-xs text-ink/60">Quyết định cuối cùng thuộc về con người; nhật ký chỉ lưu trên trình duyệt này.</span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <h3 className="font-serif text-base">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{items.map((t, i) => (<li key={i}>{t}</li>))}</ul>
    </div>
  );
}

function Slider({ id, label, value, min, max, step, unit, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-sm"><span>{label}</span><strong>{value.toLocaleString("vi-VN")}{unit}</strong></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-caramel)]" />
    </div>
  );
}
