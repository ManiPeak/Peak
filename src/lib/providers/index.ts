/**
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
} from "@/lib/providers/http";