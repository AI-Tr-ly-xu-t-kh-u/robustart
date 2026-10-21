/** Đường viền lượn sóng chuyển từ nền kem (header) sang nền espresso (nội dung). */
export function Wave() {
  return (
    <div aria-hidden="true" className="bg-cream leading-[0]">
      <svg viewBox="0 0 1440 90" preserveAspectRatio="none" className="block h-[54px] w-full sm:h-[90px]">
        <path d="M0 50 C 120 8, 240 8, 360 46 C 480 84, 600 84, 720 46 C 840 8, 960 8, 1080 46 C 1200 84, 1320 70, 1440 34 V90 H0 Z" fill="#2A1810" />
      </svg>
    </div>
  );
}
