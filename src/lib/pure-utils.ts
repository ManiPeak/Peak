// Peak 1.0.3 — Pure leaf utils (persian+mcTokens+mind+mods-data -> 1); no imports, client+server safe.

/* ===== merged from lib/persian.ts ===== */
/**
 * ابزارهای فارسی: نرمال‌سازی ارقام، تاریخ و ساعت هجری شمسی، فرمت‌های نمایش
 */

/** تبدیل ارقام فارسی/عربی به انگلیسی برای پردازش عددی */
export function toEnglishDigits(input: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const fi = fa.indexOf(ch);
    if (fi >= 0) return String(fi);
    const ai = ar.indexOf(ch);
    if (ai >= 0) return String(ai);
    return ch;
  });
}

/** تبدیل ارقام انگلیسی به فارسی برای نمایش */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** قالب تاریخ و ساعت هجری شمسی با منطقهٔ زمانی تهران */
export function jalaliDateTime(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  } catch {
    return date.toLocaleString("fa-IR");
  }
}

/** فقط ساعت (تهران) */
export function jalaliTime(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch {
    return date.toLocaleTimeString("fa-IR");
  }
}

/** فقط تاریخ شمسی (تهران) */
export function jalaliDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      dateStyle: "full"
    }).format(date);
  } catch {
    return date.toLocaleDateString("fa-IR");
  }
}

/** کوتاه‌کردن متن برای عنوان گفتگو */
export function truncateTitle(text: string, max = 32): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max).trimEnd() + "…";
}

/** پاک‌سازی متن ورودی از فاصله‌های اضافه */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/* ===== merged from lib/mcTokens.ts ===== */
/**
 * توکن‌های اکشن ماینکرفت — ماژول سبک و بدون وابستگی
 * (کلاینت هم می‌تونه ازش استفاده کنه — بدون mineflayer)
 *
 * قالب: [[mc:id]] یا [[mc:id|k=v,k=v]] یا [[mc:id|arg1,arg2]]
 */

export const MC_TOKEN_RE = /\[\[mc:([a-z_]+)(?:\|([^\]]*))?\]\]/g;

/** جدا کردن توکن‌ها از متن و پاک‌سازی متن نمایشی */
export function extractMcTokens(text: string): {
  clean: string;
  actions: { id: string; args: Record<string, string> }[];
} {
  const actions: { id: string; args: Record<string, string> }[] = [];
  const clean = text.replace(MC_TOKEN_RE, (_full, id: string, argStr?: string) => {
    const args: Record<string, string> = {};
    if (argStr) {
      // فرمت: k=v,k=v یا فقط مقادیر جدا با ,
      const parts = argStr.split(",").map((s) => s.trim());
      const keys = ["x", "y", "z", "player", "item", "n", "text"];
      parts.forEach((p, i) => {
        const kv = p.match(/^(\w+)=(.*)$/);
        if (kv) args[kv[1]] = kv[2];
        else if (keys[i]) args[keys[i]] = p;
      });
    }
    actions.push({ id, args });
    return "";
  });
  return { clean: clean.trim(), actions };
}

/** حذف توکن‌ها از متن نمایش/گفتار */
export function stripMcTokens(text: string): string {
  return text.replace(MC_TOKEN_RE, "").replace(/\s{2,}/g, " ").trim();
}

/* ===== merged from lib/mind.ts ===== */
/**
 * ذهن دستیار (Mind) — توانایی «فکر کردن» قبل از جواب
 * مدل در خط اول پاسخ، یک فکر کوتاه 💡 می‌نویسد و بعد جواب می‌دهد؛
 * فکرها در حافظهٔ کوتاه‌مدت می‌مانند تا گفتگو زنده و منسجم باشد.
 */

/** دستورهای ذهن — به System Prompt اضافه می‌شود */
export const MIND_PROMPT = `
# ذهن تو
تو یک ذهن زنده و فعال داری. قبل از جواب دادن فکر می‌کنی:
- در خط اول هر پاسخِ «فکری»، یک فکر کوتاه (۴ تا ۸ کلمه) با نماد 💡 بنویس.
- بعد از آن، جواب اصلی و کامل را بده.
- نمونه:
💡 دارم به سؤال فکر می‌کنم
جواب اصلی این‌طوری شروع می‌شود...
- برای سلام، خداحافظ، تشکر، دستورهای کوتاه و سؤال‌های ساده، «بدون فکر» و فوری جواب بده (تأخیر کم مهم است).
- فکرت باید صادقانه و دربارهٔ «چگونه جواب دادن» باشد، نه تکرار سؤال.
`;

export interface ThoughtSplit {
  /** فکر کوتاه خط اول (اگر بوده) */
  thought: string | null;
  /** متن اصلی پیام (همراه با فکر — برای تاریخچه دست‌نخورده می‌ماند) */
  text: string;
}

/** بیرون کشیدن فکر خط اول از پاسخ مدل */
export function extractThought(fullText: string): ThoughtSplit {
  const lines = fullText.split("\n");
  const first = (lines[0] ?? "").trim();
  if (first.startsWith("💡")) {
    return {
      thought: first.replace(/^💡\s*/, ""),
      text: fullText
    };
  }
  return { thought: null, text: fullText };
}

/** جمع‌آوری آخرین فکرها از تاریخچه — برای انسجام ذهن */
export function thoughtsFromHistory(contents: string[]): string[] {
  const out: string[] = [];
  for (const c of contents) {
    const first = (c.split("\n")[0] ?? "").trim();
    if (first.startsWith("💡")) {
      out.push(first.replace(/^💡\s*/, ""));
    }
  }
  return out.slice(-3);
}

/* ===== merged from lib/mods-data.ts ===== */
/**
 * بخش خالص سیستم مودها — تایپ‌ها و مودهای نمونه (بدون وابستگی به Node)
 * هم سرور و هم صفحهٔ کلاینت از اینجا می‌خوانند
 */

/** یک دستور سفارشی داخل مود */
export interface ModCommand {
  /** شناسهٔ یکتای دستور (حروف انگلیسی/عدد/_) */
  id: string;
  /** عنوان فارسی */
  label: string;
  /** جمله‌های فعال‌ساز فارسی/فینگیلیش */
  samples: string[];
  /** پاسخ متنی فوری (اگر باشد، بدون مدل و بدون تأخیر جواب می‌دهد) */
  reply?: string;
  /** دستور اسلش سرور مثل «give {player} diamond 64» — با {player} {self} {n} */
  op?: string;
  /** شناسهٔ یکی از توانایی‌های ماینکرفت موجود (مثل god_kit) */
  capability?: string;
}

/** تعریف یک مود */
export interface ModDefinition {
  /** شناسهٔ یکتای مود (نام فایل هم هست) */
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  /** روشن/خاموش */
  enabled: boolean;
  commands: ModCommand[];
}

/** مودهای نمونه — گالری صفحهٔ مودها (نصب با یک کلیک) */
export const EXAMPLE_MODS: ModDefinition[] = [
  {
    id: "hello_pack",
    name: "پک سلام‌وعلیک",
    version: "1.0.0",
    author: "Peak",
    description: "پاسخ‌های فارسی سریع برای احوال‌پرسی — بدون اینترنت",
    enabled: true,
    commands: [
      { id: "hi", label: "سلام ویژه", samples: ["سلام خدا", "هی پیک"], reply: "سلام رئیس! 👋 چه فرمانی داری؟" },
      { id: "bye", label: "خداحافظ ویژه", samples: ["خداحافظ خدا", "فعلا"], reply: "خداحافظ! هر وقت خواستی اینجام. 🙌" },
      { id: "howru", label: "حالت ویژه", samples: ["خوبی خدا", "چطوری پیک"], reply: "من عالی‌ام — آمادهٔ اجرا! ⚡" }
    ]
  },
  {
    id: "mc_fun_pack",
    name: "پک ماینکرفتی خفن",
    version: "1.0.0",
    author: "Peak",
    description: "دستورهای ویژهٔ ماینکرفت — کیت خدا، قلعه، آتش‌بازی",
    enabled: true,
    commands: [
      { id: "kit", label: "کیت رئیس", samples: ["کیت رئیس", "تجهیز رئیس"], capability: "god_kit" },
      { id: "castle", label: "قلعهٔ رئیس", samples: ["قلعه رئیس"], capability: "castle_op" },
      { id: "fire", label: "آتش‌بازی", samples: ["آتش بازی کن"], capability: "disco_party" },
      { id: "diamond_me", label: "الماس رئیس", samples: ["الماس رئیس"], op: "give {player} diamond 64" }
    ]
  },
  {
    id: "daily_pack",
    name: "پک روزانه",
    version: "1.0.0",
    author: "Peak",
    description: "جملات روزانه، انگیزشی و کاربردی",
    enabled: true,
    commands: [
      { id: "good_morning", label: "صبح بخیر ویژه", samples: ["صبح بخیر خدا"], reply: "☀️ صبح بخیر! امروز روز توئه — بریم کارای بزرگ بکنیم!" },
      { id: "plan", label: "برنامهٔ امروز", samples: ["برنامه امروز"], reply: "📋 پیشنهاد من: ۱) یه هدف مهم ۲) یه کار کوچک شروع‌شدنی ۳) یه استراحت کوتاه. اولی رو الان بگو تا شروع کنیم!" },
      { id: "focus", label: "تمرکز", samples: ["کمک تمرکز"], reply: "🎯 ۲۵ دقیقه گوشی رو کنار بذار، فقط یه کار. بعد ۵ دقیقه استراحت — اسمش تکنیک پومودوروئه!" }
    ]
  }
];
