import Link from "next/link";
import { IconCalendarStats, IconChartLine, IconDatabase, IconNews, IconPercentage, IconRobot, IconShieldCheck, IconTarget, IconTargetArrow, IconTrendingUp, type Icon } from "@tabler/icons-react";
import { Hero } from "@/components/Hero";
import { Reveal } from "@/components/Motion";
import { CountUp } from "@/components/ui";
import { getData } from "@/lib/data";
import { fmt } from "@/lib/format";
import { defaultInventory, horizonSum, simSummary } from "@/lib/derived";

const VALUES: { t: string; d: string; Icon: Icon }[] = [
  { Icon: IconRobot, t: "Agent tự gọi công cụ", d: "Hỏi bằng tiếng Việt, agent chọn công cụ (dự báo, kịch bản, tồn kho, cảnh báo) và đưa khuyến nghị kèm từng bước làm việc để bạn kiểm tra." },
  { Icon: IconNews, t: "Đọc tin, chỉnh kịch bản", d: "AI rút tín hiệu giá và mưa từ bản tin, trích nguyên văn làm bằng chứng, đổi thành kịch bản trong miền mô hình hỗ trợ." },
  { Icon: IconShieldCheck, t: "Kiểm chứng và có người duyệt", d: "Mọi con số được đối chiếu với kết quả công cụ, câu thiếu dữ liệu bị từ chối, quyết định cuối cùng do con người chấp nhận." },
];

const STEPS: { n: string; t: string; d: string; Icon: Icon }[] = [
  { Icon: IconDatabase, n: "1", t: "Dữ liệu", d: "Xuất khẩu theo thị trường, giá, tỷ giá, mưa, cước." },
  { Icon: IconChartLine, n: "2", t: "Dự báo", d: "Nhu cầu 6 tháng tới theo thị trường, kèm khoảng có thể xảy ra." },
  { Icon: IconRobot, n: "3", t: "AI agent", d: "Gọi công cụ, đọc tin tức, đề xuất kế hoạch tồn kho." },
  { Icon: IconTargetArrow, n: "4", t: "Quyết định", d: "Con người xem bằng chứng, chấp nhận hoặc từ chối." },
];

export default function Home() {
  const d = getData();
  const q = horizonSum(d, "Total", 3);
  const inv = defaultInventory(d);
  const sim = simSummary(d, 2, 0.95);
  const stats = [
    { Icon: IconTrendingUp, v: q.change * 100, digits: 1, suffix: "%", prefix: q.change > 0 ? "+" : "", label: "Dự báo quý tới so với cùng kỳ năm trước", note: `${fmt(q.p50, 1)} kt trong 3 tháng tới` },
    { Icon: IconTarget, v: inv.safetyStock * 1000, digits: 0, suffix: " tấn", label: "Tồn kho an toàn khuyến nghị", note: "Doanh nghiệp giả định, mức dịch vụ 95%" },
    { Icon: IconPercentage, v: sim ? sim.reduction * 100 : 0, digits: 1, suffix: "%", label: "Giảm chi phí trong mô phỏng", note: "Doanh nghiệp giả định, L = 2 tháng, dịch vụ 95%" },
    { Icon: IconCalendarStats, v: d.history.month.length, digits: 0, suffix: "", label: "Tháng dữ liệu", note: "01/2010–06/2026, 6 thị trường" },
  ];

  return (
    <>
      <Hero />

      {/* sóng chuyển sang nền kem */}
      <div aria-hidden="true" className="bg-espresso leading-[0]">
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none" className="block h-[54px] w-full sm:h-[90px]">
          <path d="M0 90 V50 C 120 10, 240 10, 360 50 C 480 90, 600 90, 720 50 C 840 10, 960 10, 1080 50 C 1200 90, 1320 70, 1440 36 V90 Z" fill="#F4E6D6" />
        </svg>
      </div>

      <div className="bg-cream text-ink">
        {/* 3 thẻ giá trị */}
        <section className="mx-auto max-w-7xl px-6 py-14" aria-labelledby="gia-tri">
          <h2 id="gia-tri" className="text-3xl sm:text-4xl">AI hỗ trợ ra quyết định xuất khẩu</h2>
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {VALUES.map((v, i) => (
              <Reveal as="li" key={v.t} delay={i * 0.1} className="card">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-espresso text-caramel"><v.Icon size={26} stroke={1.6} aria-hidden="true" /><span className="sr-only">{i + 1}</span></div>
                <h3 className="text-xl">{v.t}</h3>
                <p className="mt-2 text-sm text-muted">{v.d}</p>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Dải số liệu nổi bật */}
        <section className="bg-roast text-cream" aria-label="Số liệu nổi bật">
          <div className="on-dark mx-auto grid max-w-7xl gap-6 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Reveal key={s.label} delay={0.08 * stats.indexOf(s)} className="border-l-2 border-caramel pl-4">
                <div className="font-serif text-4xl text-caramel sm:text-5xl"><CountUp value={s.v} digits={s.digits} suffix={s.suffix} prefix={s.prefix} /></div>
                <div className="mt-1 text-sm font-semibold">{s.label}</div>
                <div className="text-xs text-cream/70">{s.note}</div>
              </Reveal>
            ))}
          </div>
          <p className="on-dark mx-auto max-w-7xl px-6 pb-8 text-xs text-cream/70">
            Kết quả giảm chi phí chỉ đúng trong mô phỏng của một doanh nghiệp giả định (thị phần {fmt(d.meta.share * 100, 0)}%).
          </p>
        </section>

        {/* 4 bước */}
        <section className="mx-auto max-w-7xl px-6 py-14" aria-labelledby="bon-buoc">
          <h2 id="bon-buoc" className="text-3xl sm:text-4xl">Cách BeanCast ra quyết định</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 0.1} className="relative rounded-[20px] border-[1.5px] border-espresso/25 p-5 transition-colors hover:border-espresso/60">
                <div className="flex items-center justify-between"><span className="font-serif text-4xl text-caramel-deep">{s.n}</span><s.Icon size={30} stroke={1.5} className="text-caramel-deep" aria-hidden="true" /></div>
                <h3 className="mt-1 text-xl">{s.t}</h3>
                <p className="mt-1 text-sm text-muted">{s.d}</p>
                {i < STEPS.length - 1 && <span aria-hidden="true" className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-2xl text-caramel-deep md:block">→</span>}
              </Reveal>
            ))}
          </ol>
          <div className="mt-10 text-center"><Link href="/tro-ly" className="pill pill-dark">Thử hỏi AI agent</Link></div>
        </section>
      </div>
    </>
  );
}
