/**
 * ابزارهای HTTP مشترک لایهٔ ارائه‌دهنده‌ها
 *
 * اهداف:
 *  - تایم‌اوت اجباری روی هر درخواست (تا یک ارائه‌دهندهٔ مرده چت را قفل نکند)
 *  - تبدیل خطاهای شبکه به پیام‌های قابل‌فهم فارسی (اتصال رد شد، DNS، تایم‌اوت…)
 *  - هرگز لو ندادن کلید API در متن خطا
 */
import { describeError, logger, redact } from "@/lib/logger";

export const DEFAULT_TIMEOUT_MS = 60_000;
export const PROBE_TIMEOUT_MS = 15_000;

/** کد خطای شبکه → پیام فارسی + راهنمای رفع */
const NETWORK_HINTS: Array<{
  test: (code: string, msg: string) => boolean;
  message: string;
  hint: string;
}> = [
  {
    // هم کد استاندارد و هم متن زنجیرهٔ علت (بعضی نسخه‌های Node فقط پیام می‌دهند)
    test: (c, m) => c === "ECONNREFUSED" || /ECONNREFUSED|connection refused/i.test(m),
    message: "اتصال برقرار نشد (Connection refused).",
    hint: "سرویس روی این آدرس/پورت در حال اجرا نیست. Ollama را اجرا کنید (`ollama serve`) یا آدرس پایه را اصلاح کنید."
  },
  {
    test: (c, m) => c === "ENOTFOUND" || c === "EAI_AGAIN" || /ENOTFOUND|getaddrinfo/i.test(m),
    message: "دامنه پیدا نشد (DNS).",
    hint: "نام دامنه یا اینترنت سیستم را بررسی کنید."
  },
  {
    test: (c) => c === "ETIMEDOUT" || c === "UND_ERR_CONNECT_TIMEOUT",
    message: "اتصال بیش از حد طول کشید (timeout).",
    hint: "فایروال/VPN یا سرعت شبکه را بررسی کنید."
  },
  {
    test: (c, m) => c === "UND_ERR_HEADERS_TIMEOUT" || /headers timeout/i.test(m),
    message: "ارائه‌دهنده در زمان مجاز پاسخ نداد.",
    hint: "دوباره تلاش کنید؛ اگر تکرار شد مدل یا سرویس کند است."
  },
  {
    test: (c, m) => /bad port|invalid url|invalid port/i.test(m),
    message: "آدرس یا پورت معتبر نیست.",
    hint: "آدرس پایه را کامل بنویسید، مثلاً http://127.0.0.1:11434 (پورت‌های رزروشده مثل 9 مجاز نیستند)."
  },
  {
    test: (c) => c.startsWith("CERT_") || c.startsWith("ERR_TLS") || c.startsWith("DEPTH_ZERO"),
    message: "خطای گواهی TLS/SSL.",
    hint: "گواهی‌های سیستم را به‌روز کنید یا NODE_EXTRA_CA_CERTS را تنظیم کنید."
  }
];

/** استخراج کد خطا از fetch/DNS/TCP (در Node ۱۸+ خطاها علت زنجیره‌ای دارند) */
export function errorCode(err: unknown): string {
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    const e = cur as { code?: string; cause?: unknown; errors?: unknown };
    if (typeof e.code === "string") return e.code;
    // اتصال دوحالته (IPv4/IPv6) به‌صورت AggregateError گزارش می‌شود
    if (Array.isArray(e.errors) && e.errors.length) {
      for (const inner of e.errors) {
        const code = errorCode(inner);
        if (code) return code;
      }
    }
    cur = e.cause;
  }
  return "";
}

/** جمع‌آکردن پیام‌های کل زنجیرهٔ علت — Node جزئیات را در `cause` پنهان می‌کند */
export function errorChainText(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    const e = cur as { message?: unknown; cause?: unknown; errors?: unknown };
    if (typeof e.message === "string") parts.push(e.message);
    if (Array.isArray(e.errors)) {
      for (const inner of e.errors) parts.push(errorChainText(inner));
    }
    cur = e.cause;
  }
  return parts.join(" | ");
}

/** تبدیل خطای شبکه به پیام قابل‌فهم + راهنما */
export function describeNetworkError(err: unknown): {
  message: string;
  hint: string;
  kind: "network" | "timeout" | "abort" | "unknown";
} {
  const code = errorCode(err);
  const raw = redact(err instanceof Error ? err.message : String(err));
  const chain = redact(errorChainText(err));
  const name = err instanceof Error ? err.name : "";
  // کدها یا پیام‌های زنجیرهٔ علت
  const test = (c: string, m: string) => NETWORK_HINTS.some((h) => h.test(c, m));
  const hitFor = (m: string) => NETWORK_HINTS.find((h) => h.test(code, m));

  if (
    name === "TimeoutError" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    test(code, chain)
  ) {
    const hit = hitFor(chain) ?? hitFor(raw);
    const timeoutish =
      name === "TimeoutError" ||
      code === "UND_ERR_CONNECT_TIMEOUT" ||
      code === "ETIMEDOUT" ||
      (hit !== undefined &&
        (code === "UND_ERR_HEADERS_TIMEOUT" || /headers timeout/i.test(chain)));
    if (timeoutish) {
      return {
        message: "اتصال به ارائه‌دهنده بیش از حد طول کشید.",
        hint: hit?.hint ?? "سرویس کند یا در دسترس نیست. دوباره تلاش کنید.",
        kind: "timeout"
      };
    }
    return {
      message: `${hit?.message ?? raw}${code ? ` (${code})` : ""}`,
      hint: hit?.hint ?? "اتصال اینترنت، فایروال و آدرس ارائه‌دهنده را بررسی کنید.",
      kind: "network"
    };
  }
  if (name === "AbortError") {
    return {
      message: "درخواست به‌خاطر تمام شدن زمان لغو شد.",
      hint: "زمان پاسخ ارائه‌دهنده بیش از حد طول کشید.",
      kind: "timeout"
    };
  }
  const hit = NETWORK_HINTS.find((h) => h.test(code, chain)) ?? NETWORK_HINTS.find((h) => h.test(code, raw));
  if (hit) return { message: `${hit.message}${code ? ` (${code})` : ""}`, hint: hit.hint, kind: "network" };
  return {
    message: raw || "خطای ناشناختهٔ شبکه",
    hint: "اتصال اینترنت، فایروال و آدرس ارائه‌دهنده را بررسی کنید.",
    kind: "unknown"
  };
}

/**
 * خطای شبکه با پیام قابل‌فهم نرمال‌سازی می‌شود و کد خطا حفظ می‌گردد
 * تا لایهٔ بالا بتواند تصمیم بگیرد (نمایش به کاربر یا تلاش دوباره).
 */
export class ProviderNetworkError extends Error {
  readonly code: string;
  readonly kind: "network" | "timeout" | "abort" | "unknown";
  readonly hint: string;
  constructor(message: string, code: string, kind: ProviderNetworkError["kind"], hint: string) {
    super(message);
    this.name = "ProviderNetworkError";
    this.code = code;
    this.kind = kind;
    this.hint = hint;
  }
}

/** اجرای fetch با تایم‌اوت و بدون نشت کلید در لاگ */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (err) {
    const net = describeNetworkError(err);
    throw new ProviderNetworkError(net.message, errorCode(err), net.kind, net.hint);
  } finally {
    clearTimeout(timer);
  }
}

/** خواندن بدنه به‌صورت متن با سقف حجم (برای پیام خطا) */
export async function readBody(res: Response, limit = 600): Promise<string> {
  try {
    const text = await res.text();
    return redact(text.slice(0, limit));
  } catch {
    return "";
  }
}

/** خواندن JSON با خطای قابل‌فهم */
export async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    logger.warn("provider.bad_json", { status: res.status, sample: redact(text.slice(0, 200)) });
    throw new Error("پاسخ ارائه‌دهنده JSON معتبر نبود.");
  }
}

/**
 * پارس استریم SSE و استخراج تکه‌های متن.
 * اگر سرور به‌جای SSE پاسخ JSON کامل بدهد، همان را هم پشتیبانی می‌کند.
 */
export async function* readSseText(
  body: ReadableStream<Uint8Array>,
  opts: { extract?: (json: unknown) => string | undefined } = {}
): AsyncGenerator<string> {
  const extract =
    opts.extract ??
    ((json: unknown) => {
      const j = json as {
        choices?: Array<{ delta?: { content?: string }; text?: string }>;
        message?: { content?: string };
        response?: string;
        content?: string;
      };
      return (
        j.choices?.[0]?.delta?.content ??
        j.choices?.[0]?.text ??
        j.message?.content ??
        j.response ??
        j.content ??
        undefined
      );
    });

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawData = false;
  let plain = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("data:")) {
          sawData = true;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const chunk = extract(JSON.parse(payload));
            if (chunk) yield chunk;
          } catch {
            /* تکهٔ ناقص/غیرJSON — نادیده */
          }
        } else if (!trimmed.startsWith(":")) {
          // پاسخ غیر SSE (مثلاً NDJSON یا JSON کامل در یک خط)
          try {
            const chunk = extract(JSON.parse(trimmed));
            if (chunk) {
              yield chunk;
              sawData = true;
            }
          } catch {
            plain += trimmed;
          }
        }
      }
    }
    const tail = buffer.trim();
    if (tail) {
      if (tail.startsWith("data:")) {
        const payload = tail.slice(5).trim();
        if (payload !== "[DONE]") {
          try {
            const chunk = extract(JSON.parse(payload));
            if (chunk) yield chunk;
          } catch {
            /* نادیده */
          }
        }
      } else {
        try {
          const chunk = extract(JSON.parse(tail));
          if (chunk) yield chunk;
        } catch {
          plain += tail;
        }
      }
    }
    if (!sawData && plain.trim() && !plain.trim().startsWith("{")) {
      // متن ساده (مثلاً پاسخ سادهٔ Pollinations)
      yield plain;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* نادیده */
    }
  }
}

/** نرمال‌سازی آدرس پایه: حذف اسلش انتهایی */
export function normalizeBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

/** ساخت آدرس endpoint با نرمال‌سازی مسیر */
export function joinUrl(baseUrl: string, path: string): string {
  const base = normalizeBase(baseUrl);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** آدرس «ریشه» بدون پسوند /v1 — برای API بومی Ollama لازم است */
export function stripV1(baseUrl: string): string {
  return normalizeBase(baseUrl).replace(/\/v1$/i, "");
}

/** توضیح خطای HTTP برای کاربر (بدون راز) */
export function httpErrorHint(status: number): string {
  switch (status) {
    case 400:
      return "درخواست نامعتبر است — مدل یا پارامترها را بررسی کنید.";
    case 401:
      return "کلید API نامعتبر یا ارسال نشده است.";
    case 402:
      return "اعتبار (کریdit) کافی نیست.";
    case 403:
      return "دسترسی مجاز نیست — کلید، بودجه یا محدودیت ارائه‌دهنده.";
    case 404:
      return "آدرس یا نام مدل پیدا نشد — مدل را با فهرست مدل‌ها مقایسه کنید.";
    case 408:
      return "ارائه‌دهنده جواب نداد (timeout).";
    case 413:
      return "حجم درخواست بیش از حد مجاز است.";
    case 429:
      return "محدودیت نرخ درخواست (rate limit) — کمی بعد دوباره تلاش کنید.";
    case 500:
    case 502:
    case 503:
      return "خطای موقت سمت ارائه‌دهنده — چند لحظه بعد دوباره تلاش کنید.";
    case 504:
      return "ارائه‌دهنده بیش از حد طول کشید (gateway timeout).";
    default:
      return status >= 500
        ? "خطای داخلی ارائه‌دهنده."
        : "درخواست توسط ارائه‌دهنده رد شد.";
  }
}

/** ثبت خطا و بازگرداندن نسخهٔ قابل‌نمایش آن */
export function reportProviderError(
  event: string,
  err: unknown,
  context: Record<string, unknown> = {}
): { message: string; hint: string } {
  const net = describeNetworkError(err);
  const d = describeError(err);
  logger.error(event, { ...context, ...d, hint: net.hint });
  return { message: d.message, hint: net.hint };
}