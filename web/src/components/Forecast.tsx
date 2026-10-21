"use client";
import { useMemo, useState } from "react";
import { IconChartLine, IconListSearch } from "@tabler/icons-react";
import { EChart } from "./EChart";
import { forecastOption, shapGlobalOption } from "./charts";
import { useMarket } from "./MarketContext";
import { ChartCard, Segmented } from "./ui";
import { getData } from "@/lib/data";
import { driversInsight, forecastInsight } from "@/lib/chart-insights";
import { fmt, monthLabel, signedPct } from "@/lib/format";
import { MARKETS, MARKET_LABEL, MARKET_SHORT, type Market } from "@/lib/constants";

export function MarketPicker({ value, onChange }: { value: Market; onChange: (m: Market) => void }) {
  return <Segmented label="Chọn thị trường" value={value} onChange={onChange} options={MARKETS.map((m) => ({ value: m, label: MARKET_SHORT[m] }))} />;
}

function ForecastSection() {
  const d = getData();
  const { market, setMarket } = useMarket();
  const option = useMemo(() => forecastOption({ d, market, backtest: "off", showSarima: false }), [d, market]);
  const f = d.forecast[market];
  const tot = f.reduce((a, x) => a + x.p50, 0);
  const ly = f.reduce((a, x) => a + x.ly, 0);
  return (
    <ChartCard icon={IconChartLine} id="du-bao-nhu-cau" title={`Dự báo nhu cầu: ${MARKET_LABEL[market]}`} subtitle="Lịch sử 36 tháng và dự báo 6 tháng tới; vùng tô màu là khoảng nhu cầu có thể xảy ra (80%)"
      actions={<MarketPicker value={market} onChange={setMarket} />}
      insight={forecastInsight(d, market)}
      footnote={<span>Đường chấm là cùng tháng năm trước. Vùng tô màu rộng nghĩa là tháng đó khó đoán hơn.</span>}>
      <EChart option={option} height={400} ariaLabel={`Biểu đồ dự báo nhu cầu ${MARKET_LABEL[market]}`}
        summary={`Dự báo 6 tháng tới tổng ${fmt(tot, 1)} kt, ${signedPct(tot / ly - 1)} so với cùng kỳ năm trước.`} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <caption className="sr-only">Dự báo 6 tháng tới</caption>
          <thead><tr className="text-left text-muted"><th className="py-1 pr-4">Tháng</th><th className="pr-4">Thấp</th><th className="pr-4">Dự báo</th><th className="pr-4">Cao</th><th className="pr-4">Cùng tháng năm trước</th><th>So với năm trước</th></tr></thead>
          <tbody>
            {f.map((x) => (
              <tr key={x.month} className="border-t border-espresso/10">
                <td className="py-1.5 pr-4 font-semibold">{monthLabel(x.month)}</td><td className="pr-4">{fmt(x.p10, 1)}</td><td className="pr-4 font-semibold">{fmt(x.p50, 1)}</td><td className="pr-4">{fmt(x.p90, 1)}</td><td className="pr-4">{fmt(x.ly, 1)}</td>
                <td className={x.p50 >= x.ly ? "text-leaf" : "text-bad"}>{signedPct(x.p50 / x.ly - 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-muted">Đơn vị: kt (nghìn tấn). «Thấp» và «Cao» là hai đầu của khoảng nhu cầu có thể xảy ra (80%).</p>
      </div>
    </ChartCard>
  );
}

function DriversSection() {
  const d = getData();
  const [which, setWhich] = useState<"h1_local" | "h3_local">("h3_local");
  const global = useMemo(() => shapGlobalOption(d.shap.h3_global, 10), [d]);
  const local = d.shap[which];
  const idx = which === "h1_local" ? 0 : 2;
  const f = d.forecast.Total[idx];
  const ups = local.items.filter((i) => i.kt > 0).sort((a, b) => b.kt - a.kt);
  const downs = local.items.filter((i) => i.kt < 0).sort((a, b) => a.kt - b.kt);
  const phrase = (xs: typeof ups, dir: string) => (xs.length ? `${dir}: ${xs.map((i) => `${i.feature} (${i.kt > 0 ? "+" : "−"}${fmt(Math.abs(i.kt), 1)} kt)`).join("; ")}` : `Không có yếu tố nào ${dir} đáng kể`);
  return (
    <ChartCard icon={IconListSearch} id="bien-quan-trong" title="Điều gì đang tác động đến nhu cầu" subtitle="Mức ảnh hưởng của từng yếu tố đến dự báo tổng xuất khẩu 3 tháng tới"
      insight={driversInsight(d)}
      footnote={<span>Đây là các yếu tố liên quan đến dự báo, không phải bằng chứng yếu tố nào gây ra nhu cầu.</span>}>
      <EChart option={global} height={360} ariaLabel="Thanh ngang 10 yếu tố ảnh hưởng nhất" summary={`Yếu tố ảnh hưởng nhất: ${Object.entries(d.shap.h3_global).sort((a, b) => b[1] - a[1])[0][0]}`} />
      <div className="mt-6 rounded-2xl bg-cream p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl">Vì sao dự báo tháng này như vậy</h3>
          <Segmented label="Chọn tháng giải thích" value={which} onChange={setWhich} options={[{ value: "h1_local", label: monthLabel(d.forecast.Total[0].month) }, { value: "h3_local", label: monthLabel(d.forecast.Total[2].month) }]} />
        </div>
        <p className="mt-3 text-sm leading-relaxed">
          Dự báo tổng xuất khẩu tháng {monthLabel(f.month)} là <strong>{fmt(f.p50, 1)} kt</strong> (khoảng {fmt(f.p10, 1)}–{fmt(f.p90, 1)} kt), {signedPct(f.p50 / f.ly - 1)} so với cùng tháng năm trước ({fmt(f.ly, 1)} kt).
          Mức nền là {fmt(local.base, 1)} kt. {phrase(downs, "kéo xuống")}. {phrase(ups, "đẩy lên")}.
        </p>
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {[...local.items].sort((a, b) => Math.abs(b.kt) - Math.abs(a.kt)).map((i) => (
            <li key={i.feature} className="flex justify-between gap-3 border-b border-espresso/10 py-1"><span>{i.feature}</span><span className={i.kt >= 0 ? "text-leaf" : "text-bad"}>{i.kt >= 0 ? "+" : "−"}{fmt(Math.abs(i.kt), 2)} kt</span></li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

export function Forecast() {
  return (
    <div className="bg-cream text-ink">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <ForecastSection />
        <DriversSection />
      </div>
    </div>
  );
}
