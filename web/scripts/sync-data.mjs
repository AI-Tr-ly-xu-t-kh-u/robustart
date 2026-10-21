// Sao chép data/results.json (gói dữ liệu đã huấn luyện) vào src/data để web nạp tĩnh. Không sinh hay sửa số liệu.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../data/results.json");
const dst = resolve(here, "../src/data/results.json");
if (existsSync(src)) {
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  console.log("[sync-data] đã chép results.json");
} else if (existsSync(dst)) {
  console.log("[sync-data] không thấy ../data/results.json, dùng bản đã có trong src/data");
} else {
  console.error("[sync-data] thiếu results.json");
  process.exit(1);
}
