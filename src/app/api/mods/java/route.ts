/**
 * API مودهای جاوا (.jar) — GET فهرست / POST آپلود+نصب+تنظیم / PATCH روشن‌خاموش / DELETE حذف
 */
import { NextRequest, NextResponse } from "next/server";
import {
  deleteJavaMod,
  getJavaConfig,
  installJavaMods,
  listJavaMods,
  saveJavaMod,
  setJavaConfig,
  toggleJavaMod
} from "@/lib/javaMods";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ mods: listJavaMods(), config: getJavaConfig() });
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    // آپلود فایل .jar
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "فایلی ارسال نشد." }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const saved = saveJavaMod(file.name, buf);
    if (!saved) {
      return NextResponse.json(
        { error: "فایل نامعتبر است — فقط فایل .jar سالم (حداکثر ۲۰۰ مگابایت)." },
        { status: 400 }
      );
    }
    return NextResponse.json({ mod: saved, mods: listJavaMods() });
  }

  // JSON: نصب در پوشهٔ بازی یا ذخیرهٔ مسیر
  let body: { action?: string; gameModsPath?: string; target?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنهٔ نامعتبر." }, { status: 400 });
  }

  if (body.action === "config") {
    const cfg = setJavaConfig(body.gameModsPath ?? "");
    return NextResponse.json({ config: cfg });
  }
  if (body.action === "install") {
    const r = installJavaMods(body.target);
    return NextResponse.json({
      copied: r.copied,
      failed: r.failed,
      target: r.target,
      ok: r.copied.length > 0 && r.target.length > 0
    });
  }
  return NextResponse.json({ error: "action ناشناخته." }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  let body: { name?: string; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنهٔ نامعتبر." }, { status: 400 });
  }
  if (!body.name || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "name/enabled لازم است." }, { status: 400 });
  }
  const ok = toggleJavaMod(body.name, body.enabled);
  if (!ok) return NextResponse.json({ error: "مود پیدا نشد." }, { status: 404 });
  return NextResponse.json({ mods: listJavaMods() });
}

export async function DELETE(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const ok = deleteJavaMod(name);
  if (!ok) return NextResponse.json({ error: "مود پیدا نشد." }, { status: 404 });
  return NextResponse.json({ mods: listJavaMods() });
}
