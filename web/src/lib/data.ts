import raw from "@/data/results.json";
import type { Results } from "./schema";

/** Dữ liệu đã huấn luyện sẵn, nạp tĩnh. Cấu trúc được kiểm tra bằng zod ở máy chủ (xem validate.ts), không kiểm tra lại ở trình duyệt. */
export const data = raw as unknown as Results;

export function getData(): Results {
  return data;
}
