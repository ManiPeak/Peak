// Peak 1.0.3 — Consolidated Providers (7 → 1)
// All provider logic merged for 99-file optimization
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
}/**
 * رجیستری ارائه‌دهنده‌ها — تنها نقطهٔ تماس برنامه با لایهٔ LLM
 *
 * استفاده:
 *   import { getAdapter, resolveConfig, streamCompletion } from "@/lib/providers";
 */
import type { AppSettings, ProviderId } from "@/lib/types";
import type {
  CompletionResult,
  ProviderAdapter,
  ProviderMessage,
  ResolvedProviderConfig
} from "@/lib/providers/types";
import { ollamaAdapter } from "@/lib/providers/ollama";
import { isBuiltInModelId } from "@/lib/builtin-models";
import { openrouterAdapter } from "@/lib/providers/openrouter";
import { pollinationsAdapter } from "@/lib/providers/pollinations";
import { createOpenAICompatibleAdapter } from "@/lib/providers/openaiCompatible";
import { logger } from "@/lib/logger";

/* ---------------- آداپتورهای سازگار با OpenAI ---------------- */

const openaiAdapter = createOpenAICompatibleAdapter({
  id: "openai",
  label: "OpenAI",
  requiresApiKey: true,
  defaultBaseUrl: "https://api.openai.com/v1",
  defaultModel: "gpt-4o-mini",
  envBaseUrl: "OPENAI_BASE_URL",
  envApiKey: "OPENAI_API_KEY",
  help: "کلید را از https://platform.openai.com/api-keys بگیرید (متغیر محیطی OPENAI_API_KEY)."
});

const groqAdapter = createOpenAICompatibleAdapter({
  id: "groq",
  label: "Groq",
  requiresApiKey: true,
  defaultBaseUrl: "https://api.groq.com/openai/v1",
  defaultModel: "llama-3.3-70b-versatile",
  envBaseUrl: "GROQ_BASE_URL",
  envApiKey: "GROQ_API_KEY",
  help: "کلید رایگان Groq از https://console.groq.com/keys (متغیر محیطی GROQ_API_KEY)."
});

const xaiAdapter = createOpenAICompatibleAdapter({
  id: "xai",
  label: "xAI (Grok)",
  requiresApiKey: true,
  defaultBaseUrl: "https://api.x.ai/v1",
  defaultModel: "grok-2-mini",
  envBaseUrl: "XAI_BASE_URL",
  envApiKey: "XAI_API_KEY",
  help: "کلید xAI از https://console.x.ai (متغیر محیطی XAI_API_KEY)."
});

const lmstudioAdapter = createOpenAICompatibleAdapter({
  id: "lmstudio",
  label: "LM Studio (محلی)",
  requiresApiKey: false,
  defaultBaseUrl: "http://127.0.0.1:1234/v1",
  defaultModel: "local-model",
  envBaseUrl: "LMSTUDIO_BASE_URL",
  help: "در LM Studio سرور محلی را روشن کنید (Developer → Start Server). پورت پیش‌فرض 1234."
});

const customAdapter = createOpenAICompatibleAdapter({
  id: "custom",
  label: "سفارشی (OpenAI-Compatible)",
  requiresApiKey: false,
  defaultBaseUrl: "",
  defaultModel: "",
  help: "هر سرویسی که مسیر {baseUrl}/chat/completions دارد."
});

/**
 * 9Router — پروکسی محلی OpenAI-Compatible
 * منبع: مخزن رسمی decolua/9router و بستهٔ npm «9router».
 * آدرس پیش‌فرض مستندشده: http://localhost:20128/v1  (پروکسی محلی)
 * فقط از مسیرهای مستندشده استفاده می‌کنیم: /v1/models و /v1/chat/completions
 */
const nineRouterAdapter = createOpenAICompatibleAdapter({
  id: "9router",
  label: "9Router (پروکسی محلی)",
  requiresApiKey: false,
  defaultBaseUrl: "http://127.0.0.1:20128/v1",
  defaultModel: "",
  envBaseUrl: "NINE_ROUTTER_BASE_URL",
  envApiKey: "NINE_ROUTTER_API_KEY",
  help:
    "9Router یک پروکسی محلی OpenAI-Compatible است (npm i -g 9router و اجرای 9router). آدرس پیش‌فرض مستندشده http://localhost:20128/v1 — ابتدا با «تست اتصال» مطمئن شوید 9Router روی همان پورت بالا آمده، سپس مدل را از «GET /v1/models» انتخاب کنید."
});

/* ---------------- رجیستری ---------------- */

const REGISTRY: Record<ProviderId, ProviderAdapter> = {
  builtin: pollinationsAdapter,
  ollama: ollamaAdapter,
  openrouter: openrouterAdapter,
  openai: openaiAdapter,
  groq: groqAdapter,
  xai: xaiAdapter,
  lmstudio: lmstudioAdapter,
  custom: customAdapter,
  "9router": nineRouterAdapter
};

export const PROVIDER_IDS = Object.keys(REGISTRY) as ProviderId[];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && value in REGISTRY;
}

export function getAdapter(provider: ProviderId): ProviderAdapter {
  const adapter = REGISTRY[provider];
  if (!adapter) {
    logger.warn("provider.unknown", { provider });
    return pollinationsAdapter;
  }
  return adapter;
}

/** آدرس پایهٔ پیش‌فرض هر ارائه‌دهنده (برای UI و تست) */
export const PROVIDER_BASE_URLS: Record<ProviderId, string> = Object.fromEntries(
  PROVIDER_IDS.map((id) => [id, REGISTRY[id].defaultBaseUrl])
) as Record<ProviderId, string>;

/** فهرست کامل آداپتورها — برای صفحهٔ تشخیص */
export function allAdapters(): ProviderAdapter[] {
  return PROVIDER_IDS.map((id) => REGISTRY[id]);
}

/** نرمال‌سازی آدرس برای مقایسه (localhost و 127.0.0.1 یکی حساب می‌شوند) */
function normalizeForCompare(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "")
    .replace(/^http:\/\/localhost(?=[:/]|$)/, "http://127.0.0.1");
}

/**
 * آیا این آدرس ذخیره‌شده متعلق به ارائه‌دهندهٔ دیگری است؟
 * مثال کاربر: در تنظیمات قبلاً Pollinations بوده، حالا Ollama را انتخاب کرده
 * ولی آدرس قبلی در تنظیمات مانده — بدون این بررسی، Peak به آدرس اشتباه می‌رود.
 */
function baseUrlBelongsToAnotherProvider(url: string, provider: ProviderId): boolean {
  const target = normalizeForCompare(url);
  if (!target) return false;
  let mine = false;
  for (const [id, adapter] of Object.entries(REGISTRY) as Array<[ProviderId, ProviderAdapter]>) {
    const def = normalizeForCompare(adapter.defaultBaseUrl);
    if (!def) continue;
    if (target === def) {
      if (id === provider) mine = true;
      else return true;
    }
  }
  return !mine && target !== "" && [...Object.values(REGISTRY)].some(
    (a) => normalizeForCompare(a.defaultBaseUrl) === target
  );
}

/** آیا این نام مدل متعلق به ارائه‌دهنده/مدل داخلی دیگری است؟ */
function modelBelongsToAnotherProvider(model: string, provider: ProviderId): boolean {
  const m = model.trim().toLowerCase();
  if (!m) return false;
  if (provider === "builtin") return false;
  if (isBuiltInModelId(m)) return true;
  for (const [id, adapter] of Object.entries(REGISTRY) as Array<[ProviderId, ProviderAdapter]>) {
    const def = adapter.defaultModel.trim().toLowerCase();
    if (def && m === def && id !== provider && id !== "builtin") return true;
  }
  return false;
}

/** تبدیل تنظیمات برنامه به پیکربندی قطعی ارائه‌دهنده */
export function resolveConfig(
  settings: Pick<AppSettings, "provider" | "baseUrl" | "model" | "apiKey">
): ResolvedProviderConfig {
  const adapter = getAdapter(settings.provider);

  // آدرس و مدلی که به ارائه‌دهندهٔ دیگری تعلق دارند نادیده گرفته می‌شوند
  const baseUrl =
    baseUrlBelongsToAnotherProvider(settings.baseUrl ?? "", settings.provider)
      ? ""
      : settings.baseUrl;
  const model = modelBelongsToAnotherProvider(
    settings.model ?? "",
    settings.provider
  )
    ? ""
    : settings.model;

  if (baseUrl !== settings.baseUrl || model !== settings.model) {
    logger.info("provider.foreign_settings_ignored", {
      provider: settings.provider,
      ignoredBaseUrl: settings.baseUrl,
      ignoredModel: settings.model
    });
  }

  const cfg = adapter.resolve({
    provider: settings.provider,
    baseUrl,
    model,
    apiKey: settings.apiKey
  });
  logger.debug("provider.resolved", {
    provider: cfg.provider,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    apiKeySource: cfg.sources.apiKey,
    baseUrlSource: cfg.sources.baseUrl
  });
  return cfg;
}

/** استریم پاسخ مدل از ارائه‌دهندهٔ تنظیم‌شده */
export async function* streamCompletion(
  cfg: ResolvedProviderConfig,
  messages: ProviderMessage[],
  opts?: { maxTokens?: number; temperature?: number }
): AsyncGenerator<string> {
  yield* getAdapter(cfg.provider).stream(cfg, messages, opts);
}

/** تولید یک‌بارهٔ متن (برای تست‌ها و تشخیص) */
export function completeOnce(
  cfg: ResolvedProviderConfig,
  messages: ProviderMessage[],
  opts?: { maxTokens?: number; temperature?: number; timeoutMs?: number }
): Promise<CompletionResult> {
  return getAdapter(cfg.provider).complete(cfg, messages, opts);
}

/** فهرست مدل‌های واقعی ارائه‌دهنده */
export function listProviderModels(cfg: ResolvedProviderConfig): Promise<string[]> {
  return getAdapter(cfg.provider).listModels(cfg);
}

/** آیا پیکربندی برای ارسال درخواست کافی است؟ (بررسی محلی و بدون شبکه) */
export function configLooksComplete(cfg: ResolvedProviderConfig): {
  ok: boolean;
  problems: string[];
} {
  const adapter = getAdapter(cfg.provider);
  const problems: string[] = [];
  if (!cfg.baseUrl) problems.push("آدرس پایه (Base URL) خالی است.");
  else if (!/^https?:\/\//i.test(cfg.baseUrl)) problems.push("آدرس پایه باید با http:// یا https:// شروع شود.");
  if (!cfg.model) problems.push("نام مدل خالی است.");
  if (adapter.requiresApiKey && !cfg.apiKey) {
    problems.push("این ارائه‌دهنده به کلید API نیاز دارد.");
  }
  return { ok: problems.length === 0, problems };
}

export * from "@/lib/providers/types";
export { ollamaAdapter, sameModelName } from "@/lib/providers/ollama";
export { openrouterAdapter, OPENROUTER_BASE_URL } from "@/lib/providers/openrouter";
export {
  pollinationsAdapter,
  backendModelFor,
  BUILT_IN_API_URL
} from "@/lib/providers/pollinations";
export {
  describeNetworkError,
  errorCode,
  httpErrorHint
} from "@/lib/providers/http";/**
 * آداپتور Ollama — بر پایهٔ API بومی Ollama
 *
 * مستندات رسمی: https://github.com/ollama/ollama/blob/main/docs/api.md
 *  - GET  /api/version            → {"version": "..."}
 *  - GET  /api/tags               → {"models": [{"name": "llama3.2:3b", ...}]}
 *  - POST /api/chat               → {"message": {"role","content"}, "done": true}
 *    (استریم = NDJSON: هر خط یک JSON کامل)
 *  - سرویس‌های جدیدتر علاوه بر بومی، مسیر OpenAI-Compatible با پیشوند /v1 را
 *    هم می‌دهند؛ این آداپتور اول بومی را امتحان می‌کند و در صورت نبود،
 *    به مسیر سازگار با OpenAI سقوط می‌کند.
 */
import {
  fetchWithTimeout,
  httpErrorHint,
  joinUrl,
  normalizeBase,
  readBody,
  readJson,
  readSseText,
  reportProviderError,
  stripV1,
  PROBE_TIMEOUT_MS
} from "@/lib/providers/http";
import type {
  CompletionResult,
  ProviderAdapter,
  ProviderCheck,
} from "@/lib/providers/types";

export const OLLAMA_DEFAULT_BASE_URL = "http://127.0.0.1:11434";

interface OllamaTag {
  name?: string;
  model?: string;
  size?: number;
  details?: { parameter_size?: string; family?: string };
}

export interface OllamaModelInfo {
  name: string;
  family?: string;
  parameters?: string;
  sizeGB?: number;
}

function envStr(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** OLLAMA_HOST می‌تواند «127.0.0.1:11434» یا «http://host:port» باشد */
function baseUrlFromEnv(): string {
  const host = envStr("OLLAMA_HOST");
  if (!host) return OLLAMA_DEFAULT_BASE_URL;
  if (/^https?:\/\//i.test(host)) return stripV1(host);
  return `http://${host.replace(/\/+$/, "")}`;
}

async function getJson<T>(url: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<T> {
  const res = await fetchWithTimeout(url, { timeoutMs });
  if (!res.ok) {
    const body = await readBody(res);
    throw new Error(`HTTP ${res.status}${body ? ` — ${body}` : ""}`);
  }
  return readJson<T>(res);
}

export const ollamaAdapter: ProviderAdapter = {
  id: "ollama",
  label: "Ollama (محلی)",
  requiresApiKey: false,
  defaultBaseUrl: OLLAMA_DEFAULT_BASE_URL,
  defaultModel: "llama3.2:3b",
  envBaseUrl: "OLLAMA_BASE_URL",
  help:
    "Ollama را نصب و اجرا کنید (`ollama serve`)، بعد `ollama pull llama3.2:3b`. آدرس پیش‌فرض http://127.0.0.1:11434 — این آداپتور از API بومی (/api/tags و /api/chat) استفاده می‌کند.",

  resolve(input) {
    const fromSettings = (input.baseUrl ?? "").trim();
    const fromEnv = envStr("OLLAMA_BASE_URL");
    // اگر کاربر «…/v1» را وارد کرده بود، به ریشه برمی‌گردانیم تا مسیر بومی درست شود
    const raw = fromSettings || fromEnv || baseUrlFromEnv();
    const modelSettings = (input.model ?? "").trim();
    const modelEnv = envStr("OLLAMA_MODEL");
    const model = modelSettings || modelEnv || this.defaultModel;
    return {
      provider: "ollama",
      baseUrl: stripV1(normalizeBase(raw)),
      model,
      apiKey: "",
      headers: {},
      sources: {
        baseUrl: fromSettings ? "settings" : fromEnv || envStr("OLLAMA_HOST") ? "env" : "default",
        model: modelSettings ? "settings" : modelEnv ? "env" : "default",
        apiKey: "none"
      }
    };
  },

  /** فهرست مدل‌های واقعاً نصب‌شده از /api/tags (با سقوط به /v1/models) */
  async listModels(cfg) {
    try {
      const data = await getJson<{ models?: OllamaTag[] }>(joinUrl(cfg.baseUrl, "/api/tags"));
      return (data.models ?? [])
        .map((m) => m.name ?? m.model ?? "")
        .filter(Boolean)
        .sort();
    } catch (err) {
      // اگر نسخهٔ خیلی قدیمی باشد یا مسیر بومی نبود، مسیر OpenAI-Compatible را امتحان کن
      const res = await fetchWithTimeout(joinUrl(cfg.baseUrl, "/v1/models"), {
        timeoutMs: PROBE_TIMEOUT_MS
      });
      if (!res.ok) throw err;
      const data = await readJson<{ data?: Array<{ id?: string }> }>(res);
      return (data.data ?? [])
        .map((m) => m.id ?? "")
        .filter(Boolean)
        .sort();
    }
  },

  /** جزئیات مدل‌ها (خانواده، تعداد پارامتر، حجم) برای نمایش در UI */
  async describeModels(cfg): Promise<OllamaModelInfo[]> {
    const data = await getJson<{ models?: OllamaTag[] }>(joinUrl(cfg.baseUrl, "/api/tags"));
    return (data.models ?? []).map((m) => ({
      name: m.name ?? m.model ?? "",
      family: m.details?.family,
      parameters: m.details?.parameter_size,
      sizeGB: m.size ? Math.round((m.size / 1024 ** 3) * 10) / 10 : undefined
    }));
  },

  async check(cfg) {
    const checks: ProviderCheck[] = [];

    // ۱) نسخهٔ سرویس
    const t0 = Date.now();
    let version = "";
    try {
      const v = await getJson<{ version?: string }>(joinUrl(cfg.baseUrl, "/api/version"));
      version = v.version ?? "";
      checks.push({
        id: "reachability",
        label: "دسترسی به سرویس Ollama",
        status: "PASS",
        detail: `سرویس Ollama در دسترس است${version ? ` (نسخهٔ ${version})` : ""} — ${cfg.baseUrl}`,
        latencyMs: Date.now() - t0
      });
    } catch (err) {
      const { message, hint } = reportProviderError("ollama.unreachable", err, {
        baseUrl: cfg.baseUrl
      });
      checks.push({
        id: "reachability",
        label: "دسترسی به سرویس Ollama",
        status: "FAIL",
        detail: message,
        hint,
        latencyMs: Date.now() - t0
      });
      return checks;
    }

    // ۲) احراز هویت — Ollama کلید نمی‌خواهد
    checks.push({
      id: "auth",
      label: "احراز هویت",
      status: "PASS",
      detail: "Ollama محلی کلید API نمی‌خواهد."
    });

    // ۳) مدل نصب‌شده
    let models: string[] = [];
    const t1 = Date.now();
    try {
      models = await this.listModels(cfg);
      const installed = models.filter((m) => m.length > 0);
      checks.push({
        id: "models",
        label: "مدل‌های نصب‌شده",
        status: "PASS",
        detail: `${installed.length} مدل نصب است: ${installed.slice(0, 6).join("، ") || "—"}`,
        latencyMs: Date.now() - t1,
        data: { models: installed }
      });
    } catch (err) {
      checks.push({
        id: "models",
        label: "مدل‌های نصب‌شده",
        status: "FAIL",
        detail: err instanceof Error ? err.message : "خواندن فهرست مدل‌ها ناموفق بود.",
        hint: `با دستور «${cfg.model ? `ollama pull ${cfg.model}` : "ollama list"}» وضعیت مدل‌ها را ببینید.`,
        latencyMs: Date.now() - t1
      });
      return checks;
    }

    // ۴) مدل انتخابی
    const match = models.find((m) => sameModelName(m, cfg.model));
    checks.push({
      id: "model",
      label: "مدل انتخاب‌شده",
      status: match ? "PASS" : "FAIL",
      detail: match
        ? `مدل «${match}» نصب است.`
        : `مدل «${cfg.model}» روی این سیستم نصب نیست.`,
      hint: match
        ? undefined
        : models.length
          ? `یکی از مدل‌های نصب‌شده را انتخاب کنید: ${models.slice(0, 6).join("، ")}`
          : `هیچ مدلی نصب نیست. اجرا کنید: ollama pull ${cfg.model}`,
      data: { models, configured: cfg.model }
    });

    if (!match) return checks;

    // ۵) تولید واقعی متن با API بومی
    const t2 = Date.now();
    try {
      const started = Date.now();
      const res = await fetchWithTimeout(joinUrl(cfg.baseUrl, "/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: "system", content: "فقط یک کلمهٔ فارسی جواب بده." },
            { role: "user", content: "سلام" }
          ],
          stream: false,
          options: { temperature: 0, num_predict: 16 }
        }),
        timeoutMs: Math.max(PROBE_TIMEOUT_MS, 60_000)
      });
      if (!res.ok) {
        const body = await readBody(res);
        throw new Error(`HTTP ${res.status} — ${body || httpErrorHint(res.status)}`);
      }
      const data = await readJson<{
        model?: string;
        message?: { content?: string };
      }>(res);
      const text = (data.message?.content ?? "").trim();
      checks.push({
        id: "generation",
        label: "تولید متن واقعی (Ollama)",
        status: text ? "PASS" : "FAIL",
        detail: text
          ? `مدل «${data.model ?? cfg.model}» در ${Date.now() - started} میلی‌ثانیه پاسخ داد: «${text.slice(0, 60)}»`
          : "پاسخ خالی بود.",
        latencyMs: Date.now() - t2
      });
    } catch (err) {
      const { message, hint } = reportProviderError("ollama.generation_failed", err, {
        model: cfg.model,
        baseUrl: cfg.baseUrl
      });
      checks.push({
        id: "generation",
        label: "تولید متن واقعی (Ollama)",
        status: "FAIL",
        detail: message,
        hint,
        latencyMs: Date.now() - t2
      });
    }

    return checks;
  },

  async complete(cfg, messages, o = {}): Promise<CompletionResult> {
    const started = Date.now();
    const res = await fetchWithTimeout(joinUrl(cfg.baseUrl, "/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        stream: false,
        options: {
          temperature: o.temperature ?? 0.7,
          num_predict: o.maxTokens ?? 1024
        }
      }),
      timeoutMs: o.timeoutMs ?? 120_000
    });
    if (!res.ok) {
      const body = await readBody(res);
      throw new Error(
        `Ollama خطای ${res.status} داد: ${body || httpErrorHint(res.status)}`
      );
    }
    const data = await readJson<{
      model?: string;
      message?: { content?: string };
      response?: string;
    }>(res);
    return {
      text: data.message?.content ?? data.response ?? "",
      model: data.model ?? cfg.model,
      latencyMs: Date.now() - started
    };
  },

  async *stream(cfg, messages, o = {}) {
    const res = await fetchWithTimeout(joinUrl(cfg.baseUrl, "/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        stream: true,
        options: {
          temperature: o.temperature ?? 0.7,
          num_predict: o.maxTokens ?? 1024
        }
      }),
      timeoutMs: o.timeoutMs ?? 120_000
    });
    if (!res.ok) {
      const body = await readBody(res);
      throw new Error(
        `Ollama خطای ${res.status} داد: ${body || httpErrorHint(res.status)}`
      );
    }
    if (!res.body) throw new Error("بدنهٔ پاسخ Ollama خالی است.");
    // استریم Ollama بومی = NDJSON؛ هر خط یک شیء با message.content
    yield* readSseText(res.body, {
      extract: (json) => {
        const j = json as {
          message?: { content?: string };
          response?: string;
          error?: string;
        };
        if (j.error) throw new Error(`Ollama: ${j.error}`);
        return j.message?.content ?? j.response ?? undefined;
      }
    });
  }
};

/** مقایسهٔ نام مدل: «llama3» با «llama3:latest» برابر است */
export function sameModelName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/:latest$/, "");
  return norm(a) === norm(b);
}/**
 * آداپتور عمومی OpenAI-Compatible
 *
 * برای: OpenAI، Groq، xAI، LM Studio، 9Router و هر سرویس سفارشی دیگر.
 * قرارداد: POST {baseUrl}/chat/completions با هدر Authorization: Bearer <key>
 */
import {
  fetchWithTimeout,
  httpErrorHint,
  joinUrl,
  normalizeBase,
  readBody,
  readJson,
  readSseText,
  reportProviderError,
  PROBE_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS
} from "@/lib/providers/http";
import type {
  ProviderAdapter,
  ProviderCheck,
  ProviderInput,
  ProviderMessage,
  ResolvedProviderConfig
} from "@/lib/providers/types";
import type { ProviderId } from "@/lib/types";

/** ماسک کردن کلید (برای نمایش در نتیجهٔ تست — هرگز کل کلید نشت نمی‌کند) */
function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "....";
  return `...${key.slice(-4)}`;
}

export interface OpenAICompatibleOptions {
  id: ProviderId;
  label: string;
  requiresApiKey: boolean;
  defaultBaseUrl: string;
  defaultModel: string;
  envBaseUrl?: string;
  envApiKey?: string;
  help: string;
  /** هدرهای اضافهٔ ثابت یا پویا */
  extraHeaders?: (cfg: ResolvedProviderConfig) => Record<string, string>;
  /** جایگزینی فهرست مدل‌ها (مثلاً OpenRouter که فیلتر «رایگان» دارد) */
  listModels?: (cfg: ResolvedProviderConfig) => Promise<string[]>;
  /** جایگزینی جزئیات مدل‌ها (قیمت/طول زمینه) */
  describeModels?: (cfg: ResolvedProviderConfig) => Promise<unknown[]>;
  /** بررسی اضافه‌ای بعد از احراز هویت (مثلاً اعتبار کریدت در OpenRouter) */
  extraChecks?: (
    cfg: ResolvedProviderConfig
  ) => Promise<ProviderCheck | null>;
}

function envStr(name: string | undefined): string {
  if (!name) return "";
  return (process.env[name] ?? "").trim();
}

/** بدنهٔ استاندارد درخواست chat/completions */
function chatBody(
  messages: ProviderMessage[],
  model: string,
  opts: { maxTokens?: number; temperature?: number; stream: boolean }
) {
  return JSON.stringify({
    model,
    messages,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    stream: opts.stream,
    ...(opts.stream ? { stream_options: { include_usage: false } } : {})
  });
}

/** نرمال‌سازی شناسهٔ مدل برای مقایسه (حساس به :latest و پیشوندها نیست) */
export function sameModel(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/:latest$/, "");
  return norm(a) === norm(b);
}

export function createOpenAICompatibleAdapter(
  opts: OpenAICompatibleOptions
): ProviderAdapter {
  const adapter: ProviderAdapter = {
    id: opts.id,
    label: opts.label,
    requiresApiKey: opts.requiresApiKey,
    defaultBaseUrl: opts.defaultBaseUrl,
    defaultModel: opts.defaultModel,
    envBaseUrl: opts.envBaseUrl,
    envApiKey: opts.envApiKey,
    help: opts.help,

    resolve(input: ProviderInput): ResolvedProviderConfig {
      const fromSettings = (input.baseUrl ?? "").trim();
      const fromEnv = envStr(opts.envBaseUrl);
      const baseUrl = fromSettings || fromEnv || opts.defaultBaseUrl;

      const modelSettings = (input.model ?? "").trim();
      const modelEnvName_ = modelEnvName(opts.id);
      const modelEnv = envStr(modelEnvName_);
      const model = modelSettings || modelEnv || opts.defaultModel;

      const keySettings = (input.apiKey ?? "").trim();
      const keyEnv = envStr(opts.envApiKey);
      const apiKey = keySettings || keyEnv;

      const cfg: ResolvedProviderConfig = {
        provider: opts.id,
        baseUrl: normalizeBase(baseUrl),
        model,
        apiKey,
        headers: {},
        sources: {
          baseUrl: fromSettings ? "settings" : fromEnv ? "env" : "default",
          model: modelSettings ? "settings" : modelEnv ? "env" : "default",
          apiKey: keySettings ? "settings" : keyEnv ? "env" : "none"
        }
      };
      cfg.headers = opts.extraHeaders?.(cfg) ?? {};
      return cfg;
    },

    async listModels(cfg) {
      if (opts.listModels) return opts.listModels(cfg);
      const res = await fetchWithTimeout(joinUrl(cfg.baseUrl, "/models"), {
        headers: authHeaders(cfg),
        timeoutMs: PROBE_TIMEOUT_MS
      });
      if (!res.ok) {
        throw new Error(
          `فهرست مدل‌ها خطای ${res.status} داد — ${httpErrorHint(res.status)}`
        );
      }
      const data = await readJson<{ data?: Array<{ id?: string }> }>(res);
      return (data.data ?? [])
        .map((m) => m.id ?? "")
        .filter(Boolean)
        .sort();
    },

    ...(opts.describeModels
      ? {
          describeModels: (cfg: ResolvedProviderConfig) =>
            opts.describeModels!(cfg)
        }
      : {}),

    async check(cfg) {
      const checks: ProviderCheck[] = [];

      // ۱) دسترسی‌پذیری
      const t0 = Date.now();
      try {
        const res = await fetchWithTimeout(joinUrl(cfg.baseUrl, "/models"), {
          headers: authHeaders(cfg),
          timeoutMs: PROBE_TIMEOUT_MS
        });
        const latencyMs = Date.now() - t0;
        if (res.status === 401 || res.status === 403) {
          const body = await readBody(res);
          checks.push({
            id: "reachability",
            label: "دسترسی به سرویس",
            status: "PASS",
            detail: `سرویس پاسخ داد (HTTP ${res.status}) — اما احراز هویت رد شد.`,
            latencyMs
          });
          checks.push({
            id: "auth",
            label: "احراز هویت",
            status: "FAIL",
            detail: `HTTP ${res.status} — ${body || "کلید نامعتبر است."}`,
            hint: opts.requiresApiKey
              ? `کلید API را در تنظیمات وارد کنید یا متغیر محیطی ${opts.envApiKey ?? "مناسب"} را ست کنید.`
              : "سرویس کلید نمی‌خواهد؛ مقدار کلید را خالی بگذارید.",
            latencyMs
          });
          return checks;
        }
        if (!res.ok) {
          const body = await readBody(res);
          checks.push({
            id: "reachability",
            label: "دسترسی به سرویس",
            status: "FAIL",
            detail: `HTTP ${res.status} — ${body || httpErrorHint(res.status)}`,
            hint: httpErrorHint(res.status),
            latencyMs
          });
          return checks;
        }
        checks.push({
          id: "reachability",
          label: "دسترسی به سرویس",
          status: "PASS",
          detail: `سرویس در دسترس است (${cfg.baseUrl}).`,
          latencyMs
        });
      } catch (err) {
        const { message, hint } = reportProviderError("provider.unreachable", err, {
          provider: opts.id,
          baseUrl: cfg.baseUrl
        });
        checks.push({
          id: "reachability",
          label: "دسترسی به سرویس",
          status: "FAIL",
          detail: message,
          hint,
          latencyMs: Date.now() - t0
        });
        return checks;
      }

      // ۲) احراز هویت (در صورت نیاز)
      if (opts.requiresApiKey && !cfg.apiKey) {
        checks.push({
          id: "auth",
          label: "احراز هویت",
          status: "FAIL",
          detail: "کلید API وارد نشده است.",
          hint: `کلید را در صفحهٔ تنظیمات وارد کنید یا ${opts.envApiKey ?? "متغیر محیطی"} را ست کنید.`
        });
      }

      // ۳) بررسی‌های اختصاصی ارائه‌دهنده (مثلاً کریدت OpenRouter)
      if (opts.extraChecks) {
        const extra = await opts.extraChecks(cfg);
        if (extra) checks.push(extra);
      }

      // ۴) وجود مدل
      let models: string[] = [];
      try {
        models = await adapter.listModels(cfg);
        if (models.length > 0) {
          const found = models.some((m) => sameModel(m, cfg.model));
          checks.push({
            id: "model",
            label: "مدل انتخاب‌شده",
            status: found ? "PASS" : "FAIL",
            detail: found
              ? `مدل «${cfg.model}» در فهرست ارائه‌دهنده موجود است.`
              : `مدل «${cfg.model}» در فهرست ارائه‌دهنده نیست.`,
            hint: found ? undefined : `یکی از این مدل‌ها را انتخاب کنید: ${models.slice(0, 8).join("، ")}`,
            data: { available: models.slice(0, 200), total: models.length }
          });
        }
      } catch (err) {
        checks.push({
          id: "model",
          label: "مدل انتخاب‌شده",
          status: "NOT_TESTED",
          detail: err instanceof Error ? err.message : "فهرست مدل‌ها خوانده نشد.",
          hint: "مدل به‌صورت مستقیم تست می‌شود؛ نتیجهٔ تست تولید متن را ببینید."
        });
      }

      // ۵) تولید واقعی متن
      checks.push(await generationCheck(cfg, opts.id));
      return checks;
    },

    async complete(cfg, messages, o = {}) {
      const started = Date.now();
      const res = await fetchWithTimeout(joinUrl(cfg.baseUrl, "/chat/completions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(cfg) },
        body: chatBody(messages, cfg.model, { ...o, stream: false }),
        timeoutMs: o.timeoutMs ?? DEFAULT_TIMEOUT_MS
      });
      if (!res.ok) {
        const body = await readBody(res);
        const err = new Error(
          `ارائه‌دهنده خطای ${res.status} داد: ${body || httpErrorHint(res.status)}`
        );
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      const data = await readJson<{
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
      }>(res);
      return {
        text: data.choices?.[0]?.message?.content ?? "",
        model: data.model ?? cfg.model,
        latencyMs: Date.now() - started
      };
    },

    async *stream(cfg, messages, o = {}) {
      const res = await fetchWithTimeout(joinUrl(cfg.baseUrl, "/chat/completions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(cfg) },
        body: chatBody(messages, cfg.model, { ...o, stream: true }),
        timeoutMs: o.timeoutMs ?? DEFAULT_TIMEOUT_MS
      });
      if (!res.ok) {
        const body = await readBody(res);
        const err = new Error(
          `ارائه‌دهنده خطای ${res.status} داد: ${body || httpErrorHint(res.status)}`
        );
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      if (!res.body) throw new Error("بدنهٔ پاسخ ارائه‌دهنده خالی است.");
      yield* readSseText(res.body);
    }
  };

  return adapter;

  function authHeaders(cfg: ResolvedProviderConfig): Record<string, string> {
    const headers: Record<string, string> = { ...cfg.headers };
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    return headers;
  }

  /** تست واقعی تولید متن (کوچک ولی واقعی) */
  async function generationCheck(
    cfg: ResolvedProviderConfig,
    provider: ProviderId
  ): Promise<ProviderCheck> {
    const started = Date.now();
    try {
      const out = await adapter.complete(
        cfg,
        [
          { role: "system", content: "فقط یک کلمه فارسی جواب بده." },
          { role: "user", content: "سلام" }
        ],
        { maxTokens: 16, temperature: 0, timeoutMs: PROBE_TIMEOUT_MS }
      );
      const ok = typeof out.text === "string" && out.text.trim().length > 0;
      return {
        id: "generation",
        label: "تولید متن واقعی",
        status: ok ? "PASS" : "FAIL",
        detail: ok
          ? `مدل «${out.model}» در ${out.latencyMs} میلی‌ثانیه پاسخ داد: «${out.text.trim().slice(0, 60)}»`
          : "پاسخ خالی بود.",
        hint: ok ? undefined : "مدل پاسخ خالی برگرداند.",
        latencyMs: Date.now() - started,
        data: { model: out.model, keyMasked: maskApiKey(cfg.apiKey), provider }
      };
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      const { message, hint } = reportProviderError("provider.generation_failed", err, {
        provider,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        status
      });
      return {
        id: "generation",
        label: "تولید متن واقعی",
        status: "FAIL",
        detail: message,
        hint: status ? `${httpErrorHint(status)} ${hint}` : hint,
        latencyMs: Date.now() - started
      };
    }
  }
}

/** نام متغیر محیطی مدل پیش‌فرض هر ارائه‌دهنده */
export function modelEnvName(id: ProviderId): string | undefined {
  switch (id) {
    case "ollama":
      return "OLLAMA_MODEL";
    case "openrouter":
      return "OPENROUTER_MODEL";
    case "openai":
      return "OPENAI_MODEL";
    case "groq":
      return "GROQ_MODEL";
    case "xai":
      return "XAI_MODEL";
    case "9router":
      return "NINE_ROUTTER_MODEL";
    default:
      return undefined;
  }
}/**
 * آداپتور OpenRouter — بر اساس مستندات رسمی
 *   https://openrouter.ai/docs/api-reference/overview
 *
 * نکات استفاده‌شده از مستندات رسمی:
 *  - Base URL: https://openrouter.ai/api/v1
 *  - احراز هویت: Authorization: Bearer <OPENROUTER_API_KEY>
 *  - هدرهای اختیاری معرفی برنامه: HTTP-Referer و X-OpenRouter-Title
 *  - سقف/کریدت: GET /api/v1/key  →  limit_remaining و free_model_daily_requests
 *  - خطاها: 401 کلید نامعتبر، 402 کریdit ناکافی، 403 بودجه، 429 محدودیت نرخ
 *  - مدل‌های رایگان با پسوند «:free» مشخص می‌شوند
 */
import {
  fetchWithTimeout,
  httpErrorHint,
  joinUrl,
  readBody,
  readJson,
  reportProviderError,
  PROBE_TIMEOUT_MS
} from "@/lib/providers/http";
import type { ProviderCheck, ResolvedProviderConfig } from "@/lib/providers/types";
import { createOpenAICompatibleAdapter } from "@/lib/providers/openaiCompatible";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function envStr(name: string): string {
  return (process.env[name] ?? "").trim();
}

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { modality?: string };
}

/** فقط وقتی خواسته شود، مدل‌های رایگان (:free) برگردانده می‌شود */
function freeOnly(): boolean {
  const v = (process.env.OPENROUTER_FREE_ONLY ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export const openrouterAdapter = createOpenAICompatibleAdapter({
  id: "openrouter",
  label: "OpenRouter",
  requiresApiKey: true,
  defaultBaseUrl: OPENROUTER_BASE_URL,
  defaultModel: "openai/gpt-4o-mini",
  envBaseUrl: "OPENROUTER_BASE_URL",
  envApiKey: "OPENROUTER_API_KEY",
  help:
    "کلید را از https://openrouter.ai/keys بگیرید و در تنظیمات وارد کنید (یا متغیر محیطی OPENROUTER_API_KEY را ست کنید). مدل رایگان فقط اگر شناسه‌اش با «:free» تمام شود و واقعاً در فهرست مدل‌ها موجود باشد.",
  extraHeaders: () => {
    const headers: Record<string, string> = {
      "X-OpenRouter-Title": envStr("OPENROUTER_APP_NAME") || "Peak"
    };
    const referer = envStr("OPENROUTER_SITE_URL");
    if (referer) headers["HTTP-Referer"] = referer;
    return headers;
  },

  async listModels(cfg) {
    const res = await fetchWithTimeout(joinUrl(cfg.baseUrl, "/models"), {
      headers: authHeaders(cfg),
      timeoutMs: PROBE_TIMEOUT_MS
    });
    if (!res.ok) {
      const body = await readBody(res);
      const hint =
        res.status === 401
          ? "کلید API نامعتبر است یا ارسال نشده."
          : httpErrorHint(res.status);
      throw new Error(`فهرست مدل‌های OpenRouter خطای ${res.status} داد — ${hint}${body ? ` (${body})` : ""}`);
    }
    const data = await readJson<{ data?: OpenRouterModel[] }>(res);
    const all = (data.data ?? [])
      .map((m) => m.id)
      .filter(Boolean)
      .sort();
    return freeOnly() ? all.filter((id) => id.endsWith(":free")) : all;
  },

  async describeModels(cfg) {
    const res = await fetchWithTimeout(joinUrl(cfg.baseUrl, "/models"), {
      headers: authHeaders(cfg),
      timeoutMs: PROBE_TIMEOUT_MS
    });
    if (!res.ok) {
      const body = await readBody(res);
      throw new Error(`فهرست مدل‌های OpenRouter خطای ${res.status} داد — ${body}`);
    }
    const data = await readJson<{ data?: OpenRouterModel[] }>(res);
    return (data.data ?? []).map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      contextLength: m.context_length,
      promptPricePerToken: m.pricing?.prompt,
      isFree: m.id.endsWith(":free")
    }));
  },

  /** بررسی اعتبار/کریdit کلید طبق مستند رسمی GET /api/v1/key */
  async extraChecks(cfg: ResolvedProviderConfig): Promise<ProviderCheck | null> {
    if (!cfg.apiKey) return null;
    const t0 = Date.now();
    try {
      const res = await fetchWithTimeout(joinUrl(cfg.baseUrl, "/key"), {
        headers: authHeaders(cfg),
        timeoutMs: PROBE_TIMEOUT_MS
      });
      const latencyMs = Date.now() - t0;
      if (!res.ok) {
        const body = await readBody(res);
        if (res.status === 401 || res.status === 403) {
          return {
            id: "auth",
            label: "احراز هویت (کلید)",
            status: "FAIL",
            detail: `کلید نامعتبر است (HTTP ${res.status}).`,
            hint: "کلید را در https://openrouter.ai/keys بررسی/بازسازی کنید.",
            latencyMs
          };
        }
        return {
          id: "auth",
          label: "احراز هویت (کلید)",
          status: "NOT_TESTED",
          detail: `بررسی کلید ممکن نشد (HTTP ${res.status}) — ${body || httpErrorHint(res.status)}`,
          hint: "تست تولید متن در ادامه نتیجهٔ واقعی را نشان می‌دهد.",
          latencyMs
        };
      }
      const data = await readJson<{
        data?: {
          label?: string;
          limit_remaining?: number | null;
          usage?: number;
          is_free_tier?: boolean;
          free_model_daily_requests?: { remaining?: number; limit?: number };
        };
      }>(res);
      const d = data.data ?? {};
      const remaining = d.limit_remaining;
      const freeLeft = d.free_model_daily_requests?.remaining;
      const noCredits = typeof remaining === "number" && remaining <= 0;
      return {
        id: "auth",
        label: "احراز هویت و کریدت (کلید)",
        status: noCredits ? "FAIL" : "PASS",
        detail: [
          d.label ? `کلید «${d.label}» معتبر است.` : "کلید معتبر است.",
          typeof remaining === "number"
            ? `کریdit باقی‌مانده: ${remaining.toFixed(4)}$`
            : null,
          typeof freeLeft === "number"
            ? `درخواست رایگان باقی‌ماندهٔ امروز: ${freeLeft}`
            : null
        ]
          .filter(Boolean)
          .join(" — "),
        hint: noCredits
          ? "کریdit کافی نیست (خطای 402 محتمل است) — از https://openrouter.ai/settings/credits شارژ کنید یا مدل :free را انتخاب کنید."
          : undefined,
        latencyMs
      };
    } catch (err) {
      const { message, hint } = reportProviderError("openrouter.key_check_failed", err, {
        baseUrl: cfg.baseUrl
      });
      return {
        id: "auth",
        label: "احراز هویت و کریدت (کلید)",
        status: "NOT_TESTED",
        detail: message,
        hint,
        latencyMs: Date.now() - t0
      };
    }
  }
});

function authHeaders(cfg: ResolvedProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "X-OpenRouter-Title": envStr("OPENROUTER_APP_NAME") || "Peak",
    ...cfg.headers
  };
  const referer = envStr("OPENROUTER_SITE_URL");
  if (referer) headers["HTTP-Referer"] = referer;
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  return headers;
}/**
 * آداپتور سرویس داخلی رایگان (Pollinations)
 *
 * این سرویس بدون کلید کار می‌کند و پشتیبان پیش‌فرض برنامه است.
 * اگر در دسترس نبود (اینترنت قطع، سرویس خوابیده، …) باید خطای گویا بدهد تا
 * برنامه به مغز آفلاین سقوط کند — نه اینکه وانمود کند جواب داده است.
 */
import {
  fetchWithTimeout,
  httpErrorHint,
  normalizeBase,
  readBody,
  readSseText,
  reportProviderError,
  PROBE_TIMEOUT_MS
} from "@/lib/providers/http";
import type {
  CompletionResult,
  ProviderAdapter,
  ProviderCheck,
  ProviderMessage,
} from "@/lib/providers/types";

export const BUILT_IN_API_URL = "https://text.pollinations.ai/";

/** مدل‌های رایگان این سرویس — از فهرست داخلی برنامه می‌آیند */
const BACKEND_MODELS: Record<string, string> = {
  assistant: "openai-fast",
  coder: "openai-fast",
  creative: "openai-fast",
  teacher: "openai-fast",
  minecraft: "openai-fast"
};

export const pollinationsAdapter: ProviderAdapter = {
  id: "builtin",
  label: "سرویس داخلی رایگان (بدون کلید)",
  requiresApiKey: false,
  defaultBaseUrl: BUILT_IN_API_URL,
  defaultModel: "assistant",
  help:
    "پیش‌فرض برنامه: سرویس رایگان آنلاین بدون کلید API. اگر اینترنت قطع باشد یا سرویس در دسترس نباشد، Peak خودکار به مغز آفلاین (ساعت، تاریخ، حافظه، ماینکرفت) سقوط می‌کند.",

  resolve(input) {
    const fromSettings = (input.baseUrl ?? "").trim();
    const baseUrl = fromSettings || process.env.BUILTIN_API_URL?.trim() || BUILT_IN_API_URL;
    const model = (input.model ?? "").trim() || "assistant";
    return {
      provider: "builtin",
      baseUrl: normalizeBase(baseUrl),
      model,
      apiKey: "",
      headers: {},
      sources: {
        baseUrl: fromSettings ? "settings" : process.env.BUILTIN_API_URL ? "env" : "default",
        model: (input.model ?? "").trim() ? "settings" : "default",
        apiKey: "none"
      }
    };
  },

  /** این سرویس فهرست مدل رسمی نمی‌دهد — مدل‌های داخلی برنامه را برمی‌گردانیم */
  async listModels() {
    return Object.keys(BACKEND_MODELS);
  },

  async check(cfg) {
    const checks: ProviderCheck[] = [];
    const started = Date.now();
    try {
      const out = await pollinationsAdapter.complete(
        cfg,
        [{ role: "user", content: "سلام" }],
        { maxTokens: 16, timeoutMs: PROBE_TIMEOUT_MS }
      );
      const ok = out.text.trim().length > 0;
      checks.push({
        id: "reachability",
        label: "دسترسی به سرویس داخلی",
        status: ok ? "PASS" : "FAIL",
        detail: ok
          ? `سرویس در ${out.latencyMs} میلی‌ثانیه پاسخ داد: «${out.text.trim().slice(0, 50)}»`
          : "پاسخ خالی بود.",
        hint: ok ? undefined : "دوباره تلاش کنید.",
        latencyMs: Date.now() - started
      });
    } catch (err) {
      const { message, hint } = reportProviderError("builtin.unreachable", err, {
        baseUrl: cfg.baseUrl
      });
      checks.push({
        id: "reachability",
        label: "دسترسی به سرویس داخلی",
        status: "FAIL",
        detail: message,
        hint,
        latencyMs: Date.now() - started
      });
    }
    return checks;
  },

  async complete(cfg, messages: ProviderMessage[], o = {}): Promise<CompletionResult> {
    const started = Date.now();
    const backendModel = BACKEND_MODELS[cfg.model] ?? cfg.model;
    const res = await fetchWithTimeout(cfg.baseUrl + "/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: backendModel,
        messages,
        temperature: o.temperature ?? 0.7,
        max_tokens: o.maxTokens ?? 1024,
        stream: false,
        private: true
      }),
      timeoutMs: o.timeoutMs ?? PROBE_TIMEOUT_MS
    });
    if (!res.ok) {
      const body = await readBody(res);
      throw new Error(
        `سرویس داخلی خطای ${res.status} داد — ${body || httpErrorHint(res.status)}`
      );
    }
    const raw = await res.text();
    const text = raw.trim().startsWith("{") ? extractJsonText(raw) : raw.trim();
    if (!text) throw new Error("سرویس داخلی پاسخی برنگرداند.");
    return { text, model: backendModel, latencyMs: Date.now() - started };
  },

  async *stream(cfg, messages: ProviderMessage[], o = {}) {
    const backendModel = BACKEND_MODELS[cfg.model] ?? cfg.model;
    const res = await fetchWithTimeout(cfg.baseUrl + "/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: backendModel,
        messages,
        temperature: o.temperature ?? 0.7,
        max_tokens: o.maxTokens ?? 1024,
        stream: true,
        private: true
      }),
      timeoutMs: o.timeoutMs ?? 120_000
    });
    if (!res.ok) {
      const body = await readBody(res);
      throw new Error(
        `سرویس داخلی خطای ${res.status} داد — ${body || httpErrorHint(res.status)}`
      );
    }
    if (!res.body) throw new Error("بدنهٔ پاسخ خالی است.");
    yield* readSseText(res.body);
  }
};

/** استخراج متن از پاسخ JSON این سرویس */
function extractJsonText(raw: string): string {
  try {
    const json = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
      response?: string;
      content?: string;
    };
    const text =
      json.choices?.[0]?.message?.content ?? json.response ?? json.content ?? "";
    if (text.trim()) return text.trim();
  } catch {
    /* متن ساده */
  }
  const trimmed = raw.trim();
  return trimmed && trimmed !== "{}" ? trimmed : "";
}

/** نگاشت شناسهٔ مدل داخلی به مدل بومی سرویس (برای سازگاری با کد قبلی) */
export function backendModelFor(id: string): string {
  return BACKEND_MODELS[id] ?? id;
}/**
 * قرارداد لایهٔ ارائه‌دهنده‌ها (Provider Layer)
 *
 * هر ارائه‌دهنده یک آداپتور است با سه توانایی اصلی:
 *   resolve()  → تبدیل تنظیمات کاربر + متغیرهای محیطی به یک پیکربندی قطعی
 *   listModels()→ فهرست مدل‌های واقعاً موجود (نه حدسی)
 *   check()    → تست واقعی: دسترسی‌پذیری + احراز هویت + وجود مدل + یک تولید کوتاه
 *
 * قرارداد صادقانه: اگر تستی انجام نشده، status باید NOT_TESTED باشد — نه PASS.
 */
import type { ProviderId } from "@/lib/types";

export type CheckStatus = "PASS" | "FAIL" | "NOT_TESTED" | "SKIPPED";

export interface ProviderCheck {
  /** شناسهٔ ماشین‌خوان مرحله (مثلاً reachability / auth / model / generation) */
  id: string;
  /** عنوان فارسی برای نمایش */
  label: string;
  status: CheckStatus;
  detail: string;
  /** راه‌حل عملی برای کاربر */
  hint?: string;
  /** دادهٔ کمکی (مثلاً فهرست مدل‌های نصب‌شده) */
  data?: Record<string, unknown>;
  /** مدت زمان تست به میلی‌ثانیه */
  latencyMs?: number;
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** پیکربندی نهایی و قطعی ارائه‌دهنده (بدون راز در خروجی لاگ) */
export interface ResolvedProviderConfig {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  /** هدرهای اضافهٔ لازم (مثلاً HTTP-Referer در OpenRouter) */
  headers: Record<string, string>;
  /** منبع هر مقدار: settings | env | default */
  sources: {
    baseUrl: "settings" | "env" | "default";
    model: "settings" | "env" | "default";
    apiKey: "settings" | "env" | "none";
  };
}

export interface CompletionResult {
  text: string;
  model: string;
  latencyMs: number;
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  /** آیا برای کار کردن کلید لازم است */
  requiresApiKey: boolean;
  defaultBaseUrl: string;
  defaultModel: string;
  /** نام متغیرهای محیطی پشتیبان */
  envBaseUrl?: string;
  envApiKey?: string;
  /** راهنمای کوتاه نمایش در صفحهٔ تنظیمات */
  help: string;

  /** تبدیل تنظیمات کاربر + env به پیکربندی قطعی */
  resolve(input: ProviderInput): ResolvedProviderConfig;
  /** فهرست مدل‌های واقعاً موجود — در صورت عدم دسترسی باید خطا بدهد نه لیست ساختگی */
  listModels(cfg: ResolvedProviderConfig): Promise<string[]>;
  /** جزئیات غنی مدل‌ها (اختیاری — مثلاً خانواده/پارامتر/قیمت) */
  describeModels?(cfg: ResolvedProviderConfig): Promise<unknown[]>;
  /** تست کامل: دسترسی‌پذیری، احراز هویت، مدل، تولید واقعی */
  check(cfg: ResolvedProviderConfig): Promise<ProviderCheck[]>;
  /** یک تولید متنی کوچک و واقعی (برای تست و تشخیص) */
  complete(
    cfg: ResolvedProviderConfig,
    messages: ProviderMessage[],
    opts?: { maxTokens?: number; temperature?: number; timeoutMs?: number }
  ): Promise<CompletionResult>;
  /** استریم پاسخ (پیش‌فرض از complete ساخته می‌شود) */
  stream(
    cfg: ResolvedProviderConfig,
    messages: ProviderMessage[],
    opts?: { maxTokens?: number; temperature?: number; timeoutMs?: number }
  ): AsyncGenerator<string>;
}

export interface ProviderInput {
  provider: ProviderId;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  /** تنظیمات کامل برنامه برای خواندن مقادیر پیش‌فرض جایگزین */
  defaults?: { baseUrl?: string; model?: string };
}

export const OK_LABEL = "✅";
export const FAIL_LABEL = "❌";
export const NOT_TESTED_LABEL = "➖";