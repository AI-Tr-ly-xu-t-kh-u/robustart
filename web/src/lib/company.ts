import type { Results } from "./schema";

export interface CompanyRow { month: string; sales_tons: number; stock_tons?: number }
export interface CompanyData {
  rows: CompanyRow[];
  /** Thị phần ước tính (%) = tổng bán / tổng xuất khẩu cả nước trong các tháng trùng với dữ liệu lịch sử; null nếu không có tháng trùng. */
  share_pct: number | null;
  overlap_months: number;
  summary: string;
  warnings: string[];
}

const toMonth = (s: string): string | null => {
  const t = s.trim();
  let m = /^(\d{4})[-/](\d{1,2})$/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = /^(\d{1,2})[-/](\d{4})$/.exec(t);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  return null;
};
const num = (s: string | undefined, decimalComma: boolean): number | null => {
  if (s === undefined) return null;
  const t = s.trim().replace(/\s/g, "");
  if (!t) return null;
  const v = Number(decimalComma ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, ""));
  return Number.isFinite(v) ? v : null;
};

/** Đọc CSV do doanh nghiệp nhập: cột 1 = tháng (YYYY-MM hoặc MM/YYYY), cột 2 = lượng bán (tấn), cột 3 (tùy chọn) = tồn kho cuối tháng (tấn). */
export function parseCompanyCsv(text: string, d: Results): CompanyData | { error: string } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { error: "Tệp cần ít nhất một dòng tiêu đề và một dòng dữ liệu." };
  const delim = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const decimalComma = delim !== ",";
  const warnings: string[] = [];
  const byMonth = new Map<string, CompanyRow>();
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const c = line.split(delim);
    const month = toMonth(c[0] ?? "");
    const sales = num(c[1], decimalComma);
    const stock = num(c[2], decimalComma);
    if (!month || sales === null || sales < 0) { skipped++; continue; }
    byMonth.set(month, { month, sales_tons: sales, ...(stock !== null && stock >= 0 ? { stock_tons: stock } : {}) });
  }
  const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  if (rows.length === 0) return { error: "Không đọc được dòng dữ liệu nào. Cột 1 là tháng (ví dụ 2026-03 hoặc 03/2026), cột 2 là lượng bán (tấn)." };
  if (skipped) warnings.push(`Bỏ qua ${skipped} dòng không đọc được.`);

  const hist = new Map(d.history.month.map((m, i) => [m, d.history.vol_kt[i]]));
  let mine = 0, all = 0, overlap = 0;
  for (const r of rows) {
    const v = hist.get(r.month);
    if (v !== undefined) { mine += r.sales_tons; all += v * 1000; overlap++; }
  }
  const share = overlap > 0 && all > 0 ? Math.round((mine / all) * 1000) / 10 : null;
  if (overlap === 0) warnings.push("Không có tháng nào trùng với dữ liệu thị trường nên chưa ước tính được thị phần.");
  else if (overlap < 6) warnings.push(`Chỉ có ${overlap} tháng trùng với dữ liệu thị trường nên thị phần ước tính chưa vững.`);

  const last = rows[rows.length - 1];
  const avg = rows.reduce((a, r) => a + r.sales_tons, 0) / rows.length;
  const lastStock = [...rows].reverse().find((r) => r.stock_tons !== undefined);
  const summary = [
    `Dữ liệu bán hàng của doanh nghiệp do người dùng nhập (${rows.length} tháng, từ ${rows[0].month} đến ${last.month}):`,
    `- Lượng bán trung bình ${Math.round(avg)} tấn/tháng; tháng gần nhất (${last.month}) bán ${Math.round(last.sales_tons)} tấn.`,
    lastStock ? `- Tồn kho gần nhất (${lastStock.month}) là ${Math.round(lastStock.stock_tons!)} tấn.` : "- Không có số liệu tồn kho.",
    share !== null ? `- Thị phần ước tính ${share}% tổng xuất khẩu cả nước trong ${overlap} tháng trùng dữ liệu thị trường.` : "",
    "Bảng theo tháng (tháng, bán, tồn kho):",
    ...rows.slice(-24).map((r) => `${r.month}, ${Math.round(r.sales_tons)}, ${r.stock_tons !== undefined ? Math.round(r.stock_tons) : "-"}`),
  ].filter(Boolean).join("\n");
  return { rows, share_pct: share, overlap_months: overlap, summary, warnings };
}
