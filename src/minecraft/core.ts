// Peak 1.0.3 — Minecraft Core (4→1)
/**
 * پل گفت‌وگوی داخل بازی — هوش طبیعی برای ماینکرفت
 *
 * وقتی بازیکنی توی چت بازی حرف می‌زند:
 *   ۱. اول جمله‌های فارسی رایج را سریع (بدون LLM) اجرا می‌کند
 *   ۲. اگر سؤال/درخواست پیچیده بود، با مدل سریع ماینکرفت جواب کوتاه می‌دهد
 * ضد اسپم: هر بازیکن هر ۳.۵ ثانیه یک جواب می‌گیرد.
 */
import { botManager } from "@/minecraft/botManager";
import { logger } from "@/lib/logger";
import {
  buildContext,
  extractMcTokens,
  matchFastAction,
  runMcTokens,
  tryFastAction
} from "@/minecraft/actions";
import {
  isProtected,
  isToxicMessage,
  personalityPromptFragment,
  toxicReply
} from "@/minecraft/personality";
import { getBuiltInModel } from "@/lib/builtin-models";
import { streamBuiltInCompletion } from "@/lib/llm";
import { getSettings } from "@/lib/store";
import { hasPermission } from "@/lib/permissions";

/** اکشن‌های امن که دوستان هم می‌تونن بدن (بقیه فقط مالک) */
const SAFE_FRIEND_ACTIONS = new Set([
  "come",
  "stop",
  "status",
  "coords",
  "players_online",
  "health_report",
  "dance",
  "wave",
  "spin",
  "party",
  "bow_to",
  "look_at",
  "follow",
  "say",
  // باز کردن مهروموم خدایی برای دوستان هم امن است (توقف/رهایی — نه اجرا)
  "god_seal_off"
]);

let installed = false;
const lastReplyAt = new Map<string, number>();

const QUESTION_RE =
  /[?؟]|راهنما|چرا|چی|کی|کجا|چطور|چجوری|بگو|میشه|می‌تونی|میتونی|بیار|بزن|برو|بکش|بده|کن/;

/** نصب پل — فقط یک بار (فراخوانی امن از چند مسیر) */
export function installChatBridge(): void {
  if (installed) return;
  installed = true;
  botManager.setChatListener((username, message) => {
    // خطای پردازش پیام بازیکن نباید بی‌صدا بماند (وگرنه ربات خراب به‌نظر می‌رسد)
    void handlePlayerChat(username, message).catch((err: unknown) => {
      logger.error("minecraft.chat_bridge_failed", {
        username,
        error: err instanceof Error ? err.message : String(err)
      });
    });
  });
}

async function handlePlayerChat(
  username: string,
  message: string
): Promise<void> {
  const settings = getSettings();
  if (!settings.mcChatBridge) return;
  const text = message.trim();
  if (!text || text.length > 160) return;

  const botUser = botManager.getBot()?.username ?? null;
  const ownerName = settings.mcProtectTarget ?? settings.userName;
  const isOwner = username.trim().toLowerCase() === ownerName.trim().toLowerCase();
  const isFriend = isProtected(username, settings, botUser);

  // ضد اسپم — مالک کمتر، غریبه بیشتر
  const now = Date.now();
  const cooldown = isOwner ? 1200 : isFriend ? 2800 : 5000;
  const last = lastReplyAt.get(username) ?? 0;
  if (now - last < cooldown) return;

  /* ---- ۰. توهین/اذیت (فارسی/انگلیسی/فینگیلیش) → جواب به تناسب شخصیت ---- */
  if (!isOwner && !isFriend && isToxicMessage(text)) {
    lastReplyAt.set(username, now);
    botManager.rawChat(toxicReply(settings.mcPersonality));
    return;
  }

  const ctx = buildContext(ownerName, settings.mcIsOp);

  /* ---- ۱. مچ سریع فارسی/فینگیلیش (تأخیر تقریباً صفر) ---- */
  const hit = matchFastAction(text);
  if (hit) {
    // مالک: همه؛ دوست: فقط اکشن‌های امن؛ غریبه: هیچ
    const allowed = isOwner || (isFriend && SAFE_FRIEND_ACTIONS.has(hit.id));
    if (allowed) {
      const fast = await tryFastAction(text, ctx);
      if (fast) {
        lastReplyAt.set(username, now);
        botManager.rawChat(`✅ ${fast.reply}`);
        return;
      }
    }
  }

  /* ---- ۲. جواب هوشمند کوتاه برای سؤال/درخواست ---- */
  const mentionsBot = /ربات|بات|پیک|peak|هی|hi\b/i.test(text);
  if (!QUESTION_RE.test(text) && !mentionsBot) return;

  if (!hasPermission(settings, "aiNetwork")) return; // بدون دسترسی مدل، سکوت

  lastReplyAt.set(username, now);
  const preset = getBuiltInModel("minecraft");
  const persona = personalityPromptFragment(
    settings.mcPersonality,
    ownerName,
    settings.mcFriends
  );
  const messages = [
    {
      role: "system" as const,
      content:
        `تو ربات ماینکرفت «Peak» هستی و با ${username} (مالک: ${ownerName}) بازی می‌کنی. ` +
        `فقط یک جملهٔ کوتاه فارسی خودمانی جواب بده (حداکثر ۱۲ کلمه). ` +
        `پیام‌های فینگیلیش مثل "Salam" یا "bia" را بفهم. ` +
        `اگر درخواست اجرای کاری در بازی بود، در پایان جواب توکن اکشن بفرست مثل [[mc:tp_to_me]]. ` +
        persona
    },
    { role: "user" as const, content: text }
  ];

  let reply = "";
  try {
    for await (const chunk of streamBuiltInCompletion({
      backendModel: preset.backendModel,
      messages
    })) {
      reply += chunk;
      if (reply.length > 260) break;
    }
  } catch {
    return;
  }

  // توکن‌های اکشن را اجرا (فقط مالک می‌تونه توکن‌های حساس بده) و از متن چت پاک کن
  const { clean, actions } = extractMcTokens(reply);
  const runnable = isOwner
    ? actions
    : isFriend
      ? actions.filter((a) => SAFE_FRIEND_ACTIONS.has(a.id))
      : [];
  if (runnable.length) {
    const results = await runMcTokens(runnable, ctx);
    const done = results.find((r) => r.ok);
    if (done) botManager.rawChat(`⚡ ${done.reply}`);
  }
  const say = clean.replace(/\s+/g, " ").trim().slice(0, 180);
  if (say) botManager.rawChat(say);
}
/**
 * پارسر دستورهای زبان طبیعی فارسی برای ربات ماینکرفت
 * پشتیبانی کامل از ارقام فارسی/انگلیسی و اعداد منفی
 */
import type { ParsedCommand } from "@/minecraft/types";
import { toEnglishDigits } from "@/lib/persian";

/** نگاشت نام‌های فارسی بلوک‌ها به شناسهٔ ماینکرفت */
export const BLOCK_MAP: Record<string, string> = {
  چوب: "oak_log",
  درخت: "oak_log",
  الوار: "oak_log",
  لاگ: "oak_log",
  سنگ: "stone",
  خاک: "dirt",
  شن: "sand",
  ماسه: "sand",
  شنی: "sand",
  گراول: "gravel",
  ریگ: "gravel",
  الماس: "diamond_ore",
  آهن: "iron_ore",
  طلا: "gold_ore",
  ذغال: "coal_ore",
  "ذغال‌سنگ": "coal_ore",
  زمرد: "emerald_ore",
  لاجورد: "lapis_ore",
  رداستون: "redstone_ore",
  مس: "copper_ore",
  گل: "clay",
  رس: "clay",
  گلی: "clay",
  آجر: "bricks",
  چمن: "grass_block",
  چمنی: "grass_block",
  برگ: "oak_leaves",
  شیشه: "glass",
  ماسه‌سنگ: "sandstone",
  سنگ‌آهک: "calcite",
  برف: "snow_block",
  یخ: "ice",
  نی: "bamboo",
  بامبو: "bamboo",
  صخره: "cobblestone",
  کپ: "cobblestone"
};

/** تبدیل نام فارسی بلوک به شناسه */
export function normalizeBlockName(input: string): string | null {
  const key = input.trim().toLowerCase();
  if (BLOCK_MAP[key]) return BLOCK_MAP[key];
  // اگر ورودی مستقیماً شناسهٔ انگلیسی بود
  if (/^[a-z0-9_]+$/.test(key)) return key;
  return null;
}

/** تبدیل اعداد (فارسی/انگلیسی/منفی) داخل متن برای استخراج مختصات */
function normalizeNumbers(text: string): string {
  return toEnglishDigits(text)
    .replace(/منفی\s*/g, "-")
    .replace(/,/g, " ");
}

const ON_WORDS = "(?:روشن|فعال|شروع|بزن|start|on|enable)";
const OFF_WORDS = "(?:خاموش|غیرفعال|قطع|تمام|stop|off|disable)";

/**
 * تحلیل متن فارسی کاربر و تبدیل به دستور ساخت‌یافته
 * اگر متن دستور ماینکرفتی نباشد، null برمی‌گرداند
 */
export function parseCommand(rawText: string): ParsedCommand | null {
  const text = normalizeNumbers(rawText.trim());
  const t = text.toLowerCase();

  /* ---- توقف فوری ---- */
  if (/^(وایسا|وایستا|استوپ|توقف|صبر\s*کن|دست\s*نگه\s*دار|متوقف|stop)\b/.test(t)) {
    return { type: "stop" };
  }

  /* ---- دنبال‌کردن ---- */
  if (/(بیا\s*دنبالم|منو\s*دنبال\s*کن|دنبالم\s*بیا|دنبالم\s*کن|follow\s*me)/.test(t)) {
    return { type: "follow" };
  }

  /* ---- بیا پیش من ---- */
  if (/(بیا\s*پیش\s*من|بیا\s*طرف\s*من|بیا\s*سمت\s*من|come\s*to\s*me)/.test(t)) {
    return { type: "come" };
  }

  /* ---- برگشت به جای قبلی (حافظهٔ مکان) ---- */
  if (/(برگرد(?!\s*سر\s*جات)|به\s*جای\s*قبلی\s*برگرد|بیا\s*برگرد|bargard)/.test(t)) {
    return { type: "go_back" };
  }

  /* ---- یاد کردن این مکان ---- */
  if (/(اینجا\s*رو\s*یاد(?:\s*ش)?\s*کن|این\s*مکان\s*رو\s*یاد(?:\s*ش)?\s*کن|save\s*spot|mark\s*here)/.test(t)) {
    return { type: "mark_here" };
  }

  /* ---- رفتن به مختصات ---- */
  const gotoMatch = t.match(
    /(?:برو\s*به\s*(?:مختصات|مکان|موقعیت)?|برو\s*به|goto|go\s*to)\s*(-?\d+)\s*[,\s]\s*(-?\d+)\s*[,\s]\s*(-?\d+)/
  );
  if (gotoMatch) {
    return {
      type: "goto",
      x: Number(gotoMatch[1]),
      y: Number(gotoMatch[2]),
      z: Number(gotoMatch[3])
    };
  }

  /* ---- جمع‌آوری بلوک ---- */
  // «چوب جمع کن» / «سنگ جمع کن» / «از اون بلوکا جمع کن»
  const collectMatch = t.match(/([\u0600-\u06FFa-z_]{2,20})\s*(?:ها)?\s*(?:رو)?\s*جمع\s*کن/);
  if (collectMatch) {
    const block = normalizeBlockName(collectMatch[1]);
    if (block) return { type: "collect", block };
    return { type: "collect", block: "oak_log" };
  }
  if (/جمع\s*کن/.test(t) && /(بلوک|چیز|اینا)/.test(t)) {
    return { type: "collect", block: "oak_log" };
  }

  /* ---- حملهٔ خودکار / اتوکلیک ---- */
  if (/(اتو\s*کلیک|اتوکلیک|حمله\s*خودکار|اتک\s*خودکار|auto\s*click|auto\s*attack)/.test(t)) {
    const off = new RegExp(OFF_WORDS).test(t) && !new RegExp(ON_WORDS).test(t);
    return { type: "autoAttack", on: !off };
  }

  /* ---- محافظت ---- */
  if (/(محافظت|نگهبانی|پلیس|guard|protect)/.test(t)) {
    const off = new RegExp(OFF_WORDS).test(t) && !new RegExp(ON_WORDS).test(t);
    return { type: "guard", on: !off };
  }

  /* ---- حالت موشک ---- */
  if (/(موشک|rocket|سریع\s*حرکت|عین\s*موشک)/.test(t)) {
    const off = new RegExp(OFF_WORDS).test(t) && !new RegExp(ON_WORDS).test(t);
    return { type: "rocket", on: !off };
  }

  /* ---- پرش ---- */
  if (/^(بپر|پرش|jump)\b/.test(t) || /یه\s*بار\s*بپر/.test(t)) {
    return { type: "jump" };
  }

  /* ---- نگاه کردن ---- */
  if (/(به\s*من\s*نگاه\s*کن|نگام\s*کن|look\s*at\s*me)/.test(t)) {
    return { type: "look" };
  }

  /* ---- گفتن در چت ---- */
  const sayMatch = t.match(/(?:تو|در)\s*چت\s*بگو\s+(.+)/);
  if (sayMatch?.[1]) {
    // متن اصلی (نه نرمال‌شده) را بگو تا اعداد فارسی حفظ شوند
    const orig = rawText.trim().match(/(?:تو|در)\s*چت\s*بگو\s+(.+)/i);
    return { type: "say", text: (orig?.[1] ?? sayMatch[1]).trim() };
  }

  /* ---- گزارش وضعیت ---- */
  if (/(گزارش\s*وضعیت|وضعیتت|وضعیت\s*چطوره|گزارش\s*بده|status\s*report|گزارش)/.test(t)) {
    return { type: "status" };
  }

  /* ---- راهنمای دستورها ---- */
  if (/(دستورات\s*ماینکرفت|راهنمای\s*ماینکرفت|چه\s*دستورایی)/.test(t)) {
    return { type: "help" };
  }

  return null;
}

/** متن راهنمای دستورهای ماینکرفت */
export const MC_HELP_TEXT = `دستورهای ماینکرفت من اینا هستن:
• «بیا دنبالم» / «منو دنبال کن»
• «بیا پیش من»
• «وایسا» / «توقف فوری»
• «برو به مختصات ۱۰۰ ۶۴ -۳۰»
• «برگرد» / «برگرد جای قبلی» — برگشت به جایی که بوده\n• «اینجا رو یاد کن» — یاد کردن مکان فعلی\n• «چوب جمع کن» / «سنگ جمع کن» / «الماس جمع کن»
• «بپر» — «به من نگاه کن»
• «تو چت بگو سلام بچه‌ها»
• «محافظت کن» / «محافظت رو خاموش کن» (حالت پلیسی)
• «موشک روشن» / «موشک خاموش» (حرکت سریع)
• «اتوکلیک روشن» / «اتوکلیک خاموش» (حملهٔ خودکار)
• «گزارش وضعیت»`;
/**
 * موتور شخصیت و حالت‌های بازی — قلب «حالت ویژهٔ ماینکرفت»
 *
 * سه حالت شخصیتی (زیرمجموعهٔ حالت ماینکرفت):
 *   1. angry  = «vood pump» — فوق‌العاده عصبانی، جنگ‌طلب، سرعت/قدرت زیاد
 *   2. kind   = فوق‌العاده مهربون — با همه خوب، محافظ همه در برابر ماب
 *   3. normal = عادی — با هم‌تیمی‌ها خوب، نسبت به بقیه خنثی
 * در هر سه حالت: «دوستان» (mcFriends + کاربر) محترم‌اند و هرگز آسیب نمی‌بینند.
 */
import type { AppSettings } from "@/lib/types";

export type Personality = "angry" | "kind" | "normal";

export const PERSONALITY_INFO: Record<
  Personality,
  { label: string; emoji: string; desc: string }
> = {
  angry: {
    label: "vood pump — فوق‌العاده عصبانی",
    emoji: "🔥",
    desc: "سرعت و قدرت خیلی زیاد، جنگ‌طلب، استفاده از همهٔ توانایی‌ها؛ با دوستان مهربونه"
  },
  kind: {
    label: "فوق‌العاده مهربون",
    emoji: "💚",
    desc: "با همه مهربونه و از همه در برابر ماب‌ها محافظت می‌کنه"
  },
  normal: {
    label: "عادی",
    emoji: "💙",
    desc: "با هم‌تیمی‌ها خوبه، نسبت به بقیه حس خاصی نداره"
  }
};

/** رمز همیشگی برای سرورهای رجیستر/لاگین (AuthMe و…) */
export const AUTH_PASSWORD = "@1988@1988";

/** لیست محافظت‌شده‌ها: ربات، کاربر، بازیکن هدف و همهٔ دوستان (همیشه امن) */
export function protectedNames(
  settings: AppSettings,
  botUsername: string | null
): Set<string> {
  const s = new Set<string>();
  s.add((botUsername ?? "").toLowerCase());
  if (settings.userName) s.add(settings.userName.trim().toLowerCase());
  if (settings.mcProtectTarget)
    s.add(settings.mcProtectTarget.trim().toLowerCase());
  for (const f of settings.mcFriends) {
    const n = f.trim().toLowerCase();
    if (n) s.add(n);
  }
  return s;
}

export function isProtected(
  name: string | undefined | null,
  settings: AppSettings,
  botUsername: string | null
): boolean {
  if (!name) return false;
  return protectedNames(settings, botUsername).has(name.trim().toLowerCase());
}

/** آیا بازیکن «دوست/کاربر» است؟ (همان لیست محافظت) */
export function isFriendOf(
  name: string,
  settings: AppSettings,
  botUsername: string | null
): boolean {
  return isProtected(name, settings, botUsername);
}

/* ================================================================ */
/* فینگیلیش → فارسی — برای فهم پیام‌هایی مثل «Salam» «bia pisham»    */
/* ================================================================ */

const FINGLISH_MAP: Array<[RegExp, string]> = [
  [/\bsalam\b|\bsalâm\b/gi, "سلام"],
  [/\bchetori\b|\bchetoori\b|\bkhobi\b|\bkhubi\b/gi, "چطوری"],
  [/\bbia\b|\bbiy?a\b|\bcome\b/gi, "بیا"],
  [/\bpisham\b|\bpišam\b/gi, "پیشم"],
  [/\bpish\b/gi, "پیش"],
  [/\bman\b|\bme\b/gi, "من"],
  [/\bto\b|\bshoma\b/gi, "تو"],
  [/\bbekosh\b|\bbekosh\b|\bkill\b|\bbokosh\b/gi, "بکش"],
  [/\bstop\b|\bvaysa\b|\bvayssa\b/gi, "وایسا"],
  [/\bghahre\b|\bghaher\b/gi, "قهر"],
  [/\basabani\b|\basab\b|\bangry\b|\bfight\b|\bvood\b|\bgod\s?mode\b/gi, "عصبانی"],
  [/\bmoheb\b|\bmoheboon\b|\bkind\b|\bnice\b/gi, "مهربون"],
  [/\badi\b|\bnormal\b|\bmamooli\b/gi, "عادی"],
  [/\bsorat\b|\bspeed\b|\bfast\b/gi, "سرعت"],
  [/\bmerci\b|\bmersi\b|\bthanks\b|\bthank\b/gi, "مرسی"],
  [/\bare\b|\bale\b|\bbaale\b/gi, "آره"],
  [/\bna\b|\bno\b/gi, "نه"],
  [/\bdorost\b|\bright\b|\bok\b/gi, "درست"],
  [/\bhelp\b|\bkomak\b|\brahnama\b/gi, "راهنما"],
  [/\bkoja\b|\bkooja\b|\bwhere\b/gi, "کجا"],
  [/\bbegu\b|\bbego\b|\bsay\b|\btell\b/gi, "بگو"],
  [/\bbegard\b|\bgard\b/gi, "بگرد"],
  [/\bjam\b|\bjamkon\b|\bcollect\b/gi, "جمع"],
  [/\bchoob\b|\bwood\b/gi, "چوب"],
  [/\bsang\b|\bstone\b/gi, "سنگ"],
  [/\bghorbani\b|\bfight\s?for\s?me\b/gi, "فدایی"],
  [/\bdost\b|\bdoost\b|\bfriend\b/gi, "دوست"],
  [/\bghorboon\b/gi, "قربون"]
];

/** تبدیل فینگیلیش به فارسی برای مچ الگوها (بدون تغییر متن اصلی برای نمایش) */
export function normalizeFinglish(text: string): string {
  let t = text;
  for (const [re, fa] of FINGLISH_MAP) t = t.replace(re, fa);
  return t;
}

/* ================================================================ */
/* تشخیص توهین/اذیت در چت (فارسی/انگلیسی/فینگیلیش)                    */
/* ================================================================ */

const TOXIC_RE =
  /(مرض\s*داری|خنگ|احمق|اسکل|بی‌شرف|بی‌عرضه|نفهم|خفه|خفه‌شو|عوضی|کثافت|kir\b|kos\b|fuck|fuk|idiot|stupid|noob|nab\b|shut\s?up|suck|bitch|bastard|moron|dumb|کله\s*پوک|چرت|مزخرف|بی‌ادب|پررو|گمشو|برو\s*گمشو|khak|bi.?sharaf|kooni|jendeh|sag\b)/i;

export function isToxicMessage(text: string): boolean {
  return TOXIC_RE.test(normalizeFinglish(text));
}

/* ================================================================ */
/* جمله‌های واکنشی هر شخصیت                                          */
/* ================================================================ */

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TRASH_ANGRY = [
  "هی! مرض داری؟ حرف دهنتو بفهم!",
  "یه بار دیگه اینجوری حرف بزن ببین چی میشه!",
  "خیلی پررویی ها! به دوستای من بی‌احترامی نکن!",
  "بی‌ادب! برو یه کم ادب یاد بگیر بعد بیا چت!",
  "هه! فکر کردی کی هستی؟ مراقب حرف زدنت باش!"
];

const TRASH_KIND = [
  "هی عزیزم، لطفاً مودب حرف بزنی 💚",
  "بیا با احترام صحبت کنیم، باشه؟",
  "دوست من لطفاً آروم باش، قصد بدی ندارم 🌸",
  "بذار با مهربونی با هم حرف بزنیم"
];

const TRASH_NORMAL = [
  "هی! لطفاً محترمانه حرف بزن.",
  "این لحن درست نیست، مواظب حرفات باش.",
  "بی‌احترامی نکن لطفاً.",
  "آروم باش، لازم نیست اینجوری حرف بزنی."
];

/** واکنش به توهین بر اساس شخصیت */
export function toxicReply(personality: Personality): string {
  if (personality === "angry") return pick(TRASH_ANGRY);
  if (personality === "kind") return pick(TRASH_KIND);
  return pick(TRASH_NORMAL);
}

const THANKS_LINE = [
  "مرسی {user} جان! خیلی لطف کردی 💙",
  "ای وای، ممنون {user}! قربونت برم 🙏",
  "{user} جان مرسی! همین الان برداشتم 😊",
  "دستت درد نکنه {user} عزیز!"
];

/** تشکر هنگام برداشتن آیتم از جلوی پای کاربر */
export function thanksForItems(userName: string): string {
  return pick(THANKS_LINE).replace("{user}", userName || "دوست من");
}

/* ================================================================ */
/* پرامپت شخصیت برای هوش مصنوعی داخل چت بازی                         */
/* ================================================================ */

export function personalityPromptFragment(
  personality: Personality,
  ownerName: string,
  friends: string[]
): string {
  const friendList = friends.length ? friends.join("، ") : "—";
  const base = `# شخصیت تو در بازی
- کاربر/مالک تو «${ownerName}» است؛ باهاش خیلی مهربون و فداکار باش. دوستان: ${friendList} — بهشون همیشه احترام بذار.
- اگر کسی به تو یا دوستانت توهین کرد (فارسی/انگلیسی/فینگیلیش مثل "Salam" یا "noob")، با لحن شخصیتت جواب بده.
- پیام‌های فینگیلیش را بفهم و جواب فارسی طبیعی بده.`;
  if (personality === "angry") {
    return `${base}
- حالت فعلی: «vood pump» — فوق‌العاده عصبانی و جنگ‌طلب؛ جواب‌های کوتاه، آتشین و مقتدر بده؛ از همهٔ توانایی‌ها استفاده کن؛ در برابر توهین، تند جواب بده.`;
  }
  if (personality === "kind") {
    return `${base}
- حالت فعلی: «فوق‌العاده مهربون» — با همه مهربان و دلسوز؛ از همه در برابر ماب‌ها محافظت کن؛ لحن گرم و قلبی 💚.`;
  }
  return `${base}
- حالت فعلی: «عادی» — با هم‌تیمی‌ها خوب و صمیمی، نسبت به بقیه مودب و خنثی.`;
}
/**
 * تایپ‌های ماژول ماینکرفت
 */

export type LogType =
  | "info"
  | "success"
  | "warn"
  | "error"
  | "event"
  | "chat"
  | "combat"
  | "system";

export interface BotLogEntry {
  id: number;
  type: LogType;
  text: string;
  at: number;
}

export interface BotPosition {
  x: number;
  y: number;
  z: number;
}

export interface BotStatus {
  connected: boolean;
  connecting: boolean;
  host: string | null;
  port: number | null;
  username: string | null;
  health: number | null;
  food: number | null;
  position: BotPosition | null;
  dimension: string | null;
  players: string[];
  guardianMode: boolean;
  rocketMode: boolean;
  autoAttack: boolean;
  protectTarget: string | null;
  lastError: string | null;
  /** آخرین کد Device-Code برای ورود مایکروسافت */
  msDeviceCode: string | null;
}

export interface ConnectOptions {
  host: string;
  port: number;
  version: string;
  auth: "offline" | "microsoft";
  username: string;
  /** نام بازیکنی که باید از او محافظت شود */
  protectTarget?: string | null;
  /** ورود سرور کرکی: none / login / register (رمز ثابت) */
  authMode?: "none" | "login" | "register";
  serverId?: number | null;
}

/** نتیجهٔ اجرای یک دستور زبان طبیعی */
export interface CommandResult {
  ok: boolean;
  reply: string;
  command: ParsedCommand["type"] | "none" | "personality" | "kill" | "speed" | "pickup" | "fast";
}

/** ساختار دستورهای تحلیل‌شده از فارسی */
export type ParsedCommand =
  | { type: "follow" }
  | { type: "come" }
  | { type: "stop" }
  | { type: "goto"; x: number; y: number; z: number }
  | { type: "collect"; block: string }
  | { type: "jump" }
  | { type: "look" }
  | { type: "say"; text: string }
  | { type: "status" }
  | { type: "guard"; on: boolean }
  | { type: "rocket"; on: boolean }
  | { type: "autoAttack"; on: boolean }
  | { type: "go_back" }
  | { type: "mark_here" }
  | { type: "help" };
