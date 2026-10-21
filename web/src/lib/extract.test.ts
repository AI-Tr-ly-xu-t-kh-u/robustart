import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { extractText } from "./extract";

const D = `${process.cwd()}/src/lib/fixtures`;
it("pdf", async () => { const r = await extractText("tin.pdf", new Uint8Array(readFileSync(`${D}/tin.pdf`))); expect(r.text).toContain("Robusta"); });
it("docx", async () => { const r = await extractText("tin.docx", new Uint8Array(readFileSync(`${D}/tin.docx`))); expect(r.text).toContain("Tây Nguyên"); });
it("loại tệp lạ", async () => { await expect(extractText("a.exe", new Uint8Array([1, 2, 3]))).rejects.toThrow(/Chỉ hỗ trợ/); });
