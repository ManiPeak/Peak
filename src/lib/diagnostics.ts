/**
 * موتور تشخیص (Diagnostics) — یک منبع واحد برای:
 *   • مسیر /api/diagnostics
 *   • دستور خط فرمان «npm run diagnose»
 *
 * اصل طلایی: هر چیزی که واقعاً تست نشده «NOT_TESTED» است، نه PASS.
 */
import { getAdapter, configLooksComplete, resolveConfig } from "@/lib/providers";
import type { ProviderCheck, ResolvedProviderConfig } from "@/lib/providers/types";
import { getSettings, listConversations, listServers } from "@/lib/store";
import { DB_PATH, rawDb } from "@/db";
import { botManager } from "@/minecraft/botManager";
import type { ProviderId } from "@/lib/types";
import { describeError } from "@/lib/logger";

export interface DiagnosticsReport {
  ok: boolean;
  generatedAt: string;
  /** نسخهٔ برنامه و محیط */
  runtime: {
    appVersion: string;
    node: string;
    platform: string;
    uptimeSec: number;
    dbPath: string;
  };
  /** تنظیمات مؤثر ارائه‌دهنده (بدون کلید — فقط ماسک‌شده) */
  provider: {
    id: ProviderId;
    label: string;
    baseUrl: string;
    model: string;
    apiKeyMasked: string;
    sources: ResolvedProviderConfig["sources"];
    requiresApiKey: boolean;
    help: string;
  };
  checks: ProviderCheck[];
  summary: {
    pass: number;
    fail: number;
    notTested: number;
    skipped: number;
  };
}

const APP_VERSION = "1.1.0";

function mask(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "••••";
  return `••••${key.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/* بررسی‌های پایه                                                       */
/* ------------------------------------------------------------------ */

/** سلامت خودِ بک‌اند (بدون نیاز به اینترنت) */
export function backendChecks(): ProviderCheck[] {
  const checks: ProviderCheck[] = [];
  const started = Date.now();

  // دیتابیس
  try {
    const row = rawDb
      .prepare("SELECT COUNT(*) AS n FROM conversations")
      .get() as { n: number } | undefined;
    checks.push({
      id: "database",
      label: "دیتابیس محلی (SQLite)",
      status: "PASS",
      detail: `متصل است — ${row?.n ?? 0} گفتگو، ${listConversations().length} ردیف فهرست. مسیر: ${DB_PATH}`,
      latencyMs: Date.now() - started
    });
  } catch (err) {
    checks.push({
      id: "database",
      label: "دیتابیس محلی (SQLite)",
      status: "FAIL",
      detail: describeError(err).message,
      hint: "پوشهٔ data باید قابل نوشتن باشد (دایرکتوری برنامه یا پوشهٔ کاربر)."
    });
  }

  // ماینکرفت
  try {
    const snap = botManager.getSnapshot();
    checks.push({
      id: "minecraft",
      label: "ربات ماینکرفت",
      status: snap.connected ? "PASS" : "NOT_TESTED",
      detail: snap.connected
        ? `ربات «${snap.username}» وصل است.`
        : "ربات وصل نیست (اتصال فقط با اجرای سرور واقعی تست می‌شود).",
      hint: snap.connected ? undefined : "از صفحهٔ ماینکرفت به سرور وصل شوید.",
      data: { servers: listServers().length }
    });
  } catch (err) {
    checks.push({
      id: "minecraft",
      label: "ربات ماینکرفت",
      status: "NOT_TESTED",
      detail: `وضعیت قابل خواندن نبود: ${describeError(err).message}`
    });
  }

  return checks;
}

/**
 * گزارش کامل تشخیص.
 * @param override پیکربندی موقت برای تست بدون ذخیره‌کردن در تنظیمات
 */
export async function runDiagnostics(override?: {
  provider?: ProviderId;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}): Promise<DiagnosticsReport> {
  const saved = getSettings();
  const settings = override
    ? {
        ...saved,
        ...(override.provider ? { provider: override.provider } : {}),
        ...(override.baseUrl !== undefined ? { baseUrl: override.baseUrl } : {}),
        ...(override.model !== undefined ? { model: override.model } : {}),
        ...(override.apiKey !== undefined ? { apiKey: override.apiKey } : {})
      }
    : saved;

  const cfg = resolveConfig(settings);
  const adapter = getAdapter(cfg.provider);
  const checks: ProviderCheck[] = [];

  // ۱) پیکربندی (بررسی محلی و بدون شبکه)
  const local = configLooksComplete(cfg);
  checks.push({
    id: "config",
    label: "پیکربندی ارائه‌دهنده",
    status: local.ok ? "PASS" : "FAIL",
    detail: local.ok
      ? `${adapter.label} — مدل «${cfg.model}» روی ${cfg.baseUrl}`
      : local.problems.join(" — "),
    hint: local.ok ? undefined : adapter.help,
    data: { sources: cfg.sources }
  });

  // ۲) تست‌های خود ارائه‌دهنده (دسترسی، احراز هویت، مدل، تولید واقعی)
  if (local.ok) {
    try {
      const providerChecks = await adapter.check(cfg);
      checks.push(...providerChecks);
    } catch (err) {
      checks.push({
        id: "provider",
        label: "تست ارائه‌دهنده",
        status: "FAIL",
        detail: describeError(err).message
      });
    }
  } else {
    checks.push({
      id: "provider",
      label: "تست ارائه‌دهنده",
      status: "SKIPPED",
      detail: "به‌خاطر ناقص بودن پیکربندی، تست شبکه انجام نشد.",
      hint: adapter.help
    });
  }

  // ۳) بررسی‌های خود برنامه
  checks.push(...backendChecks());

  const summary = {
    pass: checks.filter((c) => c.status === "PASS").length,
    fail: checks.filter((c) => c.status === "FAIL").length,
    notTested: checks.filter((c) => c.status === "NOT_TESTED").length,
    skipped: checks.filter((c) => c.status === "SKIPPED").length
  };

  return {
    ok: summary.fail === 0,
    generatedAt: new Date().toISOString(),
    runtime: {
      appVersion: APP_VERSION,
      node: process.version,
      platform: process.platform,
      uptimeSec: Math.round(process.uptime()),
      dbPath: DB_PATH
    },
    provider: {
      id: cfg.provider,
      label: adapter.label,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      apiKeyMasked: mask(cfg.apiKey),
      sources: cfg.sources,
      requiresApiKey: adapter.requiresApiKey,
      help: adapter.help
    },
    checks,
    summary
  };
}

/** رنگ/برچسب هر وضعیت برای خروجی خط فرمان */
export const STATUS_LABEL: Record<ProviderCheck["status"], string> = {
  PASS: "PASS",
  FAIL: "FAIL",
  NOT_TESTED: "NOT TESTED",
  SKIPPED: "SKIPPED"
};