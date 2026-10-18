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
