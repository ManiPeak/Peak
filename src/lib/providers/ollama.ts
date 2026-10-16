/**
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
}