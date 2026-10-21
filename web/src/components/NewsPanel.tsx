"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconNews, IconSparkles } from "@tabler/icons-react";
import { getData } from "@/lib/data";
import { runTool } from "@/lib/tools";
import { FileDrop } from "./FileDrop";
import { saveHandoff, takeNews } from "@/lib/handoff";
import { SAMPLE_NEWS, type NewsScenario, type Signal } from "@/lib/news";

interface Analysis { mode: "llm" | "rules"; signals: Signal[]; dropped: number; scenario: NewsScenario }
interface Sc { delta_6_months_pct: number; total_6_months_kt: number; base_total_6_months_kt: number; delta_next_3_months_pct: number }
interface Inv { order_up_to_tons: number; safety_stock_tons: number; inbound_first_3_months_tons: number; inbound_last_3_months_tons: number }

const d = getData();
const DRIVER: Record<Signal["driver"], string> = { price: "Giá", rain: "Mưa", other: "Yếu tố khác" };
const fmt = (n: number, k = 1) => n.toLocaleString("vi-VN", { maximumFractionDigits: k });

function evaluate(price: number, rain: number) {
  const sc = runTool("run_scenario", { price_change_pct: price, rain_mm: rain }, d);
  const inv = runTool("plan_inventory", { price_change_pct: price, rain_mm: rain }, d);
  const base = runTool("plan_inventory", {}, d);
  if (!sc.ok || !inv.ok || !base.ok) return null;
  return { sc: sc.data as Sc, inv: inv.data as Inv, base: base.data as Inv };
}

export function NewsPanel() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState("");
  const router = useRouter();
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const t = takeNews();
    if (!t) return;
    // nhận nội dung tra cứu từ chatbot (sessionStorage) một lần khi mở trang
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(t); setNote("Đã nhận nội dung từ trợ lý tra cứu trực tiếp. Bạn có thể sửa trước khi phân tích.");
  }, []);

  function askAgent() {
    if (!res) return;
    const p = Math.round(price * 10) / 10;
    saveHandoff({
      question: `Với kịch bản từ tin tức (giá Robusta ${p}%, mưa ${rain} mm so với bình thường), kế hoạch đặt hàng và tồn kho của tôi nên thay đổi thế nào?`,
      scenario: {
        price_change_pct: p, rain_mm: rain,
        source: fileName ? `tệp «${fileName}»` : "bản tin do người dùng dán",
        signals: res.signals.slice(0, 6).map((s) => ({ driver: s.driver, direction: s.direction, magnitude: s.magnitude, evidence: s.evidence.slice(0, 400) })),
      },
      excerpt: text.slice(0, 240),
      at: new Date().toLocaleString("vi-VN"),
    });
    router.push("/tro-ly");
  }
  const [res, setRes] = useState<Analysis | null>(null);
  const [price, setPrice] = useState(0);
  const [rain, setRain] = useState(0);

  async function analyze() {
    if (busy || text.trim().length < 20) return;
    setBusy(true); setErr(""); setRes(null);
    try {
      const r = await fetch("/api/news", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Không phân tích được bản tin");
      setRes(j); setPrice(j.scenario.price_change_pct); setRain(j.scenario.rain_mm);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  const out = res ? evaluate(price, rain) : null;
  return (
    <div className="space-y-6">
      <section className="rounded-[20px] bg-cream-soft p-5 shadow-[var(--shadow-soft)]">
        <label htmlFor="news-text" className="font-serif text-xl">Tải báo cáo hoặc dán một bản tin cà phê</label>
        <div className="mt-3"><FileDrop onLoaded={(f) => { setText(f.text); setFileName(f.name); setNote(`Đã đọc «${f.name}»${f.truncated ? " (chỉ lấy phần đầu 20.000 ký tự)" : ""}. Bạn có thể sửa nội dung trước khi phân tích.`); }} /></div>
        {note && <p role="status" className="mt-2 text-sm text-ink/75">{note}</p>}
        <textarea id="news-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={20000} placeholder="Dán đoạn tin về giá Robusta, thời tiết Tây Nguyên, cước vận tải, quy định nhập khẩu…" className="mt-3 w-full rounded-2xl border border-espresso/25 bg-cream p-4 text-ink" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={analyze} disabled={busy || text.trim().length < 20} className="pill pill-caramel disabled:opacity-50"><IconSparkles size={18} stroke={2} aria-hidden="true" />{busy ? "Đang đọc tin…" : "AI đọc tin và chỉnh kịch bản"}</button>
          <span className="text-sm text-ink/70">Bản tin mẫu (do nhóm soạn, không phải tin thật):</span>
          {SAMPLE_NEWS.map((s) => (<button key={s.title} type="button" onClick={() => { setText(s.text); setFileName(""); }} className="chip">{s.title}</button>))}
        </div>
      </section>

      {err && <p role="alert" className="rounded-xl bg-warn/15 p-4">{err}</p>}

      {res && (
        <>
          <section className="rounded-[20px] bg-cream-soft p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 font-serif text-xl"><IconNews size={22} stroke={1.8} aria-hidden="true" />Tín hiệu AI rút ra ({res.mode === "llm" ? "mô hình ngôn ngữ" : "bộ luật từ khóa"})</h2>
            {res.signals.length === 0 ? (
              <p className="mt-2 text-sm">Không tìm thấy tín hiệu nào liên quan đến giá, mưa hay yếu tố khác trong bản tin.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {res.signals.map((s, i) => (
                  <li key={i} className="rounded-xl bg-cream p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{DRIVER[s.driver]} {s.direction === "up" ? "tăng" : "giảm"}</strong>
                      <span className="chip">{s.magnitude === null ? "chưa rõ mức độ, không đưa vào kịch bản" : `${fmt(s.magnitude)}${s.driver === "price" ? "%" : " mm"}`}</span>
                    </div>
                    <blockquote className="mt-1 border-l-2 border-caramel pl-3 text-ink/75">“{s.evidence}”</blockquote>
                    {s.rationale && <p className="mt-1 text-ink/70">{s.rationale}</p>}
                  </li>
                ))}
              </ul>
            )}
            {res.dropped > 0 && <p className="mt-2 text-xs text-ink/60">Đã loại {res.dropped} tín hiệu vì phần trích dẫn không có trong bản tin.</p>}
            {res.scenario.clamped && <p className="mt-2 text-xs text-warn">Mức thay đổi vượt miền kịch bản hỗ trợ nên đã bị giới hạn (giá ±20%, mưa ±100 mm).</p>}
          </section>

          <section className="rounded-[20px] bg-cream-soft p-5 shadow-[var(--shadow-soft)]">
            <h2 className="font-serif text-xl">Kịch bản đề xuất (bạn có thể chỉnh)</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">Giá Robusta: <strong>{fmt(price)}%</strong>
                <input type="range" min={-20} max={20} step={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-caramel)]" />
              </label>
              <label className="block text-sm">Mưa lệch bình thường: <strong>{fmt(rain, 0)} mm</strong>
                <input type="range" min={-100} max={100} step={5} value={rain} onChange={(e) => setRain(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-caramel)]" />
              </label>
            </div>
            {out && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Card label="Nhu cầu 6 tháng" before={`${fmt(out.sc.base_total_6_months_kt)} kt`} after={`${fmt(out.sc.total_6_months_kt)} kt`} note={`${out.sc.delta_6_months_pct > 0 ? "+" : ""}${fmt(out.sc.delta_6_months_pct)}%`} />
                <Card label="Mức tồn kho tối đa" before={`${fmt(out.base.order_up_to_tons, 0)} tấn`} after={`${fmt(out.inv.order_up_to_tons, 0)} tấn`} note="doanh nghiệp giả định" />
                <Card label="Cần về kho 3 tháng đầu" before={`${fmt(out.base.inbound_first_3_months_tons, 0)} tấn`} after={`${fmt(out.inv.inbound_first_3_months_tons, 0)} tấn`} note="thay đổi so với gốc" />
              </div>
            )}
            <p className="mt-4 text-sm text-ink/70">Tin tức chỉ là gợi ý để chỉnh kịch bản; chưa có kiểm chứng rằng tin dẫn đến mức thay đổi này, nên hãy xem đây là giả định để bạn quyết định.</p>
            <button type="button" onClick={askAgent} className="pill pill-caramel mt-3">Hỏi agent về kế hoạch với kịch bản này</button>
          </section>
          {res.scenario.unquantified.length > 0 && (
            <section className="rounded-[20px] bg-cream-soft p-5 shadow-[var(--shadow-soft)]">
              <h2 className="font-serif text-xl">Chưa thể định lượng</h2>
              <p className="mt-1 text-sm text-ink/75">Các tin sau ảnh hưởng đến quyết định nhưng BeanCast không có số liệu tương ứng, nên được ghi nhận để con người cân nhắc chứ không đưa vào con số.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{res.scenario.unquantified.map((s, i) => (<li key={i}>{s.evidence}</li>))}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Card({ label, before, after, note }: { label: string; before: string; after: string; note: string }) {
  return (
    <div className="rounded-2xl bg-cream p-4">
      <div className="text-xs uppercase tracking-widest text-ink/60">{label}</div>
      <div className="mt-1 text-sm text-ink/70">Gốc: {before}</div>
      <div className="font-serif text-2xl">{after}</div>
      <div className="text-xs text-ink/60">{note}</div>
    </div>
  );
}
