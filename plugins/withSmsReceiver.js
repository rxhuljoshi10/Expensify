// plugins/withSmsReceiver.js
// Expo Config Plugin that injects the SmsReceiver native module into the Android project.
// This file is run by `expo prebuild` and survives every rebuild.
// Reference: https://docs.expo.dev/config-plugins/introduction/

const {
  withAndroidManifest,
  withMainApplication,
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// ─── Kotlin source files ──────────────────────────────────────────────────────

const SMS_FOREGROUND_SERVICE_KT = `package com.rxhuljoshi.expensify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Foreground Service that runs a lightweight status notification
 * to keep the Expensify process active on Android 14+ / Android 15.
 */
class SmsForegroundService : Service() {

    companion object {
        private const val TAG = "ExpensifySMS"
        private const val CHANNEL_ID = "expensify_sms_sync_channel"
        private const val NOTIFICATION_ID = 8888

        fun start(context: Context) {
            try {
                val intent = Intent(context, SmsForegroundService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                Log.d(TAG, "SmsForegroundService start requested")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start SmsForegroundService", e)
            }
        }

        fun stop(context: Context) {
            try {
                val intent = Intent(context, SmsForegroundService::class.java)
                context.stopService(intent)
                Log.d(TAG, "SmsForegroundService stop requested")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to stop SmsForegroundService", e)
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Expensify SMS Auto-Sync")
            .setContentText("Listening for transaction SMS in background")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

        startForeground(NOTIFICATION_ID, notification)
        Log.d(TAG, "SmsForegroundService is running in foreground")

        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SMS Auto-Sync Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps Expensify SMS background tracking active"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}
`;

const NATIVE_SMS_PROCESSOR_KT = `package com.rxhuljoshi.expensify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Native SMS processor that handles expense detection entirely in Kotlin.
 */
object NativeSmsProcessor {

    private const val TAG = "ExpensifySMS"

    private const val SUPABASE_URL = "https://boxxvhsgpzhjkomqhyxn.supabase.co"
    private const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveHh2aHNncHpoamtvbXFoeXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTgxNTgsImV4cCI6MjA5MDUzNDE1OH0.HG80HR7l5bpWvIos3b59YBxBHUsxPGb0DXIz7llN3bo"

    private const val NOTIFICATION_CHANNEL_ID = "expense_notifications"
    private const val DEDUP_PREFS = "sms_dedup_prefs"
    private const val AUTH_PREFS = "expensify_auth_prefs"
    private const val DEDUP_WINDOW_MS = 30 * 60 * 1000L // 30 minutes

    private val DEBIT_KEYWORDS = listOf(
        "sent", "debited", "charged", "paid", "spent",
        "withdrawn", "purchase", "txn", "transferred"
    )

    private val CREDIT_KEYWORDS = listOf(
        "credited", "received", "refund", "cashback",
        "reversed", "deposited"
    )

    private val CURRENCY_PATTERN = Regex("""(?:Rs\\.?|₹|INR)\\s*[\\d,.]+""", RegexOption.IGNORE_CASE)
    private val AMOUNT_PATTERN = Regex("""(?:Rs\\.?|₹|INR)\\s*([\\d,]+(?:\\.\\d{1,2})?)""", RegexOption.IGNORE_CASE)
    private val VPA_PATTERN = Regex("""(?:to\\s+)?([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)""", RegexOption.IGNORE_CASE)
    private val NUM_DATE_PATTERN = Regex("""(\\d{1,2})[-/](\\d{1,2})[-/](\\d{2,4})""")
    private val MON_DATE_PATTERN = Regex("""(\\d{1,2})[-/]([A-Za-z]{3})[-/](\\d{2,4})""")

    private val MONTH_MAP = mapOf(
        "jan" to "01", "feb" to "02", "mar" to "03", "apr" to "04",
        "may" to "05", "jun" to "06", "jul" to "07", "aug" to "08",
        "sep" to "09", "oct" to "10", "nov" to "11", "dec" to "12"
    )

    private val P2P_BANKS = listOf("ybl", "paytm", "ibl", "apl")

    fun process(context: Context, smsBody: String) {
        try {
            Log.d(TAG, "NativeSmsProcessor: processing SMS...")

            if (!isTransactionalSms(smsBody)) {
                Log.d(TAG, "NativeSmsProcessor: not a transactional SMS, skipping")
                return
            }

            val fields = extractBasicFields(smsBody)
            if (fields == null) {
                Log.d(TAG, "NativeSmsProcessor: could not extract fields, skipping")
                return
            }

            val dedupKey = "\${fields.amount}|\${fields.date ?: "unknown"}|\${(fields.vpa ?: "unknown").lowercase()}"
            if (isDuplicate(context, dedupKey)) {
                Log.d(TAG, "NativeSmsProcessor: duplicate SMS, skipping")
                return
            }

            val session = getUserSession(context)
            if (session == null) {
                Log.w(TAG, "NativeSmsProcessor: no active user session found, skipping")
                return
            }

            val dateStr = fields.date ?: SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            val amountPaise = Math.round(fields.amount * 100)

            if (fields.vpa == null) {
                val saved = saveExpenseToSupabase(
                    userId = session.userId,
                    accessToken = session.accessToken,
                    amount = amountPaise,
                    merchant = "Unknown Merchant",
                    category = "Other",
                    expenseDate = dateStr
                )
                if (saved) {
                    showNotification(
                        context,
                        title = "Expense Saved",
                        body = "\${formatRupees(fields.amount)} — Unknown merchant (Other)",
                        targetScreen = "expenses"
                    )
                }
                return
            }

            val classification = classifyVpa(fields.vpa)

            when (classification.type) {
                "personal" -> {
                    val displayName = formatMerchantFromVpa(classification.handle, "personal")
                    val saved = saveExpenseToSupabase(
                        userId = session.userId,
                        accessToken = session.accessToken,
                        amount = amountPaise,
                        merchant = displayName,
                        category = "Personal",
                        expenseDate = dateStr
                    )
                    if (saved) {
                        showNotification(
                            context,
                            title = "Expense Saved",
                            body = "\${formatRupees(fields.amount)} to \$displayName (Personal)",
                            targetScreen = "expenses"
                        )
                    }
                }

                "brand" -> {
                    val displayName = formatMerchantFromVpa(classification.handle, "brand")
                    val saved = saveExpenseToSupabase(
                        userId = session.userId,
                        accessToken = session.accessToken,
                        amount = amountPaise,
                        merchant = displayName,
                        category = "Other",
                        expenseDate = dateStr
                    )
                    if (saved) {
                        showNotification(
                            context,
                            title = "Expense Saved",
                            body = "\${formatRupees(fields.amount)} at \$displayName (Other)",
                            targetScreen = "expenses"
                        )
                    }
                }

                "dynamic_qr" -> {
                    val mapping = lookupMerchantMapping(
                        userId = session.userId,
                        accessToken = session.accessToken,
                        rawVpa = classification.raw
                    )

                    if (mapping != null) {
                        val saved = saveExpenseToSupabase(
                            userId = session.userId,
                            accessToken = session.accessToken,
                            amount = amountPaise,
                            merchant = mapping.friendlyName,
                            category = mapping.category,
                            expenseDate = dateStr
                        )
                        if (saved) {
                            showNotification(
                                context,
                                title = "Expense Saved",
                                body = "\${formatRupees(fields.amount)} at \${mapping.friendlyName} (\${mapping.category})",
                                targetScreen = "expenses"
                            )
                        }
                    } else {
                        val savedPending = savePendingExpenseToSupabase(
                            userId = session.userId,
                            accessToken = session.accessToken,
                            rawSms = smsBody,
                            amount = amountPaise,
                            rawVpa = classification.raw,
                            vpaType = "dynamic_qr",
                            parsedDate = dateStr
                        )
                        if (savedPending) {
                            val displayName = formatMerchantFromVpa(classification.handle, "dynamic_qr")
                            showNotification(
                                context,
                                title = "New Expense Detected",
                                body = "\${formatRupees(fields.amount)} at \$displayName. Tap to name this merchant.",
                                targetScreen = "pending-expenses"
                            )
                        }
                    }
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "NativeSmsProcessor: processing failed", e)
        }
    }

    private fun isTransactionalSms(body: String): Boolean {
        val lower = body.lowercase()
        if (!CURRENCY_PATTERN.containsMatchIn(body)) return false
        if (CREDIT_KEYWORDS.any { lower.contains(it) }) return false
        return DEBIT_KEYWORDS.any { lower.contains(it) }
    }

    data class SmsFields(
        val amount: Double,
        val vpa: String?,
        val date: String?
    )

    private fun extractBasicFields(body: String): SmsFields? {
        val amountMatch = AMOUNT_PATTERN.find(body) ?: return null
        val amountStr = amountMatch.groupValues[1].replace(",", "")
        val amount = amountStr.toDoubleOrNull() ?: return null
        if (amount <= 0) return null

        val vpaMatch = VPA_PATTERN.find(body)
        val vpa = vpaMatch?.groupValues?.get(1)?.trimEnd('.', ',')

        var date: String? = null

        val numDateMatch = NUM_DATE_PATTERN.find(body)
        if (numDateMatch != null) {
            val day = numDateMatch.groupValues[1].padStart(2, '0')
            val month = numDateMatch.groupValues[2].padStart(2, '0')
            var year = numDateMatch.groupValues[3]
            if (year.length == 2) year = "20$year"
            date = "$year-$month-$day"
        }

        if (date == null) {
            val monDateMatch = MON_DATE_PATTERN.find(body)
            if (monDateMatch != null) {
                val day = monDateMatch.groupValues[1].padStart(2, '0')
                val mon = MONTH_MAP[monDateMatch.groupValues[2].lowercase()] ?: "01"
                var year = monDateMatch.groupValues[3]
                if (year.length == 2) year = "20$year"
                date = "$year-$mon-$day"
            }
        }

        return SmsFields(amount, vpa, date)
    }

    data class VpaClassification(
        val handle: String,
        val bank: String,
        val type: String,
        val raw: String
    )

    private fun classifyVpa(vpa: String): VpaClassification {
        val atIndex = vpa.indexOf('@')
        if (atIndex == -1) {
            return VpaClassification(vpa, "", "brand", vpa)
        }

        val handle = vpa.substring(0, atIndex).lowercase()
        val bank = vpa.substring(atIndex + 1).lowercase()

        val isPhoneNumber = Regex("""^\\d{10}$""").matches(handle)
        val isOkBank = bank.startsWith("ok")
        val isP2pBank = P2P_BANKS.contains(bank)

        if (isPhoneNumber || isOkBank || isP2pBank) {
            return VpaClassification(handle, bank, "personal", vpa)
        }

        val hasQr = handle.contains("qr")
        val isBharatPe = handle.startsWith("bharatpe")
        val isGibberish = Regex("""^[a-z0-9]{10,}$""").matches(handle)
                && Regex("""[a-z]""").containsMatchIn(handle)
                && Regex("""\\d""").containsMatchIn(handle)
        val isPaytmQr = handle.startsWith("paytm") && handle.length > 5

        if (hasQr || isBharatPe || isGibberish || isPaytmQr) {
            return VpaClassification(handle, bank, "dynamic_qr", vpa)
        }

        return VpaClassification(handle, bank, "brand", vpa)
    }

    private fun formatMerchantFromVpa(handle: String, type: String): String {
        return when (type) {
            "brand" -> handle.replaceFirstChar { it.uppercase() }
            "dynamic_qr" -> {
                if (handle.contains("qr")) {
                    val qrIdx = handle.indexOf("qr")
                    val prefix = handle.substring(0, qrIdx)
                    val code = handle.substring(qrIdx + 2)
                    val displayPrefix = if (prefix.isNotEmpty())
                        prefix.replaceFirstChar { it.uppercase() }
                    else "QR"
                    val shortCode = if (code.length > 6) code.substring(0, 6) + "..." else code
                    "$displayPrefix QR ($shortCode)"
                } else {
                    val short = if (handle.length > 8) handle.substring(0, 8) + "..." else handle
                    "Unknown ($short)"
                }
            }
            else -> handle.replaceFirstChar { it.uppercase() }
        }
    }

    private fun isDuplicate(context: Context, key: String): Boolean {
        val prefs = context.getSharedPreferences(DEDUP_PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()

        val allEntries = prefs.all
        val editor = prefs.edit()
        for ((k, v) in allEntries) {
            if (v is Long && now - v > DEDUP_WINDOW_MS) {
                editor.remove(k)
            }
        }

        val existing = prefs.getLong(key, 0L)
        if (existing > 0 && now - existing < DEDUP_WINDOW_MS) {
            editor.apply()
            return true
        }

        editor.putLong(key, now)
        editor.apply()
        return false
    }

    data class UserSession(
        val userId: String,
        val accessToken: String
    )

    private fun getUserSession(context: Context): UserSession? {
        try {
            val authPrefs = context.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
            val userId = authPrefs.getString("user_id", null)
            val token = authPrefs.getString("access_token", null)
            if (!userId.isNullOrEmpty() && !token.isNullOrEmpty()) {
                return UserSession(userId, token)
            }
        } catch (_: Exception) {}

        try {
            val dbPath = context.getDatabasePath("RKStorage")
            if (!dbPath.exists()) return null

            val db = SQLiteDatabase.openDatabase(
                dbPath.absolutePath, null, SQLiteDatabase.OPEN_READONLY
            )

            val cursor = db.rawQuery(
                "SELECT value FROM catalystLocalStorage WHERE key LIKE '%auth%token%' OR key LIKE '%supabase%auth%' LIMIT 10",
                null
            )

            var session: UserSession? = null

            while (cursor.moveToNext()) {
                val value = cursor.getString(0) ?: continue
                try {
                    val json = JSONObject(value)
                    session = tryExtractSession(json)
                    if (session != null) break
                } catch (_: Exception) {
                    continue
                }
            }

            cursor.close()
            db.close()
            return session
        } catch (_: Exception) {
            return null
        }
    }

    private fun tryExtractSession(json: JSONObject): UserSession? {
        try {
            val currentSession = json.optJSONObject("currentSession")
            if (currentSession != null) {
                val token = currentSession.optString("access_token", "")
                val user = currentSession.optJSONObject("user")
                val userId = user?.optString("id", "") ?: ""
                if (token.isNotEmpty() && userId.isNotEmpty()) {
                    return UserSession(userId, token)
                }
            }
        } catch (_: Exception) {}

        try {
            val token = json.optString("access_token", "")
            val user = json.optJSONObject("user")
            val userId = user?.optString("id", "") ?: ""
            if (token.isNotEmpty() && userId.isNotEmpty()) {
                return UserSession(userId, token)
            }
        } catch (_: Exception) {}

        return null
    }

    data class MerchantMapping(
        val friendlyName: String,
        val category: String
    )

    private fun lookupMerchantMapping(userId: String, accessToken: String, rawVpa: String): MerchantMapping? {
        try {
            val encodedVpa = Uri.encode(rawVpa.lowercase())
            val url = URL("$SUPABASE_URL/rest/v1/merchant_mappings?user_id=eq.$userId&raw_vpa=eq.$encodedVpa&select=friendly_name,category")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY)
            conn.setRequestProperty("Authorization", "Bearer $accessToken")
            conn.connectTimeout = 8000
            conn.readTimeout = 8000

            val responseCode = conn.responseCode
            if (responseCode in 200..299) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val responseText = reader.readText()
                reader.close()

                val jsonArray = JSONArray(responseText)
                if (jsonArray.length() > 0) {
                    val obj = jsonArray.getJSONObject(0)
                    val friendlyName = obj.optString("friendly_name", "")
                    val category = obj.optString("category", "Other")
                    if (friendlyName.isNotEmpty()) {
                        return MerchantMapping(friendlyName, category)
                    }
                }
            }
            conn.disconnect()
        } catch (e: Exception) {
            Log.e(TAG, "Error looking up merchant mapping", e)
        }
        return null
    }

    private fun saveExpenseToSupabase(
        userId: String,
        accessToken: String,
        amount: Long,
        merchant: String,
        category: String,
        expenseDate: String
    ): Boolean {
        try {
            val url = URL("$SUPABASE_URL/rest/v1/expenses")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY)
            conn.setRequestProperty("Authorization", "Bearer $accessToken")
            conn.setRequestProperty("Prefer", "return=minimal")
            conn.doOutput = true
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            val body = JSONObject().apply {
                put("user_id", userId)
                put("amount", amount)
                put("merchant", merchant)
                put("category", category)
                put("expense_date", expenseDate)
                put("source", "sms")
            }

            val writer = OutputStreamWriter(conn.outputStream)
            writer.write(body.toString())
            writer.flush()
            writer.close()

            val responseCode = conn.responseCode
            return responseCode in 200..299
        } catch (e: Exception) {
            Log.e(TAG, "Supabase REST API call failed", e)
            return false
        }
    }

    private fun savePendingExpenseToSupabase(
        userId: String,
        accessToken: String,
        rawSms: String,
        amount: Long,
        rawVpa: String?,
        vpaType: String,
        parsedDate: String
    ): Boolean {
        try {
            val url = URL("$SUPABASE_URL/rest/v1/pending_sms_expenses")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY)
            conn.setRequestProperty("Authorization", "Bearer $accessToken")
            conn.setRequestProperty("Prefer", "return=minimal")
            conn.doOutput = true
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            val body = JSONObject().apply {
                put("user_id", userId)
                put("raw_sms", rawSms)
                put("amount", amount)
                if (rawVpa != null) put("raw_vpa", rawVpa)
                put("vpa_type", vpaType)
                put("parsed_date", parsedDate)
                put("status", "pending")
            }

            val writer = OutputStreamWriter(conn.outputStream)
            writer.write(body.toString())
            writer.flush()
            writer.close()

            val responseCode = conn.responseCode
            return responseCode in 200..299
        } catch (e: Exception) {
            Log.e(TAG, "Supabase REST API call failed (pending)", e)
            return false
        }
    }

    private fun showNotification(context: Context, title: String, body: String, targetScreen: String) {
        createNotificationChannel(context)

        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            putExtra("screen", targetScreen)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            (System.currentTimeMillis() % 10000).toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationId = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
        val notification = NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
    }

    private fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Expense Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for automatically tracked expenses"
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun formatRupees(amount: Double): String {
        return if (amount == amount.toLong().toDouble()) {
            "₹\${amount.toLong()}"
        } else {
            "₹\${"%.2f".format(amount)}"
        }
    }
}
`;

const SMS_WORKER_KT = `package com.rxhuljoshi.expensify

import android.content.Context
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters

class SmsWorker(
    context: Context,
    workerParams: WorkerParameters
) : Worker(context, workerParams) {

    override fun doWork(): Result {
        val smsBody = inputData.getString("smsBody")
        if (smsBody.isNullOrEmpty()) {
            Log.w("ExpensifySMS", "SmsWorker: smsBody inputData is null or empty")
            return Result.failure()
        }

        return try {
            NativeSmsProcessor.process(applicationContext, smsBody)
            Result.success()
        } catch (e: Exception) {
            Log.e("ExpensifySMS", "SmsWorker failed during processing", e)
            Result.failure()
        }
    }
}
`;

const SMS_RECEIVER_KT = `package com.rxhuljoshi.expensify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

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

        if (grouped.isEmpty()) return

        val workManager = WorkManager.getInstance(context.applicationContext)

        for ((sender, body) in grouped) {
            val smsBody = body.toString()
            Log.d("ExpensifySMS", "SMS received from \$sender, enqueuing WorkManager job")

            val inputData = Data.Builder()
                .putString("sender", sender)
                .putString("smsBody", smsBody)
                .build()

            val workRequest = OneTimeWorkRequestBuilder<SmsWorker>()
                .setInputData(inputData)
                .build()

            workManager.enqueue(workRequest)
        }
    }
}
`;

const SMS_RECEIVER_MODULE_KT = `package com.rxhuljoshi.expensify

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SmsReceiverModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val AUTH_PREFS = "expensify_auth_prefs"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_ACCESS_TOKEN = "access_token"
    }

    override fun getName(): String = "SmsReceiverModule"

    @ReactMethod
    fun saveAuthToken(userId: String, accessToken: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_USER_ID, userId)
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .apply()

            Log.d("ExpensifySMS", "SmsReceiverModule: saved auth token for user: \$userId")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("ExpensifySMS", "SmsReceiverModule: failed to save auth token", e)
            promise.reject("AUTH_SAVE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun startForegroundService(promise: Promise) {
        try {
            SmsForegroundService.start(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("ExpensifySMS", "Failed to start foreground service", e)
            promise.reject("SERVICE_START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopForegroundService(promise: Promise) {
        try {
            SmsForegroundService.stop(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("ExpensifySMS", "Failed to stop foreground service", e)
            promise.reject("SERVICE_STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod fun startListening(promise: Promise) { promise.resolve(null) }
    @ReactMethod fun stopListening(promise: Promise) { promise.resolve(null) }
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
`;

const SMS_RECEIVER_PACKAGE_KT = `package com.rxhuljoshi.expensify

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SmsReceiverPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(SmsReceiverModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

// ─── Plugin steps ─────────────────────────────────────────────────────────────

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
        'SmsForegroundService.kt': SMS_FOREGROUND_SERVICE_KT,
        'NativeSmsProcessor.kt': NATIVE_SMS_PROCESSOR_KT,
        'SmsWorker.kt': SMS_WORKER_KT,
        'SmsReceiver.kt': SMS_RECEIVER_KT,
        'SmsReceiverModule.kt': SMS_RECEIVER_MODULE_KT,
        'SmsReceiverPackage.kt': SMS_RECEIVER_PACKAGE_KT,
      };

      for (const [filename, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(packageDir, filename), content, 'utf8');
      }

      return config;
    },
  ]);
}

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

function withSmsGradleDependencies(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('androidx.work:work-runtime-ktx')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation("androidx.work:work-runtime-ktx:2.8.1")`,
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

function withSmsManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application[0];

    const existingPermissions = (manifest['uses-permission'] || []).map(
      (p) => p.$?.['android:name'],
    );

    const requiredPermissions = [
      'android.permission.WAKE_LOCK',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    ];

    for (const perm of requiredPermissions) {
      if (!existingPermissions.includes(perm)) {
        manifest['uses-permission'] = manifest['uses-permission'] || [];
        manifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    }

    // Service declaration
    const services = application.service || [];
    const serviceDeclared = services.some(
      (s) => s.$?.['android:name'] === '.SmsForegroundService',
    );

    if (!serviceDeclared) {
      application.service = [
        ...services,
        {
          $: {
            'android:name': '.SmsForegroundService',
            'android:exported': 'false',
            'android:foregroundServiceType': 'specialUse',
          },
          property: [
            {
              $: {
                'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
                'android:value': 'SMS Background Auto-Sync',
              },
            },
          ],
        },
      ];
    }

    // Receiver declaration
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

    return config;
  });
}

module.exports = function withSmsReceiver(config) {
  config = withSmsKotlinFiles(config);
  config = withSmsMainApplication(config);
  config = withSmsGradleDependencies(config);
  config = withSmsManifest(config);
  return config;
};
