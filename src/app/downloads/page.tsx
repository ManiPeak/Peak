"use client";

/**
 * مرکز دانلود — پکیج ویندوز و راهنمای ساخت EXE
 *
 * نکتهٔ مهم: هیچ شمارهٔ نسخه‌ای در متن‌ها هاردکد نشده؛ همه‌جا نام‌های ثابت
 * `…-Latest.exe` استفاده می‌شود تا این صفحه با هر نسخهٔ جدید هم درست بماند.
 */
import {
  Download,
  ExternalLink,
  FileDown,
  Github,
  Monitor,
  Package,
  Terminal
} from "lucide-react";
import { Card, PageTitle } from "@/components/ui";

/* نشانی‌های ثابت — همیشه آخرین نسخهٔ منتشرشده */
const REPO = "ManiPeak/Peak";
const RELEASES_LATEST = `https://github.com/${REPO}/releases/latest`;
const SETUP_URL = `${RELEASES_LATEST}/download/Peak-Setup-Latest.exe`;
const PORTABLE_URL = `${RELEASES_LATEST}/download/Peak-Portable-Latest.exe`;
const ACTIONS_URL = `https://github.com/${REPO}/actions`;

export default function DownloadsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageTitle
        title="مرکز دانلود"
        subtitle="برنامه روی ویندوز اجرا می‌شه — یا مستقیم نصب کن، یا خودت EXE بساز."
      />

      {/* کدام فایل را دانلود کنم؟ */}
      <Card className="mb-6 border border-white/10">
        <h2 className="mb-3 text-base font-bold text-white">
          کدام فایل را دانلود کنم؟
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm leading-7 text-slate-300">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-2 text-right font-medium">فایل</th>
                <th className="pb-2 text-right font-medium">برای چه کسی</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-white/10">
                <td className="py-2 pl-4">
                  <span dir="ltr" className="rounded bg-white/10 px-1.5 py-0.5">
                    Peak-Setup-Latest.exe
                  </span>
                </td>
                <td className="py-2">
                  تقریباً همه — نصب عادی روی ویندوز (میان‌بر دسکتاپ و استارت‌منو)
                </td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="py-2 pl-4">
                  <span dir="ltr" className="rounded bg-white/10 px-1.5 py-0.5">
                    Peak-Portable-Latest.exe
                  </span>
                </td>
                <td className="py-2">
                  اجرای بدون نصب — مناسب فلش‌مموری و سیستم‌هایی که دسترسی نصب
                  ندارن
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-6 text-slate-400">
          فایل‌های شماره‌دار (مثل{" "}
          <span dir="ltr">Peak-Setup-1.0.1.exe</span>) همون نصب‌کننده با شمارهٔ
          نسخه‌ان و برای نگه‌داشتن نسخهٔ قدیمی می‌آن — برای نصب معمولی همیشه
          همون <span dir="ltr">…-Latest.exe</span> را بردار.
        </p>
      </Card>

      {/* دانلود مستقیم */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="border border-neon-cyan/30">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-cyan/30 to-neon-violet/30 shadow-glow">
            <Monitor size={24} className="text-neon-cyan" />
          </div>
          <h2 className="text-lg font-bold text-white">
            نصب‌کنندهٔ ویندوز (Peak Setup)
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            فایل <span dir="ltr">Peak-Setup-Latest.exe</span> با NSIS ساخته
            می‌شه؛ نصب تمیز، میان‌بر در دسکتاپ و استارت‌منو. برنامه پنجرهٔ مستقل
            خودش را باز می‌کند —{" "}
            <b className="text-slate-300">نیازی به مرورگر نیست</b>.
          </p>
          <p className="mt-3 rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 p-3 text-sm leading-7 text-slate-300">
            <b className="text-white">در نصب فقط محل نصب را انتخاب کن</b> — همهٔ
            گزینه‌های دیگر از پیش درست تنظیم شده‌اند (میان‌بر دسکتاپ ✅، منوی
            استارت ✅). <b className="text-white">Node.js لازم نیست</b>؛ داخل
            خود بسته است.
          </p>
          <a
            href={SETUP_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex w-fit items-center gap-2 rounded-xl bg-gradient-to-bl from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-glow transition hover:brightness-110"
          >
            <Download size={16} /> دانلود نصب‌کننده
          </a>
        </Card>

        <Card className="border border-neon-violet/30">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-violet/30 to-neon-pink/30 shadow-glow-violet">
            <Package size={24} className="text-neon-violet" />
          </div>
          <h2 className="text-lg font-bold text-white">نسخهٔ پرتابل</h2>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            بدون نصب، فقط اجرا کن. مناسب فلش‌مموری و سیستم‌هایی که دسترسی نصب
            ندارن.
          </p>
          <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-6 text-slate-400">
            داده‌های برنامه (دیتابیس، حافظه، تنظیمات) در{" "}
            <span dir="ltr">%APPDATA%\Peak\data</span> ذخیره می‌شه؛ پس با
            پرتابل هم چیزی روی خودِ فلش نوشته نمی‌شه.
          </p>
          <a
            href={PORTABLE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
          >
            <FileDown size={16} /> دانلود نسخهٔ پرتابل
          </a>
        </Card>
      </div>

      {/* اگر ویندوز هشدار داد */}
      <Card className="mb-6 border border-amber-400/20">
        <h2 className="mb-3 font-bold text-white">
          اگر ویندوز هشدار داد (طبیعی است)
        </h2>
        <p className="text-sm leading-7 text-slate-400">
          برنامهٔ Peak هنوز امضای دیجیتال (Code Signing) نداره؛ پس ویندوز و
          آنتی‌ویروس‌ها ممکنه هشدار بدن:
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
          <li>
            <b className="text-white">SmartScreen:</b> روی{" "}
            <span dir="ltr">More info</span> بزن و بعد{" "}
            <span dir="ltr">Run anyway</span>.
          </li>
          <li>
            <b className="text-white">فایل بلاک شده:</b> راست‌کلیک روی فایل ←{" "}
            <span dir="ltr">Properties</span> ← تیک{" "}
            <span dir="ltr">Unblock</span> ←{" "}
            <span dir="ltr">OK</span>.
          </li>
          <li>
            <b className="text-white">اجرا نشد؟</b> فایل{" "}
            <span dir="ltr">%APPDATA%\Peak\data\peak-log.txt</span> علت دقیق را
            می‌گه.
          </li>
        </ul>
      </Card>

      {/* راهنمای اجرای مستقیم از سورس */}
      <Card className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
          <Terminal size={18} className="text-neon-green" /> اجرای مستقیم از سورس
          (اختیاری)
        </h2>
        <ol className="space-y-3 text-sm leading-7 text-slate-300">
          <li>
            <b className="text-white">۱.</b> اولین نسخهٔ LTS Node.js (نسخهٔ ۲۰ به
            بالا) رو از{" "}
            <a
              href="https://nodejs.org"
              target="_blank"
              rel="noreferrer"
              className="text-neon-cyan underline"
            >
              nodejs.org
            </a>{" "}
            نصب کن. <span className="text-slate-400">(فقط برای اجرا از سورس — نسخهٔ نصبی و پرتابل نیازی ندارن)</span>
          </li>
          <li>
            <b className="text-white">۲.</b> فایل{" "}
            <span dir="ltr" className="rounded bg-white/10 px-1.5 py-0.5">
              start-peak.bat
            </span>{" "}
            رو از پوشهٔ release اجرا کن — خودش وابستگی‌ها رو بررسی می‌کنه،
            دیتابیس رو آماده می‌کنه و برنامه رو باز می‌کنه.
          </li>
          <li>
            <b className="text-white">۳.</b> از صفحهٔ تنظیمات، ارائه‌دهندهٔ
            هوش مصنوعی و کلید API رو وارد کن.
          </li>
        </ol>
      </Card>

      {/* ساخت EXE از طریق گیت‌هاب */}
      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
          <Github size={18} className="text-white" /> ساخت خودکار EXE در GitHub
          Actions
        </h2>
        <ol className="space-y-3 text-sm leading-7 text-slate-300">
          <li>
            <b className="text-white">۱.</b> کد رو در ریپوی گیت‌هاب خودت push
            کن (یا از همین ریپو Fork بگیر).
          </li>
          <li>
            <b className="text-white">۲.</b> برو به تب{" "}
            <b className="text-white">Actions</b> ← از سمت چپ{" "}
            <b className="text-white">Build Windows EXE</b> ← دکمهٔ{" "}
            <b className="text-white">Run workflow</b>. (با هر push روی main هم
            خودکار اجرا می‌شه.)
          </li>
          <li>
            <b className="text-white">۳.</b> صبر کن تا اجرا سبز بشه (حدود ۵-۱۰
            دقیقه). خروجی هم در بخش{" "}
            <b className="text-white">Artifacts</b> ({" "}
            <span dir="ltr">Peak-Windows-EXE</span> ) هست و هم خودکار در{" "}
            <b className="text-white">Releases</b> منتشر می‌شه.
          </li>
          <li>
            <b className="text-white">۴.</b> فایل{" "}
            <span dir="ltr">Peak-Setup-Latest.exe</span> رو اجرا کن — تمام!
            نیازی به نصب Node نیست.
          </li>
        </ol>
        <a
          href={ACTIONS_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
        >
          <ExternalLink size={16} /> مشاهدهٔ صفحهٔ Actions
        </a>
      </Card>
    </div>
  );
}
