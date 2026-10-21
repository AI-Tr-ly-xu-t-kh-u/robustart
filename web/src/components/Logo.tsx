export function Logo({ className = "", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const fg = tone === "dark" ? "#2A1810" : "#F4E6D6";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true">
        <ellipse cx="20" cy="20" rx="13" ry="17" transform="rotate(30 20 20)" fill={tone === "dark" ? "#3E2415" : "#E2B98A"} />
        <path d="M13 31 C 17 22, 23 18, 28 9" stroke={tone === "dark" ? "#E2B98A" : "#2A1810"} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M30 28 q6 -2 8 -9 q-7 0 -8 9z" fill="#7FA66B" />
      </svg>
      <span className="font-serif text-2xl font-semibold tracking-tight" style={{ color: fg }}>BeanCast</span>
    </span>
  );
}
