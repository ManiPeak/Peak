"use client";

/**
 * صفحهٔ دسترسی‌ها — کنترل کامل مجوزهای Peak
 *
 * اصل: Peak فقط به پوشهٔ دادهٔ خودش دسترسی دارد؛ بقیهٔ سیستم همیشه قفل است.
 * هر ۱۶ مجوز اینجا قابل روشن/خاموش کردن است + پروفایل‌های آماده.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Brain,
  ExternalLink,
  FileDown,
  Fingerprint,
  Gamepad2,
  Hand,
  Link2,
  Lock,
  Mic,
  PenLine,
  ScrollText,
  Settings2,
  ShieldCheck,
  Swords,
  Volume2
} from "lucide-react";
import { PageTitle, Toggle } from "@/components/ui-kit";
import { apiGet, apiSend } from "@/lib/client";
import {
  FS_ACCESS_RULES,
  PERMISSION_CATEGORIES,
  PERMISSION_DEFS,
  PRESET_LABELS,
  mergePermissions,
  presetPermissions,
  type PermissionPreset
} from "@/lib/permissions";
import type { PermissionKey, PermissionMap, PublicSettings } from "@/lib/types";

const ICONS: Record<PermissionKey, typeof Mic> = {
  memoryRead: Brain,
  memoryWrite: PenLine,
  memoryExtract: ScrollText,
  exportData: FileDown,
  mic: Mic,
  micContinuous: Hand,
  ttsAuto: Volume2,
  ttsClick: Volume2,
  aiNetwork: Link2,
  minecraftConnect: Gamepad2,
  minecraftControl: Fingerprint,
  minecraftGuard: ShieldCheck,
  minecraftAutoAttack: Swords,
  settingsWrite: Settings2,
  notifications: Bell,
  shellOpen: ExternalLink
};

export default function PermissionsPage() {
  const [perms, setPerms] = useState<PermissionMap | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<{ settings: PublicSettings }>("/api/settings")
      .then((d) => setPerms(mergePermissions(d.settings.permissions)))
      .catch(() => setPerms(mergePermissions()));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (next: PermissionMap) => {
    setPerms(next);
    setSaved(false);
    setError(null);
    try {
      await apiSend("/api/settings", "PUT", { permissions: next });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره ناموفق بود.");
    }
  };

  const setOne = (key: PermissionKey, value: boolean) => {
    if (!perms) return;
    void update({ ...perms, [key]: value });
  };

  const applyPreset = (preset: PermissionPreset) => {
    void update(presetPermissions(preset));
  };

  const allOn = () => {
    void update(
      Object.fromEntries(
        Object.keys(mergePermissions()).map((k) => [k, true])
      ) as PermissionMap
    );
  };

  const allOff = () => {
    // خاموش کردن همه به جز ورودی‌های ضروری چت
    void update(
      Object.fromEntries(
        Object.keys(mergePermissions()).map((k) => [k, false])
      ) as PermissionMap
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageTitle
        title="دسترسی‌های Peak 🛡️"
        subtitle="هر کاری که Peak می‌تواند انجام دهد اینجاست. هر چیزی را که خواستی ببند — برنامه فوراً اطاعت می‌کند."
      />

      {/* قفل فایل‌سیستم — همیشه برقرار */}
      <div className="glass glow-ring mt-6 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/10 bg-emerald-500/10 px-5 py-4">
          <Lock size={20} className="text-emerald-300" />
          <div>
            <h3 className="font-bold text-white">دسترسی فایل‌ها — قفل‌شده 🔒</h3>
            <p className="mt-0.5 text-xs text-slate-300">
              این قوانین توسط کد برنامه تضمین شده‌اند و قابل تغییر نیستند.
            </p>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {FS_ACCESS_RULES.map((r) => (
            <div key={r.path} className="flex items-center gap-3 px-5 py-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${
                  r.access === "full"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-red-500/15 text-red-300"
                }`}
              >
                {r.access === "full" ? "✓" : "✕"}
              </span>
              <div className="flex-1">
                <p className="text-sm text-slate-200">{r.path}</p>
                <p className="text-xs text-slate-500">{r.note}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  r.access === "full"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-red-500/15 text-red-300"
                }`}
              >
                {r.access === "full" ? "مجاز" : "قفل"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* پروفایل‌ها */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-400">پروفایل سریع:</span>
        {(Object.keys(PRESET_LABELS) as PermissionPreset[]).map((p) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className="chip"
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
        <button onClick={allOn} className="chip">
          همه روشن
        </button>
        <button onClick={allOff} className="chip !border-red-400/30 !text-red-300 hover:!border-red-400/50">
          همه خاموش
        </button>
      </div>

      {saved && (
        <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          ✅ ذخیره شد — تغییرات همین حالا اعمال می‌شوند.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          ⛔ {error}
        </p>
      )}

      {/* مجوزها به تفکیک دسته */}
      {!perms ? (
        <p className="mt-10 text-center text-slate-500">در حال بارگذاری…</p>
      ) : (
        PERMISSION_CATEGORIES.map((cat) => (
          <div key={cat.id} className="mt-8">
            <h3 className="mb-3 text-sm font-bold text-slate-300">
              {cat.label}
            </h3>
            <div className="space-y-2.5">
              {PERMISSION_DEFS.filter((d) => d.category === cat.id).map((def) => {
                const Icon = ICONS[def.key];
                return (
                  <div
                    key={def.key}
                    className={`glass card-hover p-4 ${
                      perms[def.key] ? "" : "opacity-75"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          perms[def.key]
                            ? "bg-neon-cyan/15 text-neon-cyan"
                            : "bg-white/5 text-slate-500"
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">
                          {def.label}
                        </p>
                        <p className="mt-1 text-xs leading-6 text-slate-400">
                          {def.desc}
                        </p>
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          🔸 وقتی خاموش است: {def.whenOff}
                        </p>
                      </div>
                      <div className="w-28 shrink-0">
                        <Toggle
                          checked={perms[def.key]}
                          onChange={(v) => setOne(def.key, v)}
                          label=""
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
