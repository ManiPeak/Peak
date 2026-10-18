"use client";

/**
 * صفحهٔ مودها — نصب، ساخت، روشن/خاموش و حذف مود برای Peak
 * هستهٔ برنامه دست نمی‌خورد؛ همه‌چیز از data/mods خوانده می‌شود
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Download,
  FileJson,
  Package,
  Plus,
  Puzzle,
  Trash2,
  Upload,
  X,
  Zap
} from "lucide-react";
import { EXAMPLE_MODS, type ModCommand, type ModDefinition } from "@/lib/pure-utils";

type NewCommand = {
  label: string;
  samples: string;
  kind: "reply" | "op" | "capability";
  value: string;
};

const emptyCommand = (): NewCommand => ({ label: "", samples: "", kind: "reply", value: "" });

export default function ModsPage() {
  const [mods, setMods] = useState<ModDefinition[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [form, setForm] = useState({ id: "", name: "", author: "", description: "" });
  const [commands, setCommands] = useState<NewCommand[]>([emptyCommand()]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/mods");
      const data = (await res.json()) as { mods: ModDefinition[] };
      setMods(data.mods ?? []);
    } catch {
      /* آفلاین */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const install = async (mod: ModDefinition) => {
    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch("/api/mods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mod)
      });
      const data = (await res.json()) as { ok: boolean; errors?: string[] };
      if (data.ok) {
        flash(`«${mod.name}» نصب شد ✅`);
        await refresh();
      } else {
        setErrors(data.errors ?? ["خطای ناشناخته"]);
      }
    } catch {
      setErrors(["ارتباط با برنامه برقرار نشد."]);
    }
    setBusy(false);
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`مود «${name}» حذف شود؟`)) return;
    setBusy(true);
    await fetch(`/api/mods?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    flash("مود حذف شد.");
    await refresh();
    setBusy(false);
  };

  const toggle = async (mod: ModDefinition) => {
    await fetch("/api/mods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: mod.id, enabled: !mod.enabled })
    });
    await refresh();
  };

  const submitJson = async () => {
    setErrors([]);
    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch {
      setErrors(["JSON معتبر نیست — ویرگول/جفت‌پرانتزها رو چک کن."]);
      return;
    }
    await install(raw as ModDefinition);
  };

  const submitForm = async () => {
    setErrors([]);
    const errs: string[] = [];
    const id = form.id.trim() || form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!id || !/^[a-z0-9_]{2,40}$/.test(id)) errs.push("شناسه: فقط حروف کوچک انگلیسی/عدد/زیرخط (مثل my_pack).");
    if (!form.name.trim()) errs.push("نام مود الزامی است.");
    const cmds: ModCommand[] = [];
    commands.forEach((c, i) => {
      const samples = c.samples
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!c.label.trim()) errs.push(`دستور ${i + 1}: عنوان لازم است.`);
      if (samples.length === 0) errs.push(`دستور ${i + 1}: حداقل یک جمله بنویس (با «،» جدا کن).`);
      if (!c.value.trim()) errs.push(`دستور ${i + 1}: مقدار پاسخ/دستور لازم است.`);
      if (c.kind === "op" && /[\n\r]/.test(c.value)) errs.push(`دستور ${i + 1}: دستور op نباید خط جدید داشته باشد.`);
      cmds.push({
        id: `cmd_${i + 1}`,
        label: c.label.trim(),
        samples,
        ...(c.kind === "reply" ? { reply: c.value.trim() } : {}),
        ...(c.kind === "op" ? { op: c.value.trim().replace(/^\/+/, "") } : {}),
        ...(c.kind === "capability" ? { capability: c.value.trim() } : {})
      });
    });
    if (errs.length) {
      setErrors(errs);
      return;
    }
    await install({
      id,
      name: form.name.trim(),
      version: "1.0.0",
      author: form.author.trim() || "من",
      description: form.description.trim(),
      enabled: true,
      commands: cmds
    });
    setForm({ id: "", name: "", author: "", description: "" });
    setCommands([emptyCommand()]);
    setShowForm(false);
  };

  /* ═══════ مودهای جاوا (.jar) — Minecraft Java Edition ═══════ */
  type JavaModRow = { name: string; size: number; addedAt: number; enabled: boolean };
  const [javaMods, setJavaMods] = useState<JavaModRow[]>([]);
  const [javaPath, setJavaPath] = useState("");
  const [javaBusy, setJavaBusy] = useState(false);

  const refreshJava = useCallback(async () => {
    try {
      const res = await fetch("/api/mods/java");
      const data = (await res.json()) as { mods: JavaModRow[]; config: { gameModsPath: string } };
      setJavaMods(data.mods ?? []);
      setJavaPath(data.config?.gameModsPath ?? "");
    } catch {
      /* آفلاین */
    }
  }, []);

  useEffect(() => {
    void refreshJava();
  }, [refreshJava]);

  const uploadJar = async (file: File) => {
    setJavaBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/mods/java", { method: "POST", body: fd });
      const data = (await res.json()) as { error?: string; mod?: JavaModRow };
      if (res.ok && data.mod) flash(`مود جاوا «${data.mod.name}» اضافه شد ☕`);
      else flash(data.error ?? "فایل نامعتبر بود.");
    } catch {
      flash("ارتباط با برنامه برقرار نشد.");
    }
    setJavaBusy(false);
    await refreshJava();
  };

  const toggleJar = async (m: JavaModRow) => {
    await fetch("/api/mods/java", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: m.name, enabled: !m.enabled })
    });
    await refreshJava();
  };

  const deleteJar = async (m: JavaModRow) => {
    if (!confirm(`مود جاوا «${m.name}» حذف شود؟`)) return;
    await fetch(`/api/mods/java?name=${encodeURIComponent(m.name)}`, { method: "DELETE" });
    flash("مود جاوا حذف شد.");
    await refreshJava();
  };

  const saveJavaPath = async () => {
    await fetch("/api/mods/java", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "config", gameModsPath: javaPath })
    });
    flash("مسیر پوشهٔ mods بازی ذخیره شد.");
  };

  const installJavaToGame = async () => {
    setJavaBusy(true);
    try {
      const res = await fetch("/api/mods/java", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install", target: javaPath })
      });
      const data = (await res.json()) as { copied: string[]; failed: string[]; target: string };
      if (!data.target) flash("اول مسیر پوشهٔ mods بازی را بنویس و ذخیره کن.");
      else if (data.copied.length) flash(`${data.copied.length} مود در «${data.target}» نصب شد ☕${data.failed.length ? ` (${data.failed.length} ناموفق)` : ""}`);
      else flash("مود روشنی برای نصب نیست.");
    } catch {
      flash("ارتباط با برنامه برقرار نشد.");
    }
    setJavaBusy(false);
    await refreshJava();
  };

  const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} مگ` : `${Math.max(1, Math.round(n / 1024))} کیلو`);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* هدر */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Puzzle className="h-7 w-7 text-neon-cyan" /> مودهای Peak
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            برای برنامه مود اضافه کن — <span className="text-neon-cyan">بدون دست زدن به هسته</span>، بدون نصب
            اضافی، همه‌چیز داخل خود برنامه.
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowRight size={16} /> بازگشت به چت
        </Link>
      </div>

      {/* اعلان */}
      {toast && (
        <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          {toast}
        </div>
      )}
      {errors.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          <ul className="list-inside list-disc space-y-1">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* دکمه‌های اصلی */}
      <div className="mb-8 flex flex-wrap gap-3">
        <button
          onClick={() => {
            setShowForm(!showForm);
            setErrors([]);
          }}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-neon-cyan to-sky-500 px-5 py-3 font-bold text-night-950 shadow-glow transition hover:brightness-110"
        >
          <Plus size={18} /> ساخت مود جدید
        </button>
      </div>

      {/* فرم ساخت مود */}
      {showForm && (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-white">🧩 مود جدید</h2>
            <button
              onClick={() => setJsonMode(!jsonMode)}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              <FileJson size={14} /> {jsonMode ? "حالت فرم" : "حالت JSON پیشرفته"}
            </button>
          </div>

          {jsonMode ? (
            <>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                dir="ltr"
                spellCheck={false}
                placeholder={`{\n  "id": "my_pack",\n  "name": "مود من",\n  "commands": [\n    { "id": "c1", "label": "سلام", "samples": ["سلام خاص"], "reply": "سلام!" }\n  ]\n}`}
                className="h-56 w-full rounded-xl border border-white/10 bg-night-900 p-4 font-mono text-xs text-emerald-200 outline-none focus:border-neon-cyan/50"
              />
              <button
                onClick={submitJson}
                disabled={busy}
                className="mt-3 flex items-center gap-2 rounded-xl bg-neon-cyan px-5 py-2.5 font-bold text-night-950 disabled:opacity-50"
              >
                <Upload size={16} /> نصب مود
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="نام مود (مثلاً: پک من)"
                  className="rounded-xl border border-white/10 bg-night-900 px-4 py-2.5 text-sm text-white outline-none focus:border-neon-cyan/50"
                />
                <input
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  dir="ltr"
                  placeholder="شناسه (my_pack) — اختیاری"
                  className="rounded-xl border border-white/10 bg-night-900 px-4 py-2.5 text-sm text-white outline-none focus:border-neon-cyan/50"
                />
                <input
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="سازنده (اختیاری)"
                  className="rounded-xl border border-white/10 bg-night-900 px-4 py-2.5 text-sm text-white outline-none focus:border-neon-cyan/50"
                />
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="توضیح کوتاه (اختیاری)"
                  className="rounded-xl border border-white/10 bg-night-900 px-4 py-2.5 text-sm text-white outline-none focus:border-neon-cyan/50"
                />
              </div>

              {/* دستورها */}
              {commands.map((c, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-night-900/60 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">دستور {i + 1}</span>
                    {commands.length > 1 && (
                      <button
                        onClick={() => setCommands(commands.filter((_, j) => j !== i))}
                        className="text-red-300 hover:text-red-200"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={c.label}
                      onChange={(e) => {
                        const next = [...commands];
                        next[i] = { ...c, label: e.target.value };
                        setCommands(next);
                      }}
                      placeholder="عنوان دستور"
                      className="rounded-lg border border-white/10 bg-night-900 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/50"
                    />
                    <input
                      value={c.samples}
                      onChange={(e) => {
                        const next = [...commands];
                        next[i] = { ...c, samples: e.target.value };
                        setCommands(next);
                      }}
                      placeholder="جمله‌های فعال‌ساز — با «،» جدا کن"
                      className="rounded-lg border border-white/10 bg-night-900 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/50"
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <select
                      value={c.kind}
                      onChange={(e) => {
                        const next = [...commands];
                        next[i] = { ...c, kind: e.target.value as NewCommand["kind"], value: "" };
                        setCommands(next);
                      }}
                      className="rounded-lg border border-white/10 bg-night-900 px-3 py-2 text-xs text-slate-200 outline-none"
                    >
                      <option value="reply">پاسخ متنی</option>
                      <option value="op">دستور سرور (OP)</option>
                      <option value="capability">توانایی ماینکرفت</option>
                    </select>
                    <input
                      value={c.value}
                      onChange={(e) => {
                        const next = [...commands];
                        next[i] = { ...c, value: e.target.value };
                        setCommands(next);
                      }}
                      dir={c.kind === "reply" ? "rtl" : "ltr"}
                      placeholder={
                        c.kind === "reply"
                          ? "متن پاسخ..."
                          : c.kind === "op"
                            ? "give {player} diamond 64"
                            : "god_kit"
                      }
                      className="flex-1 rounded-lg border border-white/10 bg-night-900 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/50"
                    />
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setCommands([...commands, emptyCommand()])}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
                >
                  <Plus size={15} /> دستور دیگر
                </button>
                <button
                  onClick={submitForm}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-xl bg-neon-cyan px-5 py-2 font-bold text-night-950 disabled:opacity-50"
                >
                  <Check size={16} /> نصب مود
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* مودهای نصب‌شده */}
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
        <Package size={20} className="text-neon-violet" /> مودهای نصب‌شده
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{mods.length}</span>
      </h2>
      {mods.length === 0 ? (
        <div className="mb-10 rounded-2xl border border-dashed border-white/15 bg-white/5 p-10 text-center">
          <Puzzle className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <p className="text-slate-300">هنوز مودی نصب نشده — از گالری پایین یکی رو نصب کن یا خودت بساز!</p>
        </div>
      ) : (
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          {mods.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl border p-5 transition ${
                m.enabled ? "border-neon-cyan/30 bg-neon-cyan/5" : "border-white/10 bg-white/5 opacity-70"
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white">{m.name}</h3>
                  <p className="text-xs text-slate-400">
                    v{m.version} — {m.author} — {m.commands.length} دستور
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggle(m)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      m.enabled ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {m.enabled ? "روشن" : "خاموش"}
                  </button>
                  <button
                    onClick={() => remove(m.id, m.name)}
                    className="rounded-lg bg-red-400/10 p-1.5 text-red-300 hover:bg-red-400/20"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {m.description && <p className="mb-2 text-sm text-slate-300">{m.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                {m.commands.slice(0, 6).map((c) => (
                  <span key={c.id} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-300">
                    {c.label}
                  </span>
                ))}
                {m.commands.length > 6 && (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-400">
                    +{m.commands.length - 6}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ مودهای جاوا (.jar) — Minecraft Java Edition ═══ */}
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
        <Package className="h-5 w-5 text-amber-400" /> مودهای جاوا <span className="text-sm font-normal text-white/50">(.jar — مثل Forge/Fabric)</span>
      </h2>
      <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        {/* آپلود + مسیر بازی */}
        <div className="grid gap-3 md:grid-cols-2">
          <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-400/40 p-6 text-center transition hover:border-amber-400/80 ${javaBusy ? "opacity-50" : ""}`}>
            <Upload className="mb-2 h-8 w-8 text-amber-400" />
            <span className="text-sm text-white/80">فایل <b>.jar</b> مود را اینجا رها کن یا کلیک کن</span>
            <span className="mt-1 text-xs text-white/40">حداکثر ۲۰۰ مگابایت — روی پوشهٔ data/mods/java ذخیره می‌شود</span>
            <input
              type="file"
              accept=".jar"
              className="hidden"
              disabled={javaBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadJar(f);
                e.target.value = "";
              }}
            />
          </label>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-white/60">مسیر پوشهٔ mods بازی (مثلاً <code className="text-amber-300">.../.minecraft/mods</code>)</label>
            <input
              dir="ltr"
              value={javaPath}
              onChange={(e) => setJavaPath(e.target.value)}
              placeholder="C:\Users\You\AppData\Roaming\.minecraft\mods"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-left text-sm text-white outline-none focus:border-amber-400/60"
            />
            <div className="flex gap-2">
              <button
                onClick={() => void saveJavaPath()}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
              >
                ذخیرهٔ مسیر
              </button>
              <button
                onClick={() => void installJavaToGame()}
                disabled={javaBusy}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> نصب مودهای روشن در بازی
              </button>
            </div>
            <p className="text-[11px] leading-5 text-white/40">
              مودهای روشن (.jar) هنگام زدن دکمه، در پوشهٔ mods بازی کپی می‌شوند. بازی/سرور Forge یا Fabric باید نصب باشد تا مودها لود شوند.
            </p>
          </div>
        </div>

        {/* فهرست مودهای جاوا */}
        {javaMods.length === 0 ? (
          <p className="mt-5 text-center text-sm text-white/40">هنوز مود جاوایی اضافه نکرده‌ای — فایل .jar را از باکس بالا اضافه کن.</p>
        ) : (
          <ul className="mt-5 grid gap-2">
            {javaMods.map((m) => (
              <li
                key={m.name}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <Package className={`h-5 w-5 ${m.enabled ? "text-amber-400" : "text-white/30"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white" dir="ltr">{m.name}</p>
                  <p className="text-xs text-white/40">{fmtSize(m.size)} — {new Date(m.addedAt).toLocaleDateString("fa-IR")}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${m.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50"}`}
                >
                  {m.enabled ? "روشن" : "خاموش"}
                </span>
                <button
                  onClick={() => void toggleJar(m)}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/20"
                >
                  {m.enabled ? "خاموش کن" : "روشن کن"}
                </button>
                <button
                  onClick={() => void deleteJar(m)}
                  className="rounded-lg bg-red-500/20 p-2 text-red-300 transition hover:bg-red-500/30"
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* گالری نمونه */}
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
        <Download size={20} className="text-emerald-300" /> گالری مودهای آماده
        <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-200">نصب با یک کلیک</span>
      </h2>
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {EXAMPLE_MODS.map((m) => (
          <div key={m.id} className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="mb-1 flex items-center gap-2 font-bold text-white">
              <Zap size={16} className="text-amber-300" /> {m.name}
            </h3>
            <p className="mb-2 flex-1 text-xs leading-6 text-slate-400">{m.description}</p>
            <p className="mb-3 text-[11px] text-slate-500">{m.commands.length} دستور — {m.author}</p>
            <button
              onClick={() => install(m)}
              disabled={busy || mods.some((x) => x.id === m.id)}
              className="rounded-xl bg-emerald-400/15 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/25 disabled:opacity-40"
            >
              {mods.some((x) => x.id === m.id) ? "نصب شده ✅" : "نصب"}
            </button>
          </div>
        ))}
      </div>

      {/* راهنمای ساخت مود */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-6">
        <h2 className="mb-3 text-lg font-bold text-white">📘 ساخت مود در ۳ قدم</h2>
        <ol className="space-y-3 text-sm leading-7 text-slate-300">
          <li>
            <b className="text-white">۱. دکمهٔ «ساخت مود جدید»</b> رو بزن (یا فایل <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">.json</code> بنداز توی پوشهٔ{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs" dir="ltr">data/mods/</code>).
          </li>
          <li>
            <b className="text-white">۲. دستورها رو تعریف کن:</b> برای هر دستور یه عنوان، چند جملهٔ فعال‌ساز و یکی از این سه تا:
            <span className="mx-1 rounded bg-neon-cyan/10 px-2 py-0.5 text-xs text-neon-cyan">پاسخ متنی</span>
            <span className="mx-1 rounded bg-amber-300/10 px-2 py-0.5 text-xs text-amber-200">دستور سرور (OP)</span>
            <span className="mx-1 rounded bg-neon-violet/10 px-2 py-0.5 text-xs text-violet-200">توانایی ماینکرفت</span>
          </li>
          <li>
            <b className="text-white">۳. نصب!</b> از این لحظه با گفتن جملهٔ فعال‌ساز (با صوت یا متن)، مودت اجرا می‌شه — فوری و بدون تأخیر.
          </li>
        </ol>
        <p className="mt-4 rounded-xl bg-white/5 p-3 text-xs leading-6 text-slate-400">
          💡 نکته: مودها فقط JSON ساخت‌یافته‌اند (کد اجرا نمی‌شه) → هم امنه و هم به برنامه فشار نمیاره. در دستور سرور می‌تونی از{" "}
          <code dir="ltr" className="rounded bg-white/10 px-1">{"{player}"}</code>،{" "}
          <code dir="ltr" className="rounded bg-white/10 px-1">{"{self}"}</code> و{" "}
          <code dir="ltr" className="rounded bg-white/10 px-1">{"{n}"}</code> استفاده کنی.
        </p>
      </div>
    </div>
  );
}
