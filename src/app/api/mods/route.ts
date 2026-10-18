/**
 * API مودها — فهرست، نصب/به‌روزرسانی، حذف و روشن/خاموش
 */
import { NextRequest, NextResponse } from "next/server";
import {
  deleteMod,
  loadMods,
  saveMod,
  toggleMod,
  validateMod,
  type ModDefinition
} from "@/lib/mods";

export const runtime = "nodejs";

/** GET /api/mods — فهرست مودهای نصب‌شده */
export async function GET() {
  return NextResponse.json({ mods: loadMods() });
}

/** POST /api/mods — نصب یا به‌روزرسانی مود (بدنه: JSON مود) */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["بدنهٔ درخواست JSON معتبر نیست."] }, { status: 400 });
  }
  const v = validateMod(raw);
  if (!v.ok || !v.mod) {
    return NextResponse.json({ ok: false, errors: v.errors }, { status: 400 });
  }
  saveMod(v.mod as ModDefinition);
  return NextResponse.json({ ok: true, mod: v.mod });
}

/** DELETE /api/mods?id=xxx — حذف مود */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const done = deleteMod(id);
  return NextResponse.json(
    done ? { ok: true } : { ok: false, errors: ["چنین مودی پیدا نشد."] },
    { status: done ? 200 : 404 }
  );
}

/** PATCH /api/mods — روشن/خاموش { id, enabled } */
export async function PATCH(req: NextRequest) {
  let body: { id?: string; enabled?: boolean };
  try {
    body = (await req.json()) as { id?: string; enabled?: boolean };
  } catch {
    return NextResponse.json({ ok: false, errors: ["بدنهٔ درخواست JSON معتبر نیست."] }, { status: 400 });
  }
  const done = toggleMod(String(body.id ?? ""), Boolean(body.enabled));
  return NextResponse.json(
    done ? { ok: true } : { ok: false, errors: ["چنین مودی پیدا نشد."] },
    { status: done ? 200 : 404 }
  );
}
