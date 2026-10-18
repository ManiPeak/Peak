// Peak 1.0.3 — Core Utils (3→1)
/**
 * لاگ ساخت‌یافتهٔ سمت سرور — هرگز رازها را چاپ نمی‌کند
 *
 * قوانین سخت:
 *  ۱) هیچ کلید API / توکنی هرگز وارد لاگ یا پاسخ کلاینت نمی‌شود
 *  ۲) هر خطاست باید ثبت شود (قانون: استثنا هرگز بی‌صدا بلعیده نشود)
 *  ۳) هر مقدار مشکوک پیش از چاپ با redact پاک می‌شود
 */
import fs from "node:fs";
import path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function envLevel(): LogLevel {
  const raw = (process.env.PEAK_LOG_LEVEL ?? "info").toLowerCase();
  return raw in LEVELS ? (raw as LogLevel) : "info";
}

/* ------------------------------------------------------------------ */
/* پاک‌سازی رازها                                                     */
/* ------------------------------------------------------------------ */

/** الگوهای شناخته‌شدهٔ کلید — هر چیزی که شبیه راز است پوشانده می‌شود */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // کلیدهای شناخته‌شده: sk-xxx (OpenAI)، sk-proj-…، sk_or_v1-… (OpenRouter)، gsk_… (Groq) و…
  [/\b(sk|pk|rk|or|xai|gsk|nvapi|9r|ghp|glpat|xoxb)[-_][A-Za-z0-9._-]{6,}/gi, "$1-***"],
  [/(Bearer\s+)[A-Za-z0-9._~+/-]{6,}=*/gi, "$1***"],
  [/((?:api[_-]?key|apikey|token|secret|password|authorization)"?\s*[:=]\s*"?)[^",\s}]{4,}/gi, "$1***"],
  [/([?&](?:key|api_key|apikey|token)=)[^&\s]+/gi, "$1***"]
];

const SENSITIVE_KEYS = new Set([
  "apikey",
  "api_key",
  "authorization",
  "token",
  "password",
  "secret",
  "cookie"
]);

/** هر رشته را از نظر راز بودن پاک می‌کند (برای لاگ و پاسخ خطا) */
export function redact(input: unknown): string {
  let text =
    typeof input === "string"
      ? input
      : input instanceof Error
        ? `${input.name}: ${input.message}`
        : safeStringify(input);
  for (const [re, replacement] of SECRET_PATTERNS) {
    text = text.replace(re, replacement);
  }
  return text;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === "string" && v.length > 400) return `${v.slice(0, 400)}…`;
      return v;
    }) ?? String(value);
  } catch {
    return String(value);
  }
}

/** ساخت نسخهٔ قابل‌نمایش از یک شیء با حذف کامل فیلدهای حساس */
export function scrub<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "***" : v;
  }
  return out as T;
}

/* ------------------------------------------------------------------ */
/* خروجی                                                              */
/* ------------------------------------------------------------------ */

let fileStream: fs.WriteStream | null = null;
let fileResolved = false;

function logFile(): fs.WriteStream | null {
  if (fileResolved) return fileStream;
  fileResolved = true;
  if (process.env.PEAK_LOG_FILE !== "1") return null;
  try {
    const base = process.env.DASTIAR_DB_PATH
      ? path.dirname(process.env.DASTIAR_DB_PATH)
      : path.join(process.cwd(), "data");
    fs.mkdirSync(base, { recursive: true });
    fileStream = fs.createWriteStream(path.join(base, "peak-server.log"), {
      flags: "a"
    });
  } catch {
    fileStream = null; // لاگ فایل نباید خودِ برنامه را از کار بیندازد
  }
  return fileStream;
}

/** نوشتن یک رکورد لاگ ساخت‌یافته (JSON Lines) */
export function log(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {}
): void {
  if (LEVELS[level] < LEVELS[envLevel()]) return;
  const record = {
    ts: new Date().toISOString(),
    level,
    event,
    ...scrub(fields)
  };
  let line: string;
  try {
    line = JSON.stringify(record);
  } catch {
    line = JSON.stringify({ ts: record.ts, level, event });
  }
  // stdout/stderr برای Next.js و ابزارهای لاگ استاندارد
  if (level === "error") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
  try {
    logFile()?.write(`${line}\n`);
  } catch {
    /* نادیده — لاگ نباید خطا بسازد */
  }
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) =>
    log("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) =>
    log("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) =>
    log("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) =>
    log("error", event, fields)
};

/**
 * ثبت خطا با جزئیات کامل — همیشه باید در catch استفاده شود.
 * خروجی این تابع برای پاسخ HTTP به کاربر مناسب است (بدون stack و بدون راز).
 */
export function describeError(err: unknown): {
  message: string;
  name: string;
  cause?: string;
} {
  if (err instanceof Error) {
    const cause =
      (err as Error & { cause?: unknown }).cause instanceof Error
        ? redact((err as Error & { cause: Error }).cause)
        : undefined;
    return {
      name: err.name,
      message: redact(err.message),
      ...(cause ? { cause } : {})
    };
  }
  return { name: "UnknownError", message: redact(err) };
}/**
 * موتور تشخیص (Diagnostics) — یک منبع واحد برای:
 *   • مسیر /api/diagnostics
 *   • دستور خط فرمان «npm run diagnose»
 *
 * اصل طلایی: هر چیزی که واقعاً تست نشده «NOT_TESTED» است، نه PASS.
 */
import { getAdapter, configLooksComplete, resolveConfig } from "@/lib/providers";
import type { ProviderCheck, ResolvedProviderConfig } from "@/lib/providers/types";
import { getSettings, listConversations, listServers } from "@/lib/store";
import { DB_PATH, rawDb } from "@/db";
import { botManager } from "@/minecraft/botManager";
import type { ProviderId } from "@/lib/types";
import { describeError } from "@/lib/logger";

export interface DiagnosticsReport {
  ok: boolean;
  generatedAt: string;
  /** نسخهٔ برنامه و محیط */
  runtime: {
    appVersion: string;
    node: string;
    platform: string;
    uptimeSec: number;
    dbPath: string;
  };
  /** تنظیمات مؤثر ارائه‌دهنده (بدون کلید — فقط ماسک‌شده) */
  provider: {
    id: ProviderId;
    label: string;
    baseUrl: string;
    model: string;
    apiKeyMasked: string;
    sources: ResolvedProviderConfig["sources"];
    requiresApiKey: boolean;
    help: string;
  };
  checks: ProviderCheck[];
  summary: {
    pass: number;
    fail: number;
    notTested: number;
    skipped: number;
  };
}

const APP_VERSION = "1.1.0";

function mask(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "••••";
  return `••••${key.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/* بررسی‌های پایه                                                       */
/* ------------------------------------------------------------------ */

/** سلامت خودِ بک‌اند (بدون نیاز به اینترنت) */
export function backendChecks(): ProviderCheck[] {
  const checks: ProviderCheck[] = [];
  const started = Date.now();

  // دیتابیس
  try {
    const row = rawDb
      .prepare("SELECT COUNT(*) AS n FROM conversations")
      .get() as { n: number } | undefined;
    checks.push({
      id: "database",
      label: "دیتابیس محلی (SQLite)",
      status: "PASS",
      detail: `متصل است — ${row?.n ?? 0} گفتگو، ${listConversations().length} ردیف فهرست. مسیر: ${DB_PATH}`,
      latencyMs: Date.now() - started
    });
  } catch (err) {
    checks.push({
      id: "database",
      label: "دیتابیس محلی (SQLite)",
      status: "FAIL",
      detail: describeError(err).message,
      hint: "پوشهٔ data باید قابل نوشتن باشد (دایرکتوری برنامه یا پوشهٔ کاربر)."
    });
  }

  // ماینکرفت
  try {
    const snap = botManager.getSnapshot();
    checks.push({
      id: "minecraft",
      label: "ربات ماینکرفت",
      status: snap.connected ? "PASS" : "NOT_TESTED",
      detail: snap.connected
        ? `ربات «${snap.username}» وصل است.`
        : "ربات وصل نیست (اتصال فقط با اجرای سرور واقعی تست می‌شود).",
      hint: snap.connected ? undefined : "از صفحهٔ ماینکرفت به سرور وصل شوید.",
      data: { servers: listServers().length }
    });
  } catch (err) {
    checks.push({
      id: "minecraft",
      label: "ربات ماینکرفت",
      status: "NOT_TESTED",
      detail: `وضعیت قابل خواندن نبود: ${describeError(err).message}`
    });
  }

  return checks;
}

/**
 * گزارش کامل تشخیص.
 * @param override پیکربندی موقت برای تست بدون ذخیره‌کردن در تنظیمات
 */
export async function runDiagnostics(override?: {
  provider?: ProviderId;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}): Promise<DiagnosticsReport> {
  const saved = getSettings();
  const settings = override
    ? {
        ...saved,
        ...(override.provider ? { provider: override.provider } : {}),
        ...(override.baseUrl !== undefined ? { baseUrl: override.baseUrl } : {}),
        ...(override.model !== undefined ? { model: override.model } : {}),
        ...(override.apiKey !== undefined ? { apiKey: override.apiKey } : {})
      }
    : saved;

  const cfg = resolveConfig(settings);
  const adapter = getAdapter(cfg.provider);
  const checks: ProviderCheck[] = [];

  // ۱) پیکربندی (بررسی محلی و بدون شبکه)
  const local = configLooksComplete(cfg);
  checks.push({
    id: "config",
    label: "پیکربندی ارائه‌دهنده",
    status: local.ok ? "PASS" : "FAIL",
    detail: local.ok
      ? `${adapter.label} — مدل «${cfg.model}» روی ${cfg.baseUrl}`
      : local.problems.join(" — "),
    hint: local.ok ? undefined : adapter.help,
    data: { sources: cfg.sources }
  });

  // ۲) تست‌های خود ارائه‌دهنده (دسترسی، احراز هویت، مدل، تولید واقعی)
  if (local.ok) {
    try {
      const providerChecks = await adapter.check(cfg);
      checks.push(...providerChecks);
    } catch (err) {
      checks.push({
        id: "provider",
        label: "تست ارائه‌دهنده",
        status: "FAIL",
        detail: describeError(err).message
      });
    }
  } else {
    checks.push({
      id: "provider",
      label: "تست ارائه‌دهنده",
      status: "SKIPPED",
      detail: "به‌خاطر ناقص بودن پیکربندی، تست شبکه انجام نشد.",
      hint: adapter.help
    });
  }

  // ۳) بررسی‌های خود برنامه
  checks.push(...backendChecks());

  const summary = {
    pass: checks.filter((c) => c.status === "PASS").length,
    fail: checks.filter((c) => c.status === "FAIL").length,
    notTested: checks.filter((c) => c.status === "NOT_TESTED").length,
    skipped: checks.filter((c) => c.status === "SKIPPED").length
  };

  return {
    ok: summary.fail === 0,
    generatedAt: new Date().toISOString(),
    runtime: {
      appVersion: APP_VERSION,
      node: process.version,
      platform: process.platform,
      uptimeSec: Math.round(process.uptime()),
      dbPath: DB_PATH
    },
    provider: {
      id: cfg.provider,
      label: adapter.label,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      apiKeyMasked: mask(cfg.apiKey),
      sources: cfg.sources,
      requiresApiKey: adapter.requiresApiKey,
      help: adapter.help
    },
    checks,
    summary
  };
}

/** رنگ/برچسب هر وضعیت برای خروجی خط فرمان */
export const STATUS_LABEL: Record<ProviderCheck["status"], string> = {
  PASS: "PASS",
  FAIL: "FAIL",
  NOT_TESTED: "NOT TESTED",
  SKIPPED: "SKIPPED"
};/**
 * لایهٔ یکپارچهٔ تشخیص گفتار فارسی
 *
 * اولویت اجرا:
 *   ۱. Web Speech API (Chrome/Edge) — دقیق و سریع
 *   ۲. موتور محلی vosk (WASM) — داخل پنجرهٔ برنامه/Electron، بدون مرورگر
 *      مدل صوتی فقط بار اول دانلود و کش می‌شود؛ بعدش کاملاً آفلاین
 */

export interface SttHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
  /** پیام وضعیت مثل «در حال آماده‌سازی موتور گفتار…» */
  onStatus?: (message: string) => void;
}

export interface SttSession {
  stop: () => void;
}

interface WebkitOptions {
  /** ادامهٔ شنیدن بعد از هر نتیجه */
  autoRestart: boolean;
}

/* ---------------- مسیر ۱: Web Speech API ---------------- */

function startWebkit(
  Recog: new () => SpeechRecognitionLike,
  handlers: SttHandlers,
  opts: WebkitOptions
): SttSession {
  let stopped = false;
  const recog = new Recog();
  recog.lang = "fa-IR";
  recog.continuous = true;
  recog.interimResults = true;

  recog.onresult = (event) => {
    let finalText = "";
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interimText += r[0].transcript;
    }
    if (interimText) handlers.onInterim(interimText);
    if (finalText.trim()) handlers.onFinal(finalText);
  };

  recog.onerror = (e) => {
    if (e.error === "not-allowed") {
      handlers.onError("اجازهٔ میکروفون داده نشد.");
      stopped = true;
    }
  };

  recog.onend = () => {
    if (stopped || !opts.autoRestart) {
      handlers.onEnd?.();
      return;
    }
    try {
      recog.start();
    } catch {
      /* قبلاً شروع شده */
    }
  };

  try {
    recog.start();
  } catch {
    /* نادیده */
  }

  return {
    stop: () => {
      stopped = true;
      try {
        recog.stop();
      } catch {
        /* نادیده */
      }
    }
  };
}

/* ---------------- مسیر ۲: موتور محلی vosk ---------------- */

interface VoskModelLike {
  KaldiRecognizer: new (sampleRate: number) => {
    on: (event: string, cb: (m: { result?: { text?: string; partial?: string } }) => void) => void;
    acceptWaveform: (buffer: AudioBuffer) => void;
    remove: () => void;
  };
}

let voskScriptPromise: Promise<void> | null = null;
let voskModelPromise: Promise<VoskModelLike> | null = null;

function loadVoskScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window در دسترس نیست"));
  }
  const w = window as unknown as { Vosk?: unknown };
  if (w.Vosk) return Promise.resolve();
  if (!voskScriptPromise) {
    voskScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/api/vendor/vosk"; // دانلود خودکار + کش دائمی (مثل مدل فارسی)
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("موتور گفتار بارگذاری نشد (vosk.js)"));
      document.head.appendChild(script);
    });
  }
  return voskScriptPromise;
}

async function getVoskModel(): Promise<VoskModelLike> {
  if (!voskModelPromise) {
    voskModelPromise = (async () => {
      await loadVoskScript();
      const Vosk = (window as unknown as {
        Vosk: { createModel: (url: string) => Promise<VoskModelLike> };
      }).Vosk;
      return await Vosk.createModel("/api/models/fa");
    })().catch((err) => {
      voskModelPromise = null; // اجازهٔ تلاش دوباره
      throw err;
    });
  }
  return voskModelPromise;
}

async function startVosk(handlers: SttHandlers): Promise<SttSession> {
  handlers.onStatus?.("در حال آماده‌سازی موتور گفتار… (بار اول ممکن است چند لحظه طول بکشد)");
  const model = await getVoskModel();
  handlers.onStatus?.("");

  const recognizer = new model.KaldiRecognizer(16000);
  recognizer.on("partialresult", (m) => {
    const partial = m.result?.partial ?? "";
    if (partial) handlers.onInterim(partial);
  });
  recognizer.on("result", (m) => {
    const text = (m.result?.text ?? "").trim();
    if (text) handlers.onFinal(text);
    else handlers.onInterim("");
  });

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true
    }
  });

  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new Ctx({ sampleRate: 16000 });
  const source = ctx.createMediaStreamSource(stream);
  const pump = ctx.createScriptProcessor(4096, 1, 1);
  // مقصد بی‌صدا تا زنجیرهٔ صدا فعال بماند بدون فیدبک بلندگو
  const mute = ctx.createGain();
  mute.gain.value = 0;

  let stopped = false;
  pump.onaudioprocess = (event) => {
    if (stopped) return;
    try {
      recognizer.acceptWaveform(event.inputBuffer);
    } catch {
      /* نادیده */
    }
  };

  source.connect(pump);
  pump.connect(mute);
  mute.connect(ctx.destination);

  return {
    stop: () => {
      stopped = true;
      try {
        recognizer.remove();
      } catch {
        /* نادیده */
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => undefined);
    }
  };
}

/* ---------------- ورودی عمومی ---------------- */

export async function startStt(
  handlers: SttHandlers,
  opts: WebkitOptions = { autoRestart: false }
): Promise<SttSession | null> {
  const Recog =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (Recog) return startWebkit(Recog, handlers, opts);
  try {
    return await startVosk(handlers);
  } catch (err) {
    handlers.onError(
      err instanceof Error
        ? `موتور گفتار آماده نشد: ${err.message}`
        : "موتور گفتار آماده نشد."
    );
    return null;
  }
}

/** آیا تشخیص گفتار در این محیط ممکن است؟ */
export function sttAvailable(): boolean {
  return !!(
    typeof window !== "undefined" &&
    (window.SpeechRecognition ??
      window.webkitSpeechRecognition ??
      (undefined as unknown))
  );
}
