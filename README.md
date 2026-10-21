# BeanCast – web ứng dụng AI hỗ trợ quyết định xuất khẩu (`web/`)

Next.js (App Router) + TypeScript + Tailwind v4 + ECharts. Web đọc `data/results.json` (đã huấn luyện sẵn), không train và không sinh số liệu.
Mọi con số trong khuyến nghị đến từ công cụ xác định trên dữ liệu này và được đối chiếu lại; thiếu số thì hiện «Chưa có dữ liệu».

## Chạy

```bash
cd web
npm install
npm run dev          # http://localhost:3000  (tự chép ../data/results.json vào src/data)
npm run build && npx next start -p 3100
npm test             # 82 test (81 chạy, 1 bỏ qua): tồn kho, nội suy, dữ liệu, cảnh báo, insight, agent, tin tức, tệp, logistics, chatbot
npm run lint && npm run typecheck
EVAL=1 npx vitest run src/lib/agent.eval.test.ts   # đánh giá agent 12 câu, ghi src/data/agent_eval.json
```

## Trang

| Đường dẫn | Nội dung |
|---|---|
| `/` | Trang chủ: hero, 3 thẻ giá trị, dải số, 4 bước |
| `/tong-quan` (Dashboard) | KPI, biểu đồ kèm insight, cảnh báo theo quy tắc, theo dõi thị trường |
| `/thi-truong` | Bản đồ xuất khẩu và xếp hạng thị trường |
| `/du-bao` | Dự báo theo thị trường và yếu tố tác động |
| `/ton-kho` | What-if tồn kho cho doanh nghiệp giả định |
| `/tro-ly` (Quyết định AI) | Agent gọi công cụ, truy vết từng bước, đối chiếu số liệu, người duyệt |
| `/tin-tuc` | AI đọc tin/tệp, rút tín hiệu có trích dẫn, đổi thành kịch bản |
| `/van-chuyen` | Cước tàu và so sánh tuyến kho ra cảng |
| `/gioi-thieu` | Phương pháp, phần AI, giả định, hạn chế |

## Cấu trúc chính

| Đường dẫn | Việc |
|---|---|
| `src/lib/schema.ts`, `validate.ts` | Kiểm tra cấu trúc results.json bằng zod (ở server) |
| `src/lib/inventory.ts`, `scenario.ts` | Công thức tồn kho (có test tính tay) và nội suy kịch bản giá × mưa |
| `src/lib/derived.ts`, `insights.ts`, `chart-insights.ts` | KPI, cảnh báo, xếp hạng, insight thẻ, nhận định dưới biểu đồ |
| `src/lib/tools.ts` | 9 công cụ xác định cho agent + `groundingCheck` (đối chiếu số liệu) |
| `src/lib/agent.ts`, `src/app/api/agent/route.ts` | Vòng lặp agent (Groq/OpenAI-compatible), bộ luật dự phòng, kịch bản chạy sẵn, luồng NDJSON |
| `src/lib/news.ts`, `src/app/api/news/route.ts` | Rút tín hiệu từ tin, kiểm tra bằng chứng, kịch bản |
| `src/lib/extract.ts`, `src/app/api/extract/route.ts` | Đọc PDF, Word, TXT, MD, CSV (không lưu tệp) |
| `src/lib/company.ts` | CSV doanh nghiệp: ước tính thị phần, tóm tắt cho agent |
| `src/lib/logistics.ts` | Triển vọng cước theo mùa, so sánh tuyến (giả định sửa được) |
| `src/lib/handoff.ts` | Chuyển kịch bản (Tin tức → Quyết định AI) và nội dung tra cứu (Chatbot → Tin tức) qua sessionStorage |
| `src/lib/llm.ts`, `src/app/api/chat/route.ts` | Adapter mô hình ngôn ngữ, tìm kiếm web (Groq `browser_search`), chatbot tra cứu |
| `src/lib/chat.ts` | Bộ luật chatbot dự phòng trên results.json |
| `src/lib/agent.eval.test.ts` | Bộ 12 câu đánh giá agent (không hiện trên web) |

## Mô hình ngôn ngữ và khóa API

Điền vào `beancast/.env` (đã trong `.gitignore`, mẫu ở `.env.example`):

```
LLM_PROVIDER=groq          # groq | openai | anthropic
LLM_API_KEY=...
LLM_MODEL=openai/gpt-oss-120b
LLM_BASE_URL=              # tùy chọn
```

`src/lib/llm.ts` đọc các biến `LLM_*` từ tệp này ở **máy chủ**; khóa không bao giờ xuống trình duyệt, không ghi log.
- Không có khóa: agent và đọc tin chạy bằng bộ luật; chatbot trả lời từ dữ liệu có sẵn.
- Agent gọi công cụ chỉ với nhà cung cấp tương thích OpenAI (Groq, OpenAI); `anthropic` rơi về bộ luật.
- Tìm kiếm web của chatbot chỉ bật với Groq + model `gpt-oss`.
- Gói Groq có giới hạn token theo phút: tài liệu dài (chỉ 6.000 ký tự đầu được đưa cho mô hình) hoặc hỏi dồn có thể bị từ chối và rơi về bộ luật.

## Ảnh hero

`public/images/hero-latte.webp` là ảnh người dùng cung cấp. Thay bằng ảnh có bản quyền của bạn trước khi công khai (cùng tên) và chỉnh `src/components/Hero.tsx` nếu tỉ lệ khác.

## Điều cần nhớ khi trình bày

- Dữ liệu là dữ liệu mẫu mô phỏng và doanh nghiệp là giả định. **Nhãn «Đang dùng dữ liệu mẫu» đã được gỡ khỏi giao diện theo yêu cầu** (`DataBar.tsx` và `SampleNote` trả về `null`): hãy nói rõ bằng lời hoặc khôi phục nhãn trước khi công khai.
- Mức giảm chi phí 38,4% (L = 2 tháng, dịch vụ 95%) chỉ đúng trong mô phỏng doanh nghiệp giả định.
- Tỷ giá USD/VND không đổi nhu cầu hay tồn kho, chỉ đổi chi phí quy ra đồng.
- Bảng tuyến vận chuyển là giả định minh họa; chưa có dữ liệu tắc nghẽn cảng hay lịch EUDR. Câu trả lời kiến thức chung và tìm kiếm web có thể sai hoặc lỗi thời.
- Chưa đọc Excel (lưu thành CSV) và PDF scan ảnh. Bộ đánh giá agent chỉ có 12 câu, không chứng minh tổng quát.
- `npm audit` cảnh báo mức trung bình ở phụ thuộc của `mammoth`; cân nhắc trước khi triển khai công khai.
