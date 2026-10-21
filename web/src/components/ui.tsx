"use client";
import { useEffect, useState, type ReactNode } from "react";
import { IconBulb, type Icon } from "@tabler/icons-react";
import { fmt } from "@/lib/format";

/** Số đếm lên khi xuất hiện; tôn trọng prefers-reduced-motion. */
export function CountUp({ value, digits = 1, suffix = "", prefix = "", format }: { value: number; digits?: number; suffix?: string; prefix?: string; format?: (n: number) => string }) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1100;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const text = format ? format(v) : fmt(v, digits);
  const full = format ? format(value) : fmt(value, digits);
  return (
    <span className="tnum">
      <span className="sr-only">{prefix}{full}{suffix}</span>
      <span aria-hidden="true">{prefix}{text}{suffix}</span>
    </span>
  );
}

/** Thẻ biểu đồ: tiêu đề, nội dung, chú thích; luôn có nhãn «Đang dùng dữ liệu mẫu» ở chân khi dữ liệu là mock. */
export function ChartCard({ title, subtitle, children, footnote, actions, id, icon: Ic, insight }: { title: string; subtitle?: string; children: ReactNode; footnote?: ReactNode; actions?: ReactNode; id?: string; icon?: Icon; insight?: ReactNode }) {
  return (
    <section id={id} className="card reveal-up" aria-labelledby={id ? `${id}-t` : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id ? `${id}-t` : undefined} className="flex items-center gap-2 text-2xl">{Ic && <Ic size={26} stroke={1.7} className="text-caramel-deep" aria-hidden="true" />}{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
      {insight && (
        <p className="mt-4 flex gap-3 rounded-2xl border-l-4 border-caramel bg-cream p-4 text-[0.95rem] leading-relaxed">
          <IconBulb size={22} stroke={1.7} className="mt-0.5 shrink-0 text-caramel-deep" aria-hidden="true" />
          <span>{insight}</span>
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        {footnote}
      </div>
    </section>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-leaf" />
      {label}
    </label>
  );
}

export function Skeleton({ h = 200 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h }} aria-hidden="true" />;
}

export function Stat({ label, value, note, tone, icon: Ic }: { label: string; value: ReactNode; note?: ReactNode; tone?: "good" | "bad"; icon?: Icon }) {
  return (
    <div className="rounded-2xl bg-cream p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">{Ic && <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-espresso text-caramel"><Ic size={16} stroke={1.8} aria-hidden="true" /></span>}{label}</div>
      <div className={`mt-1 font-serif text-3xl ${tone === "good" ? "text-ok" : tone === "bad" ? "text-bad" : ""}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  );
}
