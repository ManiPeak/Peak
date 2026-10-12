/**
 * مودهای جاوا (.jar) — مدیریت فایل‌های مود Minecraft Java Edition
 * ─────────────────────────────────────────────────────────────
 * این ماژول فقط فایل‌ها را نگه می‌دارد و هنگام درخواست کاربر،
 * در پوشهٔ بازی (mods) نصب می‌کند — بدون هیچ بار اضافی روی سیستم.
 * هستهٔ برنامه دست نمی‌خورد؛ همه‌چیز زیر data/mods/java می‌ماند.
 *
 * ساختار:
 *   data/mods/java/*.jar            → مودهای روشن
 *   data/mods/java/disabled/*.jar   → مودهای خاموش
 *   data/mods/java/config.json      → مسیر پوشهٔ mods بازی
 */
import fs from "node:fs";
import path from "node:path";

const JAVA_DIR = path.join(process.cwd(), "data", "mods", "java");
const DISABLED_DIR = path.join(JAVA_DIR, "disabled");
const CONFIG_FILE = path.join(JAVA_DIR, "config.json");

/** حداکثر حجم هر مود (.jar) — ۲۰۰ مگابایت */
const MAX_MOD_BYTES = 200 * 1024 * 1024;

export interface JavaModInfo {
  /** نام فایل (یکتا) */
  name: string;
  /** حجم به بایت */
  size: number;
  /** تاریخ افزودن (میلی‌ثانیه) */
  addedAt: number;
  /** روشن/خاموش */
  enabled: boolean;
}

export interface JavaModsConfig {
  /** مسیر پوشهٔ mods بازی (مثلاً .../.minecraft/mods) */
  gameModsPath: string;
}

function ensureDirs(): void {
  fs.mkdirSync(JAVA_DIR, { recursive: true });
  fs.mkdirSync(DISABLED_DIR, { recursive: true });
}

/** پاک‌سازی نام فایل — جلوگیری از مسیرهای مخرب */
export function safeJarName(raw: string): string | null {
  const base = path.basename(raw).replace(/[\\/:*?"<>|]/g, "_").trim();
  if (!/\.jar$/i.test(base)) return null;
  if (base.length < 6 || base.length > 120) return null;
  return base;
}

/** تشخیص فایل zip/jar از روی امضای PK */
export function looksLikeJar(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07);
}

function statMod(file: string, enabled: boolean): JavaModInfo | null {
  try {
    const st = fs.statSync(file);
    return {
      name: path.basename(file),
      size: st.size,
      addedAt: Math.round(st.mtimeMs),
      enabled
    };
  } catch {
    return null;
  }
}

/** فهرست همهٔ مودهای جاوا (روشن + خاموش) */
export function listJavaMods(): JavaModInfo[] {
  ensureDirs();
  const out: JavaModInfo[] = [];
  for (const f of fs.readdirSync(JAVA_DIR)) {
    if (/\.jar$/i.test(f)) {
      const m = statMod(path.join(JAVA_DIR, f), true);
      if (m) out.push(m);
    }
  }
  for (const f of fs.readdirSync(DISABLED_DIR)) {
    if (/\.jar$/i.test(f)) {
      const m = statMod(path.join(DISABLED_DIR, f), false);
      if (m) out.push(m);
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** ذخیرهٔ فایل .jar آپلودشده (بافر) — false یعنی نامعتبر */
export function saveJavaMod(fileName: string, buf: Buffer): JavaModInfo | null {
  ensureDirs();
  const name = safeJarName(fileName);
  if (!name) return null;
  if (buf.length === 0 || buf.length > MAX_MOD_BYTES) return null;
  if (!looksLikeJar(buf)) return null;
  fs.writeFileSync(path.join(JAVA_DIR, name), buf);
  return statMod(path.join(JAVA_DIR, name), true);
}

/** روشن/خاموش کردن مود (جابه‌جایی بین پوشه‌ها) */
export function toggleJavaMod(name: string, enabled: boolean): boolean {
  ensureDirs();
  const safe = safeJarName(name);
  if (!safe) return false;
  const from = enabled ? path.join(DISABLED_DIR, safe) : path.join(JAVA_DIR, safe);
  const to = enabled ? path.join(JAVA_DIR, safe) : path.join(DISABLED_DIR, safe);
  if (!fs.existsSync(from)) return false;
  fs.renameSync(from, to);
  return true;
}

/** حذف کامل مود */
export function deleteJavaMod(name: string): boolean {
  ensureDirs();
  const safe = safeJarName(name);
  if (!safe) return false;
  for (const dir of [JAVA_DIR, DISABLED_DIR]) {
    const f = path.join(dir, safe);
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      return true;
    }
  }
  return false;
}

/** خواندن تنظیمات (مسیر پوشهٔ mods بازی) */
export function getJavaConfig(): JavaModsConfig {
  ensureDirs();
  try {
    const j = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) as Partial<JavaModsConfig>;
    return { gameModsPath: typeof j.gameModsPath === "string" ? j.gameModsPath : "" };
  } catch {
    return { gameModsPath: "" };
  }
}

/** ذخیرهٔ مسیر پوشهٔ mods بازی */
export function setJavaConfig(gameModsPath: string): JavaModsConfig {
  ensureDirs();
  const cfg: JavaModsConfig = { gameModsPath: gameModsPath.trim() };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
  return cfg;
}

export interface InstallResult {
  copied: string[];
  failed: string[];
  target: string;
}

/** نصب مودهای روشن در پوشهٔ mods بازی — فقط هنگام درخواست کاربر */
export function installJavaMods(targetPath?: string): InstallResult {
  ensureDirs();
  const target = (targetPath ?? getJavaConfig().gameModsPath).trim();
  const copied: string[] = [];
  const failed: string[] = [];
  if (!target) return { copied, failed, target: "" };
  try {
    fs.mkdirSync(target, { recursive: true });
  } catch {
    return { copied, failed: listJavaMods().filter((m) => m.enabled).map((m) => m.name), target };
  }
  for (const m of listJavaMods()) {
    if (!m.enabled) continue;
    try {
      fs.copyFileSync(path.join(JAVA_DIR, m.name), path.join(target, m.name));
      copied.push(m.name);
    } catch {
      failed.push(m.name);
    }
  }
  return { copied, failed, target };
}
