/**
 * API خروجی حافظه — دانلود فایل JSON
 */
import { NextResponse } from "next/server";
import { getSettings, listMemories } from "@/lib/store";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/memories/export — خروجی JSON از همهٔ حافظه‌ها */
export async function GET() {
  if (!hasPermission(getSettings(), "exportData")) {
    return NextResponse.json(
      { error: "🔒 دسترسی «خروجی گرفتن از داده‌ها» بسته است." },
      { status: 403 }
    );
  }
  const memories = listMemories("all");
  const payload = {
    app: "peak",
    exportedAt: new Date().toISOString(),
    count: memories.length,
    memories
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="peak-memories-${new Date().toISOString().slice(0, 10)}.json"`
    }
  });
}
