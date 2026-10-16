/**
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
}