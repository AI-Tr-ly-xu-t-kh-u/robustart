"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { IconRoute, IconShip } from "@tabler/icons-react";
import { EChart } from "./EChart";
import { COLORS } from "./charts";
import { ChartCard, Stat } from "./ui";
import { getData } from "@/lib/data";
import { DEFAULT_ROUTES, evaluateRoutes, freightOutlook, pickRoutes, type RouteOption } from "@/lib/logistics";
import { fmt, monthLabel, signedPct } from "@/lib/format";

const d = getData();

export function Logistics() {
  const fo = freightOutlook(d);
  const n = d.history.month.length;
  const k = 36;
  const freightOption = {
    color: [COLORS.caramel],
    tooltip: { trigger: "axis" },
    grid: { left: 48, right: 16, top: 24, bottom: 30 },
    xAxis: { type: "category", data: d.history.month.slice(n - k).map(monthLabel), axisLabel: { color: COLORS.axis, interval: 5 } },
    yAxis: { type: "value", scale: true, name: "điểm", axisLabel: { color: COLORS.axis }, splitLine: { lineStyle: { color: COLORS.grid } } },
    series: [{ name: "Chỉ số cước", type: "line", data: d.history.freight_idx.slice(n - k), showSymbol: false, lineStyle: { width: 3 } }],
  };
  const freightInsight = `Chỉ số cước hiện ${fmt(fo.latest, 0)} điểm, ${signedPct(fo.change_3m_pct / 100, 0)} so với 3 tháng trước và ${signedPct(fo.change_12m_pct / 100, 0)} so với một năm trước. Theo mùa, cước thường cao vào ${fo.high_months.join(" và ")} và thấp vào ${fo.low_months.join(" và ")}: hãy đặt chỗ tàu sớm cho các lô rơi vào tháng cao và dồn các lô linh hoạt về tháng thấp.`;

  const [tons, setTons] = useState(500);
  const [routes, setRoutes] = useState<RouteOption[]>(DEFAULT_ROUTES);
  const res = useMemo(() => evaluateRoutes(routes, tons), [routes, tons]);
  const pick = pickRoutes(res);
  const routeOption = {
    color: [COLORS.espresso, COLORS.leaf],
    tooltip: { trigger: "axis" },
    legend: { top: 0, textStyle: { color: COLORS.axis } },
    grid: { left: 48, right: 48, top: 40, bottom: 30 },
    xAxis: { type: "category", data: res.map((r) => r.id), axisLabel: { color: COLORS.axis } },
    yAxis: [
      { type: "value", name: "USD/tấn", axisLabel: { color: COLORS.axis }, splitLine: { lineStyle: { color: COLORS.grid } } },
      { type: "value", name: "kg CO2/tấn", axisLabel: { color: COLORS.axis }, splitLine: { show: false } },
    ],
    series: [
      { name: "Chi phí (USD/tấn)", type: "bar", data: res.map((r) => r.usd_per_ton), itemStyle: { borderRadius: [6, 6, 0, 0] } },
      { name: "Khí thải (kg CO2/tấn)", type: "line", yAxisIndex: 1, data: res.map((r) => r.co2_kg_per_ton), symbolSize: 9, lineStyle: { width: 3 } },
    ],
  };
  const routeInsight = `Cho lô ${fmt(tons, 0)} tấn: rẻ nhất là «${pick.cheapest.name}» (${fmt(pick.cheapest.usd_per_ton, 1)} USD/tấn), ít khí thải nhất là «${pick.greenest.name}» (${fmt(pick.greenest.co2_kg_per_ton, 1)} kg CO2/tấn). Tuyến cân bằng hai tiêu chí là «${pick.balanced.name}». Khi cước tàu cao, hãy ưu tiên tuyến ít chuyển tải để tránh phí phát sinh.`;

  const setLeg = (ri: number, li: number, key: "km" | "usd_per_tkm" | "g_co2_per_tkm", v: number) =>
    setRoutes((rs) => rs.map((r, i) => (i !== ri ? r : { ...r, legs: r.legs.map((l, j) => (j !== li ? l : { ...l, [key]: Math.max(0, v) })) })));
  const setFixed = (ri: number, v: number) => setRoutes((rs) => rs.map((r, i) => (i !== ri ? r : { ...r, fixed_usd_per_t: Math.max(0, v) })));

  return (
    <div className="bg-cream text-ink">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card"><Stat icon={IconShip} label="Chỉ số cước hiện tại" value={`${fmt(fo.latest, 0)} điểm`} note={`TB 12 tháng: ${fmt(fo.avg_12m, 0)} điểm`} /></div>
          <div className="card"><Stat icon={IconShip} label="So với 3 tháng trước" value={signedPct(fo.change_3m_pct / 100, 1)} tone={fo.change_3m_pct > 0 ? "bad" : "good"} note="cước tăng là chi phí tăng" /></div>
          <div className="card"><Stat icon={IconShip} label="Tháng cước thường cao" value={fo.high_months.join(", ")} note={`Thường thấp: ${fo.low_months.join(", ")}`} /></div>
        </div>

        <ChartCard icon={IconShip} id="cuoc" title="Cước vận tải 36 tháng gần nhất" subtitle="Chỉ số cước theo tháng" insight={freightInsight}
          footnote={<span>Mùa vụ cước tính từ các năm đủ 12 tháng trong dữ liệu. Chưa có dữ liệu về tắc nghẽn cảng hay lịch EUDR, hãy tải thông báo vào trang <Link href="/tin-tuc" className="underline">Tin tức</Link> hoặc hỏi <Link href="/tro-ly" className="underline">Trợ lý</Link>.</span>}>
          <EChart option={freightOption} height={300} ariaLabel="Đường chỉ số cước vận tải" summary={`Chỉ số cước hiện ${fmt(fo.latest, 0)} điểm.`} />
        </ChartCard>

        <ChartCard icon={IconRoute} id="tuyen" title="Chọn tuyến vận chuyển từ kho ra cảng" subtitle="So sánh chi phí và khí thải theo tuyến cho một lô hàng" insight={routeInsight}
          actions={<label className="flex items-center gap-2 text-sm">Lô hàng (tấn)<input type="number" min={10} max={5000} value={tons} onChange={(e) => setTons(Math.min(5000, Math.max(10, Number(e.target.value) || 10)))} className="w-24 rounded-full border border-espresso/25 bg-cream px-3 py-1.5" /></label>}
          footnote={<span>Quãng đường, đơn giá và hệ số khí thải trong bảng là giả định minh họa, không phải báo giá hay đo đạc thật. Bạn sửa được ngay trong bảng.</span>}>
          <EChart option={routeOption} height={280} ariaLabel="Chi phí và khí thải theo tuyến" summary={`Tuyến rẻ nhất: ${pick.cheapest.name}`} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">Bảng so sánh tuyến vận chuyển</caption>
              <thead><tr className="text-left text-muted"><th className="py-1 pr-3">Mã</th><th className="pr-3">Tuyến</th><th className="pr-3">Km</th><th className="pr-3">USD/tấn</th><th className="pr-3">Tổng chi phí</th><th className="pr-3">kg CO2/tấn</th><th>Thêm ngày</th></tr></thead>
              <tbody>
                {res.map((r) => (
                  <tr key={r.id} className={`border-t border-espresso/10 ${r.id === pick.balanced.id ? "bg-leaf/10" : ""}`}>
                    <td className="py-1.5 pr-3 font-semibold">{r.id}</td>
                    <td className="pr-3">{r.name}{r.id === pick.cheapest.id ? " · rẻ nhất" : ""}{r.id === pick.greenest.id ? " · ít khí thải nhất" : ""}</td>
                    <td className="pr-3">{fmt(r.total_km, 0)}</td><td className="pr-3 font-semibold">{fmt(r.usd_per_ton, 1)}</td>
                    <td className="pr-3">{fmt(r.total_usd, 0)} USD</td><td className="pr-3">{fmt(r.co2_kg_per_ton, 1)}</td><td>{r.extra_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="mt-4 rounded-2xl bg-cream p-4 text-sm">
            <summary className="cursor-pointer font-semibold">Sửa giả định (quãng đường, đơn giá, khí thải, phí cố định)</summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {routes.map((r, ri) => (
                <fieldset key={r.id} className="rounded-xl bg-cream-soft p-3">
                  <legend className="px-1 font-semibold">{r.id}: {r.name}</legend>
                  {r.legs.map((l, li) => (
                    <div key={li} className="mt-2 grid grid-cols-3 gap-2">
                      <label className="text-xs">Km ({l.mode})<input type="number" value={l.km} min={0} onChange={(e) => setLeg(ri, li, "km", Number(e.target.value))} className="mt-0.5 w-full rounded-lg border border-espresso/25 bg-cream px-2 py-1" /></label>
                      <label className="text-xs">USD/tấn-km<input type="number" step={0.005} value={l.usd_per_tkm} min={0} onChange={(e) => setLeg(ri, li, "usd_per_tkm", Number(e.target.value))} className="mt-0.5 w-full rounded-lg border border-espresso/25 bg-cream px-2 py-1" /></label>
                      <label className="text-xs">g CO2/tấn-km<input type="number" value={l.g_co2_per_tkm} min={0} onChange={(e) => setLeg(ri, li, "g_co2_per_tkm", Number(e.target.value))} className="mt-0.5 w-full rounded-lg border border-espresso/25 bg-cream px-2 py-1" /></label>
                    </div>
                  ))}
                  <label className="mt-2 block text-xs">Phí cảng và bốc xếp (USD/tấn)<input type="number" value={r.fixed_usd_per_t} min={0} onChange={(e) => setFixed(ri, Number(e.target.value))} className="mt-0.5 w-full rounded-lg border border-espresso/25 bg-cream px-2 py-1" /></label>
                  <p className="mt-2 text-xs text-muted">{r.note}</p>
                </fieldset>
              ))}
            </div>
            <button type="button" onClick={() => setRoutes(DEFAULT_ROUTES)} className="chip mt-3">Khôi phục giả định ban đầu</button>
          </details>
        </ChartCard>
      </div>
    </div>
  );
}
