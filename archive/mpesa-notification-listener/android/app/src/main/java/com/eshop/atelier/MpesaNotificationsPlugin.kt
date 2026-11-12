package com.eshop.atelier

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.content.ComponentName
import androidx.core.content.ContextCompat
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "MpesaNotifications")
class MpesaNotificationsPlugin : Plugin() {
    private var transactionReceiver: BroadcastReceiver? = null

    override fun load() {
        super.load()
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (intent.action) {
                    MpesaNotificationListenerService.ACTION_TRANSACTION_RECEIVED -> {
                        val transaction = intent.getStringExtra(MpesaNotificationListenerService.EXTRA_TRANSACTION) ?: return
                        notifyListeners("transactionReceived", JSObject(transaction))
                    }
                    MpesaNotificationListenerService.ACTION_FAKE_MPESA_ALERT -> {
                        val alert = intent.getStringExtra(MpesaNotificationListenerService.EXTRA_FAKE_MPESA_ALERT) ?: return
                        notifyListeners("fakeSenderAlert", JSObject(alert))
                    }
                }
            }
        }
        transactionReceiver = receiver
        ContextCompat.registerReceiver(
            context,
            receiver,
            IntentFilter().apply {
                addAction(MpesaNotificationListenerService.ACTION_TRANSACTION_RECEIVED)
                addAction(MpesaNotificationListenerService.ACTION_FAKE_MPESA_ALERT)
            },
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val enabled = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
        if (enabled && !MpesaNotificationListenerService.isConnected) {
            NotificationListenerService.requestRebind(
                ComponentName(context, MpesaNotificationListenerService::class.java)
            )
        }
        val result = JSObject()
        result.put("enabled", enabled)
        result.put("connected", MpesaNotificationListenerService.isConnected)
        call.resolve(result)
    }

    @PluginMethod
    fun getTransactions(call: PluginCall) {
        val result = JSObject()
        result.put("transactions", JSArray(MpesaNotificationStore.all(context).toString()))
        call.resolve(result)
    }

    @PluginMethod
    fun getFakeSenderAlerts(call: PluginCall) {
        val result = JSObject()
        result.put("alerts", JSArray(MpesaNotificationStore.fakeAlerts(context).toString()))
        call.resolve(result)
    }

    @PluginMethod
    fun getOwnIdentifiers(call: PluginCall) {
        val preferences = context.getSharedPreferences(MpesaNotificationListenerService.PREFERENCES, Context.MODE_PRIVATE)
        val result = JSObject()
        result.put("numbers", JSArray(preferences.getStringSet(MpesaNotificationListenerService.OWN_NUMBERS, emptySet()).orEmpty().toList()))
        result.put("names", JSArray(preferences.getStringSet(MpesaNotificationListenerService.OWN_NAMES, emptySet()).orEmpty().toList()))
        call.resolve(result)
    }

    @PluginMethod
    fun setOwnIdentifiers(call: PluginCall) {
        val numbers = call.getString("numbers", "").orEmpty()
            .split(Regex("[,;\\n]+")).map(String::trim).filter(String::isNotEmpty).toSet()
        val names = call.getString("names", "").orEmpty()
            .split(Regex("[,;\\n]+")).map(String::trim).filter(String::isNotEmpty).toSet()
        context.getSharedPreferences(MpesaNotificationListenerService.PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(MpesaNotificationListenerService.OWN_NUMBERS, numbers)
            .putStringSet(MpesaNotificationListenerService.OWN_NAMES, names)
            .apply()
        call.resolve()
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        try {
            context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            call.resolve()
        } catch (error: Exception) {
            call.reject("Android could not open Notification Access settings.", error)
        }
    }

    override fun handleOnDestroy() {
        transactionReceiver?.let { context.unregisterReceiver(it) }
        transactionReceiver = null
        super.handleOnDestroy()
    }
}
