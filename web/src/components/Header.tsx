"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconArrowRight, IconMenu2, IconX } from "@tabler/icons-react";
import { Logo } from "./Logo";

export const NAV = [
  { href: "/", label: "Trang chủ" },
  { href: "/tong-quan", label: "Dashboard" },
  { href: "/thi-truong", label: "Thị trường" },
  { href: "/du-bao", label: "Dự báo" },
  { href: "/ton-kho", label: "Tồn kho" },
  { href: "/tro-ly", label: "Quyết định AI" },
  { href: "/van-chuyen", label: "Vận chuyển" },
  { href: "/tin-tuc", label: "Tin tức" },
  { href: "/gioi-thieu", label: "Giới thiệu" },
];

export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <header className="bg-cream">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" aria-label="BeanCast, về trang chủ"><Logo /></Link>
        <nav aria-label="Điều hướng chính" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => {
              const active = isActive(n.href);
              return (
                <li key={n.href}>
                  <Link href={n.href} aria-current={active ? "page" : undefined}
                    className={`relative isolate inline-block whitespace-nowrap rounded-full px-3.5 py-2 text-[0.92rem] font-semibold transition-colors duration-300 ${active ? "text-cream" : "text-espresso hover:bg-caramel/40"}`}>
                    {active && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-espresso" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/tro-ly" className="pill pill-caramel hidden whitespace-nowrap sm:inline-flex xl:hidden 2xl:inline-flex">Quyết định AI<IconArrowRight size={18} stroke={2} aria-hidden="true" /></Link>
          <button type="button" className="chip xl:hidden" aria-expanded={open} aria-controls="menu-di-dong" onClick={() => setOpen((o) => !o)}>
            {open ? <IconX size={16} stroke={2} aria-hidden="true" /> : <IconMenu2 size={16} stroke={2} aria-hidden="true" />}
            <span className="ml-1">{open ? "Đóng" : "Menu"}</span>
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.nav id="menu-di-dong" aria-label="Điều hướng di động" className="overflow-hidden border-t border-espresso/10 px-5 xl:hidden"
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <ul className="grid grid-cols-2 gap-2 pb-4 pt-3 sm:grid-cols-3">
              {NAV.map((n, i) => (
                <motion.li key={n.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, duration: 0.3 }}>
                  <Link href={n.href} onClick={() => setOpen(false)} aria-current={isActive(n.href) ? "page" : undefined}
                    className={`block rounded-xl px-3 py-2 text-sm font-semibold ${isActive(n.href) ? "bg-espresso text-cream" : "bg-cream-soft"}`}>{n.label}</Link>
                </motion.li>
              ))}
              <li className="col-span-full"><Link href="/tro-ly" onClick={() => setOpen(false)} className="pill pill-caramel w-full justify-center">Quyết định AI</Link></li>
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
