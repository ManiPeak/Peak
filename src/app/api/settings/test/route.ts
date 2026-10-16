/**
 * POST /api/settings/test — تست زندهٔ ارائه‌دهنده با تنظیمات فعلی یا موقت
 *
 * تفاوت با نسخهٔ قبلی: این مسیر دیگر فقط «پاسخ گرفتن» را چک نمی‌کند؛
 * کل زنجیره را می‌سنجد (دسترسی‌پذیری، احراز هویت، وجود مدل، تولید واقعی متن)
 * و اگر تست نشده باشد صریحاً NOT_TESTED برمی‌گرداند.
 */
import { NextRequest, NextResponse } from "next/server";
import { runDiagnostics } from "@/lib/diagnostics";
import { getSettings, maskApiKey } from "@/lib/store";
import { isProviderId } from "@/lib/providers";
import type { ProviderId } from "@/lib/types";
import { describeError, logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: {
    provider?: ProviderId;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    deep?: boolean;
  } = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === "object") {
      body = parsed as typeof body;
    }
  } catch {
    /* از تنظیمات فعلی استفاده کن */
  }

  if (body.provider !== undefined && !isProviderId(body.provider)) {
    return NextResponse.json(
      { ok: false, message: "شناسهٔ ارائه‌دهنده معتبر نیست." },
      { status: 400 }
    );
  }

  const current = getSettings();
  // اگر کاربر کلید را تغییر نداده، همان کلید ذخیره‌شده استفاده می‌شود
  const apiKey =
    body.apiKey !== undefined && body.apiKey !== maskApiKey(current.apiKey)
      ? body.apiKey
      : undefined;

  const override = {
    provider: body.provider ?? current.provider,
    baseUrl: body.baseUrl?.trim() || current.baseUrl,
    model: body.model?.trim() || current.model,
    apiKey
  };

  try {
    const report = await runDiagnostics(override);
    const providerChecks = report.checks.filter((c) =>
      ["config", "reachability", "auth", "model", "models", "generation"].includes(c.id)
    );
    const failed = providerChecks.find((c) => c.status === "FAIL");
    const passed = providerChecks.find((c) => c.id === "generation" && c.status === "PASS");
    const notTested = providerChecks.filter((c) => c.status === "NOT_TESTED").length;

    logger.info("settings.test", {
      provider: report.provider.id,
      ok: report.ok,
      fail: failed?.id
    });

    return NextResponse.json(
      {
        ok: report.ok,
        message: passed
          ? passed.detail
          : failed
            ? `${failed.label}: ${failed.detail}`
            : notTested
              ? "تست کامل انجام نشد — جزئیات را در checks ببینید."
              : "نتیجهٔ مشخصی به دست نیامد.",
        hint: failed?.hint,
        model: report.provider.model,
        provider: report.provider.id,
        checks: providerChecks,
        // سازگاری با UI قدیمی
        detail: report.provider
      },
      { status: 200 }
    );
  } catch (err) {
    const d = describeError(err);
    logger.error("settings.test_failed", d);
    return NextResponse.json(
      {
        ok: false,
        message: `تست انجام نشد: ${d.message}`,
        checks: []
      },
      { status: 502 }
    );
  }
}