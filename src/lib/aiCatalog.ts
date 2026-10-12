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
