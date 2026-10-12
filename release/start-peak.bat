@echo off
chcp 65001 >nul
title Peak — دستیار هوش مصنوعی شخصی
color 0B

echo ============================================
echo    Peak — دستیار هوش مصنوعی شخصی — راه‌اندازی
echo ============================================
echo.

REM ---------- بررسی نصب بودن Node.js ----------
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] Node.js روی سیستم نصب نیست!
    echo لطفاً Node.js نسخه ۱۸ به بالا را از https://nodejs.org نصب کنید و دوباره اجرا کنید.
    echo.
    pause
    exit /b 1
)

for /f "tokens=1" %%v in ('node -v') do echo [OK] Node.js نسخه %%v نصب است.
echo.

REM ---------- نصب وابستگی‌ها (فقط بار اول) ----------
if not exist "node_modules" (
    echo [۱/۳] در حال نصب وابستگی‌ها... (ممکن است چند دقیقه طول بکشد)
    call npm install
    if %errorlevel% neq 0 (
        echo [خطا] نصب وابستگی‌ها ناموفق بود. اینترنت را بررسی کنید.
        pause
        exit /b 1
    )
) else (
    echo [۱/۳] وابستگی‌ها از قبل نصب شده‌اند.
)
echo.

REM ---------- همگام‌سازی دیتابیس ----------
echo [۲/۳] در حال آماده‌سازی دیتابیس محلی...
call npm run db:sync
if %errorlevel% neq 0 (
    echo [خطا] آماده‌سازی دیتابیس ناموفق بود.
    pause
    exit /b 1
)
echo.

REM ---------- ساخت و اجرا ----------
echo [۳/۳] در حال ساخت و اجرای برنامه...
if not exist ".next\BUILD_ID" (
    call npm run build
    if %errorlevel% neq 0 (
        echo [خطا] ساخت برنامه ناموفق بود.
        pause
        exit /b 1
    )
)

REM ---------- اجرای برنامه در پنجرهٔ مستقل (بدون مرورگر) ----------
echo [۴/۴] در حال باز کردن پنجرهٔ برنامه...
call npm run electron
if %errorlevel% neq 0 (
    echo [راهنما] اگر پنجرهٔ برنامه باز نشد، مرورگر را باز کنید: http://localhost:3784
    call npm run start
)
pause
