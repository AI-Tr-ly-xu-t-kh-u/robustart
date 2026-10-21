"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Market } from "@/lib/constants";

interface Ctx { market: Market; setMarket: (m: Market) => void }
const MarketCtx = createContext<Ctx>({ market: "Total", setMarket: () => {} });

export function MarketProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState<Market>("Total");
  return <MarketCtx.Provider value={{ market, setMarket }}>{children}</MarketCtx.Provider>;
}
export const useMarket = () => useContext(MarketCtx);
