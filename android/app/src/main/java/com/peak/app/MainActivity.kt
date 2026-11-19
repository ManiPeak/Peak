/*
 * Peak Android — اکتیویتی اصلی: رابط WebView دقیقاً مثل BrowserWindow در
 * electron/main.js — سرور Next داخل گوشی بالا می‌آید و UI در همان WebView
 * محلی نمایش داده می‌شود (بدون هیچ سرور یا VPS بیرونی).
 */
package com.peak.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import java.io.File
import java.net.HttpURLConnection
import java.net.Proxy
import java.net.URL

class MainActivity : Activity() {

    private lateinit var root: LinearLayout
    private lateinit var status: TextView
    private lateinit var progress: ProgressBar
    private lateinit var retry: Button
    private var web: WebView? = null
    private val serverUrl = "http://127.0.0.1:3784"
    private var bootThread: Thread? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // صفحهٔ بارگذاری اولیه (تا سرور محلی آماده شود)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#17050b"))
            setPadding(48, 48, 48, 48)
        }
        status = TextView(this).apply {
            text = "در حال راه‌اندازی Peak…"
            textSize = 16f
            setTextColor(Color.parseColor("#e8d5df"))
            gravity = Gravity.CENTER
        }
        progress = ProgressBar(this)
        retry = Button(this).apply {
            text = "تلاش دوباره"
            visibility = View.GONE
            setOnClickListener { retry.visibility = View.GONE; boot() }
        }
        root.addView(progress)
        root.addView(status)
        root.addView(retry)
        setContentView(root)

        boot()
    }

    private fun boot() {
        if (bootThread?.isAlive == true) return
        status.text = "در حال راه‌اندازی Peak…"
        progress.visibility = View.VISIBLE
        bootThread = Thread {
            val startup = File(cacheDir, NodeService.STARTUP_STATUS)
            try {
                if (readStartup(startup).startsWith("error:")) startup.delete()
                AssetsInstaller.ensureInstalled(this) { msg ->
                    runOnUiThread { status.text = msg }
                }
                val service = Intent(this, NodeService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(service)
                } else {
                    startService(service)
                }
            } catch (e: Exception) {
                Log.e("PeakActivity", "Could not prepare or start the runtime", e)
                runOnUiThread { showFailure("آماده‌سازی فایل‌ها یا شروع سرویس ناموفق بود. فضای خالی و نسخهٔ APK را بررسی کنید.") }
                return@Thread
            }
            for (i in 1..60) {
                if (probeServer()) {
                    runOnUiThread { showUi() }
                    return@Thread
                }
                val state = readStartup(startup)
                if (state.startsWith("error:")) {
                    runOnUiThread { showStartupError(state.removePrefix("error:"), timedOut = false) }
                    return@Thread
                }
                runOnUiThread { status.text = "در حال بالا آوردن سرور محلی… ($i)" }
                Thread.sleep(1000)
            }
            val stage = readStartup(startup).removePrefix("error:")
            runOnUiThread { showStartupError(stage, timedOut = true) }
        }.also { it.start() }
    }

    private fun readStartup(file: File): String = runCatching { file.readText().trim() }.getOrDefault("")

    private fun probeServer(): Boolean {
        val connection = URL("$serverUrl/__peak_ready").openConnection(Proxy.NO_PROXY) as HttpURLConnection
        return try {
            connection.connectTimeout = 1000
            connection.readTimeout = 1000
            connection.instanceFollowRedirects = false
            connection.responseCode == 200 && connection.inputStream.bufferedReader().use {
                it.readLine() == "peak-android-ready"
            }
        } catch (_: Exception) {
            false
        } finally {
            connection.disconnect()
        }
    }

    private fun showStartupError(stage: String, timedOut: Boolean) {
        val component = when (stage) {
            "node" -> "موتور Node"
            "sqlite" -> "دیتابیس SQLite"
            "next" -> "سرور Next.js"
            "listen", "ready" -> "اتصال به سرور محلی"
            else -> "سرویس اندروید"
        }
        val code = when (stage) {
            "node", "sqlite", "next", "listen", "ready" -> stage.uppercase()
            else -> "SERVICE"
        }
        val reason = if (timedOut) "در زمان مقرر آماده نشد" else "شروع نشد"
        showFailure("$component $reason.\nکد گزارش: PEAK-$code")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun showUi() {
        if (web != null) return
        val w = WebView(this)
        w.settings.javaScriptEnabled = true
        w.settings.domStorageEnabled = true
        w.settings.cacheMode = WebSettings.LOAD_NO_CACHE
        w.settings.allowFileAccess = false
        w.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                return if (uri.host == "127.0.0.1" || uri.host == "localhost") {
                    false // داخل WebView
                } else {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri.toString())))
                    true
                }
            }
        }
        web = w
        root.removeAllViews()
        root.addView(w, ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
        ))
        w.loadUrl(serverUrl)
        requestNotifPermission()
    }

    private fun showFailure(message: String = "راه‌اندازی سرور محلی ناموفق بود.\nلطفاً برنامه را دوباره باز کنید.") {
        progress.visibility = View.GONE
        status.text = message
        retry.visibility = View.VISIBLE
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val w = web
        if (w != null && w.canGoBack()) w.goBack() else super.onBackPressed()
    }

    private fun requestNotifPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
            }
        }
    }
}
