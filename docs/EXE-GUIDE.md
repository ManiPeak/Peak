# 🖥️ فایل EXE ویندوز — دانلود، نصب و ساخت

این صفحه دو بخش دارد: **بخش ۱** برای کسی که فقط می‌خواهد برنامه را نصب کند،
**بخش ۲** برای کسی که می‌خواهد خودش EXE را بسازد.

---

## بخش ۱ — دانلود و نصب (کاربر نهایی)

### کدام فایل را بردارم؟

در صفحهٔ [Releases](https://github.com/ManiPeak/Peak/releases/latest) فقط دو فایل معنی دارند:

| فایل | برای چه کسی | چه می‌کند |
|---|---|---|
| **`Peak-Setup-Latest.exe`** | تقریباً همه | نصب روی ویندوز — میان‌بر دسکتاپ + منوی استارت |
| **`Peak-Portable-Latest.exe`** | اجرای بدون نصب | فقط اجرا می‌شود؛ مناسب فلش و سیستم مهمان |

لینک‌های ثابت (همیشه آخرین نسخه):

* نصب‌کننده: <https://github.com/ManiPeak/Peak/releases/latest/download/Peak-Setup-Latest.exe>
* پرتابل: <https://github.com/ManiPeak/Peak/releases/latest/download/Peak-Portable-Latest.exe>

فایل‌های دیگری که ممکن است در صفحهٔ ریلیز ببینی:

* `Peak-Setup-<نسخه>.exe` و `Peak-Portable-<نسخه>.exe` — همان دو فایل بالا، با شمارهٔ نسخه (آرشیو).
* `Peak.exe` / `node.exe` / `elevate.exe` — اجزای *داخل* بسته‌اند؛ برای نصب برشان ندار.

### نصب با نصب‌کننده — فقط ۳ قدم

1. `Peak-Setup-Latest.exe` را اجرا کن.
2. در نصب‌کننده **فقط محل نصب را انتخاب کن** (یا پیش‌فرض را رها کن) و
   **بقیهٔ گزینه‌ها را دست نزن** — میان‌بر دسکتاپ و منوی استارت از پیش روشن‌اند.
3. **Install** را بزن. تمام ✅

**هیچ پیش‌نیازی لازم نیست.** Node.js داخل خود بسته است (`resources/node/node.exe`)؛
نیازی به نصب Node.js، Python، Visual Studio یا git نیست.

### نسخهٔ پرتابل

فایل را هرجا (حتی روی فلش) بگذار و اجرا کن. داده‌های برنامه (دیتابیس، حافظهٔ دائمی،
تنظیمات) در `%APPDATA%\Peak\data` ذخیره می‌شوند، پس چیزی روی خود فلش نوشته نمی‌شود.

### اگر ویندوز هشدار داد

برنامه هنوز امضای دیجیتال ندارد؛ این هشدارها طبیعی‌اند:

| هشدار | کار |
|---|---|
| SmartScreen («Windows protected your PC») | **More info** ← **Run anyway** |
| فایل بلاک‌شده | راست‌کلیک روی فایل ← **Properties** ← تیک **Unblock** ← **OK** |
| آنتی‌ویروس | فایل/پوشهٔ نصب را در استثناها (Exclusion) بگذار |

### برنامه باز نشد؟

فایل `%APPDATA%\Peak\data\peak-log.txt` را باز کن؛ خط‌های `[FATAL]` علت دقیق را
می‌گویند (معمولاً یکی از این دو: Node داخل بسته نیست، یا بیلد Next داخل بسته نیست).

---

## بخش ۲ — ساخت EXE

### پیش‌نیاز ساخت (فقط برای سازنده)

* ویندوز ۱۰/۱۱ (۶۴ بیت)
* Node.js نسخهٔ ۲۰ به بالا — **فقط برای ساخت**؛ خودِ برنامه نیاز به Node ندارد

### ساخت خودکار (پیشنهادی)

با هر `push` روی `main`، ورک‌فلوی **Build Windows EXE** در گیت‌هاب خودش همه‌کار را می‌کند:

1. `scripts/build-exe.ps1` را اجرا می‌کند (نصب وابستگی ← بیلد Next ← Node قابل‌حمل ← الکترون‌بیلدر)
2. نام‌های ثابت `Peak-Setup-Latest.exe` و `Peak-Portable-Latest.exe` را می‌سازد
3. با `scripts/package-check.mjs` محتوای بسته را بازرسی می‌کند و برای هر موردِ نبوده
   **هشدار** می‌دهد (روی صفحهٔ run و در خلاصهٔ اجرا)
4. فایل‌ها را در تب **Actions** (Artifacts) می‌گذارد و در **ریلیز چرخشی** با برچسب
   `latest` منتشر می‌کند (`make_latest` روشن) — پس
   `…/releases/latest/download/Peak-Setup-Latest.exe` همیشه آخرین نسخه است.

### ساخت دستی روی سیستم خودت

```powershell
npm install
powershell -ExecutionPolicy Bypass -File scripts\build-exe.ps1
```

خروجی در پوشهٔ `dist/`:

* `Peak-Setup-<نسخه>.exe` — نصب‌کننده (NSIS)
* `Peak-Portable-<نسخه>.exe` — نسخهٔ قابل حمل
* `Peak-Setup-Latest.exe` / `Peak-Portable-Latest.exe` — همان فایل‌های بالا با نام ثابت
  (در گیت‌هاب خودکار ساخته می‌شوند؛ برای ساخت دستی هم نام‌گذاری‌شان ساده است)

بازرسی بسته:

```powershell
npm run check:package          # فقط هشدار می‌دهد
node scripts\package-check.mjs --strict   # اگر چیزی کم بود، با خطا تمام می‌شود
```

### چه چیزهایی در بسته بررسی می‌شود؟

| مورد | اگر نباشد چه می‌شود |
|---|---|
| `resources/node/node.exe` | برنامه روی سیستمی که Node ندارد باز نمی‌شود |
| `resources/app/.next/BUILD_ID` | سرور برنامه بالا نمی‌آید |
| `resources/app/node_modules/next/dist/bin/next` | پیام «فایل‌های برنامه ناقص‌اند» |
| `node_modules/better-sqlite3/build/Release/better_sqlite3.node` | حافظهٔ دائمی/دیتابیس کار نمی‌کند |

### نکته‌ها

* Node داخل خود بسته قرار می‌گیرد (`extraResources` از `vendor/node`) — روی سیستم کاربر نصب نیست.
* اگر `dist` از اجرای قبلی مانده باشد، `build-exe.ps1` اول پاکش می‌کند تا EXE کهنه منتشر نشود.
* آنتی‌ویروس گاهی فایل‌های ساخته‌شده با electron-builder را مشکوک می‌داند؛ در Windows Security استثنا بگذار.
* برای تغییر آیکون: `build/icon.ico` (حداقل ۲۵۶×۲۵۶) — اگر خراب باشد، از `build/icon.png` ساخته می‌شود.
* اگر ساخت با خطای `typescript` مواجه شد: مطمئن شو `next.config.mjs` هست (نه `.ts`).
