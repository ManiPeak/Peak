#!/usr/bin/env node
// Peak 1.0.3 — Consolidated tools (package-check+prepare-android-assets+release-notes -> 1)
// Usage: node scripts/tools.mjs <package-check|prepare-android-assets|release-notes> [args]
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

async function cmdPackageCheck() {
/**
 * package-check.mjs — بازرسی «بستهٔ ساخته‌شده» (پوشهٔ dist)
 *
 * چرا لازم است؟
 *   بارها پیش آمده که EXE ساخته شده ولی برنامه باز نشده؛ علتِ ریشه‌ای معمولاً یکی از این‌هاست:
 *     ۱. Node قابل‌حمل داخل بسته نیست  → resources/node/node.exe
 *     ۲. بیلد Next داخل بسته نیست       → resources/app/.next/BUILD_ID
 *     ۳. موتور Next نصب نشده            → resources/app/node_modules/next/dist/bin/next
 *     ۴. ماژول نیتیو دیتابیس ساخته نشده → node_modules/better-sqlite3/build/Release/better_sqlite3.node
 *   این اسکریپت همه را بررسی می‌کند و برای هر موردِ نبوده یک «هشدار» (annotation) می‌دهد
 *   تا دقیقاً روی صفحهٔ Actions دیده شود، نه اینکه فقط کاربر نهایی بفهمد «باز نمی‌شود».
 *
 * رفتار:
 *   - به‌صورت پیش‌فرض هرگز build را نمی‌شکند؛ فقط هشدار می‌دهد (خروجی ۰).
 *   - با `--strict` اگر موردی نبود، خروجی ۱ می‌دهد (برای استفادهٔ سخت‌گیرانه).
 *   - با `--no-summary` در GITHUB_STEP_SUMMARY چیزی نمی‌نویسد.
 *   - با `--dist <path>` یا متغیر PEAK_DIST_DIR می‌شود پوشهٔ خروجی را عوض کرد.
 *
 * استفاده:  node scripts/package-check.mjs
 */


/* ---------------- ورودی‌ها ---------------- */

const argv = process.argv.slice(2);
const STRICT = argv.includes("--strict");
const NO_SUMMARY = argv.includes("--no-summary");

const distArgIdx = argv.indexOf("--dist");
const DIST_DIR =
  (distArgIdx !== -1 && argv[distArgIdx + 1]) ||
  process.env.PEAK_DIST_DIR ||
  "dist";

/* ---------------- جمع‌کنندهٔ نتیجه ---------------- */

const ok = [];      // موارد سالم
const warnings = []; // موارد نبوده
const errors = [];   // خرابی‌های سخت (مثل نبودن خودِ dist)

function pass(msg) {
  ok.push(msg);
  console.log(`  ✅ ${msg}`);
}

function warn(msg) {
  warnings.push(msg);
  // annotation گیت‌هاب — روی صفحهٔ run و در خلاصهٔ PR دیده می‌شود
  console.log(`::warning::package check: ${msg}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    console.log(`  ⚠️ ${msg}`);
  }
}

function fail(msg) {
  errors.push(msg);
  console.log(`::error::package check: ${msg}`);
}

/** آیا فایل/پوشه وجود دارد؟ */
function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/** خواندن متن (برای مقایسهٔ BUILD_ID) */
function readText(p) {
  try {
    return fs.readFileSync(p, "utf8").trim();
  } catch {
    return null;
  }
}

/** خواندن اندازهٔ فایل به مگابایت */
function sizeMB(p) {
  try {
    return Math.round((fs.statSync(p).size / (1024 * 1024)) * 10) / 10;
  } catch {
    return 0;
  }
}

/** لیست فایل‌های exe داخل dist (بدون بازگشت به زیرپوشه‌ها) */
function listExes(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".exe"))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/** پیدا کردن پوشهٔ win-unpacked (محلِ خامِ برنامه که electron-builder می‌سازد) */
function findUnpackedDirs(dist) {
  try {
    return fs
      .readdirSync(dist, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /unpacked$/i.test(e.name))
      .map((e) => path.join(dist, e.name));
  } catch {
    return [];
  }
}

/* ---------------- شروع ---------------- */

console.log(`== package check ==  (dist: ${DIST_DIR})`);

if (!exists(DIST_DIR)) {
  fail(`پوشهٔ خروجی «${DIST_DIR}» وجود ندارد — یعنی ساخت بسته انجام نشده است.`);
  process.exit(1);
}

const exes = listExes(DIST_DIR);
const setupExes = exes.filter((f) => /setup/i.test(path.basename(f)) && !/latest/i.test(path.basename(f)));
const portableExes = exes.filter((f) => /portable/i.test(path.basename(f)) && !/latest/i.test(path.basename(f)));

if (exes.length === 0) {
  fail(`هیچ فایل EXE ای داخل «${DIST_DIR}» نیست.`);
} else {
  pass(`${exes.length} فایل EXE در ${DIST_DIR}`);
}

if (setupExes.length === 0) {
  warn("نصب‌کنندهٔ شماره‌دار (Peak-Setup-<نسخه>.exe) در dist نیست.");
} else {
  pass(`نصب‌کننده: ${setupExes.map((f) => `${path.basename(f)} (${sizeMB(f)} MB)`).join(", ")}`);
}

if (portableExes.length === 0) {
  warn("نسخهٔ پرتابل (Peak-Portable-<نسخه>.exe) در dist نیست.");
} else {
  pass(`پرتابل: ${portableExes.map((f) => `${path.basename(f)} (${sizeMB(f)} MB)`).join(", ")}`);
}

// نام‌های ثابت (Latest) — همان لینک‌هایی که در README داده شده
for (const wanted of ["Peak-Setup-Latest.exe", "Peak-Portable-Latest.exe"]) {
  const p = path.join(DIST_DIR, wanted);
  if (exists(p)) {
    pass(`نام ثابت موجود است: ${wanted} (${sizeMB(p)} MB)`);
  } else {
    warn(`نام ثابت «${wanted}» ساخته نشده — لینک …/releases/latest/download/${wanted} روی این ساخت کار نمی‌کند.`);
  }
}

/* ---------------- بررسی محتوای بستهٔ نصب ---------------- */

const unpackedDirs = findUnpackedDirs(DIST_DIR);
if (unpackedDirs.length === 0) {
  warn(
    "پوشهٔ win-unpacked پیدا نشد؛ بررسی محتوای بسته انجام نشد " +
      "(اگر فقط نصب‌کننده ساخته شده باشد طبیعی است، ولی بهتر است ساخت با حالت پیش‌فرض اجرا شود)."
  );
}

for (const root of unpackedDirs) {
  const resources = path.join(root, "resources");
  const app = path.join(resources, "app");
  console.log(`\n-- unpacked: ${root}`);

  // ۱) Node قابل‌حمل — بدون این، روی سیستم کاربر Node لازم می‌شود و برنامه باز نمی‌شود
  const nodeExe = path.join(resources, "node", "node.exe");
  if (exists(nodeExe)) {
    pass(`Node قابل‌حمل داخل بسته هست: ${path.relative(root, nodeExe)} (${sizeMB(nodeExe)} MB)`);
  } else {
    warn(
      `resources/node/node.exe داخل بسته نیست (${path.relative(root, nodeExe)}) — ` +
        "برنامه روی سیستمی که Node ندارد باز نمی‌شود. علت ریشه‌ای: مرحلهٔ «Node قابل‌حمل» در scripts/build-exe.ps1."
    );
  }

  // ۲) بیلد Next — بدون BUILD_ID سرور برنامه بالا نمی‌آید
  const buildId = path.join(app, ".next", "BUILD_ID");
  const sourceBuildId = readText(path.join(process.cwd(), ".next", "BUILD_ID"));
  if (exists(buildId)) {
    pass(`.next/BUILD_ID داخل بسته هست (${readText(buildId)})`);
    const packaged = readText(buildId);
    if (sourceBuildId && packaged && sourceBuildId !== packaged) {
      warn(
        `BUILD_ID داخل بسته (${packaged}) با بیلد فعلی پروژه (${sourceBuildId}) یکی نیست — ` +
          "بسته کهنه است؛ dist را پاک کن و دوباره بساز."
      );
    }
  } else {
    warn(
      "resources/app/.next/BUILD_ID داخل بسته نیست — بیلد Next داخل بسته قرار نگرفته و " +
        "سرور برنامه بالا نمی‌آید (علت ریشه‌ای: مرحلهٔ «npm run build» یا فهرست files در electron-builder)."
    );
  }

  // ۳) موتور Next — خود electron/main.js نبودش را چک می‌کند و پیام «فایل‌های برنامه ناقص‌اند» می‌دهد
  const nextBin = path.join(app, "node_modules", "next", "dist", "bin", "next");
  if (exists(nextBin)) {
    pass("موتور Next داخل بسته هست (node_modules/next/dist/bin/next)");
  } else {
    warn(
      "resources/app/node_modules/next/dist/bin/next داخل بسته نیست — اجرا با خطای " +
        "«فایل‌های برنامه ناقص‌اند» متوقف می‌شود."
    );
  }

  // ۴) حلقهٔ Electron و کد اصلی
  const mainJs = path.join(app, "electron", "main.js");
  if (exists(mainJs)) {
    pass("electron/main.js داخل بسته هست");
  } else {
    warn("resources/app/electron/main.js داخل بسته نیست.");
  }

  // ۵) ماژول نیتیو دیتابیس (حافظهٔ دائمی) — بهتر است باشد، نبودنش فقط بخش حافظه را خراب می‌کند
  const sqliteNative = path.join(
    app,
    "node_modules",
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node"
  );
  if (exists(sqliteNative)) {
    pass("ماژول نیتیو better-sqlite3 داخل بسته هست (build/Release/better_sqlite3.node)");
  } else {
    warn(
      "better-sqlite3 (build/Release/better_sqlite3.node) داخل بسته نیست — " +
        "حافظهٔ دائمی و دیتابیس کار نمی‌کند."
    );
  }

  // ۶) داده‌های سنگین ماینکرفت که عمداً حذف می‌شوند (فقط برای اطلاع)
  const bedrock = path.join(app, "node_modules", "minecraft-data", "minecraft-data", "data", "bedrock");
  if (exists(bedrock)) {
    warn("دادهٔ Bedrock داخل بسته مانده (۳۳۰+ مگ اضافه) — الگوی حذف در electron-builder کار نکرده.");
  }
}

/* ---------------- خلاصه ---------------- */

console.log("\n== package check summary ==");
console.log(`  سالم: ${ok.length}   هشدار: ${warnings.length}   خطا: ${errors.length}`);
for (const w of warnings) console.log(`  ⚠️  ${w}`);
for (const e of errors) console.log(`  ❌ ${e}`);

if (process.env.GITHUB_STEP_SUMMARY && !NO_SUMMARY) {
  const lines = [
    "",
    "## Package check (بازرسی بستهٔ ساخته‌شده)",
    "",
    `- ✅ سالم: **${ok.length}**`,
    `- ⚠️ هشدار: **${warnings.length}**`,
    `- ❌ خطا: **${errors.length}**`,
    "",
  ];
  if (warnings.length) {
    lines.push("### هشدارها", "");
    for (const w of warnings) lines.push(`- ⚠️ ${w}`);
    lines.push("");
  }
  if (errors.length) {
    lines.push("### خطاها", "");
    for (const e of errors) lines.push(`- ❌ ${e}`);
    lines.push("");
  }
  try {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
  } catch {
    /* نادیده — خلاصه اختیاری است */
  }
}

if (STRICT && (warnings.length > 0 || errors.length > 0)) {
  console.log("\nstrict mode: با وجود هشدار/خطا خروجی غیر صفر داده شد.");
  process.exit(1);
}

process.exit(errors.length > 0 ? 1 : 0);
}

async function cmdPrepareAndroidAssets() {
/*
 * Peak — آماده‌سازی assets و فایل‌های نیتیو اندروید (قبل از Gradle).
 *
 * کارها:
 *  ۱) استخراج libnode.so + هدرهای Node از بستهٔ npm «nodejs-mobile-react-native@18.20.4»
 *     (Node 18.20.4 — MODULE_VERSION 108) به android/vendor/libnode/  [در Git نمی‌رود]
 *  ۲) مونتاژ android/app/src/main/assets/app/ مثل resources/app نسخهٔ PC:
 *     .next + node_modules (پروداکشن) + package.json + next.config.mjs + public
 *
 * پیش‌نیاز: npm run build (برای ساختن .next) و npm ci
 * اجرا: node scripts/prepare-android-assets.mjs [--check]
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const NM_PKG = "nodejs-mobile-react-native@18.20.4";
const vendorDir = path.join(root, "android", "vendor");
const libnodeDir = path.join(vendorDir, "libnode");
const assetsDir = path.join(root, "android", "app", "src", "main", "assets", "app");
const ABIS = (process.env.PEAK_ABIS ?? "arm64-v8a").split(",");

const log = (m) => console.log(`[prepare-android] ${m}`);
const fail = (m) => {
  console.error(`[prepare-android] خطا: ${m}`);
  process.exit(1);
};

// ---------- ۱) libnode از npm ----------
function ensureLibnode() {
  const marker = path.join(libnodeDir, "include", "node", "node.h");
  const hasAll = ABIS.every((a) => fs.existsSync(path.join(libnodeDir, "bin", a, "libnode.so")));
  if (fs.existsSync(marker) && hasAll) {
    log(`libnode از قبل آماده است (${libnodeDir})`);
    return;
  }
  if (checkOnly) fail("android/vendor/libnode آماده نیست (بدون --check اجرا کنید)");
  const cache = path.join(vendorDir, ".cache");
  fs.mkdirSync(cache, { recursive: true });
  log(`دریافت ${NM_PKG} از npm…`);
  execFileSync("npm", ["pack", NM_PKG, "--pack-destination", cache], {
    stdio: "inherit",
    cwd: cache,
  });
  const tgz = fs.readdirSync(cache).find((f) => f.endsWith(".tgz"));
  if (!tgz) fail("خروجی npm pack پیدا نشد");
  const extractDir = path.join(cache, "extract");
  fs.rmSync(extractDir, { recursive: true, force: true });
  execFileSync("tar", ["-xzf", path.join(cache, tgz), "-C", cache], { stdio: "inherit" });
  // npm pack خروجی را در package/ باز می‌کند
  const pkgLibnode = path.join(cache, "package", "android", "libnode");
  if (!fs.existsSync(pkgLibnode)) fail("ساختار بسته با انتظار نمی‌خواند (android/libnode)");
  fs.rmSync(libnodeDir, { recursive: true, force: true });
  fs.mkdirSync(libnodeDir, { recursive: true });
  fs.cpSync(pkgLibnode, libnodeDir, { recursive: true });
  log("libnode + هدرها استخراج شدند");
}

// ---------- ۲) مونتاژ assets مثل نسخهٔ PC ----------
function ensureAssets() {
  const nextDir = path.join(root, ".next");
  if (!fs.existsSync(nextDir)) fail(".next ساخته نشده — ابتدا npm run build را اجرا کنید");

  if (checkOnly) {
    for (const req of [
      ".next/BUILD_ID",
      "package.json",
      "next.config.mjs",
    ]) {
      if (!fs.existsSync(path.join(root, req))) fail(`غایب: ${req}`);
    }
    log("پیش‌نیازهای assets موجودند");
    return;
  }

  log("مونتاژ assets/app (مثل resources/app در نسخهٔ PC)…");
  fs.rmSync(assetsDir, { recursive: true, force: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  // ۲-۱) فایل‌های ریشه
  for (const f of ["package.json", "next.config.mjs"]) {
    fs.copyFileSync(path.join(root, f), path.join(assetsDir, f));
  }
  // ۲-۲) public و .next
  fs.cpSync(path.join(root, "public"), path.join(assetsDir, "public"), { recursive: true });
  fs.cpSync(nextDir, path.join(assetsDir, ".next"), {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(root, src).replaceAll("\\", "/");
      // همان پالایش‌های scripts/package-electron.mjs
      if (rel.startsWith(".next/cache")) return false;
      if (rel === ".next/standalone") return false;
      if (rel.includes("/node_modules/") && rel.includes("/sharp/")) return false;
      return true;
    },
  });

  // ۲-۳) node_modules فقط پروداکشن با پالایش‌های دقیقاً همان الگوی
  //      scripts/build-exe.ps1 (فیلترهای files در electron-builder)
  log("استخراج node_modules پروداکشن (الگوی build-exe.ps1)…");
  const prod = execFileSync("npm", ["ls", "--omit=dev", "--all", "--parseable"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && s.startsWith(root + path.sep));
  const outNm = path.join(assetsDir, "node_modules");
  fs.mkdirSync(outNm, { recursive: true });

  // پکیج‌هایی که فقط زمان بیلد لازم‌اند (مثل swc ویندوز/لینوکس در build-exe.ps1)
  const skipPackage = (rel) =>
    /(^|\/)@next\/swc-/.test(rel) || // کد-جنریتور زمان بیلد — در اجرا لازم نیست
    /(^|\/)@img\//.test(rel) || // باینری‌های sharp — روی اندروید graceful degrade
    /(^|\/)sharp$/.test(rel);

  // پالایش مسیر داخل هر پکیج (عین ردیف‌های !node_modules/** در build-exe.ps1)
  const keepPath = (pkgPath, src) => {
    const name = path.basename(src);
    if (name === ".bin") return false;
    const r = path.relative(pkgPath, src).replaceAll("\\", "/");
    const segs = r.split("/");
    if (segs.includes("test") || segs.includes("tests")) return false;
    if (name.endsWith(".md") || name.startsWith("README")) return false;
    if (r.startsWith("build/Release/obj.target") || r.startsWith("build/Release/.deps")) return false;
    if (r.startsWith("prebuilds/win32") || r.startsWith("prebuilds/darwin") || r.startsWith("prebuilds/linux")) return false;
    return true;
  };

  let count = 0;
  for (const pkgPath of prod) {
    const rel = path.relative(root, pkgPath).replaceAll("\\", "/");
    if (skipPackage(rel)) continue;
    const out = path.join(assetsDir, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    try {
      fs.cpSync(pkgPath, out, {
        recursive: true,
        dereference: true,
        filter: (src) => keepPath(pkgPath, src),
      });
      count++;
    } catch {
      /* پکیج حذف‌شده در npm ls — نادیده */
    }
  }
  // مثل build-exe.ps1: bedrock/doc/tools از minecraft-data حذف می‌شوند
  for (const sub of ["data/bedrock", "doc", "tools"]) {
    const p = path.join(outNm, "minecraft-data", "minecraft-data", sub);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }
  log("minecraft-data: bedrock/doc/tools حذف شد (الگوی build-exe.ps1)");
  // better-sqlite3 باید برای اندروید کراس‌کامپایل شود (scripts/build-android-native.sh)
  const bsqlBuild = path.join(outNm, "better-sqlite3", "build", "Release", "better_sqlite3.node");
  if (!fs.existsSync(bsqlBuild)) {
    log("هشدار: better_sqlite3.node برای اندروید ساخته نشده — scripts/build-android-native.sh را اجرا کنید (CI این کار را می‌کند)");
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  const size = execFileSync("du", ["-sm", assetsDir], { encoding: "utf8" }).split("\t")[0];
  log(`assets آماده شد: ${count} پکیج node_modules، حجم کل ~${size}MB`);
}

ensureLibnode();
ensureAssets();
log("پایان موفقیت‌آمیز");
}

async function cmdReleaseNotes() {
/**
 * ساخت «یادداشت انتشار» (release-notes.md) و «راهنمای نصب» (INSTALL-GUIDE.md)
 * برای GitHub Release — از CHANGELOG.md و docs/EXE-GUIDE.md
 *
 * اجرا: node scripts/release-notes.mjs
 * خروجی در ریشهٔ پروژه نوشته می‌شود (در CI برای body و assets ریلیز استفاده می‌شود).
 */

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;

/** ارقام انگلیسی → فارسی (برای مچ کردن سربرگ‌های CHANGELOG) */
const toPersianDigits = (s) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

const changelogPath = path.join(root, "CHANGELOG.md");
const changelog = fs.readFileSync(changelogPath, "utf8");
const faVer = toPersianDigits(version);

/* استخراج بخش همین نسخه تا سربرگ بعدی */
const lines = changelog.split(/\r?\n/);
let start = -1;
let end = lines.length;
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].startsWith("## ")) continue;
  if (start === -1) {
    if (lines[i].includes(faVer) || lines[i].includes(version)) start = i;
  } else {
    end = i;
    break;
  }
}
const section =
  start === -1
    ? `## نسخهٔ ${faVer}\n\n⚠️ بخش این نسخه در CHANGELOG.md پیدا نشد.`
    : lines.slice(start, end).join("\n").trim();

const notes = `# Peak — نسخهٔ ${faVer} (v${version})

${section}

---

## 📥 دانلود

| فایل | برای چه کسی |
|---|---|
| **Peak-Setup-${version}.exe** | نصب‌کنندهٔ ویندوز — در نصب فقط «محل نصب» را انتخاب کن |
| **Peak-Portable-${version}.exe** | بدون نصب (فلش / سیستم مهمان) |
| **INSTALL-GUIDE.md** | راهنمای کامل نصب و عیب‌یابی |

نام‌های ثابت **Peak-Setup-Latest.exe** / **Peak-Portable-Latest.exe** همیشه آخرین نسخه‌اند:
<https://github.com/ManiPeak/Peak/releases/latest>

## ⚠️ هشدارهای ویندوز (طبیعی است)

* **SmartScreen** ← More info → Run anyway
* **فایل بلاک‌شده** ← Properties ← Unblock ← OK
* **آنتی‌ویروس** ← Add Exclusion

## 🩹 اگر میان‌بر «Missing Shortcut» داد

* معمولاً Defender فایل \`Peak.exe\` را بعد از نصب قرنطینه کرده — اجازه بده و دوباره نصب کن.
* برای نسخهٔ پرتابل، میان‌بر را به خودِ فایل EXE بده نه فایل موقت داخل \`%TEMP%\`.

## 📋 راهنما و لاگ

* راهنمای کامل: **INSTALL-GUIDE.md** داخل همین ریلیز
* لاگ خطا: \`%APPDATA%\\Peak\\data\\peak-log.txt\`
* نیاز به نصب Node.js نیست — داخل خود بسته است.
`;

fs.writeFileSync(path.join(root, "release-notes.md"), notes, "utf8");
fs.copyFileSync(
  path.join(root, "docs", "README.md"),
  path.join(root, "INSTALL-GUIDE.md")
);

console.log(`OK: release-notes.md + INSTALL-GUIDE.md برای نسخهٔ ${version} ساخته شد`);
if (start === -1) {
  console.warn(`::warning::بخش نسخهٔ ${version} در CHANGELOG.md پیدا نشد`);
}
}

const __cmd = process.argv[2];
if (['package-check','prepare-android-assets','release-notes'].includes(__cmd)) process.argv.splice(2, 1);
if (__cmd === 'package-check') await cmdPackageCheck();
else if (__cmd === 'prepare-android-assets') await cmdPrepareAndroidAssets();
else if (__cmd === 'release-notes') await cmdReleaseNotes();
else { console.error(`Unknown command: ${__cmd}. Use: package-check | prepare-android-assets | release-notes`); process.exit(2); }
