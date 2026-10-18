/**
 * مهارت‌های مغز آفلاین — ۱۰۰ قابلیت کامل بدون اینترنت و بدون تاخیر
 * ریاضی • تبدیل واحد • تاریخ • متن • سرگرمی • فارسی • ماینکرفت • کاربردی • حال‌وهوش • دانش
 */
import type { OfflineContext } from "@/lib/offline-brain";
import {
  toEnglishDigits,
  toPersianDigits
} from "@/lib/pure-utils";

/* ------------------------------------------------------------------ */
/* ابزارهای پایه                                                       */
/* ------------------------------------------------------------------ */

/** ماشین‌حساب امن — فقط اعداد و عملگرهای ریاضی (بدون اجرای کد) */
function safeCalc(expr: string): number | null {
  const s = toEnglishDigits(expr)
    .replace(/[،,]/g, "")
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\^/g, "**")
    .replace(/٪/g, "%");
  if (!/^[\d+\-*/().%**]+$/.test(s) || !/\d/.test(s)) return null;
  try {
     
    const v = Function(`"use strict";return (${s})`)() as unknown;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = [
  "ده",
  "یازده",
  "دوازده",
  "سیزده",
  "چهارده",
  "پانزده",
  "شانزده",
  "هفده",
  "هجده",
  "نزده"
];
const TENS = ["", "ده", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];

/** عدد به حروف فارسی (۰ تا ۹۹۹٬۹۹۹) */
function faNumWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "صفر";
  if (n > 999999) return String(n);
  const parts: string[] = [];
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  if (th > 0) parts.push(th === 1 ? "یک‌هزار" : `${faNumWords(th)} هزار`);
  const h = Math.floor(rest / 100);
  const t = Math.floor((rest % 100) / 10);
  const o = rest % 10;
  const sub: string[] = [];
  if (h > 0) sub.push(HUNDREDS[h]);
  if (t === 1) sub.push(TEENS[o]);
  else {
    if (t > 0) sub.push(TENS[t]);
    if (o > 0) sub.push(ONES[o]);
  }
  if (sub.length) parts.push(sub.join(" و "));
  return parts.join(" و ");
}

/** انتخاب تصادفی از لیست */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** عدد درون متن (فارسی/انگلیسی) */
function numIn(m: RegExpMatchArray, i = 1): number {
  return Number(toEnglishDigits(m[i] ?? "0").replace(/[^\d.\-]/g, "")) || 0;
}

/* ------------------------------------------------------------------ */
/* داده‌های سرگرمی و دانش                                              */
/* ------------------------------------------------------------------ */

const JOKES = [
  "یارو می‌ره کتابخونه، می‌گه: یه کتاب دربارهٔ صبر می‌خوام! کتابدار می‌گه: صبر کن بیارم. 😄",
  "به کامپیوتر گفتم یه لطیفه بگو؛ گفت: «۴۰۴ — شوخی پیدا نشد!» 🤖",
  "می‌پرسن: چرا ریاضی‌دان از درخت نمی‌افته؟ چون ریشه داره! 🌳",
  "به ماهی گفتن چرا ساکتی؟ گفت: آب دهنم بسته‌ست! 🐟",
  "یارو می‌ره ساندویچی، می‌گه: ساندویچ بدون گوشت! می‌گن: بدون گوشت چی بریزیم؟ می‌گه: بدون گوشت یعنی بدون گوشت، چیز دیگه نریزید! 🥪"
];

const RIDDLES = [
  "🔮 معما: چیزی که هرچه ازش کم کنی، بزرگ‌تر می‌شود؟ — جواب: «حفره» (چاله)",
  "🔮 معما: من دارم ولی نمی‌بینمش، چیست؟ — جواب: «سن» (سال تولدت)",
  "🔮 معما: چیزی که همیشه می‌آید ولی هرگز نمی‌رسد؟ — جواب: «فردا»",
  "🔮 معما: چند تا پا دارم ولی راه نمی‌روم؟ — جواب: «میز»"
];

const PROVERBS = [
  "«کار نیکو کردن از پر کردن است» — یعنی تمرین و پشتکار، استاد می‌سازد. 🌱",
  "«هر که را بهر کاری ساختند، لاجرم در آن کاری گماشتند» — هرکس استعداد خودش را دارد. 💡",
  "«دانش آموختن از گهواره تا گور» — یادگیری هیچ‌وقت دیر نیست. 📚",
  "«دوست آن باشد که گیرد دست تو» — دوست واقعی کمکت می‌کند. 🤝",
  "«سیلی صورت را سرخ می‌کند، شرم دامن را» — بعضی خطاها فقط آبرو را می‌برد. ⚖️"
];

const POEMS = [
  "«بنی‌آدم اعضای یک پیکرند / که در آفرینش ز یک گوهرند» — سعدی 🌹",
  "«هر نفس آواز عشق می‌رسد از چپ و راست / ما به فلک می‌رویم، عزم تماشا کنید» — مولانا ✨",
  "«بشنو از نی چون حکایت می‌کند / از جدایی‌ها شکایت می‌کند» — مولانا 🎵",
  "«اگر آن ترک شیرازی به دست آرد دل ما را / به خال هندویش بخشم سمرقند و بخارا را» — حافظ 💫"
];

const QUOTES = [
  "💪 «بزرگ‌ترین سفرها با یک قدم شروع می‌شود.»",
  "🔥 «شکست پایان راه نیست، یعنی یک مسیر دیگر را امتحان کن.»",
  "🌟 «تو قوی‌تر از چیزی هستی که فکر می‌کنی.»",
  "🚀 «امروز بهترین روز برای شروع است.»",
  "🏔️ «قله‌ها برای کسانی فتح می‌شود که از کوه نمی‌ترسند.»"
];

const TONGUE_TWISTERS = [
  "👅 زبان‌بند: «شاخهٔ بید شکسته» را ۵ بار سریع بگو!",
  "👅 زبان‌بند: «سیب سرخ سفت» — سریع و پشت‌سرهم!",
  "👅 زبان‌بند: «چه چیزی چسبناک‌تر از چسب است؟»",
  "👅 زبان‌بند: «بابا بی‌بی بی‌بی بابا» را بدون مکث بگو!"
];

const STORY_STARTERS = [
  "📖 «ماه کامل بود و ناگهان در کهنهٔ اتاق زیرزمین صدا داد...» ادامه بده!",
  "📖 «ربات کوچک برای اولین بار برف را دید و نمی‌دانست چه باید بکند...»",
  "📖 «نقشهٔ گنج فقط یک جمله داشت: از درخت بزرگ شروع کن...»"
];

/** دیکشنری کوچک فارسی↔انگلیسی */
const FA_EN: Record<string, string> = {
  سلام: "hello", خداحافظ: "goodbye", ممنون: "thank you", بله: "yes", نه: "no",
  آب: "water", نان: "bread", خانه: "house", ماشین: "car", کتاب: "book",
  مدرسه: "school", دوست: "friend", عشق: "love", خوشحال: "happy", ناراحت: "sad",
  بزرگ: "big", کوچک: "small", سریع: "fast", آهسته: "slow", شب: "night", روز: "day",
  ماه: "moon", خورشید: "sun", ستاره: "star", دریا: "sea", کوه: "mountain", گل: "flower",
  سگ: "dog", گربه: "cat", درخت: "tree", باران: "rain", برف: "snow", باد: "wind"
};
const EN_FA: Record<string, string> = Object.fromEntries(
  Object.entries(FA_EN).map(([k, v]) => [v, k])
);

/** رسپی‌های ماینکرفت */
const MC_RECIPES: Record<string, string> = {
  table: "🪵 میز کرافت: ۴ تا چوب (Planks) در شبکهٔ ۲×۲",
  torch: "🔥 مشعل: ۱ زغال + ۱ چوب = ۴ مشعل",
  pickaxe: "⛏️ کلنگ: ۳ چوب/سنگ/آهن/الماس + ۲ چوب (شکل: ردیف بالا ۳ ماده، وسط ۲ چوب)",
  sword: "🗡️ شمشیر: ۲ ماده + ۱ چوب (ستونی)",
  furnace: "🧱 کوره: ۸ سنگ (Cobblestone) دور شبکهٔ ۳×۳ (وسط خالی)",
  chest: "📦 صندوق: ۸ چوب دور شبکهٔ ۳×۳ (وسط خالی)",
  door: "🚪 در: ۶ چوب در دو ستون کنار هم",
  bed: "🛏️ تخت: ۳ پشم + ۳ چوب (پشم ردیف بالا، چوب پایین)",
  bow: "🏹 کمان: ۳ چوب + ۳ نخ (شکل یک‌چهارم دایره)",
  shield: "🛡️ سپر: ۶ چوب + ۱ آهن‌انگشتری (وسط پایین)"
};

/* ------------------------------------------------------------------ */
/* ۱۰۰ مهارت — جدول الگوها                                            */
/* ------------------------------------------------------------------ */

interface Skill {
  id: number;
  re: RegExp;
  reply: (m: RegExpMatchArray, ctx: OfflineContext) => string | null;
}

export const SKILLS: Skill[] = [
  /* ===== ریاضی (۱–۱۵) ===== */
  { id: 1, re: /(?:محاسبه\s*کن\s*[:؛]?\s*)?((?=[\d۰-۹+\-*/().^×÷٪\s]*[+\-*/^×÷])[\d۰-۹+\-*/().^×÷٪\s]{3,})\s*(?:چنده|چند\s*می‌شه|=)?/i,
    reply: (m) => {
      const v = safeCalc(m[1] || "");
      return v === null ? null : `🧮 نتیجه: ${toPersianDigits(String(Math.round(v * 100000) / 100000))}`;
    } },
  { id: 2, re: /(\d+)\s*درصد(?:\s*از)?\s*(\d+)/i,
    reply: (m) => `درصد: ${toPersianDigits(String((numIn(m) * numIn(m, 2)) / 100))} 📊` },
  { id: 3, re: /(?:جذر|ریشه(?:\s*دوم)?)\s*(?:از\s*)?(\d+)/i,
    reply: (m) => `√${toPersianDigits(m[1])} = ${toPersianDigits(String(Math.sqrt(numIn(m))))}` },
  { id: 4, re: /(\d+)\s*(?:به\s*توان|توان)\s*(\d+)/i,
    reply: (m) => `${toPersianDigits(m[1])}^${toPersianDigits(m[2])} = ${toPersianDigits(String(Math.pow(numIn(m), numIn(m, 2))))}` },
  { id: 5, re: /فاکتوریل\s*(\d+)/i,
    reply: (m) => {
      const n = Math.min(numIn(m), 20);
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return `${toPersianDigits(m[1])}! = ${toPersianDigits(String(r))}`;
    } },
  { id: 6, re: /فیبوناچی\s*(\d+)/i,
    reply: (m) => {
      const n = Math.min(numIn(m), 40);
      let a = 0, b = 1;
      for (let i = 0; i < n; i++) [a, b] = [b, a + b];
      return `فیبوناچی(${toPersianDigits(m[1])}) = ${toPersianDigits(String(a))} 🔢`;
    } },
  { id: 7, re: /عدد\s*(\d+)\s*(?:اول|اوله|عدد\s*اول)/i,
    reply: (m) => {
      const n = numIn(m);
      let p = n > 1;
      for (let i = 2; i * i <= n && p; i++) if (n % i === 0) p = false;
      return p ? `✅ بله، ${toPersianDigits(m[1])} عدد اول است.` : `❌ نه، ${toPersianDigits(m[1])} اول نیست.`;
    } },
  { id: 8, re: /(?:ب\.م\.م|بم‌م|gcd)\s*(\d+)\s*(?:و|,)\s*(\d+)/i,
    reply: (m) => {
      let a = numIn(m), b = numIn(m, 2);
      while (b) [a, b] = [b, a % b];
      return `ب.م.م = ${toPersianDigits(String(a))}`;
    } },
  { id: 9, re: /(?:ک\.م\.م|کم‌م|lcm)\s*(\d+)\s*(?:و|,)\s*(\d+)/i,
    reply: (m) => {
      const a = numIn(m), b = numIn(m, 2);
      const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
      return `ک.م.م = ${toPersianDigits(String((a * b) / g(a, b)))}`;
    } },
  { id: 10, re: /(?:عدد|یه\s*عدد)?\s*تصادفی(?:\s*بین\s*(\d+)\s*(?:تا|و)\s*(\d+))?/i,
    reply: (m) => {
      const lo = m[1] ? numIn(m) : 1;
      const hi = m[2] ? numIn(m, 2) : 100;
      return `🎲 عدد تصادفی: ${toPersianDigits(String(Math.floor(Math.random() * (hi - lo + 1)) + lo))}`;
    } },
  { id: 11, re: /(?:تاس|dice)(?:\s*(\d+)d(\d+))?/i,
    reply: (m) => {
      const count = m[1] ? Math.min(numIn(m), 6) : 1;
      const sides = m[2] ? Math.min(numIn(m, 2), 100) : 6;
      const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
      return `🎲 تاس: ${rolls.map((r) => toPersianDigits(String(r))).join("، ")}`;
    } },
  { id: 12, re: /شیر\s*یا\s*خط|سکه|coin\s*flip/i,
    reply: () => `🪙 ${pick(["شیر!", "خط!"])}` },
  { id: 13, re: /سنگ\s*کاغذ\s*قیچی|rock\s*paper/i,
    reply: () => `✊✋✌️ من ${pick(["سنگ", "کاغذ", "قیچی"])} آوردم!` },
  { id: 14, re: /عدد\s*(\d+)\s*(?:زوج|فرد)/i,
    reply: (m) => (numIn(m) % 2 === 0 ? `✅ ${toPersianDigits(m[1])} زوج است.` : `✅ ${toPersianDigits(m[1])} فرد است.`) },
  { id: 15, re: /(?:عدد\s*)?(\d+)\s*(?:رو|را)?\s*به\s*حروف/i,
    reply: (m) => `🔢 ${toPersianDigits(m[1])} = «${faNumWords(numIn(m))}»` },

  /* ===== تبدیل واحد (۱۶–۲۷) ===== */
  { id: 16, re: /(\d+)\s*(?:کیلومتر|km)\s*(?:به|→)?\s*(?:مایل|mile)/i,
    reply: (m) => `${toPersianDigits(m[1])} کیلومتر ≈ ${toPersianDigits(String(Math.round(numIn(m) * 0.621)))} مایل 🛣️` },
  { id: 17, re: /(\d+)\s*(?:کیلوگرم|کیلو|kg)\s*(?:به|→)?\s*(?:پوند|lb)/i,
    reply: (m) => `${toPersianDigits(m[1])} کیلو ≈ ${toPersianDigits(String(Math.round(numIn(m) * 2.205)))} پوند ⚖️` },
  { id: 18, re: /(?:دما\s*)?(-?\d+)\s*(?:درجه)?\s*(?:سلسیوس|سانتی|c)\s*(?:به|→)?\s*(?:فارنهایت|f)/i,
    reply: (m) => `${toPersianDigits(m[1])}°C = ${toPersianDigits(String(Math.round(numIn(m) * 1.8 + 32)))}°F 🌡️` },
  { id: 19, re: /(\d+)\s*(?:متر|m)\s*(?:به|→)?\s*(?:فوت|پا|feet)/i,
    reply: (m) => `${toPersianDigits(m[1])} متر ≈ ${toPersianDigits(String(Math.round(numIn(m) * 3.284)))} فوت 📏` },
  { id: 20, re: /(\d+)\s*(?:لیتر|liter)\s*(?:به|→)?\s*(?:گالن|gallon)/i,
    reply: (m) => `${toPersianDigits(m[1])} لیتر ≈ ${toPersianDigits(String(Math.round(numIn(m) * 0.264 * 100) / 100))} گالن 🧴` },
  { id: 21, re: /(\d+)\s*(?:مگابایت|مگ|mb)\s*(?:به|→)?\s*(?:گیگابایت|گیگ|gb)/i,
    reply: (m) => `${toPersianDigits(m[1])} مگ = ${toPersianDigits(String(Math.round((numIn(m) / 1024) * 1000) / 1000))} گیگ 💾` },
  { id: 22, re: /(\d+)\s*(?:اینچ|inch)\s*(?:به|→)?\s*(?:سانتی|cm)/i,
    reply: (m) => `${toPersianDigits(m[1])} اینچ = ${toPersianDigits(String(Math.round(numIn(m) * 2.54 * 100) / 100))} سانتی‌متر` },
  { id: 23, re: /(\d+)\s*(?:انس|ounce|oz)\s*(?:به|→)?\s*(?:گرم|gram|g)/i,
    reply: (m) => `${toPersianDigits(m[1])} انس ≈ ${toPersianDigits(String(Math.round(numIn(m) * 28.35)))} گرم` },
  { id: 24, re: /(\d+)\s*(?:کیلومتر\s*بر\s*ساعت|km\/h)\s*(?:به|→)?\s*(?:متر\s*بر\s*ثانیه|m\/s)/i,
    reply: (m) => `${toPersianDigits(m[1])} km/h ≈ ${toPersianDigits(String(Math.round((numIn(m) / 3.6) * 100) / 100))} m/s 🚗` },
  { id: 25, re: /(\d+)\s*(?:دقیقه|minute|min)\s*(?:به|→)?\s*(?:ثانیه|second|sec)/i,
    reply: (m) => `${toPersianDigits(m[1])} دقیقه = ${toPersianDigits(String(numIn(m) * 60))} ثانیه ⏱️` },
  { id: 26, re: /(\d+)\s*(?:روز|day)\s*(?:به|→)?\s*(?:ساعت|hour)/i,
    reply: (m) => `${toPersianDigits(m[1])} روز = ${toPersianDigits(String(numIn(m) * 24))} ساعت 📅` },
  { id: 27, re: /(\d+)\s*(?:گرم|gram|g)\s*(?:به|→)?\s*(?:کیلو|kg)/i,
    reply: (m) => `${toPersianDigits(m[1])} گرم = ${toPersianDigits(String(Math.round((numIn(m) / 1000) * 10000) / 10000))} کیلو` },

  /* ===== تاریخ و زمان (۲۸–۳۵) ===== */
  { id: 28, re: /روز\s*هفته(?:\s*تاریخ)?\s*(\d{4}\/\d{1,2}\/\d{1,2})?/i,
    reply: (m) => {
      if (!m[1]) return `امروز ${new Date().toLocaleDateString("fa-IR", { weekday: "long" })} است 📅`;
      return `تاریخ ${toPersianDigits(m[1])}: (تبدیل تاریخ شمسی نیاز به مدل دارد — اما امروز ${new Date().toLocaleDateString("fa-IR", { weekday: "long" })} است)`;
    } },
  { id: 29, re: /(?:سن|سالم)\s*(\d{4}\/\d{1,2}\/\d{1,2})|(?:متولد)\s*(\d{4}\/\d{1,2}\/\d{1,2})/i,
    reply: () => `🎂 برای محاسبهٔ سن دقیق، سال تولدت را بگو (مثلاً: «۱۳۷۰ به دنیا اومدم چند سالمه؟»)` },
  { id: 30, re: /(\d{1,2})\s*سال(?:ه)?\s*(?:به|تو)\s*دنیا\s*اومدم|متولد\s*(\d{4})/i,
    reply: (m) => {
      const birth = numIn(m) || numIn(m, 2);
      const age = new Date().getFullYear() - 621 - birth; // سال شمسی تقریبی
      return `🎂 حدوداً ${toPersianDigits(String(Math.max(0, age)))} سالته!`;
    } },
  { id: 31, re: /تا\s*ساعت\s*(\d{1,2}(?::\d{2})?)\s*چند/i,
    reply: (m) => {
      const [h, mi] = toEnglishDigits(m[1]).split(":").map(Number);
      const now = new Date();
      const target = new Date(now);
      target.setHours(h, mi ?? 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const diff = Math.round((target.getTime() - now.getTime()) / 60000);
      return `⏳ تا ساعت ${toPersianDigits(m[1])}: ${toPersianDigits(String(Math.floor(diff / 60)))} ساعت و ${toPersianDigits(String(diff % 60))} دقیقه مونده.`;
    } },
  { id: 32, re: /اگه\s*الان\s*بخوابم\s*تا\s*ساعت\s*(\d{1,2})/i,
    reply: (m) => {
      const target = numIn(m);
      const h = new Date().getHours();
      let hours = target - h;
      if (hours <= 0) hours += 24;
      return `😴 حدود ${toPersianDigits(String(hours))} ساعت می‌خوابی — خواب خوبی باشه!`;
    } },
  { id: 33, re: /(?:کبیسه|leap)\s*(?:سال\s*)?(\d{4})?/i,
    reply: (m) => {
      const y = m[1] ? numIn(m) : 1404;
      const leap = y % 33 === 1 || y % 33 === 5 || y % 33 === 9 || y % 33 === 13 || y % 33 === 17 || y % 33 === 22 || y % 33 === 26 || y % 33 === 30;
      return leap ? `✅ ${toPersianDigits(m[1] ?? String(y))} کبیسه است (۳۶۶ روز).` : `❌ ${toPersianDigits(m[1] ?? String(y))} کبیسه نیست (۳۶۵ روز).`;
    } },
  { id: 34, re: /تایم\s*استمپ|unix\s*time|epoch/i,
    reply: () => `⏱️ تایم‌استمپ الان: ${toPersianDigits(String(Math.floor(Date.now() / 1000)))}` },
  { id: 35, re: /الان\s*چه\s*فصلیه|فصل\s*الان/i,
    reply: () => {
      const m = new Date().getMonth() + 1;
      const season = m <= 5 ? "بهار" : m <= 8 ? "تابستان" : m <= 10 ? "پاییز" : "زمستان";
      return `🍂 الان فصل ${season} است.`;
    } },

  /* ===== متن (۳۶–۴۵) ===== */
  { id: 36, re: /(?:«?([\u0600-\u06FF\w\s]{2,40})»?)\s*چند\s*حرف(?:ی)?\s*داره/,
    reply: (m) => `🔤 «${m[1].trim()}» = ${toPersianDigits(String(m[1].replace(/\s/g, "").length))} حرف` },
  { id: 37, re: /(?:«?([\u0600-\u06FF\w\s]{2,60})»?)\s*چند\s*کلمه/,
    reply: (m) => `📝 = ${toPersianDigits(String(m[1].trim().split(/\s+/).length))} کلمه` },
  { id: 38, re: /(?:برعکس|معکوس)(?:ش|ش\s*)?\s*کن\s*[:؛]?\s*(.+)|معکوس\s*«?([\u0600-\u06FF\w\s]{2,40})»?/,
    reply: (m) => `🔄 ${(m[1] || m[2] || "").trim().split("").reverse().join("")}` },
  { id: 39, re: /«?([\u0600-\u06FF\w\s]{2,40})»?\s*رو\s*(بزرگ|کوچک|کپیتال)/i,
    reply: (m) => {
      const s = m[1].trim();
      return m[2] === "کوچک" ? `🔠 ${s.toLowerCase()}` : `🔠 ${s.toUpperCase()}`;
    } },
  { id: 40, re: /به\s*مورس(?:\s*تبدیل)?\s*(?:کن)?\s*[:؛]?\s*(.+)/i,
    reply: (m) => {
      const map: Record<string, string> = { a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--.." };
      const out = m[1].toLowerCase().split("").map((c) => map[c] ?? (c === " " ? " / " : c)).join(" ");
      return `📡 مورس: ${out}`;
    } },
  { id: 41, re: /(?:base64|بیس\s*۶۴)\s*(?:کن|انکود)?\s*[:؛]?\s*(.+)/i,
    reply: (m) => `🔐 base64: ${Buffer.from(m[1].trim(), "utf8").toString("base64")}` },
  { id: 42, re: /(?:base64|بیس\s*۶۴)\s*(?:برگردون|دیکد|decode)\s*[:؛]?\s*([A-Za-z0-9+/=]{4,})/i,
    reply: (m) => `🔓 متن: ${Buffer.from(m[1].trim(), "base64").toString("utf8")}` },
  { id: 43, re: /«?([\u0600-\u06FF\w\s]{2,30})»?\s*(?:پالیندروم|آینه‌ای)(?:ه|است)?/i,
    reply: (m) => {
      const s = m[1].replace(/\s/g, "").toLowerCase();
      const r = s.split("").reverse().join("");
      return s === r ? `✅ بله، «${m[1].trim()}» آینه‌ای است!` : `❌ نه، آینه‌ای نیست (برعکسش: ${r})`;
    } },
  { id: 44, re: /(\d+)\s*بار\s*(?:تکرار|بگو)\s*[:؛]?\s*(.+)/i,
    reply: (m) => {
      const n = Math.min(numIn(m), 10);
      return `🔁 ${Array.from({ length: n }, () => m[2].trim()).join(" | ")}`;
    } },
  { id: 45, re: /اول\s*هر\s*کلمه(?:\s*از)?\s*[:؛]?\s*(.+)/i,
    reply: (m) => `✳️ ${m[1].trim().split(/\s+/).map((w) => w[0]).join("")}` },

  /* ===== سرگرمی (۴۶–۵۷) ===== */
  { id: 46, re: /(?:لطیفه|جوک|بخندونم|بگو\s*بخندم)/i, reply: () => pick(JOKES) },
  { id: 47, re: /(?:معما|پازل|谜)/i, reply: () => pick(RIDDLES) },
  { id: 48, re: /زبان‌بند|tongue/i, reply: () => pick(TONGUE_TWISTERS) },
  { id: 49, re: /ضرب‌المثل|مثل\s*قدیمی/i, reply: () => pick(PROVERBS) },
  { id: 50, re: /(?:شعر|بیت)\s*(?:یه|یک)?/i, reply: () => pick(POEMS) },
  { id: 51, re: /انگیزشی|جمله\s*انگیزه|motivat/i, reply: () => pick(QUOTES) },
  { id: 52, re: /تعریف(?:م|مون)?\s*(?:کن)?|تعریف\s*از\s*من/i,
    reply: (_m, ctx) => `😊 ${pick(["تو آدم فوق‌العاده‌ای هستی", "انرژی مثبتت عالیه", "هوشت حرف نداره", "همیشه می‌تونی روش حساب کنم"])}${ctx.settings.userName ? ` ${ctx.settings.userName} عزیز!` : "!"}` },
  { id: 53, re: /گوی\s*جادویی|magic\s*8|فال\s*بگیر/i,
    reply: () => `🎱 ${pick(["بله، قطعاً!", "به نظرم آره", "بعداً دوباره بپرس", "جواب منفیه", "خیلی مطمئن نیستم..."])}` },
  { id: 54, re: /از\s*بین\s*(.+?)\s*(?:یکی|یه دونه)?\s*انتخاب\s*کن/i,
    reply: (m) => {
      const items = m[1].split(/[,، و\/]+/).filter((x) => x.trim());
      return items.length ? `🎯 انتخاب من: «${pick(items).trim()}»` : "لیستی ندیدم! مثلاً بگو: از بین سیب و موز انتخاب کن";
    } },
  { id: 55, re: /^(?:آره\s*یا\s*نه|بله\s*یا\s*خیر|yes\s*or\s*no)/i,
    reply: () => pick(["آره! 👍", "نه 👎", "شاید... 🤔"]) },
  { id: 56, re: /جرات\s*یا\s*حقیقت|truth\s*or\s*dare/i,
    reply: () => pick(["🎲 حقیقت: آخرین باری که خندیدی کی بود؟", "🎲 جرات: ۱۰ ثانیه از جایت بلند شو و بپر!"]) },
  { id: 57, re: /شروع\s*داستان|داستان\s*بگو|story/i, reply: () => pick(STORY_STARTERS) },

  /* ===== فارسی (۵۸–۶۵) ===== */
  { id: 58, re: /«?([\u0600-\u06FF]{2,20})»?\s*(?:به\s*)?انگلیسی(?:\s*چی\s*می‌شه|\s*ترجمه)?/i,
    reply: (m) => {
      const w = m[1].trim();
      return FA_EN[w] ? `🇬🇧 «${w}» = ${FA_EN[w]}` : `این کلمه را در دیکشنری آفلاینم ندارم؛ ولی «سلام» = hello مثلاً!`;
    } },
  { id: 59, re: /«?([a-zA-Z]{2,20})»?\s*(?:به\s*)?فارسی(?:\s*چی\s*می‌شه|\s*ترجمه)?/i,
    reply: (m) => {
      const w = m[1].trim().toLowerCase();
      return EN_FA[w] ? `🇮🇷 «${w}» = ${EN_FA[w]}` : `این کلمه در دیکشنری آفلاین نیست؛ مثلاً hello = سلام`;
    } },
  { id: 60, re: /الفبا\s*چند\s*حرف/i, reply: () => `🔤 الفبای فارسی ۳۲ حرف است.` },
  { id: 61, re: /ماه‌های\s*(?:شمسی|هجری)/i,
    reply: () => `📅 فروردین، اردیبهشت، خرداد، تیر، مرداد، شهریور، مهر، آبان، آذر، دی، بهمن، اسفند` },
  { id: 62, re: /ماه‌های\s*(?:میلادی|انگلیسی)/i,
    reply: () => `📅 January, February, March, April, May, June, July, August, September, October, November, December` },
  { id: 63, re: /اعداد\s*فارسی|اعداد\s*به\s*فارسی/i,
    reply: () => `۱=یک ۲=دو ۳=سه ۴=چهار ۵=پنج ۶=شش ۷=هفت ۸=هشت ۹=نه ۱۰=ده` },
  { id: 64, re: /معنی\s*«?([\u0600-\u06FF\s]{4,30})»?/i,
    reply: (m) => {
      const prov = PROVERBS.find((p) => p.includes(m[1].trim().slice(0, 6)));
      return prov ? prov : `معنی دقیق این عبارت را از مدل آنلاین بپرس — من در حالت آفلاین چند ضرب‌المثل معروف را بلدم: ${pick(PROVERBS)}`;
    } },
  { id: 65, re: /فینگیلیش\s*چیه|چطور\s*فینگیلیش/i,
    reply: () => `✍️ فینگیلیش یعنی فارسی را با حروف انگلیسی بنویسی — مثلاً «salam» یا «biya donbalam». من هر دو را می‌فهمم!` },

  /* ===== ماینکرفت (۶۶–۷۵) ===== */
  { id: 66, re: /میز\s*کرافت|crafting\s*table/i, reply: () => MC_RECIPES.table },
  { id: 67, re: /مشعل|torch/i, reply: () => MC_RECIPES.torch },
  { id: 68, re: /کلنگ|pickaxe/i, reply: () => MC_RECIPES.pickaxe },
  { id: 69, re: /کوره|فِرنِس|furnace/i, reply: () => MC_RECIPES.furnace },
  { id: 70, re: /الماس\s*(?:تو|در)\s*چه\s*لایه|الماس\s*کجاست|diamond\s*level/i,
    reply: () => `💎 بهترین لایه برای الماس: Y = -59 تا -54 (زیر Y=0). با کلنگ آهنی یا الماسی!` },
  { id: 71, re: /پورتال\s*ندر|نِدر\s*پورتال|nether\s*portal/i,
    reply: () => `🔥 پورتال ندر: قاب ۴×۵ از ابسیدین (حداقل ۱۰ تا)، بعد با فندک (Flint & Steel) آتشش بزن!` },
  { id: 72, re: /ابسیدین|obsidian/i,
    reply: () => `🟣 ابسیدین: آب روی گدازهٔ آرام بریز. برای برش حتماً کلنگ الماسی لازمه!` },
  { id: 73, re: /کریپر|creeper/i,
    reply: () => `💚 با کریپر: ازش فاصله بگیر یا گربه پیش خودت داشته باش (کریپر از گربه می‌ترسد!). اگه منفجر شد، بدو!` },
  { id: 74, re: /ویلیجر|villager|دِلِه/i,
    reply: () => `🧑‍🌾 ویلیجر: با کار (کتابخانه، آهنگری و...) ترید بهتر می‌ده. تریدها وقتی بازاریابی می‌کنی قفل موقت می‌خورن.` },
  { id: 75, re: /زره|armor/i, reply: () => `🛡️ ترتیب زره از ضعیف به قوی: چرم ← آهن ← زنجیری ← طلایی ← الماسی ← نِثریت. کامل‌ترین حفاظت = الماسی/نثریت!` },

  /* ===== کاربردی (۷۶–۸۵) ===== */
  { id: 76, re: /پسورد|رمز\s*عبور\s*(?:بساز|تولید|تصادفی)/i,
    reply: () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
      const pw = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      return `🔐 پسورد پیشنهادی: \`${pw}\` — قوی و امن!`;
    } },
  { id: 77, re: /(?:bmi|بی‌ام‌ای|شاخص\s*توده)\s*(\d+)\s*(?:کیلو)?\s*(?:و|,)?\s*(\d+)\s*(?:سانتی)?/i,
    reply: (m) => {
      const kg = numIn(m), cm = numIn(m, 2);
      const bmi = kg / Math.pow(cm / 100, 2);
      const state = bmi < 18.5 ? "کمبود وزن" : bmi < 25 ? "نرمال ✅" : bmi < 30 ? "اضافه‌وزن" : "چاقی";
      return `⚖️ BMI شما: ${toPersianDigits(String(Math.round(bmi * 10) / 10))} — ${state}`;
    } },
  { id: 78, re: /انعام\s*(\d+)\s*درصد(?:\s*از)?\s*(\d+)/i,
    reply: (m) => `💵 انعام ${toPersianDigits(m[1])}٪ از ${toPersianDigits(m[2])} = ${toPersianDigits(String(Math.round((numIn(m) * numIn(m, 2)) / 100)))}` },
  { id: 79, re: /تخفیف\s*(\d+)\s*درصد(?:\s*از)?\s*(\d+)/i,
    reply: (m) => {
      const off = (numIn(m) * numIn(m, 2)) / 100;
      return `🏷️ قیمت بعد از تخفیف: ${toPersianDigits(String(numIn(m, 2) - off))} (سود شما: ${toPersianDigits(String(off))})`;
    } },
  { id: 80, re: /میانگین\s*([\d\s,،و]+)/i,
    reply: (m) => {
      const nums = m[1].split(/[\s,،و]+/).map((x) => Number(toEnglishDigits(x))).filter((n) => Number.isFinite(n));
      return nums.length ? `📊 میانگین: ${toPersianDigits(String(Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100))}` : "اعداد را درست بنویس: میانگین ۱۰ و ۲۰ و ۳۰";
    } },
  { id: 81, re: /مساحت\s*مستطیل\s*(\d+)\s*(?:در|×|x)\s*(\d+)/i,
    reply: (m) => `📐 مساحت = ${toPersianDigits(String(numIn(m) * numIn(m, 2)))} واحد مربع` },
  { id: 82, re: /مساحت\s*دایره(?:\s*شعاع)?\s*(\d+)/i,
    reply: (m) => `⭕ مساحت ≈ ${toPersianDigits(String(Math.round(Math.PI * numIn(m) * numIn(m) * 100) / 100))} واحد مربع` },
  { id: 83, re: /با\s*سرعت\s*(\d+)(?:.*?)(\d+)\s*(?:ساعت|دقیقه)/i,
    reply: (m) => `🚗 مسافت ≈ ${toPersianDigits(String(numIn(m) * numIn(m, 2)))} کیلومتر` },
  { id: 84, re: /حساب\s*(\d+)\s*نفره\s*(\d+)/i,
    reply: (m) => `🧾 سهم هر نفر: ${toPersianDigits(String(Math.round(numIn(m, 2) / numIn(m))))}` },
  { id: 85, re: /(\d+)\s*روز\s*(?:دیگه|دیگر|تا)/i,
    reply: (m) => `📅 ${toPersianDigits(m[1])} روز دیگه ≈ ${toPersianDigits(String(Math.round(numIn(m) / 7)))} هفته و ${toPersianDigits(String(numIn(m) % 7))} روز.` },

  /* ===== حال‌وهوش (۸۶–۹۳) ===== */
  { id: 86, re: /صبح\s*بخیر/i,
    reply: (_m, ctx) => `☀️ صبح بخیر${ctx.settings.userName ? ` ${ctx.settings.userName}` : ""} عزیز! روز قشنگی داشته باشی.` },
  { id: 87, re: /شب\s*بخیر/i,
    reply: () => `🌙 شب بخیر! خواب‌های خوب ببینی. 😴` },
  { id: 88, re: /حالت\s*چطوره|خوبی|چطوری/i,
    reply: (_m, ctx) => `😊 ممنون، عالی‌ام! ممنون که پرسیدی${ctx.settings.userName ? ` ${ctx.settings.userName}` : ""} جان. تو چطوری؟` },
  { id: 89, re: /دوستت\s*دارم/i,
    reply: () => `❤️ منم همین‌طور! خوشحالم که کنارتم.` },
  { id: 90, re: /حوصله‌?م\s*سر\s*رفته|کسل\s*شدم|حوصله\s*ندارم/i,
    reply: () => pick([...JOKES, ...STORY_STARTERS, "🎮 بریم ماینکرفت؟ بهم بگو «محافظت کن» تا همراهت بازی کنم!"]) },
  { id: 91, re: /ناراحتم|غمگینم|افسرده/i,
    reply: () => `💙 ناراحتیت رو می‌فهمم. یه نفس عمیق بکش... من اینجام. اگه خواستی حرف بزنی، گوش می‌دم. ${pick(QUOTES)}` },
  { id: 92, re: /عصبانی|خشمگین|عصبی/i,
    reply: () => `🧘 آروم باش... چند ثانیه چشماتو ببند و نفس بکش. بعدش با خیال راحت بهم بگو چی شده.` },
  { id: 93, re: /انگیزه\s*بده|دلم\s*می‌خواد\s*بی‌خیال/i, reply: () => pick(QUOTES) },

  /* ===== دانش (۹۴–۱۰۰) ===== */
  { id: 94, re: /سرعت\s*نور/i, reply: () => `💡 سرعت نور ≈ ۲۹۹٬۷۹۲٬۴۵۸ متر بر ثانیه (تقریباً ۳۰۰ هزار کیلومتر در ثانیه!)` },
  { id: 95, re: /سیاره‌?ها|منظومه\s*شمسی/i,
    reply: () => `🪐 ترتیب سیاره‌ها: تیر، ناهید، زمین، مریخ، مشتری، زحل، اورانوس، نپتون` },
  { id: 96, re: /فرمول\s*آب|آب\s*از\s*چی\s*درست/i, reply: () => `💧 فرمول آب: H₂O = دو اتم هیدروژن + یک اتم اکسیژن` },
  { id: 97, re: /بزرگ‌ترین\s*حیوان/i, reply: () => `🐋 بزرگ‌ترین حیوان جهان: نهنگ آبی (تا ۳۰ متر و ۲۰۰ تن!)` },
  { id: 98, re: /سال\s*چند\s*روز/i, reply: () => `📅 سال شمسی معمولی: ۳۶۵ روز (کبیسه: ۳۶۶) — سال میلادی هم همین‌طور.` },
  { id: 99, re: /کوچک‌ترین\s*عدد\s*اول/i, reply: () => `🔢 کوچک‌ترین عدد اول: ۲ (و تنها عدد اول زوج!)` },
  { id: 100, re: /عدد\s*پی|pi/i, reply: () => `🥧 عدد پی (π) ≈ ۳.۱۴۱۵۹ — نسبت محیط دایره به قطرش!` }
];

/**
 * مرز واژه: جلوی تطبیق‌های تصادفی داخلِ واژه‌های بزرگ‌تر را می‌گیرد.
 * مثال: الگوی «معما» نباید داخلِ واژهٔ «معماری» جور شود (که قبلاً اتفاق می‌افتاد
 * و به‌جای جواب واقعی، معمای آماده به کاربر نشان داده می‌شد).
 */
const LETTER_RE = /[\p{L}\p{N}]/u;

/** آیا جای تطبیق، مرزِ مستقلِ واژه دارد؟ */
function isWholeWordMatch(text: string, match: RegExpMatchArray): boolean {
  const index = match.index;
  if (index === undefined) return true;
  const raw = match[0] ?? "";
  if (!raw) return true;
  const start = index;
  let end = index + raw.length;
  // «ی» اضافهٔ اضافه در فارسی («معمای خوب») مرز محسوب نمی‌شود
  if (text[end] === "ی" && !LETTER_RE.test(text[end + 1] ?? " ")) end += 1;
  const before = start > 0 ? text[start - 1] : "";
  const after = end < text.length ? text[end] : "";
  if (before && LETTER_RE.test(before)) return false;
  if (after && LETTER_RE.test(after)) return false;
  return true;
}

/**
 * پیدا کردن مهارت مناسب — null یعنی به مدل سپرده شود
 * برگرداندن null از داخل reply یعنی الگو جور بود ولی محاسبه نشد → ادامه
 */
export function skillReply(text: string, ctx: OfflineContext): string | null {
  const t = text.trim();
  if (t.length < 2 || t.length > 200) return null;
  // نسخهٔ ارقام انگلیسی — تا الگوهای \d با «۱۲۳» فارسی هم جور شوند
  const tEn = toEnglishDigits(t);
  for (const s of SKILLS) {
    let matchedText = t;
    let m = t.match(s.re);
    if (!m) {
      matchedText = tEn;
      m = tEn.match(s.re);
    }
    if (!m) continue;
    // تطبیقِ چسبیده به واژه‌ای بزرگ‌تر نادیده گرفته می‌شود (مثل «معماری» ≠ «معما»)
    if (!isWholeWordMatch(matchedText, m)) continue;
    try {
      const out = s.reply(m, ctx);
      if (out && typeof out === "string") return out;
    } catch {
      /* مهارت بعدی */
    }
  }
  return null;
}

/** شمارش مهارت‌ها (برای راهنما) */
export const SKILL_COUNT = SKILLS.length;
