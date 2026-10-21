"use client";
import { useEffect, useRef, useState } from "react";
import { IconMessageChatbot, IconSend, IconSparkles, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { saveNews } from "@/lib/handoff";

const WEB_SUGGESTIONS = [
  "Giá cà phê Robusta London hôm nay?",
  "Tin mới nhất về EUDR với cà phê?",
  "Cước container đi châu Âu đang thế nào?",
  "Thời tiết Tây Nguyên tuần này ra sao?",
];

interface Msg {
  role: "user" | "bot";
  text: string;
  sources?: string[];
  refused?: boolean;
  mode?: "rules" | "llm" | "web";
  general?: boolean;
  links?: { title: string; url: string }[];
  offline?: boolean;
}

export function ChatWidget({ compact = false, onClose }: { compact?: boolean; onClose?: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "bot", text: "Xin chào! Tôi tra cứu trực tiếp trên web: giá cà phê, tin tức, thời tiết, cước vận tải, quy định. Câu trả lời kèm nguồn để bạn kiểm tra." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const end = useRef<HTMLDivElement>(null);

  function toNews(text: string) {
    saveNews(text);
    router.push("/tin-tuc");
  }
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Có lỗi xảy ra");
      setMsgs((m) => [...m, { role: "bot", text: j.answer, sources: j.sources, refused: j.refused, mode: j.mode, general: j.general, links: j.links, offline: j.offline }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "bot", text: e instanceof Error ? e.message : "Không kết nối được trợ lý, vui lòng thử lại.", refused: true }]);
    } finally {
      setBusy(false);
    }
  }

  const inputId = compact ? "chat-fab-input" : "chat-input";
  return (
    <div className={`flex flex-col ${compact ? "h-[min(70vh,34rem)]" : "min-h-[32rem]"}`}>
      <div className="flex items-center justify-between rounded-t-[20px] bg-roast px-4 py-3 text-cream">
        <div>
          <div className="flex items-center gap-2 font-serif text-lg"><IconMessageChatbot size={22} stroke={1.8} aria-hidden="true" />Tra cứu trực tiếp</div>
          <div className="text-xs text-cream/70">Tìm kiếm web theo thời gian thực</div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="chip border-cream text-cream" aria-label="Đóng trợ lý">
            <IconX size={15} stroke={2} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Cuộc trò chuyện">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[92%] whitespace-pre-line rounded-2xl px-4 py-3 text-[0.93rem] leading-relaxed ${m.role === "user" ? "bg-espresso text-cream" : m.refused ? "bg-warn/15 text-ink" : "bg-cream text-ink"}`}>
              {m.text}
              {m.role === "bot" && m.general && <p className="mt-2 border-t border-espresso/15 pt-2 text-xs text-muted">Trả lời từ kiến thức chung của mô hình ngôn ngữ, không lấy từ dữ liệu BeanCast.</p>}
              {m.role === "bot" && m.mode === "web" && (
                <div className="mt-2 border-t border-espresso/15 pt-2 text-xs text-muted">
                  {m.links && m.links.length > 0 && (
                    <ul className="space-y-1">
                      {m.links.map((l) => (<li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer" className="underline">{l.title}</a></li>))}
                    </ul>
                  )}
                  <button type="button" onClick={() => toNews(m.text)} className="chip mt-2">Đưa vào Tin tức để chỉnh kịch bản</button>
                </div>
              )}
              {m.role === "bot" && m.offline && <p className="mt-2 border-t border-espresso/15 pt-2 text-xs text-muted">Chưa tra cứu trực tuyến được (mất kết nối hoặc hết hạn mức), đây là trả lời từ dữ liệu có sẵn.</p>}
              {m.role === "bot" && m.sources && m.sources.length > 0 && (
                <p className="mt-2 border-t border-espresso/15 pt-2 text-xs text-muted">
                  <strong>Nguồn:</strong> {m.sources.join(" · ")}
                  {m.mode ? ` · ${m.mode === "llm" ? "mô hình ngôn ngữ" : "bộ luật"}` : ""}
                </p>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="skeleton h-10 w-40" aria-label="Đang trả lời" />}
        <div ref={end} />
      </div>
      <div className="flex flex-wrap gap-2 px-4 pb-2">
        {WEB_SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip gap-1.5 text-left" onClick={() => ask(s)} disabled={busy}>
            <IconSparkles size={14} stroke={2} aria-hidden="true" />{s}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 p-4 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          Câu hỏi
        </label>
        <input id={inputId} value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder="Hỏi về dự báo, thị trường, tồn kho…" className="min-w-0 flex-1 rounded-full border-[1.5px] border-espresso/40 bg-white px-4 py-2.5 text-sm" />
        <button type="submit" className="pill pill-dark" disabled={busy || !input.trim()}>
          <IconSend size={17} stroke={2} aria-hidden="true" />Gửi
        </button>
      </form>
    </div>
  );
}
