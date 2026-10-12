# 🖥️ ساخت فایل EXE ویندوز (کامل و ساده)

## پیش‌نیاز
* ویندوز ۱۰/۱۱ (۶۴ بیت)
* Node.js نسخهٔ ۲۰ به بالا (فقط برای ساخت — خود برنامه نیاز به نصب Node ندارد)

## قدم‌ها

```powershell
# ۱) وارد پوشهٔ پروژه شو
cd dastiar

# ۲) وابستگی‌ها
npm install

# ۳) ساخت نسخهٔ ویندوز (Setup + Portable)
powershell -ExecutionPolicy Bypass -File scripts\build-exe.ps1
```

خروجی در پوشهٔ `dist/`:
* `Peak-Setup.exe` — نصب‌کننده
* `Peak-Portable.exe` — نسخهٔ قابل حمل (بدون نصب)

## نکته‌ها
* Node داخل خود بسته قرار می‌گیرد (`extraResources`) — روی سیستم کاربر نصب نیست.
* آنتی‌ویروس گاهی فایل‌های ساخته‌شده با electron-builder را مشکوک می‌داند؛ اگر لازم بود در Windows Security استثنا بگذار.
* برای تغییر آیکون: `build/icon.ico` (حداقل ۲۵۶×۲۵۶).
* اگر ساخت با خطای `typescript` مواجه شد: مطمئن شو `next.config.mjs` هست (نه `.ts`).
