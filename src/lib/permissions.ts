/**
 * موتور دسترسی‌های Peak — تعریف مجوزها، پیش‌فرض‌ها و کمکی‌های اجرا
 *
 * اصل طلایی: Peak فقط به پوشهٔ دادهٔ خودش دسترسی دارد؛ بقیهٔ فایل‌های
 * سیستم برای همیشه قفل‌اند (در کد، نه فقط در ظاهر).
 */
import type { PermissionMap } from "@/lib/types";

export type PermissionCategory =
  | "privacy"
  | "voice"
  | "ai"
  | "minecraft"
  | "system";

export interface PermissionDef {
  key: keyof PermissionMap;
  label: string;
  desc: string;
  /** وقتی خاموش است چه اتفاقی می‌افتد */
  whenOff: string;
  category: PermissionCategory;
}

export const PERMISSION_CATEGORIES: {
  id: PermissionCategory;
  label: string;
}[] = [
  { id: "privacy", label: "حریم خصوصی و حافظه" },
  { id: "voice", label: "صدا و میکروفون" },
  { id: "ai", label: "هوش مصنوعی" },
  { id: "minecraft", label: "ماینکرفت" },
  { id: "system", label: "سیستم و برنامه" }
];

export const PERMISSION_DEFS: PermissionDef[] = [
  // حریم خصوصی و حافظه
  {
    key: "memoryRead",
    label: "خواندن حافظه",
    desc: "Peak می‌تواند خاطرات ذخیره‌شده را هنگام جواب دادن بخواند.",
    whenOff: "جواب‌ها بدون دانستن خاطرات قبلی داده می‌شوند.",
    category: "privacy"
  },
  {
    key: "memoryWrite",
    label: "نوشتن در حافظه",
    desc: "ذخیرهٔ خاطرات جدید — هم دستی («یادت بمونه») و هم خودکار.",
    whenOff: "هیچ خاطره‌ای ذخیره نمی‌شود.",
    category: "privacy"
  },
  {
    key: "memoryExtract",
    label: "استخراج خودکار خاطرات",
    desc: "یادآوری خودکار از حرف‌های مهم مکالمه (مثلاً اسم، ترجیح، هدف).",
    whenOff: "فقط خاطرات دستی ذخیره می‌شوند.",
    category: "privacy"
  },
  {
    key: "exportData",
    label: "خروجی گرفتن از داده‌ها",
    desc: "دانلود فایل JSON از حافظه و تنظیمات.",
    whenOff: "دکمهٔ خروجی کار نمی‌کند.",
    category: "privacy"
  },

  // صدا
  {
    key: "mic",
    label: "میکروفون",
    desc: "دسترسی به میکروفون برای گفتگوی صوتی و تشخیص گفتار فارسی.",
    whenOff: "گفتگوی صوتی کاملاً غیرفعال می‌شود.",
    category: "voice"
  },
  {
    key: "micContinuous",
    label: "شنود پیوسته (حالت مکالمه)",
    desc: "بعد از هر پاسخ، Peak دوباره گوش می‌دهد تا مکالمه روان بماند.",
    whenOff: "بعد از هر پاسخ، شنیدن متوقف می‌شود.",
    category: "voice"
  },
  {
    key: "ttsAuto",
    label: "حرف زدن خودکار",
    desc: "پخش صدای جواب‌ها بدون کلیک — همراه با پخش جمله‌به‌جملهٔ بدون تأخیر.",
    whenOff: "جواب‌ها فقط نوشته می‌شوند.",
    category: "voice"
  },
  {
    key: "ttsClick",
    label: "پخش صدا با کلیک",
    desc: "دکمهٔ 🔊 کنار پیام‌ها برای شنیدن دستی.",
    whenOff: "دکمهٔ پخش کار نمی‌کند.",
    category: "voice"
  },

  // هوش مصنوعی
  {
    key: "aiNetwork",
    label: "دسترسی اینترنتی مدل‌ها",
    desc: "ارتباط با مدل‌های هوش مصنوعی آنلاین (سرویس داخلی رایگان و مدل‌های دلخواه).",
    whenOff: "فقط «مغز آفلاین» (ساعت، تاریخ، حافظه، دستورها) جواب می‌دهد.",
    category: "ai"
  },

  // ماینکرفت
  {
    key: "minecraftConnect",
    label: "اتصال به ماینکرفت",
    desc: "وصل شدن ربات به سرور ماینکرفت.",
    whenOff: "هر اتصالی بلاک می‌شود.",
    category: "minecraft"
  },
  {
    key: "minecraftControl",
    label: "کنترل ربات",
    desc: "حرکت، دنبال کردن، جمع‌آوری بلوک و اجرای دستورها.",
    whenOff: "ربات فقط متصل می‌ماند و حرکتی نمی‌کند.",
    category: "minecraft"
  },
  {
    key: "minecraftGuard",
    label: "حالت محافظت (پلیسی)",
    desc: "حمله به موب‌های نزدیک برای محافظت از بازیکن 🛡️.",
    whenOff: "محافظت خودکار غیرفعال است.",
    category: "minecraft"
  },
  {
    key: "minecraftAutoAttack",
    label: "اتوکلیک / حملهٔ خودکار",
    desc: "زدن خودکار به نزدیک‌ترین هدف (هر ۳۰۰ میلی‌ثانیه) ⚔️.",
    whenOff: "فقط حمله‌های دستی اجرا می‌شوند.",
    category: "minecraft"
  },

  // سیستم
  {
    key: "settingsWrite",
    label: "تغییر تنظیمات",
    desc: "ذخیرهٔ تنظیمات برنامه (به جز دسترسی‌ها — آن‌ها همیشه قابل تغییرند).",
    whenOff: "تنظیمات قفل می‌شود؛ فقط دسترسی‌ها و کلید اضطراری کار می‌کنند.",
    category: "system"
  },
  {
    key: "notifications",
    label: "اعلان‌ها",
    desc: "اعلان‌های داخل برنامه (وضعیت ربات، خطاهای مهم).",
    whenOff: "اعلانی نشان داده نمی‌شود.",
    category: "system"
  },
  {
    key: "shellOpen",
    label: "باز کردن لینک‌ها",
    desc: "باز شدن آدرس‌های خارجی در مرورگر پیش‌فرض ویندوز.",
    whenOff: "لینک‌های خارجی باز نمی‌شوند.",
    category: "system"
  }
];

/** پیش‌فرض: همه‌چیز باز (کاربر هر چه خواست می‌بندد) */
export const DEFAULT_PERMISSIONS: PermissionMap = {
  memoryRead: true,
  memoryWrite: true,
  memoryExtract: true,
  exportData: true,
  mic: true,
  micContinuous: true,
  ttsAuto: true,
  ttsClick: true,
  aiNetwork: true,
  minecraftConnect: true,
  minecraftControl: true,
  minecraftGuard: true,
  minecraftAutoAttack: true,
  settingsWrite: true,
  notifications: true,
  shellOpen: true
};

/** پروفایل‌های آماده */
export type PermissionPreset = "strict" | "balanced" | "open";

export const PRESET_LABELS: Record<PermissionPreset, string> = {
  strict: "سخت‌گیرانه 🛡️",
  balanced: "متعادل ⚖️",
  open: "آزاد 🌐"
};

export function presetPermissions(preset: PermissionPreset): PermissionMap {
  if (preset === "open") return { ...DEFAULT_PERMISSIONS };
  if (preset === "balanced") {
    return {
      ...DEFAULT_PERMISSIONS,
      minecraftAutoAttack: false,
      memoryExtract: true,
      micContinuous: true
    };
  }
  // سخت‌گیرانه: حداقل‌ها
  return {
    ...DEFAULT_PERMISSIONS,
    memoryExtract: false,
    exportData: false,
    micContinuous: false,
    ttsAuto: false,
    minecraftGuard: false,
    minecraftAutoAttack: false,
    notifications: false,
    shellOpen: false
  };
}

/** ادغام امن نقشهٔ دسترسی‌ها */
export function mergePermissions(
  partial?: Partial<PermissionMap> | null
): PermissionMap {
  return { ...DEFAULT_PERMISSIONS, ...(partial ?? {}) };
}

/** بررسی یک دسترسی (پیش‌فرض: مجاز) */
export function hasPermission(
  s: { permissions?: Partial<PermissionMap> | null },
  key: keyof PermissionMap
): boolean {
  return s.permissions?.[key] ?? true;
}

/* ------------------------------------------------------------------ */
/* دسترسی فایل‌ها — قفل سخت‌افزاری! 🗄️                                  */
/* ------------------------------------------------------------------ */

export interface FsAccessRule {
  path: string;
  access: "full" | "blocked";
  note: string;
  locked: true;
}

/** ضمانت فایل‌سیستمی Peak — همیشه برقرار، قابل تغییر نیست */
export const FS_ACCESS_RULES: FsAccessRule[] = [
  {
    path: "پوشهٔ دادهٔ برنامه (data/)",
    access: "full",
    note: "دیتابیس، مدل صوتی، پشتیبان‌ها — فقط همین",
    locked: true
  },
  {
    path: "بقیهٔ فایل‌های کامپیوتر",
    access: "blocked",
    note: "خواندن/نوشتن ممنوع — در کد غیرممکن است",
    locked: true
  },
  {
    path: "پوشه‌های خانه، اسناد، دسکتاپ",
    access: "blocked",
    note: "هیچ دسترسی‌ای وجود ندارد",
    locked: true
  },
  {
    path: "Program Files و فایل‌های ویندوز",
    access: "blocked",
    note: "هیچ دسترسی‌ای وجود ندارد",
    locked: true
  },
  {
    path: "رجیستری ویندوز",
    access: "blocked",
    note: "خواندن و نوشتن ممنوع",
    locked: true
  },
  {
    path: "فرمان‌های سیستم (CMD / PowerShell)",
    access: "blocked",
    note: "Peak هیچ فرمان سیستمی اجرا نمی‌کند",
    locked: true
  }
];
