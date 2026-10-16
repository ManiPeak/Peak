/**
 * API تنظیمات — دریافت و ذخیره (کلید API همیشه ماسک برمی‌گردد)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getPublicSettings,
  getSettings,
  maskApiKey,
  saveSettings
} from "@/lib/store";
import { hasPermission, mergePermissions } from "@/lib/permissions";
import type { AppSettings, ProviderId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PROVIDERS: ProviderId[] = [
  "builtin",
  "openai",
  "openrouter",
  "groq",
  "xai",
  "ollama",
  "lmstudio",
  "9router",
  "custom"
];

/** GET /api/settings — تنظیمات با کلید ماسک‌شده */
export async function GET() {
  return NextResponse.json({ settings: getPublicSettings() });
}

/** PUT /api/settings — ذخیرهٔ تنظیمات (ادغام جزئی) */
export async function PUT(req: NextRequest) {
  let body: Partial<AppSettings> & { apiKeyMasked?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر است." }, { status: 400 });
  }

  const current = getSettings();

  // دسترسی‌ها همیشه قابل تغییرند (قانون ایمنی)؛ بقیهٔ تنظیمات به settingsWrite نیاز دارند
  const onlyPermissions =
    body.permissions !== undefined &&
    Object.keys(body).every((k) => k === "permissions" || k === "apiKeyMasked");
  if (!onlyPermissions && !hasPermission(current, "settingsWrite")) {
    return NextResponse.json(
      { error: "🔒 دسترسی «تغییر تنظیمات» بسته است." },
      { status: 403 }
    );
  }

  const patch: Partial<AppSettings> = {};

  if (body.permissions && typeof body.permissions === "object") {
    patch.permissions = mergePermissions({
      ...current.permissions,
      ...body.permissions
    });
  }

  // اعتبارسنجی آدرس پایه — قبل از هر ذخیره‌سازی
  if (body.baseUrl !== undefined) {
    const trimmed = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      return NextResponse.json(
        { error: "آدرس پایه باید با http:// یا https:// شروع شود." },
        { status: 400 }
      );
    }
  }

  // فیلدهای رشته‌ای ساده
  for (const key of [
    "baseUrl",
    "model",
    "assistantName",
    "ttsVoiceURI",
    "microphoneId",
    "mcLastHost",
    "mcLastUsername",
    "mcProtectTarget"
  ] as const) {
    if (body[key] !== undefined) {
      patch[key] = (body[key] ?? null) as never;
    }
  }

  // ارائه‌دهنده: مقدار ناشناخته نباید بی‌صدا نادیده گرفته شود
  if (body.provider !== undefined) {
    if (typeof body.provider !== "string" || !VALID_PROVIDERS.includes(body.provider as ProviderId)) {
      return NextResponse.json(
        {
          error: `ارائه‌دهندهٔ «${String(body.provider)}» شناخته نشد.`,
          valid: VALID_PROVIDERS
        },
        { status: 400 }
      );
    }
    patch.provider = body.provider as ProviderId;
  }
  if (body.tone && ["friendly", "formal", "playful"].includes(body.tone)) {
    patch.tone = body.tone;
  }
  if (body.verbosity && ["concise", "balanced", "detailed"].includes(body.verbosity)) {
    patch.verbosity = body.verbosity;
  }
  if (typeof body.autoMemory === "boolean") {
    patch.autoMemory = body.autoMemory;
  }
  if (typeof body.autoSpeak === "boolean") {
    patch.autoSpeak = body.autoSpeak;
  }
  if (typeof body.ttsRate === "number" && body.ttsRate >= 0.5 && body.ttsRate <= 2) {
    patch.ttsRate = body.ttsRate;
  }
  if (typeof body.ttsVolume === "number" && body.ttsVolume >= 0 && body.ttsVolume <= 1) {
    patch.ttsVolume = body.ttsVolume;
  }
  if (typeof body.mcLastPort === "number" && body.mcLastPort > 0) {
    patch.mcLastPort = body.mcLastPort;
  }
  if (typeof body.mcGuardRadius === "number" && body.mcGuardRadius >= 4 && body.mcGuardRadius <= 64) {
    patch.mcGuardRadius = body.mcGuardRadius;
  }
  // شعاع اسکن: تا ۱۰۰ برابر پیش‌فرض (۱۰۰۰ → ۱۰۰۰۰۰)
  if (typeof body.mcScanRadius === "number" && body.mcScanRadius >= 100 && body.mcScanRadius <= 100000) {
    patch.mcScanRadius = Math.round(body.mcScanRadius);
  }
  // رم اختصاصی برنامه (مگابایت)
  if (typeof body.appRamMB === "number" && body.appRamMB >= 256 && body.appRamMB <= 8192) {
    patch.appRamMB = Math.round(body.appRamMB);
  }
  // سطح بازی: مبتدی / عادی / حرفه‌ای / خدا
  if (
    body.mcPlayLevel &&
    ["beginner", "normal", "pro", "god"].includes(body.mcPlayLevel)
  ) {
    patch.mcPlayLevel = body.mcPlayLevel;
  }
  if (typeof body.mcIsOp === "boolean") {
    patch.mcIsOp = body.mcIsOp;
  }
  if (body.mcPersonality && ["angry", "kind", "normal"].includes(body.mcPersonality)) {
    patch.mcPersonality = body.mcPersonality;
  }
  if (Array.isArray(body.mcFriends)) {
    patch.mcFriends = body.mcFriends
      .filter((f: unknown): f is string => typeof f === "string")
      .map((f: string) => f.trim())
      .filter((f: string) => f.length > 0 && f.length <= 16)
      .slice(0, 32);
  }
  if (typeof body.mcChatBridge === "boolean") {
    patch.mcChatBridge = body.mcChatBridge;
  }
  if (typeof body.userName === "string" && body.userName.trim().length <= 40) {
    patch.userName = body.userName.trim() || "ManiPeak";
  }

  // کلید API: اگر مقدار ماسک‌شده برگردونده شده باشه، همون قبلی حفظ می‌شه
  if (typeof body.apiKey === "string") {
    const incoming = body.apiKey.trim();
    if (incoming === "" || incoming === maskApiKey(current.apiKey)) {
      // بدون تغییر
    } else {
      patch.apiKey = incoming;
    }
  }

  const next = saveSettings(patch);

  // نوشتن کانفیگ برنامه — اپ Electron هنگام ری‌استارت سقف رم را از اینجا می‌خواند
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cfgDir = process.env.DASTIAR_DB_PATH
      ? path.dirname(process.env.DASTIAR_DB_PATH)
      : path.join(process.cwd(), "data");
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeFileSync(
      path.join(cfgDir, "peak-config.json"),
      JSON.stringify({
        appRamMB: next.appRamMB,
        mcScanRadius: next.mcScanRadius,
        mcPlayLevel: next.mcPlayLevel
      }),
      "utf8"
    );
  } catch {
    /* نادیده */
  }

  return NextResponse.json({ settings: getPublicSettings() });
}
