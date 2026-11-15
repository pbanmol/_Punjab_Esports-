package com.punjab.esports;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "NativeNotifications")
public class NativeNotificationsPlugin extends Plugin {

    @PluginMethod
    public void showNotification(PluginCall call) {
        try {
            String id = call.getString("id", String.valueOf(System.currentTimeMillis()));
            String title = call.getString("title", "Punjab Esports");
            String body = call.getString("body", "");
            BackgroundNotificationJobService.postSystemNotification(getContext(), id, title, body);
            call.resolve();
        } catch (Exception e) {
            call.resolve();
        }
    }

    @PluginMethod
    public void markSeenIds(PluginCall call) {
        try {
            JSArray ids = call.getArray("ids");
            if (ids != null) {
                SharedPreferences prefs = getContext().getSharedPreferences(
                        BackgroundNotificationJobService.PREFS_NAME, Context.MODE_PRIVATE);
                Set<String> seen = new HashSet<>(prefs.getStringSet("seen_notif_ids", new HashSet<>()));
                for (int i = 0; i < ids.length(); i++) {
                    String id = ids.optString(i, "");
                    if (!id.isEmpty()) seen.add(id);
                }
                if (seen.size() > 160) {
                    List<String> list = new ArrayList<>(seen);
                    seen = new HashSet<>(list.subList(Math.max(0, list.size() - 120), list.size()));
                }
                prefs.edit().putStringSet("seen_notif_ids", seen).apply();
            }
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void saveSession(PluginCall call) {
        try {
            String uid = call.getString("uid", "");
            String refreshToken = call.getString("refreshToken", "");
            String apiKey = call.getString("apiKey", "");
            String dbUrl = call.getString("dbUrl", "");
            Double lastBalance = call.getDouble("lastBalance");

            if (uid != null && !uid.isEmpty() && refreshToken != null && !refreshToken.isEmpty()
                    && apiKey != null && !apiKey.isEmpty() && dbUrl != null && !dbUrl.isEmpty()) {
                SharedPreferences prefs = getContext().getSharedPreferences(
                        BackgroundNotificationJobService.PREFS_NAME, Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit()
                        .putBoolean("active", true)
                        .putString("uid", uid)
                        .putString("refreshToken", refreshToken)
                        .putString("apiKey", apiKey)
                        .putString("dbUrl", dbUrl);
                if (lastBalance != null) {
                    editor.putLong("last_balance", Double.doubleToRawLongBits(lastBalance));
                }
                editor.apply();

                BackgroundNotificationJobService.ensureNotificationChannel(getContext());
                BackgroundNotificationJobService.schedulePeriodic(getContext());
            }
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void updateLastBalance(PluginCall call) {
        try {
            Double balance = call.getDouble("balance");
            if (balance != null) {
                SharedPreferences prefs = getContext().getSharedPreferences(
                        BackgroundNotificationJobService.PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putLong("last_balance", Double.doubleToRawLongBits(balance)).apply();
            }
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(
                    BackgroundNotificationJobService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().clear().apply();
            BackgroundNotificationJobService.cancelAll(getContext());
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", BackgroundNotificationJobService.canPostNotifications(getContext()));
        call.resolve(ret);
    }
}
