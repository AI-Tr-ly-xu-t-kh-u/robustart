import type { Metadata } from "next";
import { AgentPanel } from "@/components/AgentPanel";
import { IconRobot } from "@tabler/icons-react";
import { PageBand } from "@/components/PageBand";

export const metadata: Metadata = { title: "Trợ lý quyết định" };

export default function Page() {
  return (
    <>
      <PageBand eyebrow="Trợ lý quyết định" title="AI agent hỗ trợ ra quyết định xuất khẩu" icon={IconRobot}>
        Hỏi bất kỳ câu nào: khi liên quan dữ liệu, agent tự gọi công cụ (dự báo, kịch bản, tồn kho, cảnh báo) và đối chiếu mọi con số; khi ngoài dữ liệu, agent trả lời bằng kiến thức chung và gắn nhãn rõ. Bạn xem từng bước, rồi chấp nhận hoặc từ chối. Doanh nghiệp giả định.
      </PageBand>
      <div className="bg-cream text-ink">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <AgentPanel />
        </div>
      </div>
    </>
  );
}
