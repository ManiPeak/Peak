/**
 * API کلید اضطراری — توقف فوری همه‌چیز
 * همیشه مجاز است؛ دسترسی‌ها نمی‌توانند آن را مسدود کنند (قانون ایمنی).
 */
import { NextRequest, NextResponse } from "next/server";
import { botManager } from "@/minecraft/botManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let scope: "all" | "bot" | "voice" = "all";
  try {
    const body = await req.json();
    if (body.scope === "bot" || body.scope === "voice" || body.scope === "all") {
      scope = body.scope;
    }
  } catch {
    /* پیش‌فرض: all */
  }

  const stopped: string[] = ["voice"];

  if (scope !== "voice") {
    try {
      // توقف حالت‌ها، حرکت، کلنگ‌زنی و کلیدهای ربات
      botManager.emergencyStop();
      stopped.push("bot-modes", "bot-movement");
    } catch {
      /* نادیده */
    }
    try {
      // قطع کامل اتصال
      botManager.disconnect();
      stopped.push("bot-connection");
    } catch {
      /* نادیده */
    }
  }

  return NextResponse.json({ ok: true, stopped });
}
