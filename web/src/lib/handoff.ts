import type { ScenarioInput } from "./agent";

/** Chuyển kịch bản từ trang Tin tức sang trang Quyết định AI qua sessionStorage (chỉ trong phiên trình duyệt, không gửi lên máy chủ cho tới khi người dùng chạy agent). */
export interface Handoff {
  question: string;
  scenario: ScenarioInput;
  excerpt: string;
  at: string;
}

const KEY = "beancast-handoff";

export function saveHandoff(h: Handoff): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(h)); } catch { /* không lưu được: agent mở bình thường, không có kịch bản */ }
}

/** Đọc một lần rồi xóa, để tải lại trang không tự chạy lại. */
export function takeHandoff(): Handoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const h = JSON.parse(raw) as Handoff;
    return typeof h?.question === "string" && h.scenario && typeof h.scenario.price_change_pct === "number" ? h : null;
  } catch {
    return null;
  }
}

const NEWS_KEY = "beancast-news";

/** Chuyển nội dung tra cứu từ chatbot sang trang Tin tức để rút tín hiệu và chỉnh kịch bản. */
export function saveNews(text: string): void {
  try { sessionStorage.setItem(NEWS_KEY, text.slice(0, 20000)); } catch { /* bỏ qua */ }
}

export function takeNews(): string | null {
  try {
    const t = sessionStorage.getItem(NEWS_KEY);
    if (t) sessionStorage.removeItem(NEWS_KEY);
    return t;
  } catch {
    return null;
  }
}
