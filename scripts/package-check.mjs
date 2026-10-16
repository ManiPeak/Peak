#!/usr/bin/env node
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

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

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
