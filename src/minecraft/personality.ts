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
