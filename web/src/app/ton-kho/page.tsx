import type { Metadata } from "next";
import { Inventory } from "@/components/Inventory";
import { IconPackage } from "@tabler/icons-react";
import { PageBand } from "@/components/PageBand";

export const metadata: Metadata = { title: "Tồn kho" };

export default function Page() {
  return (
    <>
      <PageBand eyebrow="Tồn kho" title="Từ dự báo đến mức tồn kho và kế hoạch về kho" icon={IconPackage}>
        Kéo các thanh trượt để xem tồn kho an toàn, điểm đặt hàng lại và kế hoạch 6 tháng thay đổi ra sao. Doanh nghiệp giả định.
      </PageBand>
      <Inventory />
    </>
  );
}
