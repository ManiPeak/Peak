/**
 * قرارداد لایهٔ ارائه‌دهنده‌ها (Provider Layer)
 *
 * هر ارائه‌دهنده یک آداپتور است با سه توانایی اصلی:
 *   resolve()  → تبدیل تنظیمات کاربر + متغیرهای محیطی به یک پیکربندی قطعی
 *   listModels()→ فهرست مدل‌های واقعاً موجود (نه حدسی)
 *   check()    → تست واقعی: دسترسی‌پذیری + احراز هویت + وجود مدل + یک تولید کوتاه
 *
 * قرارداد صادقانه: اگر تستی انجام نشده، status باید NOT_TESTED باشد — نه PASS.
 */
import type { ProviderId } from "@/lib/types";

export type CheckStatus = "PASS" | "FAIL" | "NOT_TESTED" | "SKIPPED";

export interface ProviderCheck {
  /** شناسهٔ ماشین‌خوان مرحله (مثلاً reachability / auth / model / generation) */
  id: string;
  /** عنوان فارسی برای نمایش */
  label: string;
  status: CheckStatus;
  detail: string;
  /** راه‌حل عملی برای کاربر */
  hint?: string;
  /** دادهٔ کمکی (مثلاً فهرست مدل‌های نصب‌شده) */
  data?: Record<string, unknown>;
  /** مدت زمان تست به میلی‌ثانیه */
  latencyMs?: number;
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** پیکربندی نهایی و قطعی ارائه‌دهنده (بدون راز در خروجی لاگ) */
export interface ResolvedProviderConfig {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  /** هدرهای اضافهٔ لازم (مثلاً HTTP-Referer در OpenRouter) */
  headers: Record<string, string>;
  /** منبع هر مقدار: settings | env | default */
  sources: {
    baseUrl: "settings" | "env" | "default";
    model: "settings" | "env" | "default";
    apiKey: "settings" | "env" | "none";
  };
}

export interface CompletionResult {
  text: string;
  model: string;
  latencyMs: number;
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  /** آیا برای کار کردن کلید لازم است */
  requiresApiKey: boolean;
  defaultBaseUrl: string;
  defaultModel: string;
  /** نام متغیرهای محیطی پشتیبان */
  envBaseUrl?: string;
  envApiKey?: string;
  /** راهنمای کوتاه نمایش در صفحهٔ تنظیمات */
  help: string;

  /** تبدیل تنظیمات کاربر + env به پیکربندی قطعی */
  resolve(input: ProviderInput): ResolvedProviderConfig;
  /** فهرست مدل‌های واقعاً موجود — در صورت عدم دسترسی باید خطا بدهد نه لیست ساختگی */
  listModels(cfg: ResolvedProviderConfig): Promise<string[]>;
  /** جزئیات غنی مدل‌ها (اختیاری — مثلاً خانواده/پارامتر/قیمت) */
  describeModels?(cfg: ResolvedProviderConfig): Promise<unknown[]>;
  /** تست کامل: دسترسی‌پذیری، احراز هویت، مدل، تولید واقعی */
  check(cfg: ResolvedProviderConfig): Promise<ProviderCheck[]>;
  /** یک تولید متنی کوچک و واقعی (برای تست و تشخیص) */
  complete(
    cfg: ResolvedProviderConfig,
    messages: ProviderMessage[],
    opts?: { maxTokens?: number; temperature?: number; timeoutMs?: number }
  ): Promise<CompletionResult>;
  /** استریم پاسخ (پیش‌فرض از complete ساخته می‌شود) */
  stream(
    cfg: ResolvedProviderConfig,
    messages: ProviderMessage[],
    opts?: { maxTokens?: number; temperature?: number; timeoutMs?: number }
  ): AsyncGenerator<string>;
}

export interface ProviderInput {
  provider: ProviderId;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  /** تنظیمات کامل برنامه برای خواندن مقادیر پیش‌فرض جایگزین */
  defaults?: { baseUrl?: string; model?: string };
}

export const OK_LABEL = "✅";
export const FAIL_LABEL = "❌";
export const NOT_TESTED_LABEL = "➖";