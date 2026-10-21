"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { IconWorldSearch } from "@tabler/icons-react";
import { ChatWidget } from "./ChatWidget";

/** Nút nổi mở khung tra cứu trực tiếp (tin tức, giá, quy định). Chức năng cốt lõi là «Quyết định AI» ở nút trên thanh đầu trang. */
export function ChatFab() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  if (path === "/tro-ly") return null;
  return (
    <>
      {open && (
        <div role="dialog" aria-label="Tra cứu trực tiếp" className="fixed bottom-24 right-4 z-40 w-[min(94vw,26rem)] rounded-[20px] bg-cream-soft shadow-2xl">
          <ChatWidget compact onClose={() => setOpen(false)} />
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Tra cứu tin tức trực tiếp"
        className="fixed bottom-5 right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-caramel px-5 font-semibold text-espresso shadow-xl transition-transform hover:-translate-y-0.5">
        <IconWorldSearch size={24} stroke={1.8} aria-hidden="true" />
        Tra cứu tin tức
      </button>
    </>
  );
}
