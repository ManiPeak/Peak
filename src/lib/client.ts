/**
 * ابزارهای سمت کلاینت — فراخوانی API و موتور گفتار (TTS)
 *
 * موتور گفتار کم‌تأخیر:
 *  - پخش جمله‌به‌جمله: هر جمله به محض کامل شدن پخش می‌شود (همزمان با استریم جواب)
 *  - گرم‌سازی موتور در اولین تعامل کاربر (حذف تأخیر اولیه)
 *  - جمله‌های کوتاه (حداکثر ~۱۶۰ کاراکتر) تا موتور همیشه سریع شروع کند
 *  - پاک‌سازی هوشمند متن: حذف کد، لینک، ایموجی و نشانه‌گذاری‌های اضافه
 *  - نسل‌بندی صف‌ها: قطع فوری (Barge-in) هیچ صدای قدیمی را برنمی‌گرداند
 */
import type { PublicSettings } from "@/lib/types";

/** فراخوانی GET و تبدیل به JSON */
export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `خطای ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** فراخوانی POST/PUT/PATCH/DELETE */
export async function apiSend<T>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `خطای ${res.status}`);
  }
  return data as T;
}

/* ------------------------------------------------------------------ */
/* موتور گفتار کم‌تأخیر (TTS)                                            */
/* ------------------------------------------------------------------ */

let cachedVoices: SpeechSynthesisVoice[] = [];
let warmDone = false;

/** گرم‌سازی موتور صدا — حذف تأخیر اولیهٔ سنتز */
export function prewarmTTS(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.getVoices();
    // یک utterance خالی موتور را از خواب بیدار می‌کند
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    warmDone = true;
  } catch {
    /* نادیده */
  }
}

/** لیست صداهای در دسترس */
export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

/** امتیازدهی صدا: فارسی ایران ← فارسی ← پیش‌فرض */
function voiceScore(v: SpeechSynthesisVoice): number {
  const lang = v.lang.toLowerCase();
  const name = v.name.toLowerCase();
  if (lang === "fa-ir") return 100;
  if (lang.startsWith("fa")) return 80;
  if (name.includes("farsi") || name.includes("persian") || name.includes("فارسی")) return 70;
  if (v.default) return 10;
  return 0;
}

/** پیدا کردن بهترین صدای فارسی */
export function pickFaVoice(): SpeechSynthesisVoice | null {
  const voices = listVoices();
  if (!voices.length) return null;
  const scored = [...voices].sort((a, b) => voiceScore(b) - voiceScore(a));
  return scored[0] ?? null;
}

/** پاک‌سازی هوشمند متن برای گفتن */
function cleanForSpeech(text: string): string {
  return text
    .replace(/\[\[mc:[^\]]*\]\]/g, " ") // توکن‌های اکشن ماینکرفت
    .replace(/```[\s\S]*?```/g, ". ")
    .replace(/`[^`]*`/g, " ")
    .replace(/https?:\/\/\S+/g, " لینک. ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[*_#>|~\[\]{}()]/g, " ")
    .replace(/[،,؛;]/g, "، ")
    .replace(/\s+/g, " ")
    .trim();
}

/** تقسیم متن به جمله‌های کوتاه — کلید سرعت شروع پخش */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const piece of text.split(/(?<=[.!؟…])\s+|\n+/)) {
    const s = piece.trim();
    if (!s) continue;
    // جمله‌های بلند را تکه‌تکه کن تا موتور سریع شروع کند
    if (s.length <= 160) {
      out.push(s);
    } else {
      const words = s.split(" ");
      let chunk = "";
      for (const w of words) {
        if ((chunk + " " + w).length > 160 && chunk) {
          out.push(chunk.trim());
          chunk = w;
        } else {
          chunk = chunk ? chunk + " " + w : w;
        }
      }
      if (chunk.trim()) out.push(chunk.trim());
    }
  }
  return out;
}

/** تقسیم جریان متن: هر چه زودتر گفته شود — حتی بدون نقطه */
function splitStreamChunk(buffer: string): { done: string[]; rest: string } {
  // جمله‌های کامل (با نقطه/؟/!)
  const parts = buffer.split(/(?<=[.!؟…])\s+|\n+/);
  const rest = parts.pop() ?? "";
  const done = parts.map((p) => cleanForSpeech(p)).filter(Boolean);
  // اگر جمله‌ای کامل نشده ولی کلمات زیادی جمع شده (~۹ کلمه)، همین الان بگو
  if (rest.trim().split(/\s+/).length >= 6) {
    const words = rest.trim().split(/\s+/);
    const speakNow = words.slice(0, Math.max(4, Math.floor(words.length * 0.7))).join(" ");
    done.push(cleanForSpeech(speakNow));
    return { done: done.filter(Boolean), rest: words.slice(Math.max(4, Math.floor(words.length * 0.7))).join(" ") };
  }
  return { done, rest };
}

/** وضعیت صف پخش */
const ttsState = {
  queue: [] as string[],
  playing: false,
  generation: 0,
  settings: null as Partial<PublicSettings> | null
};

function pumpQueue(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (ttsState.playing || ttsState.queue.length === 0) return;
  ttsState.playing = true;
  const text = ttsState.queue.shift()!;
  const gen = ttsState.generation;
  const s = ttsState.settings;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "fa-IR";
  utter.rate = s?.ttsRate ?? 1;
  utter.volume = s?.ttsVolume ?? 1;
  const voices = cachedVoices.length ? cachedVoices : listVoices();
  const chosen = s?.ttsVoiceURI
    ? voices.find((v) => v.voiceURI === s.ttsVoiceURI) ?? null
    : pickFaVoice();
  if (chosen) utter.voice = chosen;
  const done = () => {
    if (gen !== ttsState.generation) return;
    ttsState.playing = false;
    pumpQueue();
  };
  utter.onend = done;
  utter.onerror = done;
  window.speechSynthesis.speak(utter);
}

/** پخش متن (نسخهٔ جدید: صف جمله‌های کوتاه) */
export function speak(
  text: string,
  settings?: Partial<PublicSettings> | null
): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  stopSpeaking();
  ttsState.settings = settings ?? null;
  ttsState.queue = splitSentences(cleanForSpeech(text));
  pumpQueue();
}

/** استریم گفتار — هر جمله به محض کامل شدن پخش می‌شود */
export interface SpeechStream {
  push: (delta: string) => void;
  finish: () => void;
}

export function createSpeechStream(
  settings?: Partial<PublicSettings> | null
): SpeechStream {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return { push: () => undefined, finish: () => undefined };
  }
  if (!warmDone) prewarmTTS();
  stopSpeaking();
  ttsState.settings = settings ?? null;
  let buffer = "";
  return {
    push(delta: string) {
      buffer += delta;
      // هر جمله — یا هر ۹ کلمه — فوراً پخش می‌شود (حداقل تأخیر)
      const { done, rest } = splitStreamChunk(buffer);
      buffer = rest;
      if (done.length) {
        ttsState.queue.push(...done);
        pumpQueue();
      }
    },
    finish() {
      const rest = cleanForSpeech(buffer);
      buffer = "";
      if (rest) {
        ttsState.queue.push(...splitSentences(rest));
        pumpQueue();
      }
    }
  };
}

/** قطع فوری صدا (Barge-in / کلید اضطراری) — هیچ صدایی در صف باقی نمی‌ماند */
export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    ttsState.generation++;
    ttsState.queue = [];
    ttsState.playing = false;
    window.speechSynthesis.cancel();
  }
}

/** آیا الان صدایی در حال پخش یا در صف است؟ */
export function isSpeaking(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.speechSynthesis &&
    (window.speechSynthesis.speaking ||
      ttsState.queue.length > 0 ||
      ttsState.playing)
  );
}

/* ------------------------------------------------------------------ */
/* کلید اضطراری                                                        */
/* ------------------------------------------------------------------ */

/** توقف اضطراری همه‌چیز: صدا + میکروفون + ربات ماینکرفت */
export async function triggerEmergency(
  scope: "all" | "bot" | "voice" = "all"
): Promise<{ stopped: string[] }> {
  // ۱. صدا — همین لحظه
  stopSpeaking();
  // ۲. اطلاع به همهٔ صفحه‌ها (میکروفون، استریم‌ها)
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("peak:emergency", { detail: { scope } })
    );
  }
  // ۳. سمت سرور: ربات ماینکرفت
  if (scope !== "voice") {
    try {
      return await apiSend<{ stopped: string[] }>("/api/emergency", "POST", {
        scope
      });
    } catch {
      return { stopped: ["voice"] };
    }
  }
  return { stopped: ["voice"] };
}

/* ------------------------------------------------------------------ */
/* کمکی‌های عمومی                                                       */
/* ------------------------------------------------------------------ */

/** فرمت مدت زمان (ثانیه → «۱:۲۳») */
export function formatTime(dateIso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(dateIso));
  } catch {
    return "";
  }
}
