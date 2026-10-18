/**
 * API اجرای دستور ماینکرفت — دستورهای زبان طبیعی فارسی
 * با اجرای گیت دسترسی‌ها (کنترل/محافظت/حملهٔ خودکار)
 *
 * دو مسیر اجرا (به ترتیب):
 *   ۱. دستورهای حرکتی parseCommand (مثل «بیا دنبالم»)
 *   ۲. موتور توانایی‌ها با مچ سریع فارسی/انگلیسی (مثل «مهروموم خدایی روی X»)
 */
import { NextRequest, NextResponse } from "next/server";
import { botManager } from "@/minecraft/botManager";
import { buildContext, tryFastAction } from "@/minecraft/actions";
import { getSettings } from "@/lib/store";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/minecraft/command — { text: "بیا دنبالم" } */
export async function POST(req: NextRequest) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر است." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "متن دستور خالی است." }, { status: 400 });
  }

  const settings = getSettings();
  const gate = (perm: "control" | "guard" | "autoAttack") =>
    hasPermission(
      settings,
      perm === "control"
        ? "minecraftControl"
        : perm === "guard"
          ? "minecraftGuard"
          : "minecraftAutoAttack"
    );

  /* مسیر ۱: دستورهای حرکتی */
  const result = await botManager.runCommand(text, gate);
  if (result.command !== "none") {
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  /* مسیر ۲: توانایی‌ها (۴۴۵ کار — مثل مهروموم خدایی/نبرد خدایی) از همان موتور اکشن */
  const fast = await tryFastAction(
    text,
    buildContext(settings.mcProtectTarget ?? settings.userName, settings.mcIsOp)
  );
  if (fast) {
    return NextResponse.json(
      { ok: fast.ok, reply: fast.reply, command: "fast" },
      { status: fast.ok ? 200 : 400 }
    );
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
