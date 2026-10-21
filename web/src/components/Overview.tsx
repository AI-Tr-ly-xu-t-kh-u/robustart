"use client";
import Link from "next/link";
import { useMemo } from "react";
import { IconAlertCircle, IconAlertTriangle, IconArrowRight, IconBulb, IconCalendarMonth, IconChartAreaLine, IconChartBar, IconChartDonut, IconChartLine, IconCircleCheck, IconCloudRain, IconCoffee, IconCurrencyDong, IconShieldCheck, IconShip, IconSum, IconTargetArrow, IconTrendingDown, IconTrendingUp, type Icon } from "@tabler/icons-react";
import { EChart } from "./EChart";
import { forecastOption, sparkOption } from "./charts";
import { contributionOption, marketMixOption, priceVolumeOption, seasonalityOption } from "./charts-overview";
import { ChartCard, Stat } from "./ui";
import { Reveal } from "./Motion";
import { forecastInsight, marketsInsight, mixInsight, priceVolumeInsight, seasonInsight, trackingInsight } from "@/lib/chart-insights";
import { getData } from "@/lib/data";
import { buildAlerts, buildKpis, changeOver, seriesTail, sum, type Severity } from "@/lib/derived";
import { fmt, monthLabel, signedPct } from "@/lib/format";
import { buildInsights, type Insight, type Tone } from "@/lib/insights";

const SEV: Record<Severity, { label: string; cls: string; Icon: Icon; color: string }> = {
  ok: { label: "Ổn", cls: "border-ok bg-ok/10", Icon: IconCircleCheck, color: "text-ok" },
  attention: { label: "Chú ý", cls: "border-warn bg-warn/10", Icon: IconAlertCircle, color: "text-caramel-deep" },
  critical: { label: "Nghiêm trọng", cls: "border-bad bg-bad/10", Icon: IconAlertTriangle, color: "text-bad" },
};
const KPI_ICONS: Icon[] = [IconCalendarMonth, IconSum, IconTargetArrow, IconShieldCheck];
const TONE: Record<Tone, { Icon: Icon; bar: string; chip: string }> = {
  up: { Icon: IconTrendingUp, bar: "bg-leaf", chip: "text-leaf" },
  down: { Icon: IconTrendingDown, bar: "bg-bad", chip: "text-bad" },
  warn: { Icon: IconAlertTriangle, bar: "bg-warn", chip: "text-caramel-deep" },
  info: { Icon: IconBulb, bar: "bg-caramel", chip: "text-caramel-deep" },
};

function InsightCard({ i, compact = false }: { i: Insight; compact?: boolean }) {
  const t = TONE[i.tone];
  return (
    <article className="relative overflow-hidden rounded-2xl bg-cream p-4 pl-5">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${t.bar}`} />
      <h3 className={`flex items-start gap-2 font-serif ${compact ? "text-lg" : "text-xl"} leading-snug`}>
        <t.Icon size={22} stroke={1.8} className={`mt-0.5 shrink-0 ${t.chip}`} aria-hidden="true" />
        {i.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed">{i.text}</p>
      <p className="mt-2 text-[0.7rem] text-muted">Nguồn: {i.source}</p>
    </article>
  );
}

function MarketTile({ label, value, unit, change, changeText, values, note, icon: Ic }: { icon: Icon; label: string; value: string; unit: string; change: number; changeText?: string; values: number[]; note: string }) {
  const option = useMemo(() => sparkOption(values), [values]);
  return (
    <div className="card !p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-espresso text-caramel"><Ic size={16} stroke={1.8} aria-hidden="true" /></span>
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-serif text-3xl">{value}</span>
        <span className="text-xs text-muted">{unit}</span>
      </div>
      <div className={`text-sm font-semibold ${change > 0 ? "text-leaf" : change < 0 ? "text-bad" : "text-muted"}`}>
        {changeText ?? signedPct(change)} <span className="font-normal text-muted">{changeText ? "so với 3 tháng trước đó" : "so với 3 tháng trước"}</span>
      </div>
      <EChart option={option} height={52} ariaLabel={`Biểu đồ nhỏ 24 tháng: ${label}`} />
      <div className="mt-1 text-[0.7rem] text-muted">{note}</div>
    </div>
  );
}

const d = getData();

export function Overview() {
  const kpis = buildKpis(d);
  const alerts = buildAlerts(d);
  const insights = buildInsights(d);
  const h = d.history;
  const n = h.month.length;
  const tail = (k: "price_usd_t" | "usdvnd" | "rain_anom_mm" | "freight_idx") => seriesTail(d, k, 24).values;
  const rainDiff = sum(h.rain_anom_mm.slice(n - 3)) / 3 - sum(h.rain_anom_mm.slice(n - 6, n - 3)) / 3;
  const note = `Cập nhật cuối ${monthLabel(d.meta.last_month)}`;

  const mainOpt = forecastOption({ d, market: "Total", backtest: "off", showSarima: false });
  const seasonOpt = seasonalityOption(d);
  const contribOpt = contributionOption(d);
  const mixOpt = marketMixOption(d);
  const pvOpt = priceVolumeOption(d);
  const byId = (id: string) => insights.find((x) => x.id === id)!;

  return (
    <div className="bg-cream text-ink">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <section aria-labelledby="kpi">
          <h2 id="kpi" className="sr-only">Chỉ số chính</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k, i) => (
              <Reveal key={k.label} delay={i * 0.07} className="card">
                <Stat icon={KPI_ICONS[i]} label={k.label} value={k.value} note={k.note} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* Biểu đồ chính + insight nổi bật */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartCard icon={IconChartLine} id="tq-du-bao" title="Xuất khẩu và dự báo 6 tháng tới" subtitle="Tổng xuất khẩu: 36 tháng gần nhất, dự báo và khoảng nhu cầu có thể xảy ra (80%)"
              insight={forecastInsight(d, "Total")}
              actions={<Link href="/du-bao" className="chip gap-1">Chi tiết dự báo<IconArrowRight size={14} stroke={2} aria-hidden="true" /></Link>}
              footnote={<span>Đường chấm là cùng tháng năm trước.</span>}>
              <EChart option={mainOpt} height={380} ariaLabel="Biểu đồ xuất khẩu và dự báo tổng" summary="Dự báo 6 tháng tới tăng dần về cuối năm." />
            </ChartCard>
          </div>
          <Reveal className="card flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-2xl"><IconBulb size={26} stroke={1.7} className="text-caramel-deep" aria-hidden="true" />Điểm nhấn</h2>
            <InsightCard i={byId("trend")} compact />
            <InsightCard i={byId("markets")} compact />
            <InsightCard i={byId("uncertainty")} compact />
          </Reveal>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard icon={IconChartBar} id="tq-mua-vu" title="Mùa vụ" subtitle="Mức lệch so với trung bình năm theo tháng; cột đậm là các tháng nằm trong kỳ dự báo"
            insight={seasonInsight(d)}
            footnote={<span>Trung bình các năm đủ 12 tháng; đường là 12 tháng gần nhất so với trung bình của chính nó.</span>}>
            <EChart option={seasonOpt} height={300} ariaLabel="Biểu đồ mùa vụ theo tháng" summary={byId("season").text} />
          </ChartCard>
          <ChartCard icon={IconChartBar} id="tq-thi-truong" title="Dự báo 3 tháng tới theo thị trường" subtitle="Khối lượng dự báo và mức thay đổi so với cùng kỳ năm trước"
            insight={marketsInsight(d)}
            actions={<Link href="/thi-truong" className="chip gap-1">Xem bản đồ<IconArrowRight size={14} stroke={2} aria-hidden="true" /></Link>}
            footnote={<span>Màu đỏ là thị trường dự báo giảm so với cùng kỳ.</span>}>
            <EChart option={contribOpt} height={300} ariaLabel="Cột dự báo theo thị trường" summary={byId("markets").text} />
          </ChartCard>
          <ChartCard icon={IconChartDonut} id="tq-co-cau" title="Cơ cấu thị trường theo thời gian" subtitle="Khối lượng xuất khẩu theo thị trường, 48 tháng gần nhất"
            insight={mixInsight(d)}
            footnote={<span>Diện tích xếp chồng, tổng bằng tổng xuất khẩu.</span>}>
            <EChart option={mixOpt} height={320} ariaLabel="Diện tích xếp chồng cơ cấu thị trường" summary="Cơ cấu thị trường xuất khẩu theo thời gian" />
          </ChartCard>
          <ChartCard icon={IconChartAreaLine} id="tq-gia" title="Giá Robusta và khối lượng xuất khẩu" subtitle="60 tháng gần nhất, trục trái là khối lượng, trục phải là giá"
            insight={priceVolumeInsight(d)}
            footnote={<span>Hai chuỗi cùng hiển thị để so nhịp, không hàm ý quan hệ nhân quả.</span>}>
            <EChart option={pvOpt} height={320} ariaLabel="Đường giá Robusta và khối lượng xuất khẩu" summary={byId("signals").text} />
          </ChartCard>
        </div>

        {/* Phân tích chi tiết */}
        <section aria-labelledby="phan-tich" className="card">
          <h2 id="phan-tich" className="flex items-center gap-2 text-2xl"><IconBulb size={26} stroke={1.7} className="text-caramel-deep" aria-hidden="true" />Phân tích chi tiết</h2>
          <p className="mt-1 text-sm text-muted">Tự tổng hợp từ số liệu đang hiển thị; mỗi mục ghi rõ nguồn trong results.json.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {["season", "signals", "inventory"].map((id) => <InsightCard key={id} i={byId(id)} />)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/ton-kho" className="pill pill-dark">Tính kế hoạch tồn kho<IconArrowRight size={18} stroke={2} aria-hidden="true" /></Link>
          </div>
        </section>

        <section aria-labelledby="canh-bao" className="card">
          <h2 id="canh-bao" className="text-2xl">Cảnh báo</h2>
          <p className="mt-1 text-sm text-muted">Chỉ hiển thị khi điều kiện thỏa ngưỡng; mỗi cảnh báo ghi rõ ngưỡng áp dụng.</p>
          {alerts.length === 0 ? (
            <div className={`mt-4 rounded-2xl border-l-4 p-4 ${SEV.ok.cls}`} role="status">
              <strong className="inline-flex items-center gap-1.5"><SEV.ok.Icon size={20} stroke={1.8} aria-hidden="true" />{SEV.ok.label}.</strong> Hiện không có điều kiện nào thỏa ngưỡng cảnh báo (nhu cầu lệch &gt; 10%, giá đổi &gt; 10%, mưa &lt; -50 mm, cước &gt; +30%, tồn kho dưới mức an toàn).
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {alerts.map((a) => (
                <li key={a.id} className={`rounded-2xl border-l-4 p-4 ${SEV[a.severity].cls}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => { const I = SEV[a.severity].Icon; return <I size={22} stroke={1.8} className={SEV[a.severity].color} aria-hidden="true" />; })()}
                    <strong>{a.title}</strong>
                    <span className="rounded-full bg-espresso px-2 py-0.5 text-xs font-semibold text-cream">{SEV[a.severity].label}</span>
                  </div>
                  <p className="mt-1 text-sm">{a.detail}</p>
                  <p className="mt-1 text-xs text-muted">{a.rule}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ChartCard title="Theo dõi dữ liệu thị trường" subtitle="Diễn biến 24 tháng gần nhất và thay đổi 3 tháng" id="thi-truong-du-lieu"
          insight={trackingInsight(d)}
          footnote={<span>Tháng cập nhật cuối: {monthLabel(d.meta.last_month)}.</span>}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MarketTile icon={IconCoffee} label="Giá Robusta" value={fmt(h.price_usd_t[n - 1], 0)} unit="USD/tấn" change={changeOver(d, "price_usd_t")} values={tail("price_usd_t")} note={note} />
            <MarketTile icon={IconCurrencyDong} label="USD/VND" value={fmt(h.usdvnd[n - 1], 0)} unit="đồng" change={changeOver(d, "usdvnd")} values={tail("usdvnd")} note={note} />
            <MarketTile icon={IconCloudRain} label="Lượng mưa bất thường" value={fmt(h.rain_anom_mm[n - 1], 1)} unit="mm" change={rainDiff} changeText={`${rainDiff > 0 ? "+" : rainDiff < 0 ? "−" : ""}${fmt(Math.abs(rainDiff), 1)} mm (TB 3 tháng)`} values={tail("rain_anom_mm")} note={`${note} · độ lệch so với mức bình thường`} />
            <MarketTile icon={IconShip} label="Chỉ số cước" value={fmt(h.freight_idx[n - 1], 0)} unit="điểm" change={changeOver(d, "freight_idx")} values={tail("freight_idx")} note={note} />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
