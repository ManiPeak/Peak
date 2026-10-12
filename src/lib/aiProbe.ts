/**
 * منطق تست API هوش مصنوعی + تشخیص نام آن — قابل استفاده از route و چت
 */
import { identifyAi, matchCatalogByUrl } from "@/lib/aiCatalog";

export interface AiProbeResult {
  ok: boolean;
  aiName: string;
  model: string;
  latencyMs: number;
  message: string;
  needsKey: boolean;
}

/** ساخت درخواست مناسب هر نوع سرویس (OpenAI/Gemini/Anthropic/Pollinations) */
export function buildProbeRequest(url: string, apiKey: string, model: string) {
  const u = url.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  if (u.includes("generativelanguage.googleapis.com")) {
    const base = u.replace(/\/$/, "");
    return {
      url: `${base}/models/${model || "gemini-2.5-flash"}:generateContent`,
      headers: apiKey
        ? { "Content-Type": "application/json", "x-goog-api-key": apiKey }
        : headers,
      body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] })
    };
  }
  if (u.includes("anthropic.com")) {
    return {
      url: u.replace(/\/$/, "") + "/messages",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model || "claude-haiku-4-5",
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }]
      })
    };
  }
  const chatUrl = u.includes("chat/completions")
    ? u
    : u.replace(/\/$/, "") + "/chat/completions";
  return {
    url: u.includes("pollinations") ? "https://text.pollinations.ai/" : chatUrl,
    headers,
    body: JSON.stringify({
      model:
        model || (u.includes("pollinations") ? "openai-fast" : "gpt-5.4-mini"),
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 8,
      private: true
    })
  };
}

/** تست زندهٔ یک endpoint و تشخیص هوش مصنوعی */
export async function probeEndpoint(
  url: string,
  apiKey = "",
  model = ""
): Promise<AiProbeResult> {
  const reqInfo = buildProbeRequest(url, apiKey, model);
  const started = Date.now();
  try {
    const res = await fetch(reqInfo.url, {
      method: "POST",
      headers: reqInfo.headers,
      body: reqInfo.body,
      signal: AbortSignal.timeout(15000)
    });
    const latencyMs = Date.now() - started;
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        aiName: identifyAi(text) || "نامشخص",
        model: "",
        latencyMs,
        message: `HTTP ${res.status} — ${text.slice(0, 160)}`,
        needsKey: res.status === 401 || res.status === 403
      };
    }

    let detectedModel = "";
    try {
      const j = JSON.parse(text) as Record<string, unknown>;
      const pick = (v: unknown): string => {
        if (typeof v === "string") return v;
        if (v && typeof v === "object") {
          const o = v as Record<string, unknown>;
          if (typeof o.model === "string") return o.model;
          if (typeof o.name === "string") return o.name;
        }
        return "";
      };
      detectedModel =
        pick(j.model) ||
        pick((j as { data?: unknown }).data) ||
        (Array.isArray((j as { candidates?: unknown[] }).candidates)
          ? "gemini"
          : "");
    } catch {
      /* متن ساده */
    }

    const catalog = matchCatalogByUrl(reqInfo.url);
    const aiName =
      identifyAi(detectedModel) ||
      identifyAi(reqInfo.url) ||
      (catalog ? catalog.faName : "") ||
      "هوش مصنوعی ناشناخته";

    return {
      ok: true,
      aiName,
      model: detectedModel || "(بدون نام مدل)",
      latencyMs,
      message: `✅ این API از «${aiName}» است — تاخیر ${latencyMs} میلی‌ثانیه.`,
      needsKey: false
    };
  } catch (e) {
    return {
      ok: false,
      aiName: "نامشخص",
      model: "",
      latencyMs: Date.now() - started,
      message: `ارتباط برقرار نشد: ${e instanceof Error ? e.message : "خطای ناشناخته"}`,
      needsKey: false
    };
  }
}

/** پاسخ فرمان صوتی/متنی «تست ای‌پی‌آی» — اگر مچ شد متن برمی‌گرداند، وگرنه null */
export async function fastProbeReply(
  content: string,
  current: { baseUrl: string; apiKey: string; model: string }
): Promise<string | null> {
  const c = content.toLowerCase();
  const wantsProbe =
    /(تست|چک|بررسی)\s*(ای\s*پی\s*آی|api|اپی|ای پی)/.test(c) ||
    /(api|ای\s*پی\s*آی)\s*(رو\s*)?(تست|چک|بررسی)/.test(c) ||
    /هوش\s*مصنوعی.*(تست|کدوم|کدام)/.test(c);
  if (!wantsProbe) return null;

  const parts: string[] = [];
  // ۱) سرویس فعلی برنامه
  const main = await probeEndpoint(current.baseUrl, current.apiKey, current.model);
  parts.push(
    `🔎 سرویس فعلی: ${main.ok ? main.message : `❌ ${main.message}`}`
  );
  // ۲) پولینیشن (همیشگی و بدون کلید) — برای اطمینان از کار دائمی
  const pol = await probeEndpoint("https://text.pollinations.ai/");
  parts.push(`🌐 پولینیشن (همیشگی): ${pol.ok ? pol.message : `❌ ${pol.message}`}`);
  return parts.join("\n");
}
