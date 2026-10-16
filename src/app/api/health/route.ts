/**
 * GET /api/health — بررسی سریع سلامت بک‌اند (بدون نیاز به اینترنت)
 * مناسب برای: اسکریپت راه‌اندازی، ابزارهای مانیتورینگ، تست‌های خودکار
 */
import { NextResponse } from "next/server";
import { backendChecks } from "@/lib/diagnostics";
import { getSettings } from "@/lib/store";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const checks = backendChecks();
    const dbOk = checks.find((c) => c.id === "database")?.status === "PASS";
    const settings = getSettings();
    logger.debug("health.checked", { dbOk, ms: Date.now() - started });
    return NextResponse.json({
      ok: dbOk,
      uptimeSec: Math.round(process.uptime()),
      provider: settings.provider,
      checks,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    // حتی وقتی همه‌چیز خراب است، باید پاسخ ساخت‌یافته بدهیم نه صفحهٔ سفید 500
    logger.error("health.failed", {
      error: err instanceof Error ? err.message : String(err)
    });
    return NextResponse.json(
      {
        ok: false,
        error: "بررسی سلامت بک‌اند با خطا مواجه شد.",
        checks: [],
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}