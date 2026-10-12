/**
 * API اجرای دستور ماینکرفت — دستورهای زبان طبیعی فارسی
 * با اجرای گیت دسترسی‌ها (کنترل/محافظت/حملهٔ خودکار)
 */
import { NextRequest, NextResponse } from "next/server";
import { botManager } from "@/minecraft/botManager";
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
  const result = await botManager.runCommand(text, (perm) =>
    hasPermission(
      settings,
      perm === "control"
        ? "minecraftControl"
        : perm === "guard"
          ? "minecraftGuard"
          : "minecraftAutoAttack"
    )
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
