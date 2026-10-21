import type { Metadata } from "next";
import { Overview } from "@/components/Overview";
import { IconLayoutDashboard } from "@tabler/icons-react";
import { PageBand } from "@/components/PageBand";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <>
      <PageBand eyebrow="Dashboard" title="Bức tranh nhu cầu và rủi ro" icon={IconLayoutDashboard}>
        Chỉ số chính, cảnh báo theo quy tắc và các biến thị trường.
      </PageBand>
      <Overview />
    </>
  );
}
