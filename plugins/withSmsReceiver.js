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

// SmsForegroundService removed — the SmsReceiver BroadcastReceiver handles SMS natively
// without needing a persistent foreground service notification.

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
 * Includes automatic Supabase JWT Token Refresh on HTTP 401 Unauthorized.
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
                    context = context,
                    session = session,
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
                        context = context,
                        session = session,
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
                        context = context,
                        session = session,
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
                        context = context,
                        session = session,
                        rawVpa = classification.raw
                    )

                    if (mapping != null) {
                        val saved = saveExpenseToSupabase(
                            context = context,
                            session = session,
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
                            context = context,
                            session = session,
                            rawSms = smsBody,
                            amount = amountPaise,
                            rawVpa = classification.raw,
                            vpaType = "dynamic_qr",
                            parsedDate = dateStr
                        )
                        if (savedPending) {
                            val displayName = formatMerchantFromVpa(classification.handle, "dynamic_qr")
                            showPendingNotification(
                                context,
                                session,
                                fields.amount,
                                displayName
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
        var accessToken: String,
        var refreshToken: String
    )

    private fun getUserSession(context: Context): UserSession? {
        try {
            val authPrefs = context.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
            val userId = authPrefs.getString("user_id", null)
            val token = authPrefs.getString("access_token", null)
            val refreshToken = authPrefs.getString("refresh_token", "") ?: ""
            if (!userId.isNullOrEmpty() && !token.isNullOrEmpty()) {
                return UserSession(userId, token, refreshToken)
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
                val refreshToken = currentSession.optString("refresh_token", "")
                val user = currentSession.optJSONObject("user")
                val userId = user?.optString("id", "") ?: ""
                if (token.isNotEmpty() && userId.isNotEmpty()) {
                    return UserSession(userId, token, refreshToken)
                }
            }
        } catch (_: Exception) {}

        try {
            val token = json.optString("access_token", "")
            val refreshToken = json.optString("refresh_token", "")
            val user = json.optJSONObject("user")
            val userId = user?.optString("id", "") ?: ""
            if (token.isNotEmpty() && userId.isNotEmpty()) {
                return UserSession(userId, token, refreshToken)
            }
        } catch (_: Exception) {}

        return null
    }

    private fun refreshSupabaseToken(context: Context, session: UserSession): UserSession? {
        if (session.refreshToken.isEmpty()) return null

        try {
            val url = URL("$SUPABASE_URL/auth/v1/token?grant_type=refresh_token")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY)
            conn.doOutput = true
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            val body = JSONObject().apply {
                put("refresh_token", session.refreshToken)
            }

            val writer = OutputStreamWriter(conn.outputStream)
            writer.write(body.toString())
            writer.flush()
            writer.close()

            val responseCode = conn.responseCode
            if (responseCode in 200..299) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val responseText = reader.readText()
                reader.close()

                val json = JSONObject(responseText)
                val newAccessToken = json.optString("access_token", "")
                val newRefreshToken = json.optString("refresh_token", session.refreshToken)
                val userObj = json.optJSONObject("user")
                val userId = userObj?.optString("id", session.userId) ?: session.userId

                if (newAccessToken.isNotEmpty()) {
                    session.accessToken = newAccessToken
                    session.refreshToken = newRefreshToken

                    val prefs = context.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
                    prefs.edit()
                        .putString("access_token", newAccessToken)
                        .putString("refresh_token", newRefreshToken)
                        .apply()

                    Log.d(TAG, "NativeSmsProcessor: successfully refreshed Supabase JWT token natively!")
                    return session
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "NativeSmsProcessor: token refresh exception", e)
        }
        return null
    }

    data class MerchantMapping(
        val friendlyName: String,
        val category: String
    )

    private fun lookupMerchantMapping(context: Context, session: UserSession, rawVpa: String): MerchantMapping? {
        val result = executeLookupMerchantMapping(session.userId, session.accessToken, rawVpa)
        if (result.first == 401) {
            val refreshedSession = refreshSupabaseToken(context, session)
            if (refreshedSession != null) {
                return executeLookupMerchantMapping(refreshedSession.userId, refreshedSession.accessToken, rawVpa).second
            }
        }
        return result.second
    }

    private fun executeLookupMerchantMapping(userId: String, accessToken: String, rawVpa: String): Pair<Int, MerchantMapping?> {
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
                        return Pair(responseCode, MerchantMapping(friendlyName, category))
                    }
                }
                return Pair(responseCode, null)
            }
            conn.disconnect()
            return Pair(responseCode, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error looking up merchant mapping", e)
            return Pair(500, null)
        }
    }

    private fun saveExpenseToSupabase(
        context: Context,
        session: UserSession,
        amount: Long,
        merchant: String,
        category: String,
        expenseDate: String
    ): Boolean {
        var responseCode = executeSaveExpenseToSupabase(session.userId, session.accessToken, amount, merchant, category, expenseDate)
        if (responseCode == 401) {
            val refreshedSession = refreshSupabaseToken(context, session)
            if (refreshedSession != null) {
                responseCode = executeSaveExpenseToSupabase(refreshedSession.userId, refreshedSession.accessToken, amount, merchant, category, expenseDate)
            }
        }
        return responseCode in 200..299
    }

    private fun executeSaveExpenseToSupabase(
        userId: String,
        accessToken: String,
        amount: Long,
        merchant: String,
        category: String,
        expenseDate: String
    ): Int {
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
            return responseCode
        } catch (e: Exception) {
            Log.e(TAG, "Supabase REST API call failed (expenses)", e)
            return 500
        }
    }

    private fun savePendingExpenseToSupabase(
        context: Context,
        session: UserSession,
        rawSms: String,
        amount: Long,
        rawVpa: String?,
        vpaType: String,
        parsedDate: String
    ): Boolean {
        var responseCode = executeSavePendingExpenseToSupabase(session.userId, session.accessToken, rawSms, amount, rawVpa, vpaType, parsedDate)
        if (responseCode == 401) {
            val refreshedSession = refreshSupabaseToken(context, session)
            if (refreshedSession != null) {
                responseCode = executeSavePendingExpenseToSupabase(refreshedSession.userId, refreshedSession.accessToken, rawSms, amount, rawVpa, vpaType, parsedDate)
            }
        }
        return responseCode in 200..299
    }

    private fun executeSavePendingExpenseToSupabase(
        userId: String,
        accessToken: String,
        rawSms: String,
        amount: Long,
        rawVpa: String?,
        vpaType: String,
        parsedDate: String
    ): Int {
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
            return responseCode
        } catch (e: Exception) {
            Log.e(TAG, "Supabase REST API call failed (pending)", e)
            return 500
        }
    }

    private fun getPendingCountFromSupabase(session: UserSession): Int {
        try {
            val url = URL("\$SUPABASE_URL/rest/v1/pending_sms_expenses?user_id=eq.\${session.userId}&status=eq.pending&select=id")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY)
            conn.setRequestProperty("Authorization", "Bearer \${session.accessToken}")
            conn.setRequestProperty("Prefer", "count=exact")
            conn.connectTimeout = 5000
            conn.readTimeout = 5000

            val contentRange = conn.getHeaderField("Content-Range")
            if (contentRange != null && contentRange.contains("/")) {
                val totalStr = contentRange.substringAfter("/")
                val count = totalStr.toIntOrNull()
                if (count != null) return count
            }

            val reader = BufferedReader(InputStreamReader(conn.inputStream))
            val sb = StringBuilder()
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                sb.append(line)
            }
            reader.close()
            val array = JSONArray(sb.toString())
            return array.length()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to fetch pending count", e)
            return 1
        }
    }

    private fun showPendingNotification(
        context: Context,
        session: UserSession,
        amount: Double,
        merchantName: String
    ) {
        val pendingCount = getPendingCountFromSupabase(session)

        val title = if (pendingCount <= 1) {
            "New Expense Detected"
        } else {
            "📱 \$pendingCount Pending Expenses"
        }

        val body = if (pendingCount <= 1) {
            "\${formatRupees(amount)} at \$merchantName. Tap to name this merchant."
        } else {
            "Tap to review and name these merchants."
        }

        createNotificationChannel(context)

        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            putExtra("screen", "pending-expenses")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            9991,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Fixed ID 9991 ensures Android replaces and collapses pending expense notifications into 1 single notification banner
        val PENDING_NOTIFICATION_ID = 9991

        val notification = NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(0xFF03C775.toInt())
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(PENDING_NOTIFICATION_ID, notification)
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
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(0xFF03C775.toInt())
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
        private const val KEY_REFRESH_TOKEN = "refresh_token"
    }

    override fun getName(): String = "SmsReceiverModule"

    @ReactMethod
    fun saveAuthToken(userId: String, accessToken: String, refreshToken: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_USER_ID, userId)
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .putString(KEY_REFRESH_TOKEN, refreshToken)
                .apply()

            Log.d("ExpensifySMS", "SmsReceiverModule: saved auth & refresh tokens for user: \$userId")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("ExpensifySMS", "SmsReceiverModule: failed to save auth tokens", e)
            promise.reject("AUTH_SAVE_ERROR", e.message, e)
        }
    }

    // Foreground service removed — stubbed as no-ops so existing JS callers don't crash
    @ReactMethod
    fun startForegroundService(promise: Promise) { promise.resolve(true) }

    @ReactMethod
    fun stopForegroundService(promise: Promise) { promise.resolve(true) }

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
      'android.permission.POST_NOTIFICATIONS',
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

    // SmsForegroundService removed — no manifest service entry needed

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
