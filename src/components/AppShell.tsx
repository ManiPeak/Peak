"use client";

/**
 * پوستهٔ برنامه — سایدبار ناوبری راست‌چین با برند Peak + ناوبری موبایل
 * + دکمهٔ شناور کلید اضطراری روی همهٔ صفحه‌ها
 */
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  Download,
  Gamepad2,
  MessageSquare,
  Mic,
  Puzzle,
  Settings,
  ShieldCheck,
  Zap
} from "lucide-react";
import { PeakLogo } from "@/components/ui-kit";
import { EmergencyStop } from "@/components/ui-kit";
import { prewarmTTS } from "@/lib/client";

const NAV_ITEMS = [
  { href: "/", label: "چت", icon: MessageSquare },
  { href: "/voice", label: "صوت", icon: Mic },
  { href: "/memory", label: "حافظه", icon: Brain },
  { href: "/minecraft", label: "ماینکرفت", icon: Gamepad2 },
  { href: "/mods", label: "مودها", icon: Puzzle },
  { href: "/permissions", label: "دسترسی", icon: ShieldCheck },
  { href: "/emergency", label: "اضطراری", icon: Zap },
  { href: "/settings", label: "تنظیمات", icon: Settings },
  { href: "/downloads", label: "دانلود", icon: Download }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // گرم‌سازی موتور صدا در اولین تعامل — حذف تأخیر اولیهٔ گفتار
  useEffect(() => {
    const warm = () => prewarmTTS();
    warm();
    window.addEventListener("pointerdown", warm, { once: true });
    return () => window.removeEventListener("pointerdown", warm);
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* سایدبار دسکتاپ (سمت راست) */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-20 flex-col items-center gap-1.5 overflow-y-auto border-l border-white/10 bg-night-900/60 py-6 backdrop-blur-xl md:flex">
        {/* برند Peak */}
        <Link
          href="/"
          className="group mb-1 flex flex-col items-center gap-1.5"
          title="Peak — صفحهٔ اصلی"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-cyan via-sky-400 to-neon-violet text-night-950 shadow-glow transition group-hover:scale-105 group-hover:brightness-110">
            <PeakLogo size={26} />
          </div>
          <span className="text-[10px] font-black tracking-[0.22em] text-slate-300">
            PEAK
          </span>
        </Link>

        <div className="my-2 h-px w-10 bg-gradient-to-l from-transparent via-white/15 to-transparent" />

        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex w-14 flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] transition ${
                active
                  ? "bg-gradient-to-b from-white/15 to-white/5 text-neon-cyan shadow-glow ring-1 ring-neon-cyan/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}

        <div className="mt-auto h-16 w-16 rounded-full bg-gradient-to-t from-neon-violet/20 to-transparent blur-xl" />
      </aside>

      {/* محتوا */}
      <main className="w-full pb-24 md:mr-20 md:pb-0">{children}</main>

      {/* کلید اضطراری شناور — روی همهٔ صفحه‌ها */}
      <EmergencyStop />

      {/* ناوبری پایین موبایل */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around overflow-x-auto border-t border-white/10 bg-night-900/90 py-2 backdrop-blur-xl md:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[10px] transition ${
                active
                  ? "bg-white/10 text-neon-cyan shadow-glow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
