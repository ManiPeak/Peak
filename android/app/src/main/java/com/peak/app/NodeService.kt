/*
 * Peak Android — سرویس پیش‌زمینه که رانتایم Node را زنده نگه می‌دارد (عین بخش
 * startApp در electron/main.js): بات + سرور Next داخل همین فرآیند اجرا می‌شوند
 * و با قفل شدن صفحه هم از بین نمی‌روند.
 */
package com.peak.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log

class NodeService : Service() {

    private var nodeThread: Thread? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private external fun startNodeWithArguments(args: Array<String>, workdir: String): Int

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Peak:Node").apply {
            acquire()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startAsForeground()
        if (nodeThread == null) {
            val workdir = filesDir.absolutePath + "/app"
            // دقیقاً همان آرگومان‌های electron/main.js: node node_modules/next/dist/bin/next start -p 3784
            val args = arrayOf(
                "node",
                "node_modules/next/dist/bin/next",
                "start",
                "-p", "3784",
                "-H", "127.0.0.1"
            )
            nodeThread = Thread({
                Log.i(TAG, "starting embedded node runtime in $workdir")
                try {
                    val rc = startNodeWithArguments(args, workdir)
                    Log.e(TAG, "node runtime exited: $rc")
                } catch (t: Throwable) {
                    Log.e(TAG, "node runtime crashed", t)
                }
            }, "peak-node").also { it.start() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        wakeLock?.takeIf { it.isHeld }?.release()
        super.onDestroy()
    }

    private fun startAsForeground() {
        val notification: Notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Peak فعال است")
                .setContentText("بات ماینکرفت روی خود گوشی در حال اجراست")
                .setSmallIcon(R.mipmap.ic_launcher)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("Peak فعال است")
                .setContentText("بات ماینکرفت روی خود گوشی در حال اجراست")
                .setSmallIcon(R.mipmap.ic_launcher)
                .build()
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Peak Service", NotificationManager.IMPORTANCE_LOW
            )
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    companion object {
        private const val TAG = "PeakNodeService"
        private const val CHANNEL_ID = "peak-service"
        private const val NOTIF_ID = 1001

        init {
            System.loadLibrary("peaknode")
        }
    }
}
