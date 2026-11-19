package com.punjab.esports;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.google.firebase.FirebaseApp;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

public final class NotificationHelper {
    public static final String CHANNEL_ID = "punjab_esports_alerts";
    public static final String CHANNEL_NAME = "Punjab Esports Alerts";
    public static final String CHANNEL_DESC = "Match updates, room IDs, wallet credits, mailbox gifts and admin replies";
    public static final String EXTRA_OPEN_TARGET = "pe_open_target";

    private static final String PREFS_NAME = "pe_notif_prefs";
    private static final String KEY_UID = "uid";
    private static final String KEY_DB_URL = "database_url";
    private static final String KEY_API_KEY = "api_key";
    private static final String KEY_ID_TOKEN = "id_token";
    private static final String KEY_REFRESH_TOKEN = "refresh_token";
    private static final String KEY_FCM_TOKEN = "fcm_token";
    private static final String KEY_SEEN_KEYS = "seen_keys";
    private static final String KEY_PENDING_TARGET = "pending_open_target";
    private static final String KEY_ASKED_NOTIF_PERM = "asked_notif_perm";

    private static final String WORK_PERIODIC_NAME = "pe_bg_notif_periodic";
    private static final String WORK_QUICK_NAME = "pe_bg_notif_quick";
    private static final int MAX_SEEN_KEYS = 250;

    private NotificationHelper() {}

    public static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) {
            return;
        }
        NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
        if (existing != null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(CHANNEL_DESC);
        channel.enableLights(true);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 220, 120, 220});
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        channel.setSound(defaultSound, attrs);
        nm.createNotificationChannel(channel);
    }

    public static boolean hasNotificationPermission(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    public static boolean canPostNotifications(Context context) {
        if (!hasNotificationPermission(context)) {
            return false;
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    public static boolean hasAskedNotificationPermission(Context context) {
        return prefs(context).getBoolean(KEY_ASKED_NOTIF_PERM, false);
    }

    public static void markAskedNotificationPermission(Context context) {
        prefs(context).edit().putBoolean(KEY_ASKED_NOTIF_PERM, true).apply();
    }

    public static boolean isFirebaseConfigured(Context context) {
        try {
            return !FirebaseApp.getApps(context.getApplicationContext()).isEmpty();
        } catch (Throwable ignored) {
            return false;
        }
    }

    public static void saveSession(
            Context context,
            String uid,
            String databaseUrl,
            String apiKey,
            String idToken,
            String refreshToken
    ) {
        SharedPreferences p = prefs(context);
        String prevUid = p.getString(KEY_UID, "");
        SharedPreferences.Editor ed = p.edit();
        ed.putString(KEY_UID, uid != null ? uid.trim() : "");
        if (databaseUrl != null && !databaseUrl.trim().isEmpty()) {
            String cleanUrl = databaseUrl.trim();
            while (cleanUrl.endsWith("/")) {
                cleanUrl = cleanUrl.substring(0, cleanUrl.length() - 1);
            }
            ed.putString(KEY_DB_URL, cleanUrl);
        }
        if (apiKey != null && !apiKey.trim().isEmpty()) {
            ed.putString(KEY_API_KEY, apiKey.trim());
        }
        if (idToken != null && !idToken.trim().isEmpty()) {
            ed.putString(KEY_ID_TOKEN, idToken.trim());
        }
        if (refreshToken != null && !refreshToken.trim().isEmpty()) {
            ed.putString(KEY_REFRESH_TOKEN, refreshToken.trim());
        }
        if (uid != null && !uid.trim().equals(prevUid)) {
            ed.remove(KEY_SEEN_KEYS);
        }
        ed.apply();
    }

    public static void clearSession(Context context) {
        prefs(context).edit()
                .remove(KEY_UID)
                .remove(KEY_ID_TOKEN)
                .remove(KEY_REFRESH_TOKEN)
                .remove(KEY_SEEN_KEYS)
                .remove(KEY_PENDING_TARGET)
                .apply();
        cancelBackgroundSync(context);
    }

    public static String getUid(Context context) {
        return prefs(context).getString(KEY_UID, "");
    }

    public static String getDatabaseUrl(Context context) {
        return prefs(context).getString(KEY_DB_URL, "");
    }

    public static String getApiKey(Context context) {
        return prefs(context).getString(KEY_API_KEY, "");
    }

    public static String getIdToken(Context context) {
        return prefs(context).getString(KEY_ID_TOKEN, "");
    }

    public static String getRefreshToken(Context context) {
        return prefs(context).getString(KEY_REFRESH_TOKEN, "");
    }

    public static void saveFcmToken(Context context, String token) {
        if (token != null && !token.trim().isEmpty()) {
            prefs(context).edit().putString(KEY_FCM_TOKEN, token.trim()).apply();
        }
    }

    public static String getFcmToken(Context context) {
        return prefs(context).getString(KEY_FCM_TOKEN, "");
    }

    public static void setPendingOpenTarget(Context context, String target) {
        if (target == null || target.trim().isEmpty()) {
            return;
        }
        prefs(context).edit().putString(KEY_PENDING_TARGET, target.trim()).apply();
    }

    public static String consumePendingOpenTarget(Context context) {
        SharedPreferences p = prefs(context);
        String target = p.getString(KEY_PENDING_TARGET, "");
        if (!target.isEmpty()) {
            p.edit().remove(KEY_PENDING_TARGET).apply();
        }
        return target;
    }

    public static synchronized Set<String> getSeenKeys(Context context) {
        Set<String> set = new LinkedHashSet<>();
        String raw = prefs(context).getString(KEY_SEEN_KEYS, "[]");
        try {
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                String k = arr.optString(i, "");
                if (!k.isEmpty()) {
                    set.add(k);
                }
            }
        } catch (Exception ignored) {
        }
        return set;
    }

    public static synchronized boolean isKeySeen(Context context, String key) {
        if (key == null || key.trim().isEmpty()) {
            return false;
        }
        return getSeenKeys(context).contains(key.trim());
    }

    public static synchronized void markKeysSeen(Context context, List<String> keys) {
        if (keys == null || keys.isEmpty()) {
            return;
        }
        Set<String> set = getSeenKeys(context);
        for (String k : keys) {
            if (k != null && !k.trim().isEmpty()) {
                set.add(k.trim());
            }
        }
        List<String> list = new ArrayList<>(set);
        if (list.size() > MAX_SEEN_KEYS) {
            list = list.subList(list.size() - MAX_SEEN_KEYS, list.size());
        }
        JSONArray arr = new JSONArray();
        for (String k : list) {
            arr.put(k);
        }
        prefs(context).edit().putString(KEY_SEEN_KEYS, arr.toString()).apply();
    }

    public static void markKeySeen(Context context, String key) {
        if (key == null || key.trim().isEmpty()) {
            return;
        }
        List<String> single = new ArrayList<>(1);
        single.add(key.trim());
        markKeysSeen(context, single);
    }

    @SuppressLint("MissingPermission")
    public static boolean showNotification(
            Context context,
            String dedupeKey,
            String title,
            String body,
            String target
    ) {
        ensureChannel(context);
        if (dedupeKey != null && !dedupeKey.trim().isEmpty()) {
            if (isKeySeen(context, dedupeKey)) {
                return false;
            }
            markKeySeen(context, dedupeKey);
        }

        if (!canPostNotifications(context)) {
            return false;
        }

        String safeTitle = (title != null && !title.trim().isEmpty()) ? title.trim() : "Punjab Esports";
        String safeBody = (body != null && !body.trim().isEmpty()) ? body.trim() : "You have a new update.";
        String safeTarget = (target != null && !target.trim().isEmpty()) ? target.trim() : "notifications";

        Intent intent = new Intent(context.getApplicationContext(), MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra(EXTRA_OPEN_TARGET, safeTarget);

        int notifId = (dedupeKey != null && !dedupeKey.isEmpty())
                ? Math.abs(dedupeKey.hashCode())
                : (int) (System.currentTimeMillis() & 0x7FFFFFFF);
        if (notifId == 0) {
            notifId = 1001;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context.getApplicationContext(),
                notifId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int accentColor = ContextCompat.getColor(context, R.color.notification_accent);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context.getApplicationContext(), CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notification)
                .setColor(accentColor)
                .setContentTitle(safeTitle)
                .setContentText(safeBody)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(safeBody))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        NotificationManagerCompat.from(context.getApplicationContext()).notify(notifId, builder.build());
        return true;
    }

    public static void schedulePeriodicSync(Context context) {
        try {
            if (getUid(context).isEmpty()) {
                return;
            }
            Constraints constraints = new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build();

            PeriodicWorkRequest periodicRequest = new PeriodicWorkRequest.Builder(
                    NotificationSyncWorker.class,
                    15,
                    TimeUnit.MINUTES
            )
                    .setConstraints(constraints)
                    .build();

            WorkManager.getInstance(context.getApplicationContext())
                    .enqueueUniquePeriodicWork(
                            WORK_PERIODIC_NAME,
                            ExistingPeriodicWorkPolicy.KEEP,
                            periodicRequest
                    );
        } catch (Throwable ignored) {
        }
    }

    public static void scheduleQuickBackgroundCheck(Context context) {
        try {
            if (getUid(context).isEmpty()) {
                return;
            }
            Constraints constraints = new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build();

            OneTimeWorkRequest quickRequest = new OneTimeWorkRequest.Builder(NotificationSyncWorker.class)
                    .setInitialDelay(2, TimeUnit.MINUTES)
                    .setConstraints(constraints)
                    .build();

            WorkManager.getInstance(context.getApplicationContext())
                    .enqueueUniqueWork(
                            WORK_QUICK_NAME,
                            ExistingWorkPolicy.REPLACE,
                            quickRequest
                    );
        } catch (Throwable ignored) {
        }
    }

    public static void cancelBackgroundSync(Context context) {
        try {
            WorkManager wm = WorkManager.getInstance(context.getApplicationContext());
            wm.cancelUniqueWork(WORK_PERIODIC_NAME);
            wm.cancelUniqueWork(WORK_QUICK_NAME);
        } catch (Throwable ignored) {
        }
    }

    public static String refreshIdToken(Context context) {
        String apiKey = getApiKey(context);
        String refreshToken = getRefreshToken(context);
        if (apiKey.isEmpty() || refreshToken.isEmpty()) {
            return "";
        }
        HttpURLConnection conn = null;
        try {
            URL url = new URL("https://securetoken.googleapis.com/v1/token?key=" + URLEncoder.encode(apiKey, "UTF-8"));
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

            String body = "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(refreshToken, "UTF-8");
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }

            if (conn.getResponseCode() == 200) {
                String resp = readStream(conn.getInputStream());
                JSONObject json = new JSONObject(resp);
                String newIdToken = json.optString("id_token", "");
                String newRefreshToken = json.optString("refresh_token", "");
                if (!newIdToken.isEmpty()) {
                    SharedPreferences.Editor ed = prefs(context).edit();
                    ed.putString(KEY_ID_TOKEN, newIdToken);
                    if (!newRefreshToken.isEmpty()) {
                        ed.putString(KEY_REFRESH_TOKEN, newRefreshToken);
                    }
                    ed.apply();
                    return newIdToken;
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
        return "";
    }

    public static JSONObject fetchRtdbObject(Context context, String path) {
        String dbUrl = getDatabaseUrl(context);
        if (dbUrl.isEmpty() || path == null || path.isEmpty()) {
            return null;
        }
        String token = getIdToken(context);
        String raw = httpGetRtdb(dbUrl, path, token);
        if ("__AUTH_401__".equals(raw)) {
            String refreshed = refreshIdToken(context);
            if (!refreshed.isEmpty()) {
                raw = httpGetRtdb(dbUrl, path, refreshed);
            } else {
                raw = httpGetRtdb(dbUrl, path, "");
            }
        }
        if (raw == null || raw.isEmpty() || "null".equals(raw) || "__AUTH_401__".equals(raw)) {
            return null;
        }
        try {
            return new JSONObject(raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    public static void syncFcmTokenToDatabase(Context context, String fcmToken) {
        String uid = getUid(context);
        String dbUrl = getDatabaseUrl(context);
        if (uid.isEmpty() || dbUrl.isEmpty() || fcmToken == null || fcmToken.trim().isEmpty()) {
            return;
        }
        String cleanToken = fcmToken.trim();
        String tokenKey = sanitizeRtdbKey(cleanToken);
        try {
            JSONObject payload = new JSONObject();
            payload.put("fcmToken", cleanToken);
            payload.put("fcmUpdatedAt", System.currentTimeMillis());

            JSONObject tokenNode = new JSONObject();
            tokenNode.put("token", cleanToken);
            tokenNode.put("platform", "android");
            tokenNode.put("updatedAt", System.currentTimeMillis());

            String token = getIdToken(context);
            int code = httpPatchRtdb(dbUrl, "users/" + uid, payload.toString(), token);
            if (code == 401) {
                token = refreshIdToken(context);
                if (!token.isEmpty()) {
                    httpPatchRtdb(dbUrl, "users/" + uid, payload.toString(), token);
                }
            }
            httpPutRtdb(dbUrl, "users/" + uid + "/fcmTokens/" + tokenKey, tokenNode.toString(), token);
        } catch (Exception ignored) {
        }
    }

    private static String sanitizeRtdbKey(String raw) {
        String cleaned = raw.replaceAll("[^a-zA-Z0-9_-]", "_");
        if (cleaned.length() > 48) {
            return cleaned.substring(0, 24) + "_" + cleaned.substring(cleaned.length() - 20);
        }
        return cleaned;
    }

    private static String httpGetRtdb(String dbUrl, String path, String authToken) {
        HttpURLConnection conn = null;
        try {
            String fullUrl = dbUrl + "/" + path + ".json";
            if (authToken != null && !authToken.isEmpty()) {
                fullUrl += "?auth=" + URLEncoder.encode(authToken, "UTF-8");
            }
            URL url = new URL(fullUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            int code = conn.getResponseCode();
            if (code == 401 || code == 403) {
                return "__AUTH_401__";
            }
            if (code >= 200 && code < 300) {
                return readStream(conn.getInputStream());
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
        return null;
    }

    private static int httpPatchRtdb(String dbUrl, String path, String jsonBody, String authToken) {
        return httpWriteRtdb("PATCH", dbUrl, path, jsonBody, authToken);
    }

    private static int httpPutRtdb(String dbUrl, String path, String jsonBody, String authToken) {
        return httpWriteRtdb("PUT", dbUrl, path, jsonBody, authToken);
    }

    private static int httpWriteRtdb(String method, String dbUrl, String path, String jsonBody, String authToken) {
        HttpURLConnection conn = null;
        try {
            String fullUrl = dbUrl + "/" + path + ".json";
            if (authToken != null && !authToken.isEmpty()) {
                fullUrl += "?auth=" + URLEncoder.encode(authToken, "UTF-8");
            }
            URL url = new URL(fullUrl);
            conn = (HttpURLConnection) url.openConnection();
            if ("PATCH".equals(method)) {
                conn.setRequestMethod("POST");
                conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
            } else {
                conn.setRequestMethod(method);
            }
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            try (OutputStream os = conn.getOutputStream()) {
                os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
            }
            return conn.getResponseCode();
        } catch (Exception ignored) {
            return -1;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private static String readStream(InputStream is) throws Exception {
        if (is == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line);
            }
        }
        return sb.toString();
    }
}
