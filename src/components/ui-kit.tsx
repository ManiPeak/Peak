// Peak 1.0.3 — UI Kit (3→1)
"use client";

/**
 * کلید اضطراری خاموش کردن — دکمهٔ قرمز شناور + میان‌بر Ctrl+Shift+K
 * روی همهٔ صفحه‌ها هست؛ فشردن آن همه‌چیز را همان لحظه متوقف می‌کند:
 * صدا، میکروفون، استریم‌ها و ربات ماینکرفت.
 */
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { triggerEmergency } from "@/lib/client";

export function EmergencyStop({ inline = false }: { inline?: boolean }) {
  const [done, setDone] = useState(false);

  const fire = async () => {
    await triggerEmergency("all").catch(() => undefined);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "K" || e.key === "k")) {
        e.preventDefault();
        void fire();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
     
  }, []);

  if (inline) {
    return (
      <button
        onClick={() => void fire()}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition active:scale-95 ${
          done
            ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
            : "border-red-400/40 bg-red-500/15 text-red-300 hover:bg-red-500/25"
        }`}
        title="توقف اضطراری همه‌چیز (Ctrl+Shift+K)"
      >
        <Zap size={14} />
        {done ? "✅ متوقف شد" : "اضطراری"}
      </button>
    );
  }

  return (
    <button
      onClick={() => void fire()}
      className={`fixed bottom-24 left-4 z-50 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold shadow-glow-red transition active:scale-95 md:bottom-6 ${
        done
          ? "bg-gradient-to-b from-emerald-500 to-emerald-700 text-white"
          : "bg-gradient-to-b from-red-500 to-red-700 text-white hover:brightness-110"
      }`}
      title="توقف اضطراری همه‌چیز (Ctrl+Shift+K)"
    >
      <Zap size={18} />
      {done ? "✅ همه‌چیز متوقف شد" : "خاموش اضطراری"}
    </button>
  );
}
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
"use client";

/**
 * اجزای مشترک رابط کاربری — دکمه، فیلد، کارت و تیتر
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/** تیتر صفحه */
export function PageTitle({
  title,
  subtitle
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white neon-text">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** دکمهٔ اصلی */
export function Btn({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "success";
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-bl from-blue-600 to-violet-600 text-white shadow-glow hover:brightness-110",
    ghost: "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
    danger:
      "bg-gradient-to-b from-red-500 to-red-700 text-white shadow-glow-red hover:brightness-110",
    success:
      "bg-gradient-to-b from-emerald-500 to-emerald-700 text-white hover:brightness-110"
  };
  return (
    <button
      className={`rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** فیلد ورودی متنی */
export function Field(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="field" {...props} />;
}

/** برچسب فرم */
export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-slate-400">
      {children}
    </label>
  );
}

/** کارت شیشه‌ای */
export function Card({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`glass p-5 ${className}`}>{children}</div>;
}

/** سوییچ روشن/خاموش */
export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition hover:bg-white/10"
    >
      <span className="text-slate-200">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? "bg-neon-cyan/80" : "bg-slate-600"
        }`}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={checked ? { right: "2px" } : { right: "22px" }}
        />
      </span>
    </button>
  );
}
