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
