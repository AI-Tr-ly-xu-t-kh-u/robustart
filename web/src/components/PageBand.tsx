import type { ReactNode } from "react";
import type { Icon } from "@tabler/icons-react";

export function PageBand({ eyebrow, title, children, icon: Ic }: { eyebrow?: string; title: string; children?: ReactNode; icon?: Icon }) {
  return (
    <section className="on-dark text-cream">
      <div className="mx-auto max-w-7xl px-6 pb-10 pt-6 sm:pt-10">
        {eyebrow && <p className="flex items-center gap-2 font-serif text-sm uppercase tracking-[0.2em] text-caramel">{Ic && <Ic size={20} stroke={1.8} aria-hidden="true" />}{eyebrow}</p>}
        <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">{title}</h1>
        {children && <div className="mt-3 max-w-3xl text-cream/80">{children}</div>}
      </div>
    </section>
  );
}
