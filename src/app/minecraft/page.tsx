"use client";

/**
 * صفحهٔ کنترل ماینکرفت — وضعیت زنده، اتصال، دستورهای سریع، لاگ کنسول
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Crosshair,
  Gamepad2,
  Heart,
  LogOut,
  RefreshCw,
  Rocket,
  Send,
  Server,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Zap
} from "lucide-react";
import { Btn, Card, Field, Label, PageTitle } from "@/components/ui-kit";
import { EmergencyStop } from "@/components/ui-kit";
import {
  CAPABILITIES,
  CAP_CATEGORIES,
  type CapCategory
} from "@/minecraft/capabilities";
import type { PublicSettings } from "@/lib/types";
import { apiGet, apiSend } from "@/lib/client";
import type { BotLogEntry, BotStatus } from "@/minecraft/core";
import type { ServerDTO } from "@/lib/types";

const LOG_CLASS: Record<BotLogEntry["type"], string> = {
  info: "mc-log-info",
  success: "mc-log-success",
  warn: "mc-log-warn",
  error: "mc-log-error",
  event: "mc-log-event",
  chat: "mc-log-chat",
  combat: "mc-log-combat",
  system: "mc-log-system"
};

const LOG_PREFIX: Record<BotLogEntry["type"], string> = {
  info: "ℹ️",
  success: "✅",
  warn: "⚠️",
  error: "❌",
  event: "🎮",
  chat: "💬",
  combat: "⚔️",
  system: "🔧"
};

const QUICK_COMMANDS: Array<{ label: string; text: string; icon: React.ReactNode }> = [
  { label: "بیا دنبالم", text: "بیا دنبالم", icon: <Zap size={15} /> },
  { label: "وایسا", text: "وایسا", icon: <Crosshair size={15} /> },
  { label: "بپر", text: "بپر", icon: <Sparkles size={15} /> },
  { label: "به من نگاه کن", text: "به من نگاه کن", icon: <Crosshair size={15} /> },
  { label: "گزارش وضعیت", text: "گزارش وضعیت", icon: <Activity size={15} /> },
  { label: "چوب جمع کن", text: "چوب جمع کن", icon: <Sparkles size={15} /> },
  { label: "سنگ جمع کن", text: "سنگ جمع کن", icon: <Sparkles size={15} /> },
  { label: "بیا پیش من", text: "بیا پیش من", icon: <Zap size={15} /> }
];

const EMPTY_STATUS: BotStatus = {
  connected: false,
  connecting: false,
  host: null,
  port: null,
  username: null,
  health: null,
  food: null,
  position: null,
  dimension: null,
  players: [],
  guardianMode: false,
  rocketMode: false,
  autoAttack: false,
  protectTarget: null,
  lastError: null,
  msDeviceCode: null
};

export default function MinecraftPage() {
  const [status, setStatus] = useState<BotStatus>(EMPTY_STATUS);
  const [logs, setLogs] = useState<BotLogEntry[]>([]);
  const [servers, setServers] = useState<ServerDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const lastLogId = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  // فرم اتصال
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState(25565);
  const [version, setVersion] = useState("auto");
  const [auth, setAuth] = useState<"offline" | "microsoft">("offline");
  const [username, setUsername] = useState("PeakBot");
  const [protectTarget, setProtectTarget] = useState("");
  const [isOp, setIsOp] = useState(false);
  const [chatBridge, setChatBridge] = useState(true);
  const [capQuery, setCapQuery] = useState("");
  const [capCat, setCapCat] = useState<CapCategory | "all">("all");
  const [personality, setPersonality] = useState<"angry" | "kind" | "normal">("normal");
  const [friends, setFriends] = useState<string[]>([]);
  const [friendInput, setFriendInput] = useState("");
  const [authMode, setAuthMode] = useState<"none" | "login" | "register">("none");
  const [playLevel, setPlayLevel] = useState<"beginner" | "normal" | "pro" | "god">("normal");
  const [ramMB, setRamMB] = useState(512);
  const [scanRadius, setScanRadius] = useState(1000);
  const [saveServer, setSaveServer] = useState(true);
  const [serverName, setServerName] = useState("");

  // دستور دلخواه
  const [customCmd, setCustomCmd] = useState("");

  /* ---------------- پولینگ وضعیت ---------------- */

  const poll = useCallback(async () => {
    try {
      const data = await apiGet<{ status: BotStatus; logs: BotLogEntry[] }>(
        `/api/minecraft/status?sinceLogId=${lastLogId.current}`
      );
      setStatus(data.status);
      if (data.logs.length > 0) {
        setLogs((prev) => {
          const next = [...prev, ...data.logs];
          return next.length > 300 ? next.slice(next.length - 300) : next;
        });
        lastLogId.current = data.logs[data.logs.length - 1].id;
      }
    } catch {
      /* بی‌صدا */
    }
  }, []);

  useEffect(() => {
    void poll();
    const t = setInterval(() => void poll(), 2000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    apiGet<{ servers: ServerDTO[] }>("/api/minecraft/servers")
      .then((d) => setServers(d.servers))
      .catch(() => undefined);
  }, []);

  // بارگذاری وضعیت OP و گفت‌وگوی بازی از تنظیمات
  useEffect(() => {
    apiGet<{ settings: PublicSettings }>("/api/settings")
      .then((d) => {
        setIsOp(d.settings.mcIsOp);
        setChatBridge(d.settings.mcChatBridge);
        setPersonality(d.settings.mcPersonality ?? "normal");
        setFriends(d.settings.mcFriends ?? []);
        setPlayLevel(d.settings.mcPlayLevel ?? "normal");
        setRamMB(d.settings.appRamMB ?? 512);
        setScanRadius(d.settings.mcScanRadius ?? 1000);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  /* ---------------- اتصال ---------------- */

  const connect = async () => {
    if (!host.trim() || !username.trim()) {
      setError("آدرس سرور و نام ربات الزامیه.");
      return;
    }
    setBusy(true);
    setError(null);
    setReply(null);
    try {
      const result = await apiSend<{ ok: boolean; reply: string }>(
        "/api/minecraft/connect",
        "POST",
        {
          host: host.trim(),
          port,
          version,
          auth,
          authMode,
          username: username.trim(),
          protectTarget: protectTarget.trim() || null,
          save: saveServer,
          name: serverName.trim() || host.trim()
        }
      );
      setReply(result.reply);
      void poll();
      const s = await apiGet<{ servers: ServerDTO[] }>("/api/minecraft/servers");
      setServers(s.servers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "اتصال ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await apiSend("/api/minecraft/disconnect", "POST");
      void poll();
    } finally {
      setBusy(false);
    }
  };

  const deleteServer = async (s: ServerDTO) => {
    if (!window.confirm(`سرور «${s.name}» حذف بشه؟`)) return;
    await apiSend(`/api/minecraft/servers/${s.id}`, "DELETE");
    setServers((prev) => prev.filter((x) => x.id !== s.id));
  };

  /* ---------------- دستورها ---------------- */

  const runCommand = async (text: string) => {
    setError(null);
    setReply(null);
    try {
      const result = await apiSend<{ ok: boolean; reply: string }>(
        "/api/minecraft/command",
        "POST",
        { text }
      );
      setReply(result.reply);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "اجرای دستور ناموفق بود.";
      setError(msg);
    }
    void poll();
  };

  const emergencyStop = async () => {
    await runCommand("توقف فوری");
  };

  /* ---------------- رندر ---------------- */

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <PageTitle
          title="کنترل ماینکرفت"
          subtitle="ربات با دستورهای فارسی کنترل می‌شه — محافظت پلیسی، حرکت موشکی و حملهٔ خودکار."
        />
        <EmergencyStop inline />
      </div>

      {/* کارت وضعیت نئونی */}
      <div
        className={`glass-strong mb-6 p-6 transition ${
          status.connected
            ? "border-emerald-400/40 shadow-[0_0_30px_rgba(52,211,153,0.25)]"
            : status.connecting
              ? "border-amber-400/40"
              : "border-white/10"
        }`}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
              status.connected
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-slate-700/40 text-slate-400"
            }`}
          >
            <Gamepad2 size={28} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">
              {status.connected
                ? `متصل — ${status.username ?? "ربات"}`
                : status.connecting
                  ? "در حال اتصال..."
                  : "قطع"}
            </h2>
            <p className="text-xs text-slate-400">
              {status.host
                ? `${status.host}:${status.port}`
                : "به هیچ سروری وصل نیستم"}
            </p>
          </div>

          {/* آمار زنده */}
          {status.connected ? (
            <div className="flex flex-wrap gap-3">
              <div className="glass flex items-center gap-2 px-4 py-2.5">
                <Heart size={16} className="text-red-400" />
                <span className="text-sm text-white">
                  {status.health}/20 <span className="text-xs text-slate-400">جان</span>
                </span>
              </div>
              <div className="glass flex items-center gap-2 px-4 py-2.5">
                <Activity size={16} className="text-amber-300" />
                <span className="text-sm text-white">
                  {status.food}/20 <span className="text-xs text-slate-400">سیری</span>
                </span>
              </div>
              <div className="glass px-4 py-2.5">
                <p className="text-[10px] text-slate-400">مختصات</p>
                <p className="text-sm text-white" dir="ltr">
                  {status.position
                    ? `${status.position.x}, ${status.position.y}, ${status.position.z}`
                    : "—"}
                </p>
              </div>
              <div className="glass px-4 py-2.5">
                <p className="text-[10px] text-slate-400">بعد</p>
                <p className="text-sm text-white">{status.dimension ?? "—"}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* وضعیت حالت‌ها */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3.5 py-1.5 text-xs ${
              status.guardianMode
                ? "bg-blue-500/25 text-blue-200 ring-1 ring-blue-400/50"
                : "bg-white/5 text-slate-500"
            }`}
          >
            🛡️ محافظت {status.guardianMode ? "روشن" : "خاموش"}
          </span>
          <span
            className={`rounded-full px-3.5 py-1.5 text-xs ${
              status.rocketMode
                ? "bg-violet-500/25 text-violet-200 ring-1 ring-violet-400/50"
                : "bg-white/5 text-slate-500"
            }`}
          >
            🚀 موشک {status.rocketMode ? "روشن" : "خاموش"}
          </span>
          <span
            className={`rounded-full px-3.5 py-1.5 text-xs ${
              status.autoAttack
                ? "bg-red-500/25 text-red-200 ring-1 ring-red-400/50"
                : "bg-white/5 text-slate-500"
            }`}
          >
            ⚔️ اتوکلیک {status.autoAttack ? "روشن" : "خاموش"}
          </span>
          {status.players.length > 0 ? (
            <span className="rounded-full bg-white/5 px-3.5 py-1.5 text-xs text-slate-300">
              آنلاین: {status.players.join("، ")}
            </span>
          ) : null}
        </div>

        {status.msDeviceCode ? (
          <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            🔐 برای ورود مایکروسافت به{" "}
            <a
              href="https://microsoft.com/link"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              microsoft.com/link
            </a>{" "}
            برو و کد <b dir="ltr">{status.msDeviceCode}</b> را وارد کن.
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* فرم اتصال */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
            <Server size={18} className="text-neon-cyan" /> اتصال به سرور
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>آدرس سرور</Label>
              <Field
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost یا play.example.com"
              />
            </div>
            <div>
              <Label>پورت</Label>
              <Field
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || 25565)}
              />
            </div>
            <div>
              <Label>نسخهٔ ماینکرفت</Label>
              <Field
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="auto یا 1.21.1"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {["auto", "1.26.2", "1.21.1", "1.20.4", "1.18.2", "1.16.5", "1.8.9"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVersion(v)}
                    className={`rounded-full px-2 py-0.5 text-[10px] transition ${
                      version === v
                        ? "bg-neon-cyan/20 text-neon-cyan"
                        : "bg-white/5 text-slate-500 hover:bg-white/10"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>نام ربات در بازی</Label>
              <Field
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="DastiarBot"
              />
            </div>
            <div>
              <Label>نوع ورود</Label>
              <select
                value={auth}
                onChange={(e) => setAuth(e.target.value as "offline" | "microsoft")}
                className="field"
              >
                <option value="offline">آفلاین (کرک / LAN)</option>
                <option value="microsoft">مایکروسافت (رسمی)</option>
              </select>
            </div>
            <div>
              <Label>بازیکن هدف محافظت (اختیاری)</Label>
              <Field
                value={protectTarget}
                onChange={(e) => setProtectTarget(e.target.value)}
                placeholder="نام تو در بازی"
              />
            </div>
            <div>
              <Label>نام سرور برای ذخیره</Label>
              <Field
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="سرور من"
              />
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={saveServer}
              onChange={(e) => setSaveServer(e.target.checked)}
              className="h-4 w-4 rounded accent-cyan-400"
            />
            ذخیرهٔ این سرور در لیست
          </label>

          {/* انتخاب حساب و OP */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              <input
                type="checkbox"
                checked={isOp}
                onChange={(e) => {
                  setIsOp(e.target.checked);
                  void apiSend("/api/settings", "PUT", {
                    mcIsOp: e.target.checked
                  }).catch(() => undefined);
                }}
                className="h-4 w-4 rounded accent-amber-400"
              />
              ⚡ این اکانت روی سرور <b>OP</b> است (تلپورت، give، زمان و…)
            </label>
            <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={chatBridge}
                onChange={(e) => {
                  setChatBridge(e.target.checked);
                  void apiSend("/api/settings", "PUT", {
                    mcChatBridge: e.target.checked
                  }).catch(() => undefined);
                }}
                className="h-4 w-4 rounded accent-cyan-400"
              />
              💬 گفت‌وگوی هوشمند داخل چت بازی (جواب بازیکنان)
            </label>
          </div>

          {/* ورود سرورهای کرکی (بدون اکانت) */}
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <Label>ورود به سرور کرکی (online_mode=false)</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ["none", "بدون لاگین"],
                  ["login", "🔐 /login"],
                  ["register", "🔐 /register + /login"]
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAuthMode(m)}
                  className={`rounded-lg px-2 py-2 text-[11px] transition ${
                    authMode === m
                      ? "bg-neon-green/20 text-neon-green"
                      : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              رمز همیشه <b className="text-neon-amber">@1988@1988</b> است — بعد از ورود به
              بازی، خودکار ارسال می‌شه.
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <Btn onClick={() => void connect()} disabled={busy} className="flex-1">
              {status.connecting ? "در حال اتصال..." : "اتصال"}
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => void disconnect()}
              disabled={busy || (!status.connected && !status.connecting)}
            >
              <span className="flex items-center gap-2">
                <LogOut size={16} /> قطع
              </span>
            </Btn>
          </div>

          {/* سرورهای ذخیره‌شده */}
          {servers.length > 0 ? (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-medium text-slate-400">
                سرورهای ذخیره‌شده
              </h3>
              <div className="space-y-2">
                {servers.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5"
                  >
                    <div className="flex-1">
                      <p className="text-sm text-white">{s.name}</p>
                      <p className="text-[10px] text-slate-500" dir="ltr">
                        {s.host}:{s.port} — {s.username ?? "بدون نام"} ({s.auth})
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setHost(s.host);
                        setPort(s.port);
                        setVersion(s.version);
                        setAuth(s.auth);
                        setUsername(s.username ?? "DastiarBot");
                        setServerName(s.name);
                      }}
                      className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                    >
                      پر کردن فرم
                    </button>
                    <button
                      onClick={() => void deleteServer(s)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        {/* دستورهای سریع */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
            <Zap size={18} className="text-neon-amber" /> دستورهای سریع
          </h2>

          {/* دکمه‌های حالت ویژه */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            <Btn
              variant={status.guardianMode ? "success" : "ghost"}
              onClick={() => void runCommand(status.guardianMode ? "محافظت رو خاموش کن" : "محافظت کن")}
              className="!text-xs"
            >
              <span className="flex items-center justify-center gap-1.5">
                <Shield size={15} /> محافظت
              </span>
            </Btn>
            <Btn
              variant={status.rocketMode ? "success" : "ghost"}
              onClick={() => void runCommand(status.rocketMode ? "موشک خاموش" : "موشک روشن")}
              className="!text-xs"
            >
              <span className="flex items-center justify-center gap-1.5">
                <Rocket size={15} /> موشک
              </span>
            </Btn>
            <Btn
              variant={status.autoAttack ? "danger" : "ghost"}
              onClick={() =>
                void runCommand(status.autoAttack ? "اتوکلیک خاموش" : "اتوکلیک روشن")
              }
              className="!text-xs"
            >
              <span className="flex items-center justify-center gap-1.5">
                <Swords size={15} /> اتوکلیک
              </span>
            </Btn>
          </div>

          {/* دستورهای رایج */}
          <div className="grid grid-cols-2 gap-2">
            {QUICK_COMMANDS.map((c) => (
              <button
                key={c.text}
                onClick={() => void runCommand(c.text)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-xs text-slate-200 transition hover:border-neon-cyan/40 hover:bg-white/10"
              >
                {c.icon}
                {c.label}
              </button>
            ))}
          </div>

          {/* دستور دلخواه */}
          <div className="mt-4 flex gap-2">
            <Field
              value={customCmd}
              onChange={(e) => setCustomCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customCmd.trim()) {
                  void runCommand(customCmd.trim());
                  setCustomCmd("");
                }
              }}
              placeholder="دستور فارسی دلخواه... مثلاً: برو به مختصات ۱۰ ۶۴ -۵"
            />
            <Btn
              onClick={() => {
                if (customCmd.trim()) {
                  void runCommand(customCmd.trim());
                  setCustomCmd("");
                }
              }}
              disabled={!customCmd.trim()}
            >
              <Send size={16} className="-scale-x-100" />
            </Btn>
          </div>

          {/* دکمهٔ قرمز توقف فوری */}
          <button
            onClick={() => void emergencyStop()}
            className="btn-emergency mt-4 flex w-full items-center justify-center gap-2 text-lg"
          >
            <Crosshair size={20} /> توقف فوری
          </button>

          {/* پیام‌های نتیجه */}
          {reply ? (
            <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3.5 text-sm leading-6 text-emerald-100">
              {reply}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3.5 text-sm leading-6 text-red-100">
              {error}
            </div>
          ) : null}
        </Card>
      </div>

      {/* حالت شخصیت + دوستان — حاضرم جونمو فداشون کنم */}
      <Card className="mt-6">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
          <Swords size={18} className="text-neon-amber" /> حالت شخصیت بازی + دوستان
        </h2>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              {
                id: "angry" as const,
                emoji: "🔥",
                title: "vood pump — فوق‌العاده عصبانی",
                desc: "سرعت/قدرت زیاد، اتوکلیک، جنگ‌طلب با غریبه‌ها؛ با دوستان مهربون"
              },
              {
                id: "kind" as const,
                emoji: "💚",
                title: "فوق‌العاده مهربون",
                desc: "با همه مهربون، محافظ همه در برابر ماب‌ها"
              },
              {
                id: "normal" as const,
                emoji: "💙",
                title: "عادی",
                desc: "با هم‌تیمی‌ها خوب، نسبت به بقیه خنثی"
              }
            ]
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPersonality(p.id);
                void apiSend("/api/settings", "PUT", { mcPersonality: p.id }).catch(
                  () => undefined
                );
                void runCommand(
                  p.id === "angry"
                    ? "وود پمپ کن"
                    : p.id === "kind"
                      ? "مهربون شو"
                      : "عادی شو"
                );
              }}
              className={`rounded-2xl border p-4 text-right transition ${
                personality === p.id
                  ? "border-neon-violet/60 bg-neon-violet/15"
                  : "border-white/10 bg-white/5 hover:border-white/25"
              }`}
            >
              <p className="text-sm font-bold text-white">
                {p.emoji} {p.title}
              </p>
              <p className="mt-1.5 text-[11px] leading-5 text-slate-400">{p.desc}</p>
            </button>
          ))}
        </div>

        {/* لیست دوستان */}
        <div className="mt-5">
          <Label>
            💙 دوستان — یوزرنیم‌هایی که Peak حاضره جونش رو فداشون کنه (تکی‌تکی اضافه کن)
          </Label>
          <div className="mt-2 flex gap-2">
            <Field
              value={friendInput}
              onChange={(e) => setFriendInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && friendInput.trim()) {
                  const name = friendInput.trim();
                  if (!friends.some((f) => f.toLowerCase() === name.toLowerCase())) {
                    const next = [...friends, name];
                    setFriends(next);
                    void apiSend("/api/settings", "PUT", { mcFriends: next }).catch(
                      () => undefined
                    );
                  }
                  setFriendInput("");
                }
              }}
              placeholder="یوزرنیم دوستت... مثلاً: AliCraft"
            />
            <Btn
              onClick={() => {
                const name = friendInput.trim();
                if (name && !friends.some((f) => f.toLowerCase() === name.toLowerCase())) {
                  const next = [...friends, name];
                  setFriends(next);
                  void apiSend("/api/settings", "PUT", { mcFriends: next }).catch(
                    () => undefined
                  );
                }
                setFriendInput("");
              }}
              disabled={!friendInput.trim()}
            >
              افزودن
            </Btn>
          </div>
          {friends.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {friends.map((f) => (
                <span
                  key={f}
                  className="flex items-center gap-2 rounded-full bg-neon-green/15 px-3.5 py-1.5 text-xs text-neon-green"
                >
                  💚 {f}
                  <button
                    onClick={() => {
                      const next = friends.filter((x) => x !== f);
                      setFriends(next);
                      void apiSend("/api/settings", "PUT", { mcFriends: next }).catch(
                        () => undefined
                      );
                    }}
                    className="text-slate-400 hover:text-red-400"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-slate-500">
              هنوز دوستی اضافه نشده. هر وقت هم توی صوتی یا چت بگی «فلانی رو دوستم حساب
              کن»، اضافه می‌شه.
            </p>
          )}
        </div>
      </Card>

      {/* سطح بازی — تا درجهٔ «خدا» با استقلال کامل */}
      <Card className="mt-6">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
          🎯 سطح بازی ربات — <span className="text-xs font-normal text-slate-400">هرچه بالاتر، دستش بازتر و برای تیم موثرتر</span>
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          {(
            [
              {
                id: "beginner" as const,
                emoji: "🌱",
                title: "مبتدی",
                desc: "فقط با دستور کار می‌کند — مناسب شروع"
              },
              {
                id: "normal" as const,
                emoji: "🙂",
                title: "عادی",
                desc: "دستورها + محافظت؛ بی‌دلیل کاری نمی‌کند"
              },
              {
                id: "pro" as const,
                emoji: "⚔️",
                title: "حرفه‌ای",
                desc: "خودش آهن/طلا/ذغال جمع می‌کند و از تیم دفاع می‌کند"
              },
              {
                id: "god" as const,
                emoji: "👑",
                title: "خدا",
                desc: "استقلال کامل: الماس و همهٔ سنگ‌های قیمتی را استخراج می‌کند، دفاع خودکار — برای تیم مثل یک پلیر حرفه‌ای"
              }
            ]
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPlayLevel(p.id);
                void apiSend("/api/settings", "PUT", { mcPlayLevel: p.id }).catch(
                  () => undefined
                );
              }}
              className={`rounded-2xl border p-4 text-right transition ${
                playLevel === p.id
                  ? "border-neon-cyan/60 bg-neon-cyan/15"
                  : "border-white/10 bg-white/5 hover:border-white/25"
              }`}
            >
              <p className="text-sm font-bold text-white">
                {p.emoji} {p.title}
              </p>
              <p className="mt-1.5 text-[11px] leading-5 text-slate-400">{p.desc}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* شعاع اسکن + رم اختصاصی — هرچه رم بیشتر، شعاع بیشتر */}
      <Card className="mt-6">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
          📡 شعاع اسکن + رم اختصاصی — <span className="text-xs font-normal text-slate-400">رم بیشتر بده، دنیای بیشتری ببیند</span>
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {[
            { ram: 512, label: "۵۱۲ مگ" },
            { ram: 1024, label: "۱ گیگ" },
            { ram: 2048, label: "۲ گیگ" },
            { ram: 4096, label: "۴ گیگ" },
            { ram: 8192, label: "۸ گیگ" }
          ].map((r) => {
            const radius = Math.min(100000, Math.round(r.ram * 20));
            return (
              <button
                key={r.ram}
                onClick={() => {
                  setRamMB(r.ram);
                  setScanRadius(radius);
                  void apiSend("/api/settings", "PUT", {
                    appRamMB: r.ram,
                    mcScanRadius: radius
                  }).catch(() => undefined);
                }}
                className={`rounded-2xl border p-4 text-right transition ${
                  ramMB === r.ram
                    ? "border-neon-amber/60 bg-neon-amber/15"
                    : "border-white/10 bg-white/5 hover:border-white/25"
                }`}
              >
                <p className="text-sm font-bold text-white">🧠 {r.label}</p>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                  شعاع اسکن: {radius.toLocaleString("fa-IR")} بلوک
                </p>
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>شعاع اسکن دستی (۱۰۰ تا ۱۰۰٬۰۰۰ بلوک)</Label>
            <Field
              type="number"
              value={scanRadius}
              onChange={(e) => setScanRadius(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end">
            <Btn
              onClick={() =>
                void apiSend("/api/settings", "PUT", {
                  appRamMB: ramMB,
                  mcScanRadius: scanRadius
                }).catch(() => undefined)
              }
            >
              💾 ذخیرهٔ شعاع و رم
            </Btn>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          ⚙️ سقف رم با ری‌استارت برنامه اعمال می‌شود. شعاع اسکن بلافاصله روی «اسکن خطر» و محیط اثر می‌گذارد.
        </p>
      </Card>

      {/* فهرست توانایی‌ها — کارهایی که Peak می‌تونه انجام بده */}
      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-bold text-white">
            <Zap size={18} className="text-neon-violet" />
            کارهایی که Peak می‌تونه بکنه
            <span className="rounded-full bg-neon-violet/20 px-2.5 py-0.5 text-xs text-neon-violet">
              {CAPABILITIES.length} توانایی
            </span>
          </h2>
          <input
            value={capQuery}
            onChange={(e) => setCapQuery(e.target.value)}
            placeholder="جست‌وجوی کار..."
            className="field !w-56 !py-2 text-xs"
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setCapCat("all")}
            className={`rounded-full px-3 py-1.5 text-[11px] transition ${
              capCat === "all"
                ? "bg-neon-cyan/20 text-neon-cyan"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            همه
          </button>
          {CAP_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCapCat(c.id)}
              className={`rounded-full px-3 py-1.5 text-[11px] transition ${
                capCat === c.id
                  ? "bg-neon-cyan/20 text-neon-cyan"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid max-h-96 grid-cols-1 gap-2 overflow-y-auto pl-1 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.filter(
            (c) =>
              (capCat === "all" || c.cat === capCat) &&
              (!capQuery.trim() ||
                c.label.includes(capQuery.trim()) ||
                c.desc.includes(capQuery.trim()) ||
                c.samples.some((s) => s.includes(capQuery.trim())))
          ).map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-neon-cyan/30 hover:bg-white/10"
            >
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs font-bold text-slate-100">
                  {c.label}
                </p>
                {c.op ? (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                    OP
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[10px] leading-5 text-slate-500">
                {c.desc}
              </p>
              {c.descEn ? (
                <p dir="ltr" className="mt-1 text-left text-[9px] leading-4 text-slate-600">
                  {c.descEn}
                </p>
              ) : null}
              <p className="mt-1 text-[10px] text-slate-600">
                مثال: «{c.samples[0]}»
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* لاگ کنسول */}
      <Card className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-white">
            <Activity size={18} className="text-neon-green" /> لاگ رویدادها
          </h2>
          <button
            onClick={() => {
              setLogs([]);
              lastLogId.current = 0;
            }}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/10"
          >
            <RefreshCw size={13} /> پاک‌کردن نمایش
          </button>
        </div>
        <div className="h-72 overflow-y-auto rounded-xl bg-black/40 p-4 font-mono text-xs leading-6">
          {logs.length === 0 ? (
            <p className="text-slate-600">
              هنوز رویدادی ثبت نشده. وصل که بشی همه‌چیز اینجا میاد...
            </p>
          ) : (
            logs.map((l) => (
              <div key={l.id} className={`flex gap-2 ${LOG_CLASS[l.type]}`}>
                <span className="opacity-70">
                  {new Date(l.at).toLocaleTimeString("fa-IR")}
                </span>
                <span>{LOG_PREFIX[l.type]}</span>
                <span className="flex-1 whitespace-pre-wrap">{l.text}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </Card>
    </div>
  );
}
