package com.punjab.esports;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONException;

@CapacitorPlugin(name = "NativeNotifications")
public class NativeNotificationPlugin extends Plugin {
    private static WeakReference<NativeNotificationPlugin> activeInstance = new WeakReference<>(null);

    @Override
    public void load() {
        super.load();
        activeInstance = new WeakReference<>(this);
        NotificationHelper.ensureChannel(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        NativeNotificationPlugin current = activeInstance.get();
        if (current == this) {
            activeInstance.clear();
        }
    }

    public static void notifyTapFromActivity(String target) {
        if (target == null || target.trim().isEmpty()) {
            return;
        }
        NativeNotificationPlugin instance = activeInstance.get();
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("target", target.trim());
            instance.notifyListeners("notificationTap", data, true);
        }
    }

    public static void notifyTokenRefreshed(String token) {
        if (token == null || token.trim().isEmpty()) {
            return;
        }
        NativeNotificationPlugin instance = activeInstance.get();
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("token", token.trim());
            instance.notifyListeners("fcmToken", data, true);
        }
    }

    @PluginMethod
    public void syncSession(PluginCall call) {
        Context ctx = getContext();
        String uid = call.getString("uid", "");
        String databaseUrl = call.getString("databaseUrl", "");
        String apiKey = call.getString("apiKey", "");
        String idToken = call.getString("idToken", "");
        String refreshToken = call.getString("refreshToken", "");

        if (uid == null || uid.trim().isEmpty()) {
            NotificationHelper.clearSession(ctx);
            JSObject ret = new JSObject();
            ret.put("synced", false);
            call.resolve(ret);
            return;
        }

        NotificationHelper.ensureChannel(ctx);
        NotificationHelper.saveSession(ctx, uid, databaseUrl, apiKey, idToken, refreshToken);

        JSArray seenArr = call.getArray("seenKeys");
        if (seenArr != null && seenArr.length() > 0) {
            List<String> keys = new ArrayList<>();
            for (int i = 0; i < seenArr.length(); i++) {
                try {
                    String k = seenArr.getString(i);
                    if (k != null && !k.trim().isEmpty()) {
                        keys.add(k.trim());
                    }
                } catch (JSONException ignored) {
                }
            }
            NotificationHelper.markKeysSeen(ctx, keys);
        }

        NotificationHelper.schedulePeriodicSync(ctx);
        NotificationHelper.scheduleAlarmLoop(ctx, NotificationHelper.ALARM_INTERVAL_MS);

        boolean hasBal = NotificationHelper.hasKnownBalance(ctx);
        double lastBal = NotificationHelper.getLastKnownBalance(ctx);
        boolean hasDia = NotificationHelper.hasKnownDiamonds(ctx);
        long lastDia = NotificationHelper.getLastKnownDiamonds(ctx);

        boolean fcmReady = NotificationHelper.isFirebaseConfigured(ctx);
        if (fcmReady) {
            try {
                FirebaseMessaging.getInstance().subscribeToTopic("all_users");
                FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                    JSObject ret = new JSObject();
                    ret.put("synced", true);
                    ret.put("fcmReady", true);
                    ret.put("permissionGranted", NotificationHelper.canPostNotifications(ctx));
                    ret.put("ignoringBatteryOptimizations", NotificationHelper.isIgnoringBatteryOptimizations(ctx));
                    if (hasBal) ret.put("lastKnownBalance", lastBal);
                    if (hasDia) ret.put("lastKnownDiamonds", lastDia);
                    if (task.isSuccessful() && task.getResult() != null && !task.getResult().isEmpty()) {
                        String token = task.getResult();
                        NotificationHelper.saveFcmToken(ctx, token);
                        ret.put("fcmToken", token);
                    } else {
                        ret.put("fcmToken", NotificationHelper.getFcmToken(ctx));
                    }
                    call.resolve(ret);
                });
                return;
            } catch (Throwable ignored) {
            }
        }

        JSObject ret = new JSObject();
        ret.put("synced", true);
        ret.put("fcmReady", false);
        ret.put("fcmToken", "");
        ret.put("permissionGranted", NotificationHelper.canPostNotifications(ctx));
        ret.put("ignoringBatteryOptimizations", NotificationHelper.isIgnoringBatteryOptimizations(ctx));
        if (hasBal) ret.put("lastKnownBalance", lastBal);
        if (hasDia) ret.put("lastKnownDiamonds", lastDia);
        call.resolve(ret);
    }

    @PluginMethod
    public void updateSnapshots(PluginCall call) {
        Double bal = call.getDouble("balance");
        Long dia = call.getLong("diamonds");
        if (dia == null) {
            Integer diaInt = call.getInt("diamonds");
            if (diaInt != null) {
                dia = diaInt.longValue();
            }
        }
        NotificationHelper.saveSnapshots(getContext(), bal, dia);
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        NotificationHelper.clearSession(getContext());
        JSObject ret = new JSObject();
        ret.put("cleared", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void markSeenKeys(PluginCall call) {
        JSArray seenArr = call.getArray("keys");
        if (seenArr != null && seenArr.length() > 0) {
            List<String> keys = new ArrayList<>();
            for (int i = 0; i < seenArr.length(); i++) {
                try {
                    String k = seenArr.getString(i);
                    if (k != null && !k.trim().isEmpty()) {
                        keys.add(k.trim());
                    }
                } catch (JSONException ignored) {
                }
            }
            NotificationHelper.markKeysSeen(getContext(), keys);
        }
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void showLocalNotification(PluginCall call) {
        String dedupeKey = call.getString("dedupeKey", "");
        String title = call.getString("title", "Punjab Esports");
        String body = call.getString("body", "You have a new update.");
        String target = call.getString("target", "notifications");

        boolean shown = NotificationHelper.showNotification(getContext(), dedupeKey, title, body, target);
        JSObject ret = new JSObject();
        ret.put("shown", shown);
        call.resolve(ret);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();
        ret.put("permissionGranted", NotificationHelper.hasNotificationPermission(ctx));
        ret.put("notificationsEnabled", NotificationHelper.canPostNotifications(ctx));
        ret.put("ignoringBatteryOptimizations", NotificationHelper.isIgnoringBatteryOptimizations(ctx));
        ret.put("fcmReady", NotificationHelper.isFirebaseConfigured(ctx));
        ret.put("fcmToken", NotificationHelper.getFcmToken(ctx));
        call.resolve(ret);
    }

    @SuppressLint("InlinedApi")
    @PluginMethod
    public void requestPermission(PluginCall call) {
        Context ctx = getContext();
        if (NotificationHelper.canPostNotifications(ctx)) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && !NotificationHelper.hasNotificationPermission(ctx)
                && getActivity() != null) {
            NotificationHelper.markAskedNotificationPermission(ctx);
            getActivity().requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1002);
            JSObject ret = new JSObject();
            ret.put("requested", true);
            ret.put("granted", false);
            call.resolve(ret);
            return;
        }
        openNotificationSettingsInternal();
        JSObject ret = new JSObject();
        ret.put("openedSettings", true);
        ret.put("granted", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        openNotificationSettingsInternal();
        JSObject ret = new JSObject();
        ret.put("opened", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        } catch (Exception e) {
            try {
                Context ctx = getContext();
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(android.net.Uri.fromParts("package", ctx.getPackageName(), null));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
            } catch (Exception ignored) {
            }
        }
        JSObject ret = new JSObject();
        ret.put("opened", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void consumePendingTarget(PluginCall call) {
        String target = NotificationHelper.consumePendingOpenTarget(getContext());
        JSObject ret = new JSObject();
        ret.put("target", target);
        call.resolve(ret);
    }

    private void openNotificationSettingsInternal() {
        try {
            Context ctx = getContext();
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(android.net.Uri.fromParts("package", ctx.getPackageName(), null));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        } catch (Exception ignored) {
        }
    }
}
