// Peak 1.0.3 — AI Core (3→1)
/**
 * کاتالوگ APIهای هوش مصنوعی + تشخیص اینکه پاسخ از کدام هوش مصنوعی است
 * (همسان‌سازی‌شده با ابزار manix — اولویت: ماینکرفت + گفتار + تاخیر کم)
 */

export interface AiCatalogEntry {
  id: string;
  faName: string;
  enName: string;
  model: string;
  endpoint: string;
  keyEnv: string;
  needsKey: boolean;
  latency: string;
  minecraft: string;
  speech: string;
  permanent: boolean;
}

/** فهرست اولویت‌بندی‌شدهٔ سرویس‌ها */
export const AI_CATALOG: AiCatalogEntry[] = [
  {
    id: "openai",
    faName: "ChatGPT نسخه جدید",
    enName: "OpenAI GPT-5.4",
    model: "gpt-5.4",
    endpoint: "https://api.openai.com/v1",
    keyEnv: "OPENAI_API_KEY",
    needsKey: true,
    latency: "خیلی کم",
    minecraft: "★★★★★",
    speech: "★★★★★",
    permanent: true
  },
  {
    id: "openai-realtime",
    faName: "ChatGPT صوتی",
    enName: "GPT Realtime 2",
    model: "gpt-realtime-2.1",
    endpoint: "wss://api.openai.com/v1/realtime",
    keyEnv: "OPENAI_API_KEY",
    needsKey: true,
    latency: "خیلی کم",
    minecraft: "★★★★",
    speech: "★★★★★",
    permanent: true
  },
  {
    id: "gemini",
    faName: "جمنای فلش",
    enName: "Google Gemini 2.5 Flash",
    model: "gemini-2.5-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    keyEnv: "GEMINI_API_KEY",
    needsKey: true,
    latency: "خیلی کم",
    minecraft: "★★★★",
    speech: "★★★★★",
    permanent: true
  },
  {
    id: "gemini-3",
    faName: "جمنای ۳.۵ فلش",
    enName: "Google Gemini 3.5 Flash",
    model: "gemini-3.5-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    keyEnv: "GEMINI_API_KEY",
    needsKey: true,
    latency: "خیلی کم",
    minecraft: "★★★★",
    speech: "★★★★",
    permanent: true
  },
  {
    id: "anthropic",
    faName: "کلاد هایک",
    enName: "Anthropic Claude Haiku 4.5",
    model: "claude-haiku-4-5",
    endpoint: "https://api.anthropic.com/v1",
    keyEnv: "ANTHROPIC_API_KEY",
    needsKey: true,
    latency: "کم",
    minecraft: "★★★★",
    speech: "★★★★",
    permanent: true
  },
  {
    id: "openai-mini",
    faName: "جی‌پی‌تی مینی",
    enName: "OpenAI GPT-5.4-mini",
    model: "gpt-5.4-mini",
    endpoint: "https://api.openai.com/v1",
    keyEnv: "OPENAI_API_KEY",
    needsKey: true,
    latency: "کم",
    minecraft: "★★★★",
    speech: "★★★",
    permanent: true
  },
  {
    id: "xai",
    faName: "گروک",
    enName: "xAI Grok",
    model: "grok",
    endpoint: "https://api.x.ai/v1",
    keyEnv: "XAI_API_KEY",
    needsKey: true,
    latency: "کم",
    minecraft: "★★★",
    speech: "★★★★",
    permanent: true
  },
  {
    id: "pollinations",
    faName: "پولینیشن (رایگان)",
    enName: "Pollinations openai-fast",
    model: "openai-fast",
    endpoint: "https://text.pollinations.ai/",
    keyEnv: "",
    needsKey: false,
    latency: "کم",
    minecraft: "★★★",
    speech: "★★★",
    permanent: true
  },
  {
    id: "deepseek",
    faName: "دیپ‌سیک",
    enName: "DeepSeek",
    model: "deepseek-chat",
    endpoint: "https://api.deepseek.com/v1",
    keyEnv: "DEEPSEEK_API_KEY",
    needsKey: true,
    latency: "متوسط",
    minecraft: "★★★",
    speech: "★★",
    permanent: true
  },
  {
    id: "qwen",
    faName: "کیوان",
    enName: "Qwen (Alibaba)",
    model: "qwen-max",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    keyEnv: "DASHSCOPE_API_KEY",
    needsKey: true,
    latency: "متوسط",
    minecraft: "★★★",
    speech: "★★★",
    permanent: true
  },
  {
    id: "kimi",
    faName: "کیمی",
    enName: "Moonshot Kimi",
    model: "kimi-k2",
    endpoint: "https://api.moonshot.ai/v1",
    keyEnv: "MOONSHOT_API_KEY",
    needsKey: true,
    latency: "متوسط",
    minecraft: "★★★",
    speech: "★★",
    permanent: true
  }
];

/** تشخیص نام هوش مصنوعی از روی نام مدل/پاسخ */
export function identifyAi(modelOrText: string): string {
  const s = (modelOrText || "").toLowerCase();
  if (/gpt|o1|o3|o4|chatgpt|openai/.test(s)) return "ChatGPT (OpenAI)";
  if (/realtime/.test(s)) return "ChatGPT صوتی (OpenAI Realtime)";
  if (/claude|anthropic/.test(s)) return "Claude (Anthropic)";
  if (/gemini|gemma|google/.test(s)) return "Gemini (Google)";
  if (/grok|xai/.test(s)) return "Grok (xAI)";
  if (/deepseek/.test(s)) return "DeepSeek";
  if (/qwen|tongyi|dashscope/.test(s)) return "Qwen (Alibaba)";
  if (/kimi|moonshot/.test(s)) return "Kimi (Moonshot)";
  if (/llama|meta/.test(s)) return "Llama (Meta)";
  if (/mistral|mixtral/.test(s)) return "Mistral";
  if (/pollinations|openai-fast/.test(s)) return "Pollinations (رایگان)";
  return "";
}

/** پیدا کردن سرویس کاتالوگ از روی url */
export function matchCatalogByUrl(url: string): AiCatalogEntry | null {
  const u = (url || "").toLowerCase();
  return (
    AI_CATALOG.find((c) => u.includes(c.endpoint.replace(/^wss?:\/\//, ""))) ??
    AI_CATALOG.find((c) => u.includes(c.id)) ??
    null
  );
}
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
/**
 * مدل‌های هوش مصنوعی داخلی — کاملاً رایگان و بدون نیاز به کلید API
 * روی سرویس آزاد Pollinations اجرا می‌شوند و با انتخاب هر مدل،
 * شخصیت و تخصص دستیار عوض می‌شود.
 */

export interface BuiltInModel {
  /** شناسهٔ مدل در تنظیمات */
  id: string;
  /** برچسب نمایشی */
  label: string;
  /** توضیح کوتاه */
  description: string;
  /** مدل موتور پشتیبان (سرویس رایگان) */
  backendModel: string;
  /** دستور شخصیت — به System Prompt اضافه می‌شود */
  persona: string;
}

/** لیست مدل‌های داخلی (رایگان) */
export const BUILT_IN_MODELS: BuiltInModel[] = [
  {
    id: "assistant",
    label: "⭐ دستیار فارسی",
    description: "دستیار عمومی، سریع و مودب — مناسب کارهای روزمره",
    backendModel: "openai-fast",
    persona:
      "تو یک دستیار عمومی همه‌فن‌حریف هستی. جواب‌های دقیق، کاربردی و سریع بده. برای سؤال‌های ساده کوتاه جواب بده."
  },
  {
    id: "coder",
    label: "💻 دستیار کدنویس",
    description: "متخصص برنامه‌نویسی و دیباگ — کد تمیز و توضیح فارسی",
    backendModel: "openai-fast",
    persona:
      "تو یک مهندس ارشد نرم‌افزار هستی. در برنامه‌نویسی، دیباگ و معماری کد متخصصی. کدها را دقیق، تمیز و با توضیح فارسی کوتاه ارائه بده. اگر کد خواسته شد، کد کامل و قابل اجرا بده."
  },
  {
    id: "creative",
    label: "🎨 داستان‌سرا و شاعر",
    description: "خلاق در داستان، شعر و متن‌های ادبی",
    backendModel: "openai-fast",
    persona:
      "تو یک نویسنده و شاعر خلاق هستی. در داستان‌سرایی، شعر فارسی، متن‌های ادبی و ایده‌پردازی قوی عمل کن. از تخیل غنی و زبان زیبا استفاده کن."
  },
  {
    id: "teacher",
    label: "📚 معلم صبور",
    description: "آموزش قدم‌به‌قدم با مثال ساده",
    backendModel: "openai-fast",
    persona:
      "تو یک معلم صبور و مهربان هستی. مفاهیم را قدم‌به‌قدم، با مثال‌های ساده و روزمره یاد بده. از اصطلاحات سخت پرهیز کن و مطمئن شو کاربر واقعاً یاد گرفته."
  },
  {
    id: "minecraft",
    label: "🎮 هم‌تیمی ماینکرفت",
    description: "حرفه‌ای در ماینکرفت — نکته، ترفند و راهنمای بقا",
    backendModel: "openai-fast",
    persona:
      "تو یک بازیکن حرفه‌ای ماینکرفت هستی. در بقا، رِداستون، مبارزه، ساخت‌وساز و ترفندهای بازی استادی. جواب‌های کوتاه و عملی بده و اگر لازم شد دستور یا فرمول ساخت بده."
  }
];

/** پیدا کردن مدل داخلی با شناسه */
export function getBuiltInModel(id: string): BuiltInModel {
  return (
    BUILT_IN_MODELS.find((m) => m.id === id) ?? BUILT_IN_MODELS[0]
  );
}

/** آیا این شناسه مدل داخلی است؟ */
export function isBuiltInModelId(id: string): boolean {
  return BUILT_IN_MODELS.some((m) => m.id === id);
}
