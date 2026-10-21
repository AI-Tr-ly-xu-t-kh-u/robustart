import "server-only";

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_CHARS = 20000;
export const ACCEPT = ".pdf,.docx,.txt,.md,.csv";

export interface Extracted { text: string; kind: "pdf" | "docx" | "text"; truncated: boolean; pages?: number }

const ext = (name: string) => name.toLowerCase().split(".").pop() ?? "";

/** Rút văn bản từ tệp ngay trong bộ nhớ; không lưu tệp. Ném lỗi có thông báo tiếng Việt khi không đọc được. */
export async function extractText(name: string, bytes: Uint8Array): Promise<Extracted> {
  if (bytes.byteLength > MAX_BYTES) throw new Error("Tệp quá lớn (tối đa 5 MB).");
  const e = ext(name);
  let text = "";
  let kind: Extracted["kind"] = "text";
  let pages: number | undefined;
  if (e === "pdf") {
    kind = "pdf";
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const r = await pdfText(pdf, { mergePages: true });
    text = Array.isArray(r.text) ? r.text.join("\n") : r.text;
    pages = r.totalPages;
  } else if (e === "docx") {
    kind = "docx";
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
  } else if (["txt", "md", "csv"].includes(e)) {
    text = new TextDecoder("utf-8").decode(bytes);
  } else {
    throw new Error("Chỉ hỗ trợ PDF, Word (.docx), TXT, MD và CSV. Với Excel, hãy lưu thành CSV rồi tải lên.");
  }
  text = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 20) throw new Error("Không đọc được nội dung chữ trong tệp (tệp scan ảnh chưa được hỗ trợ).");
  const truncated = text.length > MAX_CHARS;
  return { text: truncated ? text.slice(0, MAX_CHARS) : text, kind, truncated, pages };
}
