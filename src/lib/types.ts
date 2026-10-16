/**
 * تایپ‌های مشترک «دستیار» بین سمت سرور و کلاینت
 */

export type Role = "user" | "assistant" | "system";

export type MemoryCategory =
  | "profile"
  | "preference"
  | "goal"
  | "minecraft"
  | "note"
  | "other";

export type MemorySource = "manual" | "auto" | "explicit";

export type Tone = "friendly" | "formal" | "playful";

export type Verbosity = "concise" | "balanced" | "detailed";

/** کلیدهای دسترسی برنامه — هر کدام یک کلید روشن/خاموش دارد */
export type PermissionKey =
  | "memoryRead"
  | "memoryWrite"
  | "memoryExtract"
  | "exportData"
  | "mic"
  | "micContinuous"
  | "ttsAuto"
  | "ttsClick"
  | "aiNetwork"
  | "minecraftConnect"
  | "minecraftControl"
  | "minecraftGuard"
  | "minecraftAutoAttack"
  | "settingsWrite"
  | "notifications"
  | "shellOpen";

export type PermissionMap = Record<PermissionKey, boolean>;

/** سطح بازی ربات ماینکرفت */
export type PlayLevel = "beginner" | "normal" | "pro" | "god";

export type ProviderId =
  | "builtin"
  | "openai"
  | "openrouter"
  | "groq"
  | "xai"
  | "ollama"
  | "lmstudio"
  | "9router"
  | "custom";

/** حالت پاسخ‌دهی پیام */
export type ReplyMode = "llm" | "offline" | "memory" | "minecraft";

/** متادیتای هر پیام — JSON ذخیره‌شده در ستون meta */
export interface MessageMeta {
  mode: ReplyMode;
  /** عنوان حافظه‌های ذخیره‌شده در اثر این پیام */
  memories?: string[];
  /** فکر کوتاه خط اول 💡 (ذهن دستیار) */
  thought?: string;
  /** پیام خطای LLM در صورت سقوط به حالت آفلاین */
  error?: string;
  [key: string]: unknown;
}

/** تنظیمات کامل برنامه (JSON جدول settings) */
export interface AppSettings {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  assistantName: string;
  tone: Tone;
  verbosity: Verbosity;
  autoMemory: boolean;
  /** پخش خودکار صدای پاسخ‌ها (دستیار بدون کلیک حرف می‌زند) */
  autoSpeak: boolean;
  ttsRate: number;
  ttsVolume: number;
  ttsVoiceURI: string | null;
  microphoneId: string | null;
  mcLastHost: string | null;
  mcLastPort: number;
  mcLastUsername: string | null;
  /** شعاع محافظت پلیسی در ماینکرفت */
  mcGuardRadius: number;
  /** شعاع اسکن محیط (بلوک) — با رم اختصاص‌داده‌شده تا ۱۰۰۰۰۰ بالا می‌رود */
  mcScanRadius: number;
  /** رم اختصاصی برنامه (مگابایت) — سقف حافظهٔ سرور داخل برنامه */
  appRamMB: number;
  /** سطح بازی ربات — از مبتدی تا «خدا» (استقلال کامل) */
  mcPlayLevel: PlayLevel;
  /** نام بازیکنی که ربات باید از او محافظت کند (خالی = نزدیک‌ترین بازیکن) */
  mcProtectTarget: string | null;
  /** آیا اکانت ربات روی سرور OP است؟ (تلپورت، give و…) */
  mcIsOp: boolean;
  /** گفت‌وگوی هوشمند داخل چت بازی */
  mcChatBridge: boolean;
  /** نام کاربر (مثلاً ManiPeak) — برای خطاب قرار دادن */
  userName: string;
  /** لیست دوستان (یوزرنیم‌های بازیکنان) — ربات حاضره جانش رو فداشون کنه */
  mcFriends: string[];
  /** حالت شخصیتی زیرمجموعهٔ ماینکرفت: vood pump / مهربون / عادی */
  mcPersonality: "angry" | "kind" | "normal";
  /** دسترسی‌های برنامه — هر ۱۶ مجوز قابل روشن/خاموش کردن */
  permissions: PermissionMap;
}

export interface ConversationDTO {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  preview?: string;
}

export interface MessageDTO {
  id: number;
  conversationId: number;
  role: Role;
  content: string;
  meta: MessageMeta | null;
  createdAt: string;
}

export interface MemoryDTO {
  id: number;
  category: MemoryCategory;
  title: string;
  content: string;
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
}

export interface ServerDTO {
  id: number;
  name: string;
  host: string;
  port: number;
  version: string;
  auth: "offline" | "microsoft";
  /** ورود به سرورهای کرکی: بدون لاگین / لاگین / رجیستر+لاگین (رمز ثابت) */
  authMode: "none" | "login" | "register";
  username: string | null;
  lastStatus: "connected" | "never" | "error";
  lastConnectedAt: string | null;
  createdAt: string;
}

/** نسخهٔ تنظیمات برای خروجی API — کلید API همیشه ماسک است */
export type PublicSettings = Omit<AppSettings, "apiKey"> & {
  apiKeyMasked: string;
};

/** پاسخ تست اتصال ارائه‌دهنده */
export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  model?: string;
}
