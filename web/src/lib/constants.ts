import type { Results, SimPair } from "./schema";

export const MARKETS = ["Total", "EU", "US", "JP", "KR", "CN"] as const;
export type Market = (typeof MARKETS)[number];
export const MARKET_LABEL: Record<Market, string> = {
  Total: "Tổng xuất khẩu",
  EU: "Liên minh châu Âu (EU-27)",
  US: "Hoa Kỳ",
  JP: "Nhật Bản",
  KR: "Hàn Quốc",
  CN: "Trung Quốc",
};
export const MARKET_SHORT: Record<Market, string> = { Total: "Tổng", EU: "EU", US: "Mỹ", JP: "Nhật", KR: "Hàn", CN: "Trung Quốc" };

export const MODELS = ["snaive", "ma3", "sarima", "lgbm"] as const;
export type Model = (typeof MODELS)[number];
export const MODEL_LABEL: Record<Model, string> = {
  snaive: "Naive theo mùa",
  ma3: "Trung bình 3 tháng",
  sarima: "SARIMA",
  lgbm: "LightGBM",
};

/** Lấy cặp chính sách A/B của khóa «L|svc»; dữ liệu đã được kiểm tra cấu trúc ở server (validate.ts). */
export function simPairAt(data: Results, L: number, svc: number): SimPair | null {
  const v = (data.sim as Record<string, unknown>)[`${L}|${svc}`] as SimPair | undefined;
  return v && typeof v === "object" && "A" in v && "B" in v ? v : null;
}
