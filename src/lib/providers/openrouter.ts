/**
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
}