package com.smartshala.smartshala_mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()
    }

    /**
     * Android 8+ posts nothing through a channel that does not exist, and the
     * channel FCM would create by default is the low-importance "Miscellaneous"
     * one — no sound, no heads-up. Creating it here is enough: the app must have
     * been opened at least once to register for notifications at all, so the
     * channel is always in place before the first one can arrive.
     *
     * The id must match PushConfig.androidChannelId in Dart and
     * ANDROID_CHANNEL_ID in the backend's fcm.ts.
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            "smartshala_default",
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = getString(R.string.notification_channel_description)
        }

        val manager = getSystemService(NotificationManager::class.java)
        manager?.createNotificationChannel(channel)
    }
}
