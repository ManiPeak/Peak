/**
 * توکن‌های اکشن ماینکرفت — ماژول سبک و بدون وابستگی
 * (کلاینت هم می‌تونه ازش استفاده کنه — بدون mineflayer)
 *
 * قالب: [[mc:id]] یا [[mc:id|k=v,k=v]] یا [[mc:id|arg1,arg2]]
 */

export const MC_TOKEN_RE = /\[\[mc:([a-z_]+)(?:\|([^\]]*))?\]\]/g;

/** جدا کردن توکن‌ها از متن و پاک‌سازی متن نمایشی */
export function extractMcTokens(text: string): {
  clean: string;
  actions: { id: string; args: Record<string, string> }[];
} {
  const actions: { id: string; args: Record<string, string> }[] = [];
  const clean = text.replace(MC_TOKEN_RE, (_full, id: string, argStr?: string) => {
    const args: Record<string, string> = {};
    if (argStr) {
      // فرمت: k=v,k=v یا فقط مقادیر جدا با ,
      const parts = argStr.split(",").map((s) => s.trim());
      const keys = ["x", "y", "z", "player", "item", "n", "text"];
      parts.forEach((p, i) => {
        const kv = p.match(/^(\w+)=(.*)$/);
        if (kv) args[kv[1]] = kv[2];
        else if (keys[i]) args[keys[i]] = p;
      });
    }
    actions.push({ id, args });
    return "";
  });
  return { clean: clean.trim(), actions };
}

/** حذف توکن‌ها از متن نمایش/گفتار */
export function stripMcTokens(text: string): string {
  return text.replace(MC_TOKEN_RE, "").replace(/\s{2,}/g, " ").trim();
}
