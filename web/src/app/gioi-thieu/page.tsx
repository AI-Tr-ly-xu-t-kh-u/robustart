import type { Metadata } from "next";
import { IconInfoCircle } from "@tabler/icons-react";
import { PageBand } from "@/components/PageBand";
import { getData } from "@/lib/data";
import { monthLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Giới thiệu" };

export default function Page() {
  const d = getData();
  return (
    <>
      <PageBand eyebrow="Giới thiệu" title="BeanCast là một đề tài nghiên cứu" icon={IconInfoCircle}>
        Trang duy nhất nói rõ bối cảnh: đây là đề tài nghiên cứu về dự báo nhu cầu và tối ưu tồn kho cà phê Robusta xuất khẩu của Việt Nam, chạy trên dữ liệu mẫu.
      </PageBand>
      <div className="bg-cream text-ink">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 py-10">
          <section className="card" aria-labelledby="pp">
            <h2 id="pp" className="text-2xl">Phương pháp</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-sm leading-relaxed">
              <li><strong>Chia thời gian:</strong> huấn luyện đến 2022, validation năm 2023 ({monthLabel(d.meta.val_start)}), kiểm tra từ {monthLabel(d.meta.test_start)} đến {monthLabel(d.meta.last_month)} (30 tháng).</li>
              <li><strong>Biến đặc trưng:</strong> mùa vụ của tháng dự báo, khối lượng các tháng trước và cùng tháng các năm trước, giá Robusta và biến động giá, lượng mưa bất thường 6–9 tháng trước, chỉ số cước.</li>
            </ul>
          </section>

          <section className="card" aria-labelledby="ai">
            <h2 id="ai" className="text-2xl">Phần ứng dụng AI</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-sm leading-relaxed">
              <li><strong>Agent ra quyết định:</strong> mô hình ngôn ngữ chọn và gọi 7 công cụ tính xác định (dự báo, xếp hạng thị trường, kịch bản, tồn kho, cảnh báo, so sánh chính sách, độ chính xác). Mô hình không tự tính số: mọi con số phải đến từ kết quả công cụ và được đối chiếu lại sau khi trả lời.</li>
              <li><strong>Tin tức thành kịch bản:</strong> AI rút tín hiệu giá và mưa từ bản tin, mỗi tín hiệu phải kèm trích dẫn nguyên văn có trong bản tin; mức thay đổi được kẹp trong miền mô hình hỗ trợ và người dùng chỉnh được trước khi tính lại.</li>
              <li><strong>Con người duyệt:</strong> agent chỉ khuyến nghị; người dùng chấp nhận hoặc từ chối và quyết định được ghi vào nhật ký trên trình duyệt.</li>
              <li><strong>Khi không có khóa mô hình ngôn ngữ:</strong> hệ thống chuyển sang bộ lập kế hoạch bằng luật, vẫn gọi cùng các công cụ. </li>
              <li><strong>Phạm vi:</strong> câu hỏi ngoài dữ liệu (ví dụ EUDR, điều kiện giao hàng) được trả lời bằng kiến thức chung của mô hình và gắn nhãn «không lấy từ dữ liệu BeanCast»; tài liệu quy định chưa được nạp nên ngày áp dụng cụ thể cần kiểm tra nguồn chính thức; dữ liệu và tin tức mẫu không phải số liệu thật.</li>
            </ul>
          </section>

          <section className="card" aria-labelledby="ct">
            <h2 id="ct" className="text-2xl">Công thức tồn kho</h2>
            <p className="mt-2 text-sm text-muted">s = thị phần, L = lead time (tháng) = số tuần / 4,345, P = L + 1 (khoảng bảo vệ, rà soát hàng tháng).</p>
            <ul className="mt-3 space-y-1 text-sm leading-relaxed">
              <li>F<sub>i</sub> = dự báo p50 tháng i của tổng xuất khẩu × s.</li>
              <li>D<sub>P</sub> = ΣF<sub>i</sub> trên P tháng; D<sub>L</sub> = ΣF<sub>i</sub> trên L tháng (phần lẻ tính theo tỉ lệ).</li>
              <li>σ<sub>P</sub> = √( Σ(sig_h[i]·s)² + (firm_noise · F̄)² · P ).</li>
              <li>Safety stock SS = z · σ<sub>P</sub>; ROP = D<sub>L</sub> + SS; mức tối đa S = D<sub>P</sub> + SS.</li>
              <li>Tồn kho bình quân ≈ SS + F<sub>1</sub>/2; chi phí lưu kho/tháng = tồn kho bình quân × (chi phí vốn × giá Robusta + 6 USD/tấn kho).</li>
            </ul>
          </section>

          <section className="card" aria-labelledby="gd">
            <h2 id="gd" className="text-2xl">Giả định của mô phỏng</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-sm leading-relaxed">
              <li>Doanh nghiệp giả định có thị phần {d.meta.share * 100}% tổng xuất khẩu, thêm nhiễu riêng {d.meta.firm_noise * 100}%.</li>
              <li>Hai chính sách: A theo kinh nghiệm và B theo dự báo của mô hình, so sánh trong 01/2024–06/2026.</li>
              <li>Tỷ giá USD/VND không làm đổi nhu cầu trong mô hình, chỉ đổi chi phí quy ra đồng.</li>
            </ul>
          </section>

          <section className="card border-2 border-warn/60" aria-labelledby="hc">
            <h2 id="hc" className="text-2xl">Hạn chế</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-sm leading-relaxed">
              <li><strong>Dữ liệu mẫu:</strong> số liệu là mô phỏng có mùa vụ rất rõ, không phải số liệu xuất khẩu thật. Mọi kết luận về mức giảm chi phí chỉ có giá trị trong mô phỏng này.</li>
              <li><strong>Doanh nghiệp giả định:</strong> không đại diện cho công ty có thật.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
