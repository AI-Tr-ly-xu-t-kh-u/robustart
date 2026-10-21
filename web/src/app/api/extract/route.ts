import { extractText, MAX_BYTES } from "@/lib/extract";

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 10;
}

/** Nhận một tệp (multipart), trả về văn bản đã rút. Tệp không được lưu lại. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return Response.json({ error: "Bạn tải lên quá nhanh, vui lòng thử lại sau ít giây." }, { status: 429 });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES + 100_000) return Response.json({ error: "Tệp quá lớn (tối đa 5 MB)." }, { status: 413 });
  let file: File | null = null;
  try {
    const f = (await req.formData()).get("file");
    if (f instanceof File) file = f;
  } catch {
    return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }
  if (!file) return Response.json({ error: "Chưa chọn tệp." }, { status: 400 });
  try {
    const out = await extractText(file.name, new Uint8Array(await file.arrayBuffer()));
    return Response.json({ name: file.name, ...out });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Không đọc được tệp." }, { status: 422 });
  }
}
