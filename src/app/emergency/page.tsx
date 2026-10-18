"use client";

/**
 * صفحهٔ کلید اضطراری — وضعیت زنده + دکمه‌های خاموش کردن + توضیح میان‌بر
 */
import { useCallback, useEffect, useState } from "react";
import {
  Gamepad2,
  Mic,
  RefreshCw,
  Volume2,
  Zap
} from "lucide-react";
import { PageTitle } from "@/components/ui";
import { EmergencyStop } from "@/components/EmergencyStop";
import { apiGet, isSpeaking, triggerEmergency } from "@/lib/client";

interface McStatus {
  connected: boolean;
  guardianMode?: boolean;
  rocketMode?: boolean;
  autoAttack?: boolean;
}

export default function EmergencyPage() {
  const [mc, setMc] = useState<McStatus | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    apiGet<{ status: McStatus }>("/api/minecraft/status")
      .then((d) => setMc(d.status))
      .catch(() => setMc(null));
    setSpeaking(isSpeaking());
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [refresh]);

  const fire = async (scope: "all" | "bot" | "voice") => {
    setBusy(true);
    try {
      const r = await triggerEmergency(scope);
      setLog((prev) =>
        [
          `${new Date().toLocaleTimeString("fa-IR")} — توقف ${scope === "all" ? "کامل" : scope === "bot" ? "ربات" : "صدا"}: ${r.stopped.join("، ")}`,
          ...prev
        ].slice(0, 12)
      );
    } catch {
      setLog((prev) => ["خطا در توقف", ...prev].slice(0, 12));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageTitle
        title="کلید اضطراری ⛔"
        subtitle="هر وقت چیزی از کنترل خارج شد، اینجا همه‌چیز را یک‌جا خاموش کن — یا Ctrl+Shift+K را بزن."
      />

      {/* وضعیت زنده */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="glass card-hover flex items-center gap-3 p-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${speaking ? "bg-neon-cyan/20 text-neon-cyan" : "bg-white/5 text-slate-400"}`}>
            <Volume2 size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">صدای دستیار</p>
            <p className="text-xs text-slate-400">{speaking ? "در حال حرف زدن…" : "خاموش"}</p>
          </div>
        </div>
        <div className="glass card-hover flex items-center gap-3 p-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${mc?.connected ? "bg-neon-green/20 text-neon-green" : "bg-white/5 text-slate-400"}`}>
            <Gamepad2 size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">ربات ماینکرفت</p>
            <p className="text-xs text-slate-400">
              {mc?.connected
                ? `متصل${mc.guardianMode ? " — محافظت 🛡️" : ""}${mc.rocketMode ? " — موشک 🚀" : ""}${mc.autoAttack ? " — اتوکلیک ⚔️" : ""}`
                : "قطع"}
            </p>
          </div>
        </div>
        <div className="glass card-hover flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-400">
            <Mic size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">میکروفون</p>
            <p className="text-xs text-slate-400">با توقف، همان لحظه قطع می‌شود</p>
          </div>
        </div>
      </div>

      {/* دکمه‌های اضطراری */}
      <div className="mt-8 space-y-3">
        <button
          onClick={() => void fire("all")}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-red-500 to-red-700 px-6 py-5 text-lg font-bold text-white shadow-glow-red transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
        >
          <Zap size={24} />
          خاموش اضطراری — همه‌چیز
        </button>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => void fire("bot")}
            disabled={busy}
            className="btn-ghost flex items-center justify-center gap-2 !py-4 font-bold text-red-300"
          >
            <Gamepad2 size={18} />
            فقط ربات ماینکرفت
          </button>
          <button
            onClick={() => void fire("voice")}
            disabled={busy}
            className="btn-ghost flex items-center justify-center gap-2 !py-4 font-bold text-red-300"
          >
            <Volume2 size={18} />
            فقط صدا و میکروفون
          </button>
        </div>
      </div>

      {/* راهنما */}
      <div className="glass mt-8 p-5">
        <h3 className="flex items-center gap-2 font-bold text-white">
          <RefreshCw size={16} className="text-neon-cyan" />
          چه چیزهایی خاموش می‌شود؟
        </h3>
        <ul className="mt-3 space-y-1.5 text-sm leading-7 text-slate-300">
          <li>✅ قطع فوری صدای در حال پخش و صف گفتار</li>
          <li>✅ قطع میکروفون و شنود پیوسته</li>
          <li>✅ توقف حرکت، مسیریابی، کلنگ‌زنی و حالت‌های ربات (محافظت/موشک/اتوکلیک)</li>
          <li>✅ قطع اتصال ربات ماینکرفت</li>
          <li>✅ این دکمه همیشه کار می‌کند — حتی اگر بقیهٔ دسترسی‌ها بسته باشند</li>
        </ul>
        <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          ⌨️ میان‌بر سراسری: <b>Ctrl + Shift + K</b> — دکمهٔ قرمز شناور پایین صفحه هم همین کار را می‌کند.
        </p>
      </div>

      {/* تاریخچه */}
      {log.length > 0 && (
        <div className="glass mt-6 p-5">
          <h3 className="font-bold text-white">آخرین توقف‌ها</h3>
          <ul className="mt-3 space-y-1 text-xs text-slate-400">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-24 md:mt-10">
        <EmergencyStop />
      </div>
    </div>
  );
}
