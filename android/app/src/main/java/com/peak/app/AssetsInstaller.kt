/*
 * Peak Android — نصب assets اپ (فایل‌های Next + node_modules بسته‌بندی‌شده)
 * روی حافظهٔ داخلی گوشی، فقط در اولین اجرا یا بعد از به‌روزرسانی نسخه.
 * خروجی دقیقاً همان ساختار resources/app در نسخهٔ PC است.
 */
package com.peak.app

import android.content.Context
import android.content.pm.PackageManager
import android.content.res.AssetManager
import android.util.Log
import java.io.File

object AssetsInstaller {
    private const val TAG = "PeakAssets"
    private const val MARKER = ".installed-version"

    /** @return تعداد فایل‌های کپی‌شده؛ اگر از قبل نصب بود ۰ */
    fun ensureInstalled(context: Context, onProgress: (String) -> Unit = {}): Int {
        val appDir = File(context.filesDir, "app")
        val marker = File(appDir, MARKER)
        val version = currentVersion(context)
        if (marker.exists() && marker.readText() == version &&
            File(appDir, "node_modules/next/dist/bin/next").exists()
        ) {
            Log.i(TAG, "assets already installed ($version)")
            return 0
        }
        onProgress("در حال آماده‌سازی فایل‌های برنامه…")
        if (appDir.exists()) appDir.deleteRecursively()
        appDir.mkdirs()
        File(appDir, "tmp").mkdirs()

        var count = 0
        copyTree(context.assets, "app", appDir) { n ->
            count = n
            if (n % 500 == 0) onProgress("در حال استخراج فایل‌ها ($n)…")
        }
        marker.writeText(version)
        Log.i(TAG, "installed $count files for $version")
        return count
    }

    private fun copyTree(am: AssetManager, assetPath: String, outDir: File, onFile: (Int) -> Unit) {
        var n = 0
        fun walk(aPath: String, oDir: File) {
            oDir.mkdirs()
            val children = am.list(aPath) ?: emptyArray()
            for (child in children) {
                val childAsset = "$aPath/$child"
                val sub = am.list(childAsset)
                if (sub != null && sub.isNotEmpty()) {
                    walk(childAsset, File(oDir, child))
                } else {
                    am.open(childAsset).use { input ->
                        File(oDir, child).outputStream().use { output -> input.copyTo(output) }
                    }
                    n++
                    onFile(n)
                }
            }
        }
        walk(assetPath, outDir)
    }

    private fun currentVersion(context: Context): String = try {
        val pi = context.packageManager.getPackageInfo(context.packageName, 0)
        pi.versionName ?: "unknown"
    } catch (e: PackageManager.NameNotFoundException) {
        "unknown"
    }
}
