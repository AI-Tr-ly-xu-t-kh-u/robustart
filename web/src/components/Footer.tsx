import Link from "next/link";
import { Logo } from "./Logo";
import { getData } from "@/lib/data";

export function Footer() {
  const d = getData();
  return (
    <footer className="on-dark bg-roast text-cream">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-3">
        <div>
          <Logo tone="light" />
          <p className="mt-3 text-sm text-cream/75">Dự báo nhu cầu và tối ưu tồn kho cà phê nhân Robusta xuất khẩu của Việt Nam.</p>
        </div>
        <nav aria-label="Liên kết chân trang" className="text-sm">
          <ul className="grid grid-cols-2 gap-2">
            {[["/tong-quan", "Dashboard"], ["/thi-truong", "Thị trường"], ["/du-bao", "Dự báo"], ["/ton-kho", "Tồn kho"], ["/tro-ly", "Trợ lý quyết định"], ["/van-chuyen", "Vận chuyển"], ["/tin-tuc", "Tin tức"], ["/gioi-thieu", "Giới thiệu"]].map(([h, l]) => (
              <li key={h}><Link href={h} className="hover:text-caramel underline-offset-4 hover:underline">{l}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="text-sm text-cream/75">
          
          <p className="mt-2">Mô phỏng tồn kho là của một doanh nghiệp giả định (thị phần {d.meta.share * 100}%), không phải của công ty có thật.</p>
        </div>
      </div>
      <div className="border-t border-cream/10 py-4 text-center text-xs text-cream/60">© BeanCast · Giao diện lấy cảm hứng từ phong cách quán cà phê, không dùng ảnh hay thương hiệu của bên thứ ba.</div>
    </footer>
  );
}
