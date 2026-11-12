package com.eshop.atelier

import android.app.Notification
import android.content.ComponentName
import android.content.Intent
import android.util.Log
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.provider.Telephony
import org.json.JSONArray
import org.json.JSONObject

class MpesaNotificationListenerService : NotificationListenerService() {
    override fun onListenerConnected() {
        super.onListenerConnected()
        isConnected = true
        Log.i(TAG, "Notification listener connected")
    }

    override fun onListenerDisconnected() {
        isConnected = false
        Log.w(TAG, "Notification listener disconnected")
        super.onListenerDisconnected()
        requestRebind(ComponentName(this, MpesaNotificationListenerService::class.java))
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val defaultSmsPackage = Telephony.Sms.getDefaultSmsPackage(applicationContext)
        val fromDefaultSmsApp = !defaultSmsPackage.isNullOrBlank() && sbn.packageName == defaultSmsPackage
        Log.i(TAG, "Notification callback received; fromDefaultSmsApp=$fromDefaultSmsApp")
        if (!fromDefaultSmsApp) return
        val extras = sbn.notification.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val bodies = recoverSmsNotificationTexts(extras)
        Log.i(TAG, "Default SMS notification inspected; hasMpesaTitle=${title.replace(Regex("""[^A-Za-z0-9]"""), "").equals("MPESA", true)}, textCandidates=${bodies.size}")
        val preferences = getSharedPreferences(PREFERENCES, MODE_PRIVATE)
        val ownNumbers = preferences.getStringSet(OWN_NUMBERS, emptySet()).orEmpty()
        val ownNames = preferences.getStringSet(OWN_NAMES, emptySet()).orEmpty()
        val seenReferences = mutableSetOf<String>()
        var savedCount = 0
        for (body in bodies) {
            val fakeAlert = MpesaNotificationParser.detectFakeMpesaSender(title, body, sbn.postTime)
            if (fakeAlert != null) {
                val saved = MpesaNotificationStore.saveFakeAlert(applicationContext, fakeAlert)
                sendBroadcast(
                    Intent(ACTION_FAKE_MPESA_ALERT)
                        .setPackage(packageName)
                        .putExtra(EXTRA_FAKE_MPESA_ALERT, saved.toString())
                )
                continue
            }
            val transaction = MpesaNotificationParser.parse(title, body, sbn.postTime, ownNumbers, ownNames)
                ?: continue
            if (!seenReferences.add(transaction.transactionCode)) continue
            val saved = MpesaNotificationStore.save(applicationContext, transaction)
            savedCount++
            sendBroadcast(
                Intent(ACTION_TRANSACTION_RECEIVED)
                    .setPackage(packageName)
                    .putExtra(EXTRA_TRANSACTION, saved.toString())
            )
        }
        if (savedCount == 0) {
            Log.i(TAG, "Default SMS notification contained no new confirmed M-Pesa transactions")
            return
        }
        Log.i(TAG, "Saved $savedCount confirmed M-Pesa transaction(s) from notification")
    }

    private fun recoverSmsNotificationTexts(extras: android.os.Bundle): List<String> {
        val messageTexts = extras.getParcelableArray(Notification.EXTRA_MESSAGES)
            ?.let { Notification.MessagingStyle.Message.getMessagesFromBundleArray(it) }
            ?.mapNotNull { it.text?.toString()?.takeIf(String::isNotBlank) }
            .orEmpty()
        if (messageTexts.isNotEmpty()) return messageTexts.flatMap(::splitSmsConversation).distinct()

        val textLines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
            ?.map(CharSequence::toString)
            ?.filter(String::isNotBlank)
            .orEmpty()
        if (textLines.isNotEmpty()) return textLines.flatMap(::splitSmsConversation).distinct()

        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
        if (bigText.isNotBlank()) return splitSmsConversation(bigText).distinct()

        val summary = extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)?.toString().orEmpty()
        val shortText = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val selected = if (summary.length > shortText.length) summary else shortText
        if (selected.isBlank()) return emptyList()
        return splitSmsConversation(selected).distinct()
    }

    private fun splitSmsConversation(text: String): List<String> {
        val starts = Regex("""(?i)\b[A-Z0-9]{8,12}\b[\s.,:;!'-]*confirmed\b""")
            .findAll(text).map { it.range.first }.toList()
        if (starts.size <= 1) return listOf(text)
        return starts.mapIndexed { index, start ->
            text.substring(start, starts.getOrNull(index + 1) ?: text.length).trim()
        }.filter(String::isNotBlank)
    }

    companion object {
        private const val TAG = "MpesaNotificationListener"
        @Volatile
        var isConnected = false
            private set
        const val PREFERENCES = "mpesa_notification_transactions"
        const val OWN_NUMBERS = "own_numbers"
        const val OWN_NAMES = "own_names"
        const val ACTION_TRANSACTION_RECEIVED = "com.eshop.atelier.MPESA_TRANSACTION_RECEIVED"
        const val EXTRA_TRANSACTION = "transaction"
        const val ACTION_FAKE_MPESA_ALERT = "com.eshop.atelier.MPESA_FAKE_SENDER_ALERT"
        const val EXTRA_FAKE_MPESA_ALERT = "fakeMpesaAlert"
    }
}

internal object MpesaNotificationStore {
    private const val PREFERENCES = "mpesa_notification_transactions"
    private const val TRANSACTIONS = "transactions"
    private const val FAKE_ALERTS = "fake_sender_alerts"
    private const val MAX_TRANSACTIONS = 500
    private const val MAX_FAKE_ALERTS = 200
    private val lock = Any()

    fun all(context: android.content.Context): JSONArray = synchronized(lock) {
        val raw = context.getSharedPreferences(PREFERENCES, android.content.Context.MODE_PRIVATE)
            .getString(TRANSACTIONS, "[]") ?: "[]"
        JSONArray(raw)
    }

    fun save(context: android.content.Context, transaction: MpesaTransaction): JSONObject = synchronized(lock) {
        val preferences = context.getSharedPreferences(PREFERENCES, android.content.Context.MODE_PRIVATE)
        val current = JSONArray(preferences.getString(TRANSACTIONS, "[]") ?: "[]")
        for (index in 0 until current.length()) {
            if (current.optJSONObject(index)?.optString("transactionCode") == transaction.transactionCode) {
                return@synchronized current.getJSONObject(index)
            }
        }
        val saved = JSONObject()
            .put("transactionCode", transaction.transactionCode)
            .put("amount", transaction.amount)
            .put("currency", "KES")
            .put("direction", transaction.direction)
            .put("channel", transaction.channel)
            .put("counterparty", transaction.counterparty)
            .put("isOwnTransfer", transaction.isOwnTransfer)
            .put("timestamp", transaction.timestamp)
        val updated = JSONArray().put(saved)
        for (index in 0 until minOf(current.length(), MAX_TRANSACTIONS - 1)) {
            updated.put(current.getJSONObject(index))
        }
        preferences.edit().putString(TRANSACTIONS, updated.toString()).apply()
        saved
    }

    fun fakeAlerts(context: android.content.Context): JSONArray = synchronized(lock) {
        val raw = context.getSharedPreferences(PREFERENCES, android.content.Context.MODE_PRIVATE)
            .getString(FAKE_ALERTS, "[]") ?: "[]"
        JSONArray(raw)
    }

    fun saveFakeAlert(context: android.content.Context, alert: FakeMpesaAlert): JSONObject = synchronized(lock) {
        val preferences = context.getSharedPreferences(PREFERENCES, android.content.Context.MODE_PRIVATE)
        val current = JSONArray(preferences.getString(FAKE_ALERTS, "[]") ?: "[]")
        for (index in 0 until current.length()) {
            val existing = current.optJSONObject(index) ?: continue
            if (existing.optString("transactionCode") == alert.transactionCode &&
                existing.optString("sender") == alert.sender
            ) return@synchronized existing
        }
        val saved = JSONObject()
            .put("sender", alert.sender)
            .put("transactionCode", alert.transactionCode)
            .put("amount", alert.amount)
            .put("timestamp", alert.timestamp)
        val updated = JSONArray().put(saved)
        for (index in 0 until minOf(current.length(), MAX_FAKE_ALERTS - 1)) {
            updated.put(current.getJSONObject(index))
        }
        preferences.edit().putString(FAKE_ALERTS, updated.toString()).apply()
        saved
    }
}
