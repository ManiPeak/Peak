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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
