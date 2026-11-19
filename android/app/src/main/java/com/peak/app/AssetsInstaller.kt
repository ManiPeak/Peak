/*
 * Peak Android — نصب assets اپ (فایل‌های Next + node_modules بسته‌بندی‌شده)
 * روی حافظهٔ داخلی گوشی، فقط در اولین اجرا یا بعد از به‌روزرسانی نسخه.
 * خروجی دقیقاً همان ساختار resources/app در نسخهٔ PC است.
 */
package com.peak.app

import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import java.io.File
import java.util.zip.ZipInputStream

object AssetsInstaller {
    private const val TAG = "PeakAssets"
    private const val MARKER = ".installed-version"

    /** @return تعداد فایل‌های کپی‌شده؛ اگر از قبل نصب بود ۰ */
    @Synchronized
    fun ensureInstalled(context: Context, onProgress: (String) -> Unit = {}): Int {
        val appDir = File(context.filesDir, "app")
        val marker = File(appDir, MARKER)
        val version = currentVersion(context)
        if (marker.exists() && marker.readText() == version && hasRuntime(appDir)) {
            Log.i(TAG, "assets already installed ($version)")
            return 0
        }
        onProgress("در حال آماده‌سازی فایل‌های برنامه…")
        // SQLite, settings and mods live in app/data. Do not delete them on update.
        appDir.listFiles()?.filter { it.name != "data" }?.forEach {
            check(it.deleteRecursively()) { "Could not clear old runtime: ${it.name}" }
        }
        appDir.mkdirs()
        File(appDir, "tmp").mkdirs()

        Log.i(TAG, "extracting runtime for $version")
        val count = extractRuntime(context, appDir, onProgress)
        check(hasRuntime(appDir)) { "APK is missing required Next.js or SQLite files" }
        marker.writeText(version)
        Log.i(TAG, "installed $count files for $version")
        return count
    }

    private fun hasRuntime(appDir: File) = listOf(
        ".next/BUILD_ID",
        "node_modules/next/dist/bin/next",
        "node_modules/better-sqlite3/build/Release/better_sqlite3.node"
    ).all { File(appDir, it).isFile }

    private fun extractRuntime(context: Context, appDir: File, onProgress: (String) -> Unit): Int {
        val base = appDir.canonicalFile
        val prefix = base.path + File.separator
        val protectedData = File(base, "data").path
        var count = 0
        ZipInputStream(context.assets.open("peak-runtime.zip").buffered()).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val output = File(base, entry.name).canonicalFile
                check(output.path.startsWith(prefix) && output.path != protectedData &&
                    !output.path.startsWith(protectedData + File.separator)) {
                    "Invalid runtime archive entry: ${entry.name}"
                }
                if (entry.isDirectory) {
                    output.mkdirs()
                } else {
                    output.parentFile?.mkdirs()
                    output.outputStream().buffered().use { dest -> zip.copyTo(dest) }
                    count++
                    if (count % 500 == 0) onProgress("در حال استخراج فایل‌ها ($count)…")
                }
                zip.closeEntry()
            }
        }
        return count
    }

    private fun currentVersion(context: Context): String = try {
        val pi = context.packageManager.getPackageInfo(context.packageName, 0)
        pi.versionName ?: "unknown"
    } catch (e: PackageManager.NameNotFoundException) {
        "unknown"
    }
}
