import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Wave } from "@/components/Wave";
import { Footer } from "@/components/Footer";
import { DataBar } from "@/components/DataBar";
import { MarketProvider } from "@/components/MarketContext";
import { ChatFab } from "@/components/ChatFab";
import { MotionProvider } from "@/components/Motion";
import { loaded } from "@/lib/validate";

const playfair = Playfair_Display({ subsets: ["latin", "vietnamese"], variable: "--font-playfair", display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin", "vietnamese"], variable: "--font-manrope", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "BeanCast · Dự báo nhu cầu và tồn kho cà phê Robusta", template: "%s · BeanCast" },
  description: "Dashboard dự báo nhu cầu xuất khẩu và tối ưu tồn kho cà phê nhân Robusta Việt Nam.",
};
export const viewport: Viewport = { themeColor: "#2A1810", width: "device-width", initialScale: 1 };

function LoadError({ issues }: { issues: string[] }) {
  return (
    <main className="mx-auto max-w-2xl p-8" role="alert">
      <h1 className="text-3xl">Không đọc được results.json</h1>
      <p className="mt-3">Tệp dữ liệu thiếu khóa hoặc sai cấu trúc. Hãy chạy lại <code>python ml/train.py</code> để tạo lại gói dữ liệu.</p>
      <ul className="mt-4 list-disc pl-6 text-sm">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
    </main>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${playfair.variable} ${manrope.variable}`}>
      <body className="min-h-screen flex flex-col">
        <a href="#noi-dung" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-espresso focus:text-cream focus:p-3">Bỏ qua điều hướng</a>
        {loaded.ok ? (
          <MotionProvider>
          <MarketProvider>
            <DataBar />
            <Header />
            <Wave />
            <main id="noi-dung" className="flex-1 bg-espresso">{children}</main>
            <Footer />
            <ChatFab />
          </MarketProvider>
          </MotionProvider>
        ) : (
          <LoadError issues={loaded.issues} />
        )}
      </body>
    </html>
  );
}
