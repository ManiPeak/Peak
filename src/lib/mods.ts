/**
 * سیستم مودهای Peak — افزودن قابلیت بدون دست زدن به هستهٔ برنامه
 *
 * هر مود یک فایل JSON در پوشهٔ data/mods است (می‌توانی فایل را دستی هم بگذاری).
 * مودها می‌توانند: پاسخ متنی فوری، دستور اسلش سرور (OP) یا ارجاع به توانایی ماینکرفت داشته باشند.
 * طراحی: سبک، بدون اجرای کد دلخواه (فقط JSON ساخت‌یافته) → امن و بهینه.
 */
import fs from "node:fs";
import path from "node:path";
import { toEnglishDigits } from "@/lib/persian";
import type { ModCommand, ModDefinition } from "@/lib/mods-data";

export type { ModCommand, ModDefinition };
export { EXAMPLE_MODS } from "@/lib/mods-data";

/** نتیجهٔ اعتبارسنجی */
export interface ModValidation {
  ok: boolean;
  errors: string[];
  mod?: ModDefinition;
}

const MODS_DIR = path.join(process.cwd(), "data", "mods");

const ID_RE = /^[a-z0-9_]{2,40}$/;

/** نرمال‌سازی متن برای مچ سریع (کوچک، بدون فاصلهٔ اضافی، ارقام انگلیسی) */
function norm(s: string): string {
  return toEnglishDigits(s.trim().toLowerCase())
    .replace(/[!?.،؛:«»"'`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* اعتبارسنجی                                                          */
/* ------------------------------------------------------------------ */

/** اعتبارسنجی کامل یک مود خام (JSON) */
export function validateMod(raw: unknown): ModValidation {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["مود باید یک آبجکت JSON باشد."] };
  }
  const r = raw as Record<string, unknown>;
  const str = (k: string): string => (typeof r[k] === "string" ? (r[k] as string).trim() : "");
  const id = str("id");
  const name = str("name");
  if (!ID_RE.test(id)) errors.push("شناسهٔ مود باید حروف کوچک انگلیسی/عدد/زیرخط (۲ تا ۴۰ نویسه) باشد.");
  if (!name) errors.push("نام مود الزامی است.");
  const cmdsRaw = Array.isArray(r.commands) ? (r.commands as unknown[]) : [];
  if (cmdsRaw.length === 0) errors.push("مود باید حداقل یک دستور داشته باشد.");
  if (cmdsRaw.length > 100) errors.push("هر مود حداکثر ۱۰۰ دستور می‌تواند داشته باشد.");

  const commands: ModCommand[] = [];
  const seenCmdIds = new Set<string>();
  cmdsRaw.forEach((c, i) => {
    if (typeof c !== "object" || c === null) {
      errors.push(`دستور شمارهٔ ${i + 1} نامعتبر است.`);
      return;
    }
    const cr = c as Record<string, unknown>;
    const cid = typeof cr.id === "string" ? cr.id.trim() : "";
    const clabel = typeof cr.label === "string" ? cr.label.trim() : "";
    const samples = Array.isArray(cr.samples)
      ? (cr.samples as unknown[]).filter((s) => typeof s === "string" && s.trim()).map((s) => (s as string).trim())
      : [];
    const reply = typeof cr.reply === "string" ? cr.reply.trim() : "";
    const op = typeof cr.op === "string" ? cr.op.trim().replace(/^\/+/, "") : "";
    const capability = typeof cr.capability === "string" ? cr.capability.trim() : "";
    if (!ID_RE.test(cid)) errors.push(`دستور شمارهٔ ${i + 1}: شناسه نامعتبر است.`);
    else if (seenCmdIds.has(cid)) errors.push(`دستور شمارهٔ ${i + 1}: شناسهٔ «${cid}» تکراری است.`);
    else seenCmdIds.add(cid);
    if (!clabel) errors.push(`دستور شمارهٔ ${i + 1}: عنوان الزامی است.`);
    if (samples.length === 0) errors.push(`دستور شمارهٔ ${i + 1}: حداقل یک جملهٔ فعال‌ساز لازم است.`);
    if (!reply && !op && !capability) {
      errors.push(`دستور شمارهٔ ${i + 1}: یکی از reply یا op یا capability لازم است.`);
    }
    if (op && /[\n\r]/.test(op)) errors.push(`دستور شمارهٔ ${i + 1}: دستور op نباید خط جدید داشته باشد.`);
    commands.push({
      id: cid,
      label: clabel,
      samples,
      ...(reply ? { reply } : {}),
      ...(op ? { op } : {}),
      ...(capability ? { capability } : {})
    });
  });

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    mod: {
      id,
      name,
      version: str("version") || "1.0.0",
      author: str("author") || "ناشناس",
      description: str("description"),
      enabled: typeof r.enabled === "boolean" ? r.enabled : true,
      commands
    }
  };
}

/* ------------------------------------------------------------------ */
/* ذخیره‌سازی (data/mods) — با کش کوتاه برای بهینه‌سازی                    */
/* ------------------------------------------------------------------ */

let cache: { at: number; mods: ModDefinition[] } | null = null;
const CACHE_MS = 3000;

function ensureDir(): void {
  try {
    fs.mkdirSync(MODS_DIR, { recursive: true });
  } catch {
    /* پوشه موجود است */
  }
}

/** خواندن همهٔ مودهای نصب‌شده */
export function loadMods(): ModDefinition[] {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.mods;
  ensureDir();
  const mods: ModDefinition[] = [];
  let files: string[] = [];
  try {
    files = fs.readdirSync(MODS_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    files = [];
  }
  for (const f of files) {
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(path.join(MODS_DIR, f), "utf8"));
      const v = validateMod(raw);
      if (v.ok && v.mod) mods.push(v.mod);
    } catch {
      /* فایل خراب — رد می‌شود */
    }
  }
  cache = { at: Date.now(), mods };
  return mods;
}

/** ذخیرهٔ مود (افزودن/به‌روزرسانی) */
export function saveMod(mod: ModDefinition): void {
  ensureDir();
  fs.writeFileSync(path.join(MODS_DIR, `${mod.id}.json`), JSON.stringify(mod, null, 2), "utf8");
  cache = null;
}

/** حذف مود */
export function deleteMod(id: string): boolean {
  if (!ID_RE.test(id)) return false;
  const p = path.join(MODS_DIR, `${id}.json`);
  try {
    fs.unlinkSync(p);
    cache = null;
    return true;
  } catch {
    return false;
  }
}

/** روشن/خاموش کردن مود */
export function toggleMod(id: string, enabled: boolean): boolean {
  const mod = loadMods().find((m) => m.id === id);
  if (!mod) return false;
  saveMod({ ...mod, enabled });
  return true;
}

/* ------------------------------------------------------------------ */
/* مچ سریع جمله → دستور مود                                             */
/* ------------------------------------------------------------------ */

export interface ModHit {
  mod: ModDefinition;
  command: ModCommand;
}

/** پیدا کردن دستور مود از روی جملهٔ کاربر (فقط مودهای روشن) */
export function matchModCommand(text: string): ModHit | null {
  const t = norm(text);
  if (!t) return null;
  for (const mod of loadMods()) {
    if (!mod.enabled) continue;
    for (const cmd of mod.commands) {
      for (const s of cmd.samples) {
        const ns = norm(s);
        if (!ns) continue;
        // مچ دقیق یا اینکه جملهٔ کاربر شامل نمونه باشد (حداقل ۳ نویسه)
        if (ns.length >= 3 && (t === ns || t.includes(ns) || ns.includes(t))) {
          return { mod, command: cmd };
        }
      }
    }
  }
  return null;
}

/** پرکردن الگوی دستور op با نام بازیکن */
export function fillModTemplate(template: string, player: string, self: string, n = "1"): string {
  return template
    .replaceAll("{player}", player)
    .replaceAll("{self}", self)
    .replaceAll("{n}", n);
}
