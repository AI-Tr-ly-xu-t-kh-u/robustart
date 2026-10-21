import raw from "@/data/results.json";
import { parseResults, type LoadResult } from "./schema";

/** Kiểm tra cấu trúc results.json bằng zod (chạy ở server khi dựng trang). */
export const loaded: LoadResult = parseResults(raw);
