"use client";
import { useMemo, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { IconAdjustmentsHorizontal, IconArrowBarToUp, IconBellRinging, IconBuildingWarehouse, IconCash, IconCoins, IconListCheck, IconShieldCheck } from "@tabler/icons-react";
import { EChart } from "./EChart";
import { COLORS } from "./charts";
import { ChartCard, Stat } from "./ui";
import { getData } from "@/lib/data";
import { DEFAULT_LEAD_WEEKS, DEFAULT_SERVICE } from "@/lib/derived";
import { planInsight } from "@/lib/chart-insights";
import { fmt, fmtVol, monthLabel, signedPct } from "@/lib/format";
import { computeInventory, holdingCost, planTable, weeksToMonths, zFor } from "@/lib/inventory";
import { interpolateScenario } from "@/lib/scenario";

interface State {
  price: number; // %
  rain: number; // mm
  weeks: number;
  service: number; // %
  share: number; // %
  fx: number; // %
  capital: number; // %/tháng
}

function Slider({ id, label, min, max, step, value, unit, onChange, hint, digits = 1 }: { id: string; label: string; min: number; max: number; step: number; value: number; unit: string; onChange: (v: number) => void; hint?: string; digits?: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        <output htmlFor={id} className="tnum text-sm font-semibold text-caramel-deep">{`${value > 0 && (id === "price" || id === "fx") ? "+" : ""}${fmt(value, digits)}${unit === "%" ? "%" : ` ${unit}`}`}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-describedby={hint ? `${id}-h` : undefined} />
      {hint && <p id={`${id}-h`} className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Inventory() {
  const d = getData();
  const DEFAULTS: State = { price: 0, rain: 0, weeks: DEFAULT_LEAD_WEEKS, service: DEFAULT_SERVICE * 100, share: d.meta.share * 100, fx: 0, capital: 0.8 };
  const [s, setS] = useState<State>(DEFAULTS);
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));

  const calc = useMemo(() => {
    const priceNow = d.history.price_usd_t.at(-1)!;
    const fxNow = d.history.usdvnd.at(-1)!;
    const mk = (st: State) => {
      const p50 = interpolateScenario(d.scenarios, 1 + st.price / 100, st.rain);
      const L = weeksToMonths(st.weeks);
      const inv = computeInventory({ forecastP50: p50, sigH: d.meta.sig_h, share: st.share / 100, firmNoise: d.meta.firm_noise, leadMonths: L, z: zFor(st.service / 100, d.meta.z) });
      const cost = holdingCost({ avgInventoryKt: inv.avgInventory, priceUsdT: priceNow, priceChange: st.price / 100, capitalCostMonthly: st.capital / 100, usdvnd: fxNow, fxChange: st.fx / 100 });
      return { p50, L, inv, cost, plan: planTable(inv.F, inv.safetyStock, L) };
    };
    return { cur: mk(s), base: mk(DEFAULTS), priceNow, fxNow };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, d]);

  const { cur, base } = calc;
  const months = d.forecast.Total.map((f) => f.month);
  const planOption = useMemo<EChartsCoreOption>(() => ({
    color: [COLORS.caramelLight, COLORS.espresso, COLORS.leaf],
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => (typeof v === "number" ? `${fmt(v * 1000, 0)} tấn` : "—") },
    legend: { top: 0, textStyle: { color: COLORS.axis } },
    grid: { left: 54, right: 20, top: 40, bottom: 30 },
    xAxis: { type: "category", data: months.map(monthLabel), axisLabel: { color: COLORS.axis }, axisLine: { lineStyle: { color: COLORS.axis } } },
    yAxis: { type: "value", name: "kt", axisLabel: { color: COLORS.axis }, splitLine: { lineStyle: { color: COLORS.grid } } },
    series: [
      { name: "Nhu cầu doanh nghiệp", type: "bar", data: cur.plan.map((r) => r.demand), itemStyle: { borderRadius: [6, 6, 0, 0] } },
      { name: "Tồn kho mục tiêu cuối tháng", type: "line", data: cur.plan.map((r) => r.target), lineStyle: { width: 3 }, symbolSize: 7 },
      { name: "Lượng cần về kho", type: "line", data: cur.plan.map((r) => r.inbound), lineStyle: { width: 2.5, type: "dashed" }, symbolSize: 6 },
    ],
  }), [cur, months]);

  const peak = cur.plan.reduce((a, r, i) => (r.inbound > a.v ? { v: r.inbound, i } : a), { v: -1, i: 0 });
  const planInsightText = planInsight({
    inbound3: cur.plan.slice(0, 3).reduce((a, r) => a + r.inbound, 0) * 1000,
    inbound6: cur.plan.reduce((a, r) => a + r.inbound, 0) * 1000,
    peakMonth: monthLabel(months[peak.i]), peakInbound: peak.v * 1000, unit: "tấn",
  });
  const delta = (a: number, b: number) => (b ? signedPct(a / b - 1) : "—");
  const changed = JSON.stringify(s) !== JSON.stringify(DEFAULTS);

  return (
    <div className="bg-cream text-ink">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <p className="rounded-2xl bg-warn/15 p-4 text-sm"><strong>Doanh nghiệp giả định.</strong> Mọi con số tồn kho dưới đây là của một doanh nghiệp giả định có thị phần {fmt(s.share, 1)}% tổng xuất khẩu. Không phải của công ty có thật.</p>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <section className="card h-fit space-y-5" aria-labelledby="whatif">
            <div className="flex items-center justify-between">
              <h2 id="whatif" className="flex items-center gap-2 text-2xl"><IconAdjustmentsHorizontal size={26} stroke={1.7} className="text-caramel-deep" aria-hidden="true" />What-if</h2>
              <button type="button" className="chip" onClick={() => setS(DEFAULTS)} disabled={!changed}>Đặt lại</button>
            </div>
            <Slider id="price" label="Giá Robusta" min={-20} max={20} step={1} value={s.price} unit="%" onChange={(v) => set("price", v)} hint="Đổi dự báo nhu cầu qua kịch bản đã tính sẵn và đổi chi phí vốn." digits={0} />
            <Slider id="rain" label="Lượng mưa bất thường" min={-100} max={100} step={5} value={s.rain} unit="mm" onChange={(v) => set("rain", v)} hint="Lệch so với bình thường, cộng vào 12 tháng gần nhất." digits={0} />
            <Slider id="weeks" label="Lead time" min={4} max={20} step={0.1} value={s.weeks} unit="tuần" onChange={(v) => set("weeks", v)} hint={`≈ ${fmt(weeksToMonths(s.weeks), 2)} tháng`} />
            <Slider id="service" label="Mức dịch vụ" min={85} max={99.5} step={0.5} value={s.service} unit="%" onChange={(v) => set("service", v)} hint={`z = ${fmt(zFor(s.service / 100, d.meta.z), 3)}`} />
            <Slider id="share" label="Thị phần doanh nghiệp" min={1} max={5} step={0.1} value={s.share} unit="%" onChange={(v) => set("share", v)} />
            <Slider id="fx" label="Tỷ giá USD/VND" min={-10} max={10} step={1} value={s.fx} unit="%" onChange={(v) => set("fx", v)} hint="Tỷ giá KHÔNG làm đổi nhu cầu hay tồn kho trong mô hình này, chỉ đổi chi phí quy ra VND." digits={0} />
            <Slider id="capital" label="Chi phí vốn" min={0.2} max={2} step={0.05} value={s.capital} unit="%/tháng" onChange={(v) => set("capital", v)} digits={2} />
          </section>

          <div className="space-y-6">
            <section aria-labelledby="ket-qua" className="card">
              <h2 id="ket-qua" className="flex items-center gap-2 text-2xl"><IconBuildingWarehouse size={26} stroke={1.7} className="text-caramel-deep" aria-hidden="true" />Mức tồn kho khuyến nghị</h2>
              <p className="mt-1 text-sm text-muted">Khoảng bảo vệ P = lead time + 1 tháng (rà soát hàng tháng) = {fmt(cur.inv.P, 2)} tháng.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Stat icon={IconShieldCheck} label="Tồn kho an toàn (SS)" value={fmtVol(cur.inv.safetyStock)} note={`${delta(cur.inv.safetyStock, base.inv.safetyStock)} so với mặc định`} />
                <Stat icon={IconBellRinging} label="Điểm đặt hàng lại (ROP)" value={fmtVol(cur.inv.rop)} note={`${delta(cur.inv.rop, base.inv.rop)} so với mặc định`} />
                <Stat icon={IconArrowBarToUp} label="Mức tồn kho tối đa" value={fmtVol(cur.inv.orderUpTo)} note={`${delta(cur.inv.orderUpTo, base.inv.orderUpTo)} so với mặc định`} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Stat icon={IconBuildingWarehouse} label="Tồn kho bình quân" value={fmtVol(cur.inv.avgInventory)} note="SS + nhu cầu tháng 1 / 2" />
                <Stat icon={IconCoins} label="Chi phí lưu kho / tháng" value={`${fmt(cur.cost.holdingUsdK, 1)} nghìn USD`} note={`vốn ${fmt(cur.cost.capitalPart, 1)} + kho ${fmt(cur.cost.storagePart, 1)}`} />
                <Stat icon={IconCash} label="Quy ra đồng / tháng" value={`${fmt(cur.cost.holdingBillionVnd, 2)} tỷ`} note={`${delta(cur.cost.holdingBillionVnd, base.cost.holdingBillionVnd)} so với mặc định · tỷ giá chỉ đổi con số này`} />
              </div>
              <p className="mt-3 text-xs text-muted">Nhu cầu 6 tháng tới (tổng xuất khẩu, p50) sau kịch bản: {cur.p50.map((v) => fmt(v, 1)).join(" · ")} kt.</p>
            </section>

            <ChartCard icon={IconListCheck} id="ke-hoach" title="Kế hoạch 6 tháng tới" subtitle="Nhu cầu doanh nghiệp, tồn kho mục tiêu cuối tháng và lượng cần về kho"
              insight={planInsightText}
              footnote={<span>Mục tiêu tháng m = SS + nhu cầu L tháng kế tiếp (vượt tháng 6 thì lặp lại tháng 6).</span>}>
              <EChart option={planOption} height={300} ariaLabel="Biểu đồ kế hoạch tồn kho 6 tháng" summary={`Tổng lượng cần về kho 6 tháng: ${fmtVol(cur.plan.reduce((a, r) => a + r.inbound, 0))}`} />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <caption className="sr-only">Bảng kế hoạch 6 tháng tới</caption>
                  <thead><tr className="text-left text-muted"><th className="py-1 pr-4">Tháng</th><th className="pr-4">Nhu cầu doanh nghiệp</th><th className="pr-4">Tồn kho mục tiêu cuối tháng</th><th>Lượng cần về kho</th></tr></thead>
                  <tbody>
                    {cur.plan.map((r, i) => (
                      <tr key={r.month} className="border-t border-espresso/10">
                        <td className="py-1.5 pr-4 font-semibold">{monthLabel(months[i])}</td>
                        <td className="pr-4">{fmtVol(r.demand)}</td>
                        <td className="pr-4">{fmtVol(r.target)}</td>
                        <td className="font-semibold">{fmtVol(r.inbound)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}
