import type { Metadata } from "next";
import { IconNews } from "@tabler/icons-react";
import { NewsPanel } from "@/components/NewsPanel";
import { PageBand } from "@/components/PageBand";

export const metadata: Metadata = { title: "Tin tức thành kịch bản" };

export default function Page() {
  return (
    <>
      <PageBand eyebrow="Tin tức thành kịch bản" title="AI đọc tin, chỉnh kịch bản dự báo" icon={IconNews}>
        Dán một bản tin, AI rút ra tín hiệu về giá và mưa kèm trích dẫn nguyên văn, đổi thành kịch bản trong miền kịch bản hỗ trợ rồi tính lại nhu cầu và tồn kho. Bạn luôn là người duyệt và chỉnh.
      </PageBand>
      <div className="bg-cream text-ink">
        <div className="mx-auto max-w-5xl px-6 py-10"><NewsPanel /></div>
      </div>
    </>
  );
}
