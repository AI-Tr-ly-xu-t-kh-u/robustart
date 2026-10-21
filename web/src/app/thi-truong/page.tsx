import type { Metadata } from "next";
import { MarketMap } from "@/components/MarketMap";
import { IconWorld } from "@tabler/icons-react";
import { PageBand } from "@/components/PageBand";

export const metadata: Metadata = { title: "Thị trường" };

export default function Page() {
  return (
    <>
      <PageBand eyebrow="Thị trường" title="Xuất khẩu theo thị trường nhập khẩu" icon={IconWorld}>
        Bản đồ tô màu theo dự báo 3 tháng tới. Bấm vào thị trường để xem dự báo chi tiết.
      </PageBand>
      <MarketMap />
    </>
  );
}
