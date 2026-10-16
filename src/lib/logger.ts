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
}