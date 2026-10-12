/**
 * لوگوی Peak — نشان کوه‌قله با کلاه‌برفی و خورشید
 */
export function PeakLogo({
  size = 24,
  className = ""
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* قلهٔ اصلی */}
      <path d="M16 4.5L28.5 27.5H3.5L16 4.5Z" fill="currentColor" />
      {/* کلاه‌برفی */}
      <path d="M16 4.5L21.8 15H10.2L16 4.5Z" fill="#e2e8f0" />
      {/* قلهٔ کوچک پشت */}
      <path d="M23 27.5L27 19L31 27.5H23Z" fill="currentColor" opacity="0.55" />
      {/* خورشید */}
      <circle cx="24.2" cy="8.2" r="2.6" fill="#fbbf24" />
    </svg>
  );
}
