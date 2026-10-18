/**
 * مغز آفلاین (Offline Brain)
 * وقتی کلید API تنظیم نشده یا اینترنت قطع است، پاسخ‌های محلی و سریع
 * ساعت، تاریخ، نام، حافظه، راهنما و دستورهای ماینکرفت — بدون هیچ خطا
 */
import type { AppSettings, MemoryDTO } from "@/lib/types";
import { configLooksComplete, resolveConfig } from "@/lib/providers";
import { jalaliDate, jalaliDateTime, jalaliTime, toPersianDigits } from "@/lib/persian";
import { skillReply, SKILL_COUNT } from "@/lib/offline-skills";

export interface OfflineContext {
  settings: AppSettings;
  memories: MemoryDTO[];
}

/** آیا پیام دربارهٔ ساعت است؟ */
function isTimeQuestion(text: string): boolean {
  return /(ساعت|وقت)(\s*(چنده|چند است|الان|امروز))?|چند\s*دقیقه|time/i.test(text);
}

/** آیا پیام دربارهٔ تاریخ است؟ */
function isDateQuestion(text: string): boolean {
  return /(تاریخ|امروز\s*چندمه|چندمه|روز\s*چنده|date)/i.test(text);
}

/** آیا پیام دربارهٔ نام/هویت دستیار یا کاربر است؟ */
function isNameQuestion(text: string): boolean {
  return /((?:اسم|نام)\s*(?:م|ت|من|تو|ش)|تو\s*کی\s*هستی|خودت\s*رو\s*معرفی|who are you|کی\s*هستی)/i.test(
    text
  );
}

/** آیا پیام دربارهٔ حافظه است؟ */
function isMemoryQuestion(text: string): boolean {
  return /(حافظه|یادت\s*(هست|مونده|هستش)|چی\s*یادت\s*مونده|memory)/i.test(text);
}

/** آیا پیام درخواست راهنماست؟ */
function isHelpRequest(text: string): boolean {
  return /(راهنما|کمک|چیکار\s*می‌تونی|چه\s*کارهایی|قابلیت|دستورات|help)/i.test(text);
}

/** آیا احوال‌پرسی است؟ */
function isGreeting(text: string): boolean {
  return /^(سلام|درود|سلام\s*علیک|های|hi|hello|خوبی|حالت\s*چطوره|چطوری)/i.test(
    text.trim()
  );
}

/** آیا تشکر است؟ */
function isThanks(text: string): boolean {
  return /(ممنون|مرسی|سپاس|متشکرم|thanks|thank you)/i.test(text);
}

/**
 * تولید پاسخ آفلاین — همیشه موفق، همیشه سریع، همیشه فارسی طبیعی
 */
/**
 * پاسخ فوری برای سؤال‌های محلی (ساعت/تاریخ/حافظه/راهنما) — تأخیر تقریباً صفر
 * null یعنی باید به مدل سپرده شود.
 */
export function localFastReply(text: string, ctx: OfflineContext): string | null {
  const t = text.trim();
  // ۱۰۰ مهارت آفلاین — اول از همه (ریاضی، تبدیل، سرگرمی، ماینکرفت و...)
  const skill = skillReply(t, ctx);
  if (skill) return skill;
  if (isTimeQuestion(t)) {
    return `الان ساعت ${toPersianDigits(jalaliTime())} هست (به وقت تهران). ⏰`;
  }
  if (isDateQuestion(t)) {
    return `امروز ${jalaliDate()} هست.`;
  }
  if (/(تاریخ\s*و\s*ساعت|ساعت\s*و\s*تاریخ)/.test(t)) {
    return `الان ${jalaliDateTime()} هست.`;
  }
  // نام و هویت — جواب آنی (بدون مدل) برای حداقل تأخیر
  if (isNameQuestion(t)) {
    return offlineReply(t, ctx);
  }
  if (isMemoryQuestion(t)) {
    return offlineReply(t, ctx);
  }
  if (isHelpRequest(t)) {
    return offlineReply(t, ctx);
  }
  return null;
}

export function offlineReply(text: string, ctx: OfflineContext): string {
  const { settings, memories } = ctx;
  const name = settings.assistantName || "دستیار";
  const t = text.trim();

  // ۱۰۰ مهارت آفلاین (ریاضی، تبدیل واحد، تاریخ، متن، سرگرمی، فارسی، ماینکرفت، کاربردی، حال‌وهوش، دانش)
  const skill = skillReply(t, ctx);
  if (skill) return skill;

  // ساعت
  if (isTimeQuestion(t)) {
    return `الان ساعت ${toPersianDigits(jalaliTime())} هست (به وقت تهران). ⏰`;
  }

  // تاریخ
  if (isDateQuestion(t)) {
    return `امروز ${jalaliDate()} هست.`;
  }

  // تاریخ و ساعت با هم
  if (/(تاریخ\s*و\s*ساعت|ساعت\s*و\s*تاریخ)/.test(t)) {
    return `الان ${jalaliDateTime()} هست.`;
  }

  // نام و هویت
  if (isNameQuestion(t)) {
    const userName = memories.find((m) => m.category === "profile");
    const extra = userName
      ? `و طبق حافظه‌ام، تو ${userName.content.replace(/^نام کاربر /, "").replace(/ است\.?$/, "")} هستی.`
      : "";
    return `من «${name}» هستم؛ یک دستیار هوش مصنوعی شخصی که روی همین کامپیوتر خودت اجرا می‌شم. ${extra} الان در حالت آفلاین‌ام، ولی بازم می‌تونم کمکت کنم.`;
  }

  // حافظه
  if (isMemoryQuestion(t)) {
    if (memories.length === 0)
      return "هنوز هیچ حافظه‌ای ذخیره نشده. هر وقت خواستی بگو: «این رو یادت بمونه: ...» تا ثبت کنم.";
    const lines = memories
      .slice(0, 10)
      .map((m, i) => `${i + 1}. ${m.title}: ${m.content}`)
      .join("\n");
    return `اینا چیزاییه که ازت یادمه:\n${lines}`;
  }

  // راهنما
  if (isHelpRequest(t)) {
    return `من «${name}» هستم و ${toPersianDigits(String(SKILL_COUNT))} قابلیت آفلاین دارم (بدون اینترنت و بدون تاخیر!):
🧮 ریاضی: «۵+۵ چنده»، «۲۰ درصد ۱۵۰»، «فاکتوریل ۵»، «تاس بریز»، «شیر یا خط»
📏 تبدیل واحد: «۱۰ کیلومتر به مایل»، «۳۰ درجه سانتی به فارنهایت»، «۵۱۲ مگ به گیگ»
📅 تاریخ/زمان: ساعت، تاریخ، «تا ساعت ۵ چند مونده»، «۱۴۰۴ کبیسه‌ست؟»
🔤 متن: «به مورس تبدیل کن سلام»، «base64 کن»، «برعکسش کن»، «چند حرف داره»
😊 سرگرمی: جوک، معما، شعر، ضرب‌المثل، زبان‌بند، گوی جادویی، «سنگ کاغذ قیچی»
🎮 ماینکرفت: رسپی‌ها، «الماس تو چه لایه‌ای»، «پورتال ندر»، ترفندها
🔐 کاربردی: «پسورد بساز»، BMI، انعام، تخفیف، میانگین، مساحت
📚 فارسی: ترجمهٔ لغات رایج، معنی ضرب‌المثل، ماه‌های شمسی/میلادی
🧠 حافظه: «این رو یادت بمونه: ...» / «این رو فراموش کن: ...»
🎮 ماینکرفت: «بیا دنبالم»، «وایسا»، «محافظت کن»، «اتوکلیک روشن»، «برگرد»
💬 و کلی چیز دیگه — هرچه بپرسی اگر از این ۱۰۰ مهارت باشد، فوری جواب می‌گیری!`;
  }

  // احوال‌پرسی
  if (isGreeting(t)) {
    const user = settings.userName?.trim();
    return `سلام${user ? ` ${user}` : ""}! خوش اومدی. 😊 من «${name}»‌ام. الان حالت آفلاینه، ولی در خدمتم. چیکار کنم؟`;
  }

  // تشکر
  if (isThanks(t)) {
    return "خواهش می‌کنم! هر وقت کاری داشتی در خدمتم.";
  }

  // پاسخ پیش‌فرض آفلاین
  return `الان حالت آفلاین‌ام (کلید API تنظیم نشده یا اینترنت قطعه)، ولی این کارا رو بدون مشکل انجام می‌دم: ساعت، تاریخ، حافظه، راهنما و همهٔ دستورهای ماینکرفت. برای جواب‌های کامل‌تر، از صفحهٔ تنظیمات یه ارائه‌دهنده وصل کن.`;
}

/** آیا ارائه‌دهنده آمادهٔ اتصال به LLM هست؟ */
export function isProviderReady(settings: AppSettings): boolean {
  // سرویس داخلی رایگان همیشه آماده است (بدون کلید) — اگر نبود، آفلاین جواب می‌دهد
  if (settings.provider === "builtin") return true;
  // بررسی روی پیکربندی نهایی (تنظیمات + پیش‌فرض‌ها + متغیرهای محیطی)
  try {
    const cfg = resolveConfig(settings);
    return configLooksComplete(cfg).ok;
  } catch {
    return false;
  }
}
