/**
 * لایهٔ سازگاری LLM
 *
 * ⚠️ این فایل فقط یک لایهٔ نازک روی «رجیستری ارائه‌دهنده‌ها» است تا
 * کدهای قدیمی (chat route، aiProbe، chatBridge، مسیرهای API) بشکند نشوند.
 * منطق واقعی هر ارائه‌دهنده در src/lib/providers/* قرار دارد.
 */
import type { AppSettings, ConnectionTestResult, ProviderId } from "@/lib/types";
import type { ProviderMessage, ResolvedProviderConfig } from "@/lib/providers";
import {
  backendModelFor,
  completeOnce,
  configLooksComplete,
  getAdapter,
  listProviderModels,
  pollinationsAdapter,
  resolveConfig,
  streamCompletion
} from "@/lib/providers";
import { BUILT_IN_API_URL } from "@/lib/providers";
import { logger, redact } from "@/lib/logger";

export type ChatMessage = ProviderMessage;

/** آدرس سرویس رایگان داخلی (بدون کلید) */
export { BUILT_IN_API_URL };

/** ساخت پیکربندی قطعی ارائه‌دهنده از تنظیمات برنامه */
export function providerConfig(
  settings: Pick<AppSettings, "provider" | "baseUrl" | "model" | "apiKey">
): ResolvedProviderConfig {
  return resolveConfig(settings);
}

/* ------------------------------------------------------------------ */
/* مدل‌های داخلی رایگان (بدون کلید)                                    */
/* ------------------------------------------------------------------ */

/** استریم از سرویس رایگان داخلی (Pollinations) — بدون کلید */
export function streamBuiltInCompletion(opts: {
  backendModel: string;
  messages: ChatMessage[];
  temperature?: number;
}): AsyncGenerator<string> {
  const cfg: ResolvedProviderConfig = {
    provider: "builtin",
    baseUrl: BUILT_IN_API_URL.replace(/\/+$/, ""),
    model: opts.backendModel,
    apiKey: "",
    headers: {},
    sources: { baseUrl: "default", model: "settings", apiKey: "none" }
  };
  return pollinationsAdapter.stream(cfg, opts.messages, {
    temperature: opts.temperature
  });
}

/** پاسخ ساده با GET — روش پشتیبان مدل‌های داخلی */
export async function builtInSimpleReply(
  prompt: string,
  _model: string
): Promise<string> {
  const url = `${BUILT_IN_API_URL}${encodeURIComponent(prompt)}`;
  const res = await fetch(url, { headers: { Accept: "text/plain" } });
  if (!res.ok) throw new Error(`سرویس رایگان خطای ${res.status} داد.`);
  const text = (await res.text()).trim();
  if (!text || text === "{}") throw new Error("سرویس رایگان پاسخی نداد.");
  return text;
}

/* ------------------------------------------------------------------ */
/* استریم عمومی                                                        */
/* ------------------------------------------------------------------ */

/**
 * استریم پاسخ مدل از ارائه‌دهندهٔ تنظیم‌شده (Ollama / OpenRouter / …)
 * در صورت خطا exception پرتاب می‌شود تا لایهٔ بالا تصمیم بگیرد
 * (سقوط به مغز آفلاین یا نمایش خطای گویا).
 */
export function streamChatCompletion(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  provider?: ProviderId;
}): AsyncGenerator<string> {
  const provider = opts.provider ?? "custom";
  const cfg = getAdapter(provider).resolve({
    provider,
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    model: opts.model
  });
  return streamCompletion(cfg, opts.messages, {
    temperature: opts.temperature,
    maxTokens: opts.maxTokens
  });
}

/* ------------------------------------------------------------------ */
/* تست اتصال                                                          */
/* ------------------------------------------------------------------ */

/**
 * تست اتصال زنده — یک تولید متن کوچک و واقعی انجام می‌دهد.
 * هرگز خطا را پنهان نمی‌کند: پیام خطای دقیق و قابل‌فهم برمی‌گرداند.
 */
export async function testConnection(
  settings: Pick<AppSettings, "baseUrl" | "apiKey" | "model" | "provider">
): Promise<ConnectionTestResult> {
  const cfg = resolveConfig(settings);

  // بررسی محلی پیکربندی قبل از هر درخواست شبکه
  const local = configLooksComplete(cfg);
  if (!local.ok) {
    return { ok: false, message: `پیکربندی ناقص: ${local.problems.join(" — ")}` };
  }

  try {
    const result = await completeOnce(
      cfg,
      [{ role: "user", content: "سلام" }],
      { maxTokens: 24, temperature: 0 }
    );
    if (!result.text.trim()) {
      return { ok: false, message: "ارائه‌دهنده پاسخ داد ولی متن خالی بود." };
    }
    return {
      ok: true,
      message: `اتصال موفق بود ✅ مدل «${result.model}» در ${result.latencyMs} میلی‌ثانیه پاسخ داد.`,
      model: result.model
    };
  } catch (err) {
    logger.warn("llm.test_failed", {
      provider: cfg.provider,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      error: err instanceof Error ? err.message : String(err)
    });
    const status = (err as { status?: number }).status;
    return {
      ok: false,
      message: `اتصال برقرار نشد: ${redact(err instanceof Error ? err.message : String(err))}${
        status ? ` (HTTP ${status})` : ""
      }`
    };
  }
}

/* ------------------------------------------------------------------ */
/* فهرست مدل‌ها                                                        */
/* ------------------------------------------------------------------ */

/** لیست مدل‌های یک ارائه‌دهنده (Ollama / OpenRouter / LM Studio / …) */
export async function listRemoteModels(
  baseUrl: string,
  apiKey = "",
  provider: ProviderId = "custom"
): Promise<string[]> {
  try {
    const cfg = getAdapter(provider).resolve({ provider, baseUrl, apiKey });
    return await listProviderModels(cfg);
  } catch {
    // برای سازگاری با کد قدیمی که فقط baseUrl می‌داد، یک تلاش دیگر با تشخیص خودکار
    return legacyListRemoteModels(baseUrl, apiKey);
  }
}

/** تشخیص خودکار نوع سرویس از روی آدرس و سپس تلاش دوباره */
async function legacyListRemoteModels(
  baseUrl: string,
  apiKey: string
): Promise<string[]> {
  const guess: ProviderId = /11434|ollama/i.test(baseUrl)
    ? "ollama"
    : /1234|lmstudio/i.test(baseUrl)
      ? "lmstudio"
      : "custom";
  try {
    const cfg = getAdapter(guess).resolve({ provider: guess, baseUrl, apiKey });
    return await listProviderModels(cfg);
  } catch {
    return [];
  }
}

/** نگاشت شناسهٔ مدل داخلی برنامه به مدل سرویس پشتیبان */
export { backendModelFor };