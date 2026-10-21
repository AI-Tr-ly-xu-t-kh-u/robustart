"use client";
import { useEffect, useRef, useState } from "react";
import type { ECharts, EChartsCoreOption } from "echarts/core";

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Props {
  option: EChartsCoreOption;
  height?: number | string;
  ariaLabel: string;
  /** Đăng ký sự kiện (vd. click); trả về hàm dọn dẹp. */
  onReady?: (chart: ECharts) => (() => void) | void;
  /** Mô tả văn bản thay thế cho trình đọc màn hình */
  summary?: string;
  /** "map" nạp thêm module bản đồ */
  kind?: "basic" | "map";
}

/** Biểu đồ ECharts nạp lười: chỉ tải thư viện và vẽ khi khối vào gần màn hình, giúp trang nhẹ hơn. */
export function EChart({ option, height = 340, ariaLabel, onReady, summary, kind = "basic" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<ECharts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setTimeout(() => setVisible(true), 0);
      return;
    }
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setVisible(true), io.disconnect()), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !ref.current) return;
    let disposed = false;
    let inst: ECharts | null = null;
    let off: (() => void) | void;
    let ro: ResizeObserver | null = null;
    (kind === "map" ? import("./echarts-map") : import("./echarts-setup"))
      .then(({ echarts }) => {
        if (disposed || !ref.current) return;
        inst = echarts.init(ref.current, undefined, { renderer: "canvas" });
        off = readyRef.current?.(inst);
        ro = new ResizeObserver(() => inst?.resize());
        ro.observe(ref.current);
        setChart(inst);
      })
      .catch((e) => !disposed && setError(e instanceof Error ? e.message : "Không vẽ được biểu đồ"));
    return () => {
      disposed = true;
      ro?.disconnect();
      if (typeof off === "function") off();
      inst?.dispose();
      setChart(null);
    };
  }, [visible, kind]);

  useEffect(() => {
    chart?.setOption({ animation: !reducedMotion(), animationDuration: 900, textStyle: { fontFamily: "var(--font-manrope), system-ui, sans-serif" }, ...option }, true);
  }, [chart, option]);

  if (error) return <div role="alert" className="rounded-xl bg-bad/10 p-4 text-sm text-bad">Không vẽ được biểu đồ: {error}</div>;
  return (
    <>
      <div className="relative" style={{ height, width: "100%" }}>
        <div ref={ref} role="img" aria-label={ariaLabel} style={{ height: "100%", width: "100%" }} />
        {!chart && <div className="skeleton absolute inset-0" aria-hidden="true" />}
      </div>
      {summary && <p className="sr-only">{summary}</p>}
    </>
  );
}
