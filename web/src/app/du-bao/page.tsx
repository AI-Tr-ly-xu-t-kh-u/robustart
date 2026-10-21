import type { Metadata } from "next";
import { Forecast } from "@/components/Forecast";
import { IconChartLine } from "@tabler/icons-react";
import { PageBand } from "@/components/PageBand";

export const metadata: Metadata = { title: "Dự báo" };

export default function Page() {
  return (
    <>
      <PageBand eyebrow="Dự báo" title="Nhu cầu 6 tháng tới và độ tin cậy" icon={IconChartLine}>
        Nhu cầu 6 tháng tới theo từng thị trường và những yếu tố đang tác động đến nó.
      </PageBand>
      <Forecast />
    </>
  );
}
