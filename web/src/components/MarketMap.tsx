"use client";
import Link from "next/link";
import { IconArrowRight, IconTrophy, IconWorld } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import type { ECharts } from "echarts/core";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection } from "geojson";
import { EChart } from "./EChart";
import { mapOption } from "./charts";
import { useMarket } from "./MarketContext";
import { ChartCard, Segmented } from "./ui";
import { getData } from "@/lib/data";
import { mapInsight } from "@/lib/chart-insights";
import { horizonSum, marketRanking } from "@/lib/derived";
import { fmt, signedPct } from "@/lib/format";
import { MARKET_LABEL, type Market } from "@/lib/constants";

const EU27 = ["Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"];
const COUNTRIES: Record<string, string[]> = { EU: EU27, US: ["United States of America"], JP: ["Japan"], KR: ["South Korea"], CN: ["China"] };
const MARKETS5 = ["EU", "US", "JP", "KR", "CN"] as const;

/** Bỏ các đa giác vắt qua kinh tuyến 180° (Nga, Fiji, Nam Cực) vì ECharts vẽ thành dải ngang xuyên bản đồ. */
function stripAntimeridian(geo: FeatureCollection) {
  const span = (ring: number[][]) => Math.max(...ring.map((c) => c[0])) - Math.min(...ring.map((c) => c[0]));
  for (const f of geo.features) {
    const g = f.geometry;
    if (g.type === "Polygon") {
      if (span(g.coordinates[0]) > 180) g.coordinates = [];
    } else if (g.type === "MultiPolygon") {
      g.coordinates = g.coordinates.filter((p) => span(p[0]) <= 180);
    }
  }
}

export function MarketMap() {
  const d = getData();
  const { setMarket, market } = useMarket();
  const [metric, setMetric] = useState<"vol" | "yoy">("vol");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Market | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([import("world-atlas/countries-110m.json"), import("./echarts-map")])
      .then(([m, { echarts }]) => {
        const topo = (m.default ?? m) as unknown as Topology;
        const geo = feature(topo, topo.objects.countries) as unknown as FeatureCollection;
        stripAntimeridian(geo);
        echarts.registerMap("world", geo as never);
        if (!cancelled) setReady(true);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Không nạp được bản đồ"));
    return () => { cancelled = true; };
  }, []);

  const values = useMemo(() => {
    const out: Record<string, { name: string; value: number; extra: string }> = {};
    for (const m of MARKETS5) {
      const h = horizonSum(d, m, 3);
      out[m] = {
        name: m === "EU" ? "EU-27 (gộp)" : MARKET_LABEL[m],
        value: metric === "vol" ? h.p50 : h.change * 100,
        extra: `Dự báo 3 tháng tới: <b>${fmt(h.p50, 1)} kt</b> (khoảng 80%: ${fmt(h.p10, 1)}–${fmt(h.p90, 1)} kt)<br/>So với cùng kỳ năm trước: <b>${signedPct(h.change)}</b>`,
      };
    }
    return out;
  }, [d, metric]);

  const option = useMemo(() => mapOption(values, metric, COUNTRIES), [values, metric]);
  const rank = marketRanking(d, 3);

  const onReady = (c: ECharts) => {
    const h = (p: { data?: { market?: Market } }) => {
      const m = p.data?.market;
      if (m) { setMarket(m); setPicked(m); }
    };
    c.on("click", h as never);
    return () => c.off("click", h as never);
  };

  return (
    <div className="bg-cream text-ink">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <ChartCard icon={IconWorld} id="ban-do" title="Bản đồ xuất khẩu theo thị trường" subtitle="Dự báo 3 tháng tới của EU-27, Mỹ, Nhật, Hàn Quốc và Trung Quốc"
          insight={mapInsight(d)}
          actions={<Segmented label="Chỉ số tô màu" value={metric} onChange={setMetric} options={[{ value: "vol", label: "Khối lượng dự báo (kt)" }, { value: "yoy", label: "% so với cùng kỳ năm trước" }]} />}
          footnote={<span>EU-27 tô chung (Malta quá nhỏ nên không hiện trên bản đồ độ phân giải thấp). Các nước khác chưa có dữ liệu riêng nên để màu nền.</span>}>
          {error ? <p role="alert" className="rounded-xl bg-bad/10 p-4 text-bad">Không nạp được bản đồ: {error}</p>
            : !ready ? <div className="skeleton h-[420px]" aria-label="Đang tải bản đồ" />
            : <EChart kind="map" option={option} height={460} ariaLabel="Bản đồ thế giới tô màu theo dự báo xuất khẩu" onReady={onReady}
                summary={rank.map((r) => `${MARKET_LABEL[r.market]}: ${fmt(r.p50, 1)} kt, ${signedPct(r.change)}`).join("; ")} />}
          {picked && (
            <p role="status" className="mt-3 rounded-2xl bg-leaf/10 p-3 text-sm">Đã chọn <strong>{MARKET_LABEL[picked]}</strong>. <Link href="/du-bao#du-bao-nhu-cau" className="font-semibold underline">Xem biểu đồ dự báo<IconArrowRight size={16} stroke={2} className="ml-1 inline" aria-hidden="true" /></Link></p>
          )}
        </ChartCard>

        <section className="card" aria-labelledby="xep-hang">
          <h2 id="xep-hang" className="flex items-center gap-2 text-2xl"><IconTrophy size={26} stroke={1.7} className="text-caramel-deep" aria-hidden="true" />Xếp hạng thị trường</h2>
          <p className="mt-1 text-sm text-muted">Theo mức thay đổi dự báo 3 tháng tới so với cùng kỳ năm trước. Bấm để chọn thị trường ở biểu đồ dự báo.</p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {rank.map((r, i) => (
              <li key={r.market}>
                <Link href="/du-bao#du-bao-nhu-cau" onClick={() => setMarket(r.market)} aria-current={market === r.market ? "true" : undefined}
                  className={`block rounded-2xl p-4 transition-transform hover:-translate-y-1 ${market === r.market ? "bg-espresso text-cream" : "bg-cream"}`}>
                  <div className="text-xs font-semibold opacity-70">#{i + 1}</div>
                  <div className="font-serif text-xl">{MARKET_LABEL[r.market].replace(" (EU-27)", "")}</div>
                  <div className={`mt-1 text-2xl font-semibold ${r.change >= 0 ? (market === r.market ? "text-ok-light" : "text-leaf") : market === r.market ? "text-bad-light" : "text-bad"}`}>{signedPct(r.change)}</div>
                  <div className="text-xs opacity-75">{fmt(r.p50, 1)} kt · khoảng {fmt(r.p10, 0)}–{fmt(r.p90, 0)}</div>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
