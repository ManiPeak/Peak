/**
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
}