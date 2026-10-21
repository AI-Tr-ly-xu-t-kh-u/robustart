import type { Results } from "./schema";
import { MARKET_LABEL, MARKET_SHORT, type Market } from "./constants";
import { changeOver, horizonSum, marketRanking, sum } from "./derived";
import { fmt, monthLabel, pct, signedPct } from "./format";
import { seasonalIndex } from "./insights";

/**
 * Câu «điều này nghĩa là gì» cho từng biểu đồ, viết cho người ra quyết định: nói việc nên làm, không nói về mô hình.
 * Mọi con số đều tính từ results.json.
 */
const MONTH_NAMES = ["tháng 1", "tháng 2", "tháng 3", "tháng 4", "tháng 5", "tháng 6", "tháng 7", "tháng 8", "tháng 9", "tháng 10", "tháng 11", "tháng 12"];
const short = (m: Market) => MARKET_SHORT[m];

export function forecastInsight(d: Results, market: Market): string {
  const f = d.forecast[market];
  const tot = sum(f.map((x) => x.p50));
  const ly = sum(f.map((x) => x.ly));
  const peak = f.reduce((a, b) => (b.p50 > a.p50 ? b : a));
  const low = f.reduce((a, b) => (b.p50 < a.p50 ? b : a));
  const band = sum(f.map((x) => x.p90 - x.p10)) / tot;
  const dir = tot >= ly ? "tăng" : "giảm";
  return `${MARKET_LABEL[market]} dự kiến ${dir} ${signedPct(tot / ly - 1)} so với cùng kỳ năm trước (${fmt(tot, 0)} kt trong 6 tháng). Nhu cầu cao nhất vào ${monthLabel(peak.month)}, thấp nhất vào ${monthLabel(low.month)}: hãy chốt hàng và vận tải cho tháng cao điểm sớm hơn. Vùng bất định rộng khoảng ${pct(band, 0)} so với dự báo, nên đừng cam kết sát từng tấn mà giữ một phần linh hoạt.`;
}

export function seasonInsight(d: Results): string {
  const { index } = seasonalIndex(d);
  const r = index.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const top = r[0], bottom = r[r.length - 1];
  return `Xuất khẩu cao nhất vào ${MONTH_NAMES[top.i]} (${signedPct(top.v - 1, 0)} so với trung bình năm) và thấp nhất vào ${MONTH_NAMES[bottom.i]} (${signedPct(bottom.v - 1, 0)}). Hãy gom hàng và đặt chỗ vận tải trước tháng cao điểm, và dùng giai đoạn thấp điểm để tiêu hao tồn kho cũ và đàm phán hợp đồng.`;
}

export function marketsInsight(d: Results): string {
  const rank = marketRanking(d, 3);
  const bySize = [...rank].sort((a, b) => b.p50 - a.p50);
  const total = sum(rank.map((r) => r.p50));
  const fastest = rank[0], slowest = rank[rank.length - 1];
  return `${short(bySize[0].market)} chiếm ${pct(bySize[0].p50 / total, 0)} nhu cầu dự báo của 5 thị trường, nên là nơi cần giữ hàng ổn định nhất. ${short(fastest.market)} tăng nhanh nhất (${signedPct(fastest.change)}): đáng thử tăng chào bán. ${short(slowest.market)} chậm nhất (${signedPct(slowest.change)}): chưa cần ưu tiên thêm hàng ở đây.`;
}

export function mixInsight(d: Results): string {
  const h = d.history;
  const n = h.month.length;
  const share = (from: number, to: number) => sum(h.vol_EU_kt.slice(from, to)) / sum(h.vol_kt.slice(from, to));
  const now = share(n - 12, n), before = share(n - 48, n - 36);
  const diff = now - before;
  return `EU chiếm ${pct(now, 0)} khối lượng xuất 12 tháng gần nhất, ${diff >= 0 ? "tăng" : "giảm"} ${fmt(Math.abs(diff) * 100, 1)} điểm phần trăm so với 3 năm trước. Phụ thuộc nhiều vào một thị trường nghĩa là một thay đổi về quy định hay nhu cầu ở đó ảnh hưởng rất mạnh đến doanh thu: nên giữ kế hoạch dự phòng cho các thị trường còn lại.`;
}

export function priceVolumeInsight(d: Results): string {
  const h = d.history;
  const n = h.month.length;
  const p12 = h.price_usd_t[n - 1] / h.price_usd_t[n - 13] - 1;
  const v12 = sum(h.vol_kt.slice(n - 12)) / sum(h.vol_kt.slice(n - 24, n - 12)) - 1;
  return `Trong 12 tháng qua giá Robusta ${p12 >= 0 ? "tăng" : "giảm"} ${signedPct(p12, 0)} còn khối lượng xuất ${v12 >= 0 ? "tăng" : "giảm"} ${signedPct(v12, 0)}. Hai đường này không chứng minh cái này gây ra cái kia, nhưng khi giá biến động mạnh hãy xem lại giá chốt hợp đồng và mức tồn kho đang giữ, vì giá đổi làm đổi giá trị hàng đang nằm trong kho.`;
}

export function mapInsight(d: Results): string {
  const rank = marketRanking(d, 3);
  const up = rank.filter((r) => r.change > 0);
  const down = rank.filter((r) => r.change < 0);
  return `${up.length} trên ${rank.length} thị trường dự kiến tăng trong 3 tháng tới${down.length ? `, riêng ${down.map((r) => short(r.market)).join(", ")} giảm` : ""}. Màu đậm là nơi khối lượng lớn: ưu tiên nguồn hàng và tàu cho các vùng đậm, và xem xếp hạng bên dưới để chọn thị trường cần đẩy bán.`;
}

export function trackingInsight(d: Results): string {
  const price = changeOver(d, "price_usd_t");
  const fx = changeOver(d, "usdvnd");
  const freight = changeOver(d, "freight_idx");
  const parts = [`giá Robusta ${signedPct(price, 0)}`, `USD/VND ${signedPct(fx, 0)}`, `cước ${signedPct(freight, 0)}`];
  return `Ba tháng qua: ${parts.join(", ")}. Giá và cước đổi nhiều là tín hiệu để xem lại giá chào và thời điểm đặt tàu; tỷ giá chỉ đổi giá trị quy ra đồng của chi phí kho, không đổi lượng hàng cần giữ.`;
}

export function driversInsight(d: Results): string {
  const items = Object.entries(d.shap.h3_global).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  return `Ba yếu tố ảnh hưởng nhiều nhất đến dự báo là ${items.join(", ")}. Đây là các chỉ số bạn nên theo dõi hằng tháng: khi chúng đổi bất thường, hãy cập nhật lại kế hoạch đặt hàng thay vì chờ đến cuối quý.`;
}

export function planInsight(args: { inbound3: number; inbound6: number; peakMonth: string; peakInbound: number; unit: string }): string {
  return `Cần về kho ${fmt(args.inbound3, 0)} ${args.unit} trong 3 tháng đầu và ${fmt(args.inbound6, 0)} ${args.unit} trong 6 tháng. Đợt lớn nhất là ${args.peakMonth} (${fmt(args.peakInbound, 0)} ${args.unit}): hãy đặt hàng sớm bằng thời gian giao hàng (lead time) để không thiếu hàng đúng lúc cao điểm.`;
}

export const totalChange = (d: Results) => horizonSum(d, "Total", 6).change;
