import type { Metadata } from "next";
import { IconRoute } from "@tabler/icons-react";
import { Logistics } from "@/components/Logistics";
import { PageBand } from "@/components/PageBand";

export const metadata: Metadata = { title: "Vận chuyển" };

export default function Page() {
  return (
    <>
      <PageBand eyebrow="Vận chuyển" title="Cước tàu và tuyến đến cảng" icon={IconRoute}>
        Theo dõi cước vận tải, chọn thời điểm đặt tàu và so sánh tuyến từ kho ra cảng theo chi phí và khí thải. Số liệu tuyến là giả định bạn có thể sửa.
      </PageBand>
      <Logistics />
    </>
  );
}
