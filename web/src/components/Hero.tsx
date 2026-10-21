"use client";
import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { IconArrowRight } from "@tabler/icons-react";

const EASE = [0.22, 1, 0.36, 1] as const;
const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } };
const item: Variants = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } } };
const line: Variants = { hidden: { y: "105%" }, show: { y: 0, transition: { duration: 0.9, ease: EASE } } };

/** Hero toàn khung: ảnh ly latte làm nền (zoom chậm như máy quay), chữ hiện lần lượt ở bên trái. */
export function Hero() {
  return (
    <section className="on-dark relative isolate overflow-hidden text-cream" aria-labelledby="hero-title">
      <motion.div className="hero-photo absolute inset-y-0 right-0 -z-20 w-full lg:w-[72%]" initial={{ scale: 1.12, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 2.2, ease: EASE }}>
        <Image src="/images/hero-latte.webp" alt="Ly latte có hình lá trên khay gỗ, hạt cà phê rang và lá cà phê xanh" fill priority sizes="100vw" className="object-cover object-[78%_center] lg:object-right" />
      </motion.div>
      {/* lớp phủ giúp chữ dễ đọc, mờ dần về phía ly */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-espresso via-espresso/80 to-transparent max-lg:from-espresso/90 max-lg:via-espresso/70 lg:from-espresso lg:via-espresso/35 lg:to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-espresso/70 to-transparent" />

      <div className="mx-auto flex min-h-[34rem] max-w-7xl items-center px-6 pb-20 pt-10 lg:min-h-[40rem]">
        <motion.div className="min-w-0 max-w-xl" variants={container} initial="hidden" animate="show">
          <motion.p variants={item} className="font-serif text-sm uppercase tracking-[0.22em] text-cream/90"><span className="text-caramel">A</span>I agent · Tin tức · Quyết định.</motion.p>
          <h1 id="hero-title" className="mt-4 text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="block overflow-hidden pb-1 pr-6"><motion.span variants={line} className="block">ĐI TRƯỚC</motion.span></span>
            <span className="block overflow-hidden pb-1 pr-6"><motion.span variants={line} className="block text-caramel">MÙA VỤ.</motion.span></span>
          </h1>
          <motion.p variants={item} className="mt-6 text-lg text-cream/85">
            BeanCast là trợ lý AI cho doanh nghiệp xuất khẩu cà phê Robusta: agent tự gọi công cụ dự báo và tồn kho để khuyến nghị đặt hàng, đọc tin tức để chỉnh kịch bản, và luôn cho bạn duyệt trước khi quyết định.
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/tro-ly" className="pill pill-caramel text-base">Hỏi AI agent<IconArrowRight size={20} stroke={2} aria-hidden="true" /></Link>
            <Link href="/tong-quan" className="pill border-[1.5px] border-cream/60 text-cream hover:bg-cream/10">Mở Dashboard</Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
