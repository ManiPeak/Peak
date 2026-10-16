/**
 * /api/diagnostics — گزارش ساخت‌یافتهٔ وضعیت کل سیستم
 *
 * GET  /api/diagnostics                      → تست تنظیمات ذخیره‌شده
 * POST /api/diagnostics {provider,baseUrl,model,apiKey} → تست پیکربندی موقت
 *                                          (بدون ذخیره‌سازی — کلید فقط در حافظه)
 *
 * پاسخ شامل وضعیت هر مرحله با PASS / FAIL / NOT_TESTED / SKIPPED است.
 */
import { NextRequest, NextResponse } from "next/server";
import { runDiagnostics } from "@/lib/diagnostics";
import { isProviderId } from "@/lib/providers";
import { describeError, logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** سقف زمان کل تشخیص (تا کلاینت معلق نماند) */
const MAX_DURATION_MS = 90_000;

async function handle(req: NextRequest): Promise<NextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAX_DURATION_MS);
  try {
    let override: Parameters<typeof runDiagnostics>[0];
    if (req.method === "POST") {
      let body: Record<string, unknown> = {};
      try {
        const parsed: unknown = await req.json();
        if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
      } catch {
        /* بدنهٔ نامعتبر = تست تنظیمات ذخیره‌شده */
      }
      if (body.provider !== undefined && !isProviderId(body.provider)) {
        return NextResponse.json(
          { ok: false, error: "شناسهٔ ارائه‌دهنده معتبر نیست." },
          { status: 400 }
        );
      }
      override = {
        provider: isProviderId(body.provider) ? body.provider : undefined,
        baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
        model: typeof body.model === "string" ? body.model : undefined,
        apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined
      };
    }

    const report = await runDiagnostics(override);
    return NextResponse.json(report, { status: report.ok ? 200 : 200 });
  } catch (err) {
    const d = describeError(err);
    logger.error("diagnostics.failed", d);
    return NextResponse.json(
      {
        ok: false,
        error: "اجرای تشخیص با خطا مواجه شد.",
        detail: d.message,
        checks: []
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}