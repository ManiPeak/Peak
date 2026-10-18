"use client";

/**
 * 🖥️ صفحهٔ نصب ویندوز — مرکز دانلود Peak
 *
 * نکتهٔ مهم: شمارهٔ نسخه از package.json خوانده می‌شود ولی لینک‌های دانلود همیشه
 * نام‌های ثابت `…-Latest.exe` هستند تا این صفحه با هر نسخهٔ جدید هم درست بماند.
 */
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  FileDown,
  Github,
  HelpCircle,
  Monitor,
  Package,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap
} from "lucide-react";
import pkg from "../../../package.json";

/* نشانی‌های ثابت — همیشه آخرین نسخهٔ منتشرشده */
const REPO = "ManiPeak/Peak";
const RELEASES_URL = `https://github.com/${REPO}/releases`;
const RELEASES_LATEST = `https://github.com/${REPO}/releases/latest`;
const SETUP_URL = `${RELEASES_LATEST}/download/Peak-Setup-Latest.exe`;
const PORTABLE_URL = `${RELEASES_LATEST}/download/Peak-Portable-Latest.exe`;
const ACTIONS_URL = `https://github.com/${REPO}/actions`;
const CHANGELOG_URL = `https://github.com/${REPO}/blob/main/CHANGELOG.md`;
const VERSION = pkg.version;

const QUICK_FACTS = [
  { icon: Zap, label: "بدون Node.js", desc: "Node داخل خود بسته است" },
  { icon: Monitor, label: "پنجرهٔ مستقل", desc: "نیازی به مرورگر نیست" },
  { icon: ShieldCheck, label: "نصب تمیز", desc: "میان‌بر دسکتاپ + استارت‌منو" }
] as const;

const INSTALL_STEPS = [
  {
    n: "۱",
    title: "دانلود و اجرا",
    desc: "فایل Peak-Setup-Latest.exe را دانلود و اجرا کن."
  },
  {
    n: "۲",
    title: "فقط محل نصب",
    desc: "در نصب‌کننده فقط محل نصب را انتخاب کن — بقیهٔ گزینه‌ها از پیش درست‌اند."
  },
  {
    n: "۳",
    title: "تمام!",
    desc: "دکمهٔ Install را بزن و از میان‌بر دسکتاپ برنامه را باز کن."
  }
] as const;

const WARNINGS = [
  {
    title: "SmartScreen",
    body: "روی More info و بعد Run anyway بزن.",
    code: "Windows protected your PC"
  },
  {
    title: "فایل بلاک‌شده",
    body: "راست‌کلیک روی فایل ← Properties ← تیک Unblock ← OK.",
    code: "Unblock"
  },
  {
    title: "آنتی‌ویروس",
    body: "فایل یا پوشهٔ نصب را در استثناها (Exclusion) بگذار.",
    code: "Add Exclusion"
  }
] as const;

const SHORTCUT_FIXES = [
  {
    cause: "Defender فایل Peak.exe را قرنطینه کرده",
    fix: "به برنامه اجازه بده (Add exclusion) و دوباره نصب کن — میان‌بر سالم می‌شود."
  },
  {
    cause: "میان‌بر به فایل موقت پرتابل اشاره دارد",
    fix: "میان‌بر جدید بساز و مستقیم به خودِ Peak-Portable-Latest.exe بده، نه فایل داخل %TEMP%."
  }
] as const;

function SectionTitle({
  icon: Icon,
  title,
  accent = "cyan"
}: {
  icon: typeof Zap;
  title: string;
  accent?: "cyan" | "violet" | "amber" | "green";
}) {
  const colors = {
    cyan: "text-neon-cyan",
    violet: "text-neon-violet",
    amber: "text-neon-amber",
    green: "text-neon-green"
  } as const;
  return (
    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
      <Icon size={20} className={colors[accent]} />
      {title}
    </h2>
  );
}

export default function DownloadsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* ── سربرگ ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-bl from-night-800 via-night-900 to-night-950 p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-neon-cyan/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-neon-violet/20 blur-3xl" />
        <div className="relative">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1 text-xs font-bold text-neon-cyan">
              نسخهٔ {VERSION}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              ویندوز ۱۰ / ۱۱ — ۶۴ بیت
            </span>
          </div>
          <h1 className="neon-text text-3xl font-extrabold leading-relaxed">
            نصب Peak روی ویندوز 🖥️
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-8 text-slate-300">
            دستیار هوش مصنوعی شخصی‌ات را در چند دقیقه نصب کن —{" "}
            <b className="text-white">بدون هیچ پیش‌نیازی</b>. Node.js داخل خود بسته
            است؛ فقط دانلود کن، نصب کن و لذت ببر.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={SETUP_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-blue-600 to-violet-600 px-7 py-3.5 text-sm font-bold text-white shadow-glow-violet transition hover:brightness-110 active:scale-95"
            >
              <Download size={18} /> دانلود نصب‌کننده
            </a>
            <a
              href={PORTABLE_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 active:scale-95"
            >
              <FileDown size={18} /> نسخهٔ پرتابل
            </a>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-2xl border border-white/10 px-5 py-3.5 text-sm text-slate-400 transition hover:text-white"
            >
              <Github size={16} /> صفحهٔ Releases
            </a>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {QUICK_FACTS.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <f.icon size={18} className="shrink-0 text-neon-cyan" />
                <div>
                  <p className="text-xs font-bold text-white">{f.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── کدام فایل؟ ── */}
      <div className="mt-8">
        <SectionTitle icon={Package} title="کدام فایل را دانلود کنم؟" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass card-hover rounded-2xl border border-neon-cyan/30 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-white">نصب‌کننده (Setup)</h3>
              <span className="rounded-full bg-neon-cyan/15 px-2.5 py-1 text-[10px] font-bold text-neon-cyan">
                پیشنهادی
              </span>
            </div>
            <p
              dir="ltr"
              className="rounded-lg bg-night-950/60 px-3 py-2 text-center text-xs text-neon-cyan"
            >
              Peak-Setup-Latest.exe
            </p>
            <ul className="mt-4 space-y-2 text-xs leading-6 text-slate-300">
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-neon-green" />
                مناسب تقریباً همهٔ کاربران ویندوز
              </li>
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-neon-green" />
                میان‌بر دسکتاپ و منوی استارت — خودکار
              </li>
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-neon-green" />
                در نصب فقط «محل نصب» را انتخاب کن
              </li>
            </ul>
            <a
              href={SETUP_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-600 to-violet-600 py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 active:scale-95"
            >
              <Download size={16} /> دانلود نصب‌کننده
            </a>
          </div>

          <div className="glass card-hover rounded-2xl border border-neon-violet/30 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-white">پرتابل (بدون نصب)</h3>
              <span className="rounded-full bg-neon-violet/15 px-2.5 py-1 text-[10px] font-bold text-neon-violet">
                فلش / مهمان
              </span>
            </div>
            <p
              dir="ltr"
              className="rounded-lg bg-night-950/60 px-3 py-2 text-center text-xs text-neon-violet"
            >
              Peak-Portable-Latest.exe
            </p>
            <ul className="mt-4 space-y-2 text-xs leading-6 text-slate-300">
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-neon-green" />
                بدون نصب — فقط اجرا کن
              </li>
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-neon-green" />
                مناسب فلش‌مموری و سیستم‌های بدون دسترسی نصب
              </li>
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-neon-green" />
                داده‌ها در %APPDATA%\Peak\data می‌مانند (نه روی فلش)
              </li>
            </ul>
            <a
              href={PORTABLE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-sm text-slate-200 transition hover:bg-white/10 active:scale-95"
            >
              <FileDown size={16} /> دانلود نسخهٔ پرتابل
            </a>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-6 text-slate-500">
          فایل‌های شماره‌دار (مثل{" "}
          <span dir="ltr">Peak-Setup-{VERSION}.exe</span>) همان نصب‌کننده با شمارهٔ
          نسخه‌اند و برای آرشیو نگه داشته می‌شوند — برای نصب معمولی همیشه همان{" "}
          <span dir="ltr">…-Latest.exe</span> را بردار.
        </p>
      </div>

      {/* ── نصب در ۳ قدم ── */}
      <div className="mt-8">
        <SectionTitle icon={Sparkles} title="نصب در ۳ قدم" accent="violet" />
        <div className="grid gap-4 sm:grid-cols-3">
          {INSTALL_STEPS.map((s) => (
            <div
              key={s.n}
              className="glass card-hover relative overflow-hidden rounded-2xl p-5"
            >
              <div className="pointer-events-none absolute -left-3 -top-3 text-6xl font-extrabold text-white/5">
                {s.n}
              </div>
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-neon-cyan/30 to-neon-violet/30 text-sm font-bold text-white">
                {s.n}
              </div>
              <h3 className="text-sm font-bold text-white">{s.title}</h3>
              <p className="mt-1.5 text-xs leading-6 text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── هشدارهای ویندوز ── */}
      <div className="mt-8">
        <SectionTitle icon={AlertTriangle} title="اگر ویندوز هشدار داد (طبیعی است)" accent="amber" />
        <p className="mb-4 text-xs leading-7 text-slate-400">
          برنامه هنوز امضای دیجیتال (Code Signing) ندارد؛ این هشدارها را با این
          قدم‌ها رد کن:
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {WARNINGS.map((w) => (
            <div
              key={w.title}
              className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5"
            >
              <h3 className="text-sm font-bold text-amber-300">{w.title}</h3>
              <p className="mt-2 text-xs leading-6 text-slate-300">{w.body}</p>
              <p
                dir="ltr"
                className="mt-2 inline-block rounded bg-night-950/60 px-2 py-1 text-[10px] text-amber-200/80"
              >
                {w.code}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── عیب‌یابی میان‌بر ── */}
      <div className="mt-8">
        <SectionTitle icon={HelpCircle} title="اگر میان‌بر «Missing Shortcut» داد" accent="green" />
        <div className="grid gap-4 sm:grid-cols-2">
          {SHORTCUT_FIXES.map((s) => (
            <div key={s.cause} className="glass rounded-2xl p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-white">
                <AlertTriangle size={16} className="shrink-0 text-neon-amber" />
                {s.cause}
              </p>
              <p className="mt-2.5 flex items-start gap-2 text-xs leading-6 text-slate-300">
                <Check size={15} className="mt-0.5 shrink-0 text-neon-green" />
                {s.fix}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-6 text-slate-500">
          نام اجرایی نصب‌شده همیشه{" "}
          <span dir="ltr" className="text-slate-400">
            Peak.exe
          </span>{" "}
          است (در config پین شده)؛ پس میان‌برهای ساخته‌شده توسط نصب‌کننده به هدف
          درست اشاره می‌کنند.
        </p>
      </div>

      {/* ── عیب‌یابی و لاگ ── */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl border border-white/10 p-6">
          <SectionTitle icon={ScrollText} title="برنامه باز نشد؟" />
          <p className="text-xs leading-7 text-slate-300">
            فایل لاگ را باز کن — خط‌های{" "}
            <span dir="ltr" className="rounded bg-night-950/60 px-1.5 py-0.5 text-neon-amber">
              [FATAL]
            </span>{" "}
            علت دقیق را می‌گویند:
          </p>
          <p
            dir="ltr"
            className="mt-3 rounded-xl bg-night-950/70 px-4 py-3 text-center text-xs text-neon-cyan"
          >
            %APPDATA%\Peak\data\peak-log.txt
          </p>
        </div>
        <div className="glass rounded-2xl border border-white/10 p-6">
          <SectionTitle icon={Terminal} title="اجرا از سورس (اختیاری)" />
          <ol className="space-y-2.5 text-xs leading-7 text-slate-300">
            <li>
              <b className="text-white">۱.</b> Node.js نسخهٔ ۲۰ به بالا را نصب کن
              (فقط برای اجرا از سورس).
            </li>
            <li>
              <b className="text-white">۲.</b>{" "}
              <span dir="ltr" className="rounded bg-night-950/60 px-1.5 py-0.5">
                release/start-peak.bat
              </span>{" "}
              را اجرا کن — خودش همه‌چیز را آماده می‌کند.
            </li>
            <li>
              <b className="text-white">۳.</b> از صفحهٔ تنظیمات، ارائه‌دهندهٔ هوش
              مصنوعی را انتخاب کن.
            </li>
          </ol>
        </div>
      </div>

      {/* ── ساخت خودکار + لینک‌ها ── */}
      <div className="mt-8">
        <SectionTitle icon={Github} title="ساخت خودکار در GitHub Actions" />
        <div className="glass rounded-2xl p-6">
          <p className="text-xs leading-7 text-slate-300">
            با هر push روی{" "}
            <span dir="ltr" className="rounded bg-night-950/60 px-1.5 py-0.5">
              main
            </span>{" "}
            یا ساخت تگ{" "}
            <span dir="ltr" className="rounded bg-night-950/60 px-1.5 py-0.5">
              v*
            </span>
            ، ورک‌فلوی <b className="text-white">Build Windows EXE</b> خودش
            نصب‌کننده و پرتابل را می‌سازد، بسته را بازرسی می‌کند و در Releases
            منتشر می‌کند — به‌همراه راهنمای نصب و یادداشت انتشار.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={ACTIONS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
            >
              <ExternalLink size={16} /> صفحهٔ Actions
            </a>
            <a
              href={CHANGELOG_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
            >
              <ScrollText size={16} /> تاریخچهٔ نسخه‌ها
            </a>
            <a
              href={RELEASES_LATEST}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
            >
              <Download size={16} /> آخرین نسخهٔ منتشرشده
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
