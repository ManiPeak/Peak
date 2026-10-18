/**
 * پیکربندی electron-builder — ساخت نصب‌کننده و نسخهٔ پرتابل ویندوز
 *
 * نکته‌های مهم (برای اینکه ساخت گیت‌هاب هرگز خطا نده):
 *  - نام خروجی‌ها فقط ASCII و بدون فاصله است (Peak-Setup-1.0.0.exe)
 *    تا glob های آپلود Artifact همیشه درست مچ بشن.
 *  - نام میان‌برها هم ASCII است تا NSIS با کاراکتر غیرلاتین به مشکل نخوره.
 *  - سرور Next.js داخل فرایند Node جدا (فرزند) اجرا می‌شود، نه داخل Electron؛
 *    پس نیازی به بازسازی ماژول‌های native برای ABI اکترون نیست.
 *  - اگر پوشهٔ vendor/node موجود باشد (Node قابل حمل)، داخل بسته قرار می‌گیرد
 *    تا برنامه بدون نیاز به نصب Node هم اجرا شود.
 */
const fs = require("fs");

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: "com.peak.desktop",
  productName: "Peak",
  // مهم (کلاس خطای «Missing Shortcut»): نام فایل اجرایی نصب‌شده همیشه Peak.exe می‌ماند
  // تا میان‌برهای دسکتاپ/منوی استارت هرگز به هدف گم‌شده اشاره نکنند.
  executableName: "Peak",
  directories: {
    output: "dist",
    buildResources: "build"
  },

  // سرور با Node سیستم/قابل‌حمل اجرا می‌شود — بازسازی native لازم نیست
  npmRebuild: false,

  // asar خاموش تا فرایند فرزند بتواند روی .next و node_modules کار کند
  asar: false,

  // فایل‌های لازم برنامه — وابستگی‌های production خودکار اضافه می‌شوند
  files: [
    ".next/**/*",
    "electron/**/*",
    "public/**/*",
    "next.config.mjs",
    "tsconfig.json",
    "package.json",
    // حذف داده‌های Bedrock (۳۳۰+ مگ) — mineflayer فقط Java Edition است
    "!node_modules/minecraft-data/minecraft-data/data/bedrock/**",
    "!node_modules/minecraft-data/minecraft-data/doc/**",
    "!node_modules/minecraft-data/minecraft-data/tools/**",
    // حذف باینری‌های SWC پلتفرم‌های غیر ویندوز (در صورت وجود)
    "!node_modules/@next/swc-linux-*/**",
    "!node_modules/@next/swc-darwin-*/**",
    "!node_modules/@next/swc-win32-ia32-*/**",
    "!node_modules/@next/swc-win32-arm64-*/**",
    // حذف باینری‌های sharp پلتفرم‌های غیر ویندوز (در صورت وجود)
    "!node_modules/@img/sharp-linux*/**",
    "!node_modules/@img/sharp-libvips-linux*/**",
    "!node_modules/@img/sharp-darwin-*/**",
    "!node_modules/@img/sharp-libvips-darwin-*/**",
    "!node_modules/@img/sharp-wasm32/**"
  ],

  win: {
    icon: "build/icon.ico",
    target: [
      { target: "nsis", arch: ["x64"] },
      { target: "portable", arch: ["x64"] }
    ]
  },

  // نام خروجی: Peak-Setup-1.0.0.exe — بدون فاصله، فقط ASCII
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Peak",
    artifactName: "Peak-Setup-${version}.${ext}"
    // (v1.0.3: NSIS wizard BMP graphics removed — the referenced build/*.bmp files
    //  never shipped in the repo, and 'installerHeaderImage' is not a valid
    //  electron-builder 25 property (schema validation failed the Windows build).
    //  NSIS now uses its default installer graphics.)
  },

  portable: {
    artifactName: "Peak-Portable-${version}.${ext}"
  }
};

// اگر Node قابل حمل آماده شده باشد، داخل بسته قرار بگیرد
// (ورک‌فلوی گیت‌هاب و scripts/build-exe.ps1 این پوشه را قبل از بسته‌بندی می‌سازند)
if (fs.existsSync("vendor/node")) {
  config.extraResources = [{ from: "vendor/node", to: "node" }];
  console.log("[electron-builder] Node قابل‌حمل پیدا شد → داخل بسته قرار می‌گیرد (resources/node)");
} else {
  // بدون این پوشه، برنامه روی سیستمی که Node ندارد باز نمی‌شود.
  // عمداً فقط هشدار می‌دهیم (ساخت را نمی‌شکنیم) تا کاربر بداند بستهٔ خروجی کامل نیست.
  console.warn(
    "[electron-builder] هشدار: پوشهٔ vendor/node پیدا نشد — Node داخل بسته قرار نمی‌گیرد و " +
      "برنامه روی سیستمی که Node ندارد باز نمی‌شود.\n" +
      "                   برای بستهٔ کامل: powershell -ExecutionPolicy Bypass -File scripts\\build-exe.ps1\n" +
      "                   برای بازرسی بستهٔ ساخته‌شده: npm run check:package"
  );
}

module.exports = config;
