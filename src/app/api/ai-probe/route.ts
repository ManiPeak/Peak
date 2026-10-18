/**
 * API تست و تشخیص هوش مصنوعی — «از کدوم هوش مصنوعی است؟»
 */
import { NextRequest, NextResponse } from "next/server";
import { AI_CATALOG } from "@/lib/ai-core";
import { probeEndpoint, type AiProbeResult } from "@/lib/ai-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type { AiProbeResult };

/** POST /api/ai-probe — بدنه: { url, apiKey?, model? } — بدون url = فهرست کاتالوگ */
export async function POST(req: NextRequest) {
  let body: { url?: string; apiKey?: string; model?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* بدنهٔ خالی */
  }

  const url = (body.url ?? "").trim();
  if (!url) {
    return NextResponse.json({ ok: true, catalog: AI_CATALOG });
  }

  const result = await probeEndpoint(url, body.apiKey ?? "", body.model ?? "");
  return NextResponse.json(result);
}
