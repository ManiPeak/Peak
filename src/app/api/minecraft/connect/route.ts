/**
 * API اتصال ماینکرفت — اتصال به سرور (offline / microsoft)
 */
import { NextRequest, NextResponse } from "next/server";
import { botManager } from "@/minecraft/botManager";
import {
  createServer,
  findServerByHost,
  getSettings,
  saveSettings,
  updateServerStatus
} from "@/lib/store";
import { hasPermission } from "@/lib/permissions";
import { describeError, logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/minecraft/connect */
export async function POST(req: NextRequest) {
  let body: {
    host?: string;
    port?: number;
    version?: string;
    auth?: string;
    authMode?: string;
    username?: string;
    protectTarget?: string | null;
    save?: boolean;
    name?: string;
    serverId?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر است." }, { status: 400 });
  }

  // گیت دسترسی: اتصال به ماینکرفت
  if (!hasPermission(getSettings(), "minecraftConnect")) {
    return NextResponse.json(
      { error: "🔒 دسترسی «اتصال به ماینکرفت» بسته است." },
      { status: 403 }
    );
  }

  const host = (body.host ?? "").trim();
  const username = (body.username ?? "").trim();
  if (!host || !username) {
    return NextResponse.json(
      { error: "آدرس سرور و نام ربات الزامی است." },
      { status: 400 }
    );
  }

  const port = Number(body.port) || 25565;
  const version = (body.version ?? "auto").trim() || "auto";
  const auth = body.auth === "microsoft" ? "microsoft" : "offline";
  const authMode: "none" | "login" | "register" =
    body.authMode === "login" || body.authMode === "register"
      ? body.authMode
      : "none";

  // ذخیرهٔ آخرین اتصال در تنظیمات
  saveSettings({
    mcLastHost: host,
    mcLastPort: port,
    mcLastUsername: username,
    mcProtectTarget: body.protectTarget ?? null
  });

  // ذخیرهٔ سرور در لیست سرورها (درخواست صریح یا اگر قبلاً ثبت شده)
  const existing = findServerByHost(host, port);
  let serverId = body.serverId ?? existing?.id ?? null;
  if (body.save && !existing) {
    const created = createServer({
      name: body.name?.trim() || host,
      host,
      port,
      version,
      auth,
      authMode,
      username
    });
    serverId = created.id;
  }

  // اگر سرور قبلاً ثبت شده و authMode ذخیره دارد، از همان استفاده کن
  const finalAuthMode = body.authMode
    ? authMode
    : existing?.authMode ?? authMode;

  // اتصال ماینکرفت می‌تواند استثنا بدهد (سرور خاموش، نسخهٔ ناسازگار، …)
  // نباید هیچ‌وقت به صفحهٔ سفید HTTP 500 برسیم.
  let result: Awaited<ReturnType<typeof botManager.connect>>;
  try {
    result = await botManager.connect({
      host,
      port,
      version,
      auth,
      username,
      protectTarget: body.protectTarget ?? getSettings().mcProtectTarget,
      authMode: finalAuthMode,
      serverId
    });
  } catch (err) {
    const d = describeError(err);
    logger.error("minecraft.connect_failed", {
      host,
      port,
      version,
      error: d.message
    });
    if (serverId != null) updateServerStatus(serverId, "error");
    return NextResponse.json(
      {
        ok: false,
        reply: `اتصال به سرور ناموفق بود: ${d.message}`,
        error: d.message,
        hint: "آدرس/پورت، نسخهٔ ماینکرفت سرور و در دسترس بودن سرور را بررسی کنید."
      },
      { status: 502 }
    );
  }

  if (serverId != null) {
    updateServerStatus(serverId, result.ok ? "connected" : "error");
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
