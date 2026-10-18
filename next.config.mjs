/**
 * پیکربندی Next.js — نسخهٔ JavaScript (mjs)
 * ⚠️ عمداً .ts نیست: تا برنامهٔ بسته‌بندی‌شده در زمان اجرا به TypeScript نیاز نداشته باشد
 * (علت اصلی باز نشدن EXE — حل‌شده)
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // پکیج‌های نیتیو و ماینکرفت باید خارج از باندل سمت سرور اجرا شوند
  serverExternalPackages: [
    "better-sqlite3",
    "mineflayer",
    "mineflayer-pathfinder",
    "mineflayer-collectblock",
    "minecraft-protocol",
    "minecraft-data",
    "prismarine-auth",
    "prismarine-chunk",
    "prismarine-entity",
    "prismarine-item",
    "prismarine-nbt",
    "prismarine-physics",
    "prismarine-recipe",
    "prismarine-registry",
    "prismarine-windows",
    "prismarine-world"
  ],
  reactStrictMode: true,
  experimental: {
    // ساخت تک‌رشته‌ای — مناسب محیط‌های کم‌حافظه
    cpus: 1,
    workerThreads: false
  },
  webpack: (config) => {
    // بدون source map — حافظهٔ کمتر، بیلد/اجرای سبک‌تر
    config.devtool = false;
    return config;
  }
};

export default nextConfig;
