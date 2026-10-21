"use client";
import { useRef, useState } from "react";
import { IconFileUpload } from "@tabler/icons-react";

export interface Loaded { name: string; text: string; truncated: boolean }

/** Chọn PDF, Word, TXT, MD hoặc CSV; máy chủ rút văn bản (không lưu tệp) rồi trả về cho trang. */
export function FileDrop({ onLoaded, label = "Tải tài liệu (PDF, Word, TXT, CSV)" }: { onLoaded: (f: Loaded) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);

  async function send(file: File) {
    setBusy(true); setErr("");
    try {
      const body = new FormData();
      body.set("file", file);
      const r = await fetch("/api/extract", { method: "POST", body });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Không đọc được tệp");
      onLoaded({ name: j.name, text: j.text, truncated: j.truncated });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không đọc được tệp");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) send(f); }}
        className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-sm ${over ? "border-caramel bg-caramel/10" : "border-espresso/30"}`}>
        <IconFileUpload size={26} stroke={1.6} className="text-caramel-deep" aria-hidden="true" />
        <span className="min-w-0 flex-1">Kéo tệp vào đây hoặc chọn tệp. Tệp chỉ được đọc để phân tích, không lưu lại (tối đa 5 MB; AI đọc khoảng 6.000 ký tự đầu).</span>
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="chip disabled:opacity-50">{busy ? "Đang đọc tệp…" : label}</button>
        <input ref={input} type="file" accept=".pdf,.docx,.txt,.md,.csv" className="sr-only" aria-label={label} onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); }} />
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-warn">{err}</p>}
    </div>
  );
}
