#!/usr/bin/env bash
# Peak — کراس‌کامپایل better-sqlite3 برای اندروید با NDK (پرریسک‌ترین مرحلهٔ ساخت APK).
#
# با nodejs-mobile-gyp@0.4.0 (فورک رسمی node-gyp با پچ‌های nodejs-mobile) و
# هدرهای داخل android/vendor/libnode (از scripts/prepare-android-assets.mjs).
#
# پیش‌نیاز: ANDROID_NDK_HOME (NDK r26+)، python3، make، و اجرای قبلی prepare-android-assets.mjs
# اجرا: scripts/build-android-native.sh [arm64-v8a|armeabi-v7a]   (پیش‌فرض: arm64-v8a)
#
# ⚠️ وضعیت: این اسکریپت در CI اجرا و اعتبارسنجی می‌شود؛ در محیط توسعهٔ فعلی NDK
# موجود نیست و اجرا نشده است (گزارش‌شده در docs/ANDROID.md به‌عنوان NOT_TESTED).
set -euo pipefail
# Surface the exact failing line as a CI annotation (job logs are not always reachable)
trap 'echo "::error::[build-android-native] failed at line $LINENO: $BASH_COMMAND"' ERR

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ABI="${1:-arm64-v8a}"
NODE_MODULE_VERSION=108
TARGET_VERSION="18.20.4"
API_LEVEL=24
NODEDIR="$ROOT/android/vendor/libnode"
ASSETS_BSQL="$ROOT/android/app/src/main/assets/app/node_modules/better-sqlite3"

die() { echo "::error::[build-android-native] $*" >&2; echo "[build-android-native] خطا: $*" >&2; exit 1; }
log() { echo "[build-android-native] $*"; }

# --- بررسی پیش‌نیازها ---
[ -n "${ANDROID_NDK_HOME:-}" ] || die "ANDROID_NDK_HOME تنظیم نشده (NDK r26+ نصب کنید)"
[ -f "$NODEDIR/include/node/common.gypi" ] || die "android/vendor/libnode آماده نیست — اول scripts/prepare-android-assets.mjs"
[ -d "$ROOT/node_modules/better-sqlite3" ] || die "node_modules/better-sqlite3 نیست — npm ci کنید"
command -v python3 >/dev/null || die "python3 لازم است"

PREBUILT="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt"
[ -d "$PREBUILT" ] || die "پوشهٔ prebuilt در NDK نیست: $PREBUILT (ANDROID_NDK_HOME=$ANDROID_NDK_HOME)"
HOST_TAG="$(ls "$PREBUILT" | head -1)"
TOOLCHAIN="$PREBUILT/$HOST_TAG"
[ -d "$TOOLCHAIN" ] || die "toolchain llvm در NDK پیدا نشد: $PREBUILT"

case "$ABI" in
  arm64-v8a)   TRIPLE="aarch64-linux-android";   GYP_ARCH="arm64" ;;
  armeabi-v7a) TRIPLE="armv7a-linux-androideabi"; GYP_ARCH="arm" ;;
  *) die "ABI ناشناخته: $ABI (arm64-v8a یا armeabi-v7a)" ;;
esac

export CC="$TOOLCHAIN/bin/${TRIPLE}${API_LEVEL}-clang"
export CXX="$TOOLCHAIN/bin/${TRIPLE}${API_LEVEL}-clang++"
export AR="$TOOLCHAIN/bin/llvm-ar"
export RANLIB="$TOOLCHAIN/bin/llvm-ranlib"
export STRIP="$TOOLCHAIN/bin/llvm-strip"
export LINK="$CXX"
export GYP_CROSSCOMPILE=1
export CC_target="$CC"
export CXX_target="$CXX"
[ -x "$CC" ] || die "کامپایلر NDK پیدا نشد: $CC"

# --- nodejs-mobile-gyp به‌صورت محلی (بستهٔ npm، بدون نصب سراسری) ---
GYP_CACHE="$ROOT/android/vendor/.cache/nodejs-mobile-gyp"
mkdir -p "$GYP_CACHE"
if [ ! -x "$GYP_CACHE/package/bin/node-gyp.js" ]; then
  log "دریافت nodejs-mobile-gyp@0.4.0 از npm…"
  (cd "$GYP_CACHE" && npm pack nodejs-mobile-gyp@0.4.0 >/dev/null && tar -xzf nodejs-mobile-gyp-0.4.0.tgz)
fi
GYP="$GYP_CACHE/package/bin/node-gyp.js"

# --- ساخت better-sqlite3 ---
log "کراس‌کامپایل better-sqlite3 برای $ABI (Node $TARGET_VERSION / ABI $NODE_MODULE_VERSION)…"
cd "$ROOT/node_modules/better-sqlite3"
rm -rf build
if ! node "$GYP" rebuild \
  --nodedir="$NODEDIR" \
  --target="$TARGET_VERSION" \
  --arch="$GYP_ARCH" \
  --devdir="$ROOT/android/vendor/.cache/node-gyp" \
  -- \
  -DOS=android -Dtarget_arch="$GYP_ARCH" > /tmp/peak-gyp.log 2>&1; then
  # Surface the tail as annotations (job log downloads are not always reachable)
  grep -iE "error|exception|traceback|gyp err" /tmp/peak-gyp.log | tail -8 | while IFS= read -r line; do echo "::error::gyp: $line"; done || true
  tail -20 /tmp/peak-gyp.log >&2
  die "node-gyp rebuild failed (python3: $(python3 --version 2>&1); see gyp annotations above)"
fi
cat /tmp/peak-gyp.log

BUILT="build/Release/better_sqlite3.node"
[ -f "$BUILT" ] || die "خروجی ساخته نشد: $BUILT"

# --- کپی در assets (اگر assets مونتاژ شده باشد) ---
if [ -d "$ASSETS_BSQL" ]; then
  cp "$BUILT" "$ASSETS_BSQL/build/Release/better_sqlite3.node" 2>/dev/null || {
    mkdir -p "$ASSETS_BSQL/build/Release"
    cp "$BUILT" "$ASSETS_BSQL/build/Release/better_sqlite3.node"
  }
  log "better_sqlite3.node در assets کپی شد"
fi

log "موفق: $BUILT ($(du -h "$BUILT" | cut -f1))"
