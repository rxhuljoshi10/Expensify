// plugins/withSmsReceiver.js
// Expo Config Plugin that injects the SmsReceiver native module into the Android project.
// This file is run by `expo prebuild` and survives every rebuild.
// Reference: https://docs.expo.dev/config-plugins/introduction/

const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// ─── Kotlin source files ──────────────────────────────────────────────────────

const SMS_HEADLESS_TASK_SERVICE_KT = `package com.rxhuljoshi.expensify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Service that launches the React Native JS context in the background
 * to execute 'SmsHeadlessTask' when an SMS arrives while the app is closed or minimized.
 *
 * On Android O+ this service is started via startForegroundService(), so we MUST
 * call startForeground() within 5 seconds. We show a minimal, transient notification
 * that auto-dismisses when the task completes.
 */
class SmsHeadlessTaskService : HeadlessJsTaskService() {

    companion object {
        private const val CHANNEL_ID = "sms_processing_channel"
        private const val NOTIFICATION_ID = 9999
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Must call startForeground IMMEDIATELY — before super, to satisfy the 5s deadline
        createNotificationChannel()

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Processing SMS")
            .setContentText("Checking for expense transactions…")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

        startForeground(NOTIFICATION_ID, notification)
        Log.d("ExpensifySMS", "SmsHeadlessTaskService: startForeground called")

        return super.onStartCommand(intent, flags, startId)
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras ?: return null
        return HeadlessJsTaskConfig(
            "SmsHeadlessTask",
            Arguments.fromBundle(extras),
            15000, // 15s timeout
            true   // allow in foreground as well
        )
    }

    override fun onHeadlessJsTaskFinish(taskId: Int) {
        super.onHeadlessJsTaskFinish(taskId)
        Log.d("ExpensifySMS", "SmsHeadlessTaskService: task finished, stopping foreground")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SMS Processing",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows while processing incoming SMS for expenses"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}
`;

const SMS_RECEIVER_KT = `package com.rxhuljoshi.expensify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.util.Log
import com.facebook.react.HeadlessJsTaskService

/**
 * BroadcastReceiver that listens for incoming SMS messages.
 * Registered in AndroidManifest.xml.
 *
 * ALL SMS messages are processed via HeadlessJS (SmsHeadlessTaskService),
 * regardless of whether the app is in the foreground, background, or killed.
 *
 * On Android O+ we MUST use startForegroundService() because background apps
 * are not allowed to call startService(). The SmsHeadlessTaskService will
 * immediately call startForeground() to satisfy the 5-second deadline.
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        Log.d("ExpensifySMS", "SmsReceiver.onReceive triggered with action: \${intent.action}")
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: run {
            Log.d("ExpensifySMS", "No messages found in intent")
            return
        }

        val grouped = LinkedHashMap<String, StringBuilder>()
        for (msg in messages) {
            val sender = msg.displayOriginatingAddress ?: continue
            grouped.getOrPut(sender) { StringBuilder() }.append(msg.messageBody ?: "")
        }

        val timestamp = System.currentTimeMillis()
        for ((sender, body) in grouped) {
            val smsBody = body.toString()
            Log.d("ExpensifySMS", "SMS received from \$sender: \$smsBody")
            Log.d("ExpensifySMS", "Launching HeadlessJS service for processing")

            try {
                val serviceIntent = Intent(context, SmsHeadlessTaskService::class.java).apply {
                    putExtra("sender", sender)
                    putExtra("body", smsBody)
                    putExtra("timestamp", timestamp.toDouble())
                }
                HeadlessJsTaskService.acquireWakeLockNow(context)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            } catch (e: Exception) {
                Log.e("ExpensifySMS", "Failed to launch HeadlessJS service", e)
            }
        }
    }
}
`;

const SMS_RECEIVER_MODULE_KT = `package com.rxhuljoshi.expensify

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * React Native Native Module — kept as a thin shell so the JS side
 * can still call startListening()/stopListening() without crashing.
 * Actual SMS processing is handled entirely by HeadlessJS via SmsReceiver.
 */
class SmsReceiverModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsReceiverModule"

    @ReactMethod
    fun startListening(promise: Promise) {
        Log.d("ExpensifySMS", "SmsReceiverModule.startListening (no-op, HeadlessJS handles all SMS)")
        promise.resolve(null)
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        Log.d("ExpensifySMS", "SmsReceiverModule.stopListening (no-op)")
        promise.resolve(null)
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
`;

const SMS_RECEIVER_PACKAGE_KT = `package com.rxhuljoshi.expensify

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * ReactPackage that registers SmsReceiverModule with the React Native bridge.
 * Manually added to MainApplication.getPackages() by the withSmsReceiver config plugin.
 */
class SmsReceiverPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(SmsReceiverModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

// ─── Plugin steps ─────────────────────────────────────────────────────────────

/**
 * Step 1: Write all Kotlin source files into the android source tree.
 */
function withSmsKotlinFiles(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const packageDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java/com/rxhuljoshi/expensify',
      );
      fs.mkdirSync(packageDir, { recursive: true });

      const files = {
        'SmsReceiver.kt': SMS_RECEIVER_KT,
        'SmsReceiverModule.kt': SMS_RECEIVER_MODULE_KT,
        'SmsReceiverPackage.kt': SMS_RECEIVER_PACKAGE_KT,
        'SmsHeadlessTaskService.kt': SMS_HEADLESS_TASK_SERVICE_KT,
      };

      for (const [filename, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(packageDir, filename), content, 'utf8');
      }

      return config;
    },
  ]);
}

/**
 * Step 2: Register SmsReceiverPackage in MainApplication.kt's getPackages().
 */
function withSmsMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('SmsReceiverPackage()')) {
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply \{([^}]*)\}/,
        (match, inner) =>
          `PackageList(this).packages.apply {${inner}              add(SmsReceiverPackage())\n            }`,
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

/**
 * Step 3: Add <receiver>, <service> declarations, and permissions to AndroidManifest.xml.
 */
function withSmsManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application[0];

    // ── Add permissions ──────────────────────────────────────────────────
    const existingPermissions = (manifest['uses-permission'] || []).map(
      (p) => p.$?.['android:name'],
    );

    const requiredPermissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SHORT_SERVICE',
      'android.permission.WAKE_LOCK',
    ];

    for (const perm of requiredPermissions) {
      if (!existingPermissions.includes(perm)) {
        manifest['uses-permission'] = manifest['uses-permission'] || [];
        manifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    }

    // ── Receiver registration ────────────────────────────────────────────
    const receivers = application.receiver || [];
    const receiverDeclared = receivers.some(
      (r) => r.$?.['android:name'] === '.SmsReceiver',
    );

    if (!receiverDeclared) {
      application.receiver = [
        ...receivers,
        {
          $: {
            'android:name': '.SmsReceiver',
            'android:exported': 'true',
            'android:permission': 'android.permission.BROADCAST_SMS',
          },
          'intent-filter': [
            {
              $: { 'android:priority': '999' },
              action: [
                { $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } },
              ],
            },
          ],
        },
      ];
    }

    // ── HeadlessJS Service registration ──────────────────────────────────
    const services = application.service || [];
    const serviceDeclared = services.some(
      (s) => s.$?.['android:name'] === '.SmsHeadlessTaskService',
    );

    if (!serviceDeclared) {
      application.service = [
        ...services,
        {
          $: {
            'android:name': '.SmsHeadlessTaskService',
            'android:exported': 'false',
            'android:foregroundServiceType': 'shortService',
          },
        },
      ];
    } else {
      // Update existing service declaration to include foregroundServiceType
      const existingService = services.find(
        (s) => s.$?.['android:name'] === '.SmsHeadlessTaskService',
      );
      if (existingService && !existingService.$['android:foregroundServiceType']) {
        existingService.$['android:foregroundServiceType'] = 'shortService';
      }
    }

    return config;
  });
}

// ─── Compose all steps ────────────────────────────────────────────────────────

/**
 * @param {import('@expo/config-plugins').ExpoConfig} config
 */
module.exports = function withSmsReceiver(config) {
  config = withSmsKotlinFiles(config);
  config = withSmsMainApplication(config);
  config = withSmsManifest(config);
  return config;
};
