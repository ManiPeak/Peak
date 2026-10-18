/**
 * API فهرست مدل‌ها — مدل‌های داخلی + مدل‌های واقعی ارائه‌دهندهٔ انتخاب‌شده
 *
 * GET /api/settings/models?provider=ollama|openrouter|builtin|…
 * برای Ollama از /api/tags بومی می‌خواند (فهرست واقعی مدل‌های نصب‌شده)
 * و اگر سرویس در دسترس نباشد، reachable:false برمی‌گرداند (نه لیست ساختگی).
 */
import { NextRequest, NextResponse } from "next/server";
import { BUILT_IN_MODELS } from "@/lib/ai-core";
import { getAdapter, isProviderId, resolveConfig } from "@/lib/providers";
import { getSettings, maskApiKey } from "@/lib/store";
import { describeError, logger } from "@/lib/logger";
import type { ProviderId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** فهرست پیشنهادی وقتی سرویس در دسترس نیست (فقط پیشنهاد، نه ادعا) */
const SUGGESTED: Partial<Record<ProviderId, string[]>> = {
  openrouter: [
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash-exp:free",
    "deepseek/deepseek-chat",
    "meta-llama/llama-3.3-70b-instruct"
  ],
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  xai: ["grok-2-mini", "grok-2"],
  ollama: ["llama3.2:3b", "qwen2.5:7b", "gemma2:2b", "phi3:mini"],
  lmstudio: ["local-model"],
  "9router": []
};

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("provider") ?? "builtin";
  if (!isProviderId(raw)) {
    return NextResponse.json(
      { models: [], reachable: false, error: "شناسهٔ ارائه‌دهنده معتبر نیست." },
      { status: 400 }
    );
  }
  const provider = raw;
  const settings = getSettings();

  if (provider === "builtin") {
    return NextResponse.json({
      models: BUILT_IN_MODELS.map((m) => ({
        id: m.id,
        label: m.label,
        description: m.description,
        builtin: true
      })),
      reachable: true
    });
  }

  const apiKeyParam = req.nextUrl.searchParams.get("apiKey");
  const apiKey =
    apiKeyParam && apiKeyParam !== maskApiKey(settings.apiKey)
      ? apiKeyParam
      : settings.apiKey;
  const baseUrlParam = req.nextUrl.searchParams.get("baseUrl");

  const cfg = resolveConfig({
    provider,
    baseUrl: baseUrlParam ?? settings.baseUrl,
    model: settings.model,
    apiKey
  });
  const adapter = getAdapter(provider);

  try {
    const models = await adapter.listModels(cfg);
    const free = provider === "openrouter" ? models.filter((m) => m.endsWith(":free")) : [];
    return NextResponse.json({
      models: models.map((id) => ({
        id,
        label: id,
        description: id.endsWith(":free") ? "مدل رایگان OpenRouter" : "",
        builtin: false,
        free: id.endsWith(":free")
      })),
      reachable: models.length > 0,
      // فقط وقتی سرویس واقعاً در دسترس نبود پیشنهاد می‌دهیم
      suggested: models.length === 0 ? (SUGGESTED[provider] ?? []) : undefined,
      configuredModel: cfg.model,
      configuredModelExists: models.some((m) => m.toLowerCase() === cfg.model.toLowerCase()),
      freeCount: provider === "openrouter" ? free.length : undefined,
      source: cfg.sources
    });
  } catch (err) {
    const d = describeError(err);
    logger.warn("models.list_failed", { provider, baseUrl: cfg.baseUrl, error: d.message });
    return NextResponse.json({
      models: [],
      reachable: false,
      error: d.message,
      hint: adapter.help,
      suggested: SUGGESTED[provider] ?? [],
      configuredModel: cfg.model
    });
  }
}