package com.punjab.esports;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlarmManager;
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
import android.os.PowerManager;
import android.os.SystemClock;
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
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

public final class NotificationHelper {
    public static final String CHANNEL_ID = "punjab_esports_alerts";
    public static final String CHANNEL_NAME = "Punjab Esports Alerts";
    public static final String CHANNEL_DESC = "Match updates, room IDs, wallet credits, mailbox gifts and admin replies";
    public static final String EXTRA_OPEN_TARGET = "pe_open_target";

    public static final long ALARM_INTERVAL_MS = 60_000L;

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
    private static final String KEY_LAST_BALANCE = "last_known_balance";
    private static final String KEY_HAS_BALANCE = "has_known_balance";
    private static final String KEY_LAST_DIAMONDS = "last_known_diamonds";
    private static final String KEY_HAS_DIAMONDS = "has_known_diamonds";
    private static final String KEY_DEP_STATUS_MAP = "dep_status_map";
    private static final String KEY_WD_STATUS_MAP = "wd_status_map";
    private static final String KEY_LAST_BG_RUN_AT = "last_bg_run_at";
    private static final String KEY_RECENT_SIGS = "recent_notif_sigs";
    private static final String KEY_BG_NOTIFIED_BAL = "bg_notified_balance";
    private static final String KEY_BG_NOTIFIED_BAL_AT = "bg_notified_balance_at";

    private static final String WORK_PERIODIC_NAME = "pe_bg_notif_periodic";
    private static final String WORK_QUICK_NAME = "pe_bg_notif_quick";
    private static final int ALARM_REQUEST_CODE = 44019;
    private static final int MAX_SEEN_KEYS = 300;
    private static final int MAX_NOTIFS_PER_RUN = 5;
    private static final long CONTENT_DEDUPE_WINDOW_MS = 5L * 60L * 1000L;

    private static final long FIVE_DAYS_MS = 5L * 24L * 60L * 60L * 1000L;
    private static final long TWO_DAYS_MS = 2L * 24L * 60L * 60L * 1000L;
    private static final long MAIL_EXPIRY_MS = 7L * 24L * 60L * 60L * 1000L;

    private static final AtomicBoolean BG_CHECK_RUNNING = new AtomicBoolean(false);

    private static class PendingAlert {
        final String dedupeKey;
        final String title;
        final String body;
        final String target;
        final long ts;

        PendingAlert(String dedupeKey, String title, String body, String target, long ts) {
            this.dedupeKey = dedupeKey;
            this.title = title;
            this.body = body;
            this.target = target;
            this.ts = ts;
        }
    }

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

    public static boolean isIgnoringBatteryOptimizations(Context context) {
        try {
            PowerManager pm = (PowerManager) context.getApplicationContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                return pm.isIgnoringBatteryOptimizations(context.getApplicationContext().getPackageName());
            }
        } catch (Throwable ignored) {
        }
        return true;
    }

    public static boolean hasAskedNotificationPermission(Context context) {
        return prefs(context).getBoolean(KEY_ASKED_NOTIF_PERM, false);
    }

    public static void markAskedNotificationPermission(Context context) {
        prefs(context).edit().putBoolean(KEY_ASKED_NOTIF_PERM, true).apply();
    }

    public static boolean isFirebaseConfigured(Context context) {
        try {
            Context appCtx = context.getApplicationContext();
            int resId = appCtx.getResources().getIdentifier("google_app_id", "string", appCtx.getPackageName());
            if (resId == 0) {
                return false;
            }
            return !FirebaseApp.getApps(appCtx).isEmpty();
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
        String cleanUid = uid != null ? uid.trim() : "";
        SharedPreferences.Editor ed = p.edit();
        ed.putString(KEY_UID, cleanUid);
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
        if (!prevUid.isEmpty() && !cleanUid.equals(prevUid)) {
            ed.remove(KEY_SEEN_KEYS);
            ed.remove(KEY_HAS_BALANCE);
            ed.remove(KEY_LAST_BALANCE);
            ed.remove(KEY_HAS_DIAMONDS);
            ed.remove(KEY_LAST_DIAMONDS);
            ed.remove(KEY_DEP_STATUS_MAP);
            ed.remove(KEY_WD_STATUS_MAP);
            ed.remove(KEY_RECENT_SIGS);
            ed.remove(KEY_BG_NOTIFIED_BAL);
            ed.remove(KEY_BG_NOTIFIED_BAL_AT);
        }
        ed.apply();
    }

    public static void saveSnapshots(Context context, Double balance, Long diamonds) {
        SharedPreferences.Editor ed = prefs(context).edit();
        if (balance != null && !Double.isNaN(balance) && !Double.isInfinite(balance)) {
            ed.putString(KEY_LAST_BALANCE, String.valueOf(balance));
            ed.putBoolean(KEY_HAS_BALANCE, true);
        }
        if (diamonds != null && diamonds >= 0L) {
            ed.putLong(KEY_LAST_DIAMONDS, diamonds);
            ed.putBoolean(KEY_HAS_DIAMONDS, true);
        }
        ed.apply();
    }

    public static boolean hasKnownBalance(Context context) {
        return prefs(context).getBoolean(KEY_HAS_BALANCE, false);
    }

    public static double getLastKnownBalance(Context context) {
        try {
            return Double.parseDouble(prefs(context).getString(KEY_LAST_BALANCE, "0"));
        } catch (Exception ignored) {
            return 0.0;
        }
    }

    public static boolean hasKnownDiamonds(Context context) {
        return prefs(context).getBoolean(KEY_HAS_DIAMONDS, false);
    }

    public static long getLastKnownDiamonds(Context context) {
        return prefs(context).getLong(KEY_LAST_DIAMONDS, 0L);
    }

    public static void clearSession(Context context) {
        prefs(context).edit()
                .remove(KEY_UID)
                .remove(KEY_ID_TOKEN)
                .remove(KEY_REFRESH_TOKEN)
                .remove(KEY_SEEN_KEYS)
                .remove(KEY_PENDING_TARGET)
                .remove(KEY_HAS_BALANCE)
                .remove(KEY_LAST_BALANCE)
                .remove(KEY_HAS_DIAMONDS)
                .remove(KEY_LAST_DIAMONDS)
                .remove(KEY_DEP_STATUS_MAP)
                .remove(KEY_WD_STATUS_MAP)
                .remove(KEY_RECENT_SIGS)
                .remove(KEY_BG_NOTIFIED_BAL)
                .remove(KEY_BG_NOTIFIED_BAL_AT)
                .apply();
        cancelBackgroundSync(context);
    }

    public static void recordBgNotifiedBalance(Context context, double balance) {
        if (Double.isNaN(balance) || Double.isInfinite(balance)) return;
        prefs(context).edit()
                .putString(KEY_BG_NOTIFIED_BAL, String.valueOf(balance))
                .putLong(KEY_BG_NOTIFIED_BAL_AT, System.currentTimeMillis())
                .apply();
    }

    public static boolean hasBgNotifiedBalance(Context context) {
        return prefs(context).getLong(KEY_BG_NOTIFIED_BAL_AT, 0L) > 0L;
    }

    public static double getBgNotifiedBalance(Context context) {
        try {
            return Double.parseDouble(prefs(context).getString(KEY_BG_NOTIFIED_BAL, "0"));
        } catch (Exception ignored) {
            return 0.0;
        }
    }

    public static long getBgNotifiedBalanceAt(Context context) {
        return prefs(context).getLong(KEY_BG_NOTIFIED_BAL_AT, 0L);
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

    private static String buildContentSignature(String title, String body) {
        String t = title != null ? title.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT) : "";
        String b = body != null ? body.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT) : "";
        return t + "||" + b;
    }

    private static synchronized boolean checkAndRecordRecentContent(Context context, String title, String body) {
        String sig = buildContentSignature(title, body);
        long now = System.currentTimeMillis();
        SharedPreferences p = prefs(context);
        JSONObject map;
        try {
            map = new JSONObject(p.getString(KEY_RECENT_SIGS, "{}"));
        } catch (Exception e) {
            map = new JSONObject();
        }
        JSONObject pruned = new JSONObject();
        boolean isDuplicate = false;
        Iterator<String> it = map.keys();
        while (it.hasNext()) {
            String k = it.next();
            long ts = map.optLong(k, 0L);
            if ((now - ts) < CONTENT_DEDUPE_WINDOW_MS) {
                try {
                    pruned.put(k, ts);
                } catch (Exception ignored) {
                }
                if (k.equals(sig)) {
                    isDuplicate = true;
                }
            }
        }
        if (!isDuplicate) {
            try {
                pruned.put(sig, now);
            } catch (Exception ignored) {
            }
        }
        p.edit().putString(KEY_RECENT_SIGS, pruned.toString()).apply();
        return isDuplicate;
    }

    @SuppressLint({"MissingPermission", "NotificationPermission"})
    public static boolean showNotification(
            Context context,
            String dedupeKey,
            String title,
            String body,
            String target
    ) {
        ensureChannel(context);

        String safeTitle = (title != null && !title.trim().isEmpty()) ? title.trim() : "Punjab Esports";
        String safeBody = (body != null && !body.trim().isEmpty()) ? body.trim() : "You have a new update.";
        String safeTarget = (target != null && !target.trim().isEmpty()) ? target.trim() : "notifications";

        if (dedupeKey != null && !dedupeKey.trim().isEmpty()) {
            if (isKeySeen(context, dedupeKey)) {
                return false;
            }
            markKeySeen(context, dedupeKey);
        }

        if (checkAndRecordRecentContent(context, safeTitle, safeBody)) {
            return false;
        }

        if (!canPostNotifications(context)) {
            return false;
        }

        Intent intent = new Intent(context.getApplicationContext(), MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra(EXTRA_OPEN_TARGET, safeTarget);

        int notifId = (dedupeKey != null && !dedupeKey.isEmpty())
                ? (dedupeKey.hashCode() & 0x7FFFFFFF)
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
                    .setInitialDelay(15, TimeUnit.SECONDS)
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

    public static void scheduleAlarmLoop(Context context, long delayMs) {
        try {
            Context appCtx = context.getApplicationContext();
            if (getUid(appCtx).isEmpty()) {
                return;
            }
            AlarmManager am = (AlarmManager) appCtx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) {
                return;
            }
            Intent intent = new Intent(appCtx, NotificationAlarmReceiver.class);
            intent.setAction(NotificationAlarmReceiver.ACTION_POLL);
            PendingIntent pi = PendingIntent.getBroadcast(
                    appCtx,
                    ALARM_REQUEST_CODE,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            long safeDelay = Math.max(30_000L, delayMs);
            long triggerAt = SystemClock.elapsedRealtime() + safeDelay;
            am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
        } catch (Throwable ignored) {
        }
    }

    public static void cancelAlarmLoop(Context context) {
        try {
            Context appCtx = context.getApplicationContext();
            AlarmManager am = (AlarmManager) appCtx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) {
                return;
            }
            Intent intent = new Intent(appCtx, NotificationAlarmReceiver.class);
            intent.setAction(NotificationAlarmReceiver.ACTION_POLL);
            PendingIntent pi = PendingIntent.getBroadcast(
                    appCtx,
                    ALARM_REQUEST_CODE,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            am.cancel(pi);
        } catch (Throwable ignored) {
        }
    }

    public static void cancelBackgroundSync(Context context) {
        cancelAlarmLoop(context);
        try {
            WorkManager wm = WorkManager.getInstance(context.getApplicationContext());
            wm.cancelUniqueWork(WORK_PERIODIC_NAME);
            wm.cancelUniqueWork(WORK_QUICK_NAME);
        } catch (Throwable ignored) {
        }
    }

    public static void runBackgroundCheck(Context context) {
        Context ctx = context.getApplicationContext();
        String uid = getUid(ctx);
        if (uid.isEmpty()) {
            return;
        }
        if (!canPostNotifications(ctx)) {
            return;
        }
        long now = System.currentTimeMillis();
        long lastRun = prefs(ctx).getLong(KEY_LAST_BG_RUN_AT, 0L);
        if ((now - lastRun) < 20_000L) {
            return;
        }
        if (!BG_CHECK_RUNNING.compareAndSet(false, true)) {
            return;
        }

        try {
            prefs(ctx).edit().putLong(KEY_LAST_BG_RUN_AT, now).apply();
            List<PendingAlert> alerts = new ArrayList<>();
            boolean hasFreshWalletNotif = false;
            boolean hasFreshDiamondNotif = false;

            // 1. User Notifications: notifications/{uid}
            JSONObject notifsObj = fetchRtdbObject(ctx, "notifications/" + uid);
            if (notifsObj != null) {
                Iterator<String> keys = notifsObj.keys();
                while (keys.hasNext()) {
                    String id = keys.next();
                    JSONObject item = notifsObj.optJSONObject(id);
                    if (item == null) continue;
                    if (item.optBoolean("read", false)) continue;
                    String type = item.optString("type", "");
                    if ("announcement".equalsIgnoreCase(type)) continue;

                    String dedupeKey = "notif:" + id;
                    if (isKeySeen(ctx, dedupeKey)) continue;

                    String title = item.optString("title", "New Notification");
                    String body = item.optString("body", item.optString("message", "Tap to view details in Punjab Esports."));
                    long ts = extractTimestamp(item);
                    String combined = (type + " " + title + " " + body).toLowerCase(Locale.ROOT);
                    if (combined.contains("balance") || combined.contains("wallet") || combined.contains("deposit")
                            || combined.contains("withdraw") || combined.contains("refund") || combined.contains("reward")) {
                        hasFreshWalletNotif = true;
                    }
                    if (combined.contains("diamond")) {
                        hasFreshDiamondNotif = true;
                    }
                    alerts.add(new PendingAlert(dedupeKey, title, body, "notifications", ts > 0 ? ts : now));
                }
            }

            // 2. Direct Wallet Balance Changes (when Admin updates wallets/{uid} without writing notifications/{uid})
            JSONObject walletObj = fetchRtdbObject(ctx, "wallets/" + uid);
            if (walletObj != null && walletObj.has("balance")) {
                double newBal = walletObj.optDouble("balance", Double.NaN);
                if (!Double.isNaN(newBal) && !Double.isInfinite(newBal)) {
                    if (hasKnownBalance(ctx)) {
                        double prevBal = getLastKnownBalance(ctx);
                        double diff = Math.round((newBal - prevBal) * 100.0) / 100.0;
                        if (Math.abs(diff) >= 0.01) {
                            saveSnapshots(ctx, newBal, null);
                            if (!hasFreshWalletNotif) {
                                recordBgNotifiedBalance(ctx, newBal);
                                String actionLabel = diff > 0
                                        ? ("+" + formatRupees(diff) + " added")
                                        : (formatRupees(Math.abs(diff)) + " deducted");
                                String body = "Your wallet was updated by admin (" + actionLabel
                                        + "). New balance: " + formatRupees(newBal) + ".";
                                String key = "bg_bal_" + Math.round(prevBal * 100) + "_" + Math.round(newBal * 100) + "_" + (now / 5000L);
                                alerts.add(new PendingAlert(key, "Wallet Balance Updated", body, "notifications", now));
                            }
                        }
                    } else {
                        saveSnapshots(ctx, newBal, null);
                    }
                }
            }

            // 3. Direct User Diamonds Changes (when Admin updates users/{uid}/diamonds)
            JSONObject userObj = fetchRtdbObject(ctx, "users/" + uid);
            if (userObj != null) {
                if (userObj.has("diamonds")) {
                    long newDia = userObj.optLong("diamonds", -1L);
                    if (newDia >= 0L) {
                        if (hasKnownDiamonds(ctx)) {
                            long prevDia = getLastKnownDiamonds(ctx);
                            long diff = newDia - prevDia;
                            if (diff != 0L) {
                                saveSnapshots(ctx, null, newDia);
                                if (!hasFreshDiamondNotif) {
                                    String actionLabel = diff > 0
                                            ? ("+" + diff + " Diamonds added")
                                            : (Math.abs(diff) + " Diamonds deducted");
                                    String body = "Your diamonds were updated by admin (" + actionLabel
                                            + "). Total: " + newDia + " Diamonds.";
                                    String key = "bg_dia_" + prevDia + "_" + newDia + "_" + (now / 5000L);
                                    alerts.add(new PendingAlert(key, "Diamonds Updated by Admin", body, "notifications", now));
                                }
                            }
                        } else {
                            saveSnapshots(ctx, null, newDia);
                        }
                    }
                }

                // 4. Unclaimed Mailbox Gifts (already inside users/{uid}/mailbox!)
                JSONObject mailObj = userObj.optJSONObject("mailbox");
                JSONObject deletedIdsObj = userObj.optJSONObject("deletedMailIds");
                if (mailObj != null) {
                    Iterator<String> keys = mailObj.keys();
                    while (keys.hasNext()) {
                        String id = keys.next();
                        if (deletedIdsObj != null && deletedIdsObj.optBoolean(id, false)) continue;
                        JSONObject item = mailObj.optJSONObject(id);
                        if (item == null) continue;
                        if (item.optBoolean("deleted", false)) continue;
                        String status = item.optString("status", "");
                        if (!"unclaimed".equalsIgnoreCase(status)) continue;

                        long createdAt = extractTimestamp(item);
                        long expiresAt = item.optLong("expiresAt", createdAt > 0 ? createdAt + MAIL_EXPIRY_MS : 0L);
                        if (expiresAt > 0 && now >= expiresAt) continue;

                        String dedupeKey = "mail:" + id;
                        if (isKeySeen(ctx, dedupeKey)) continue;

                        String title = "New Gift in Mailbox!";
                        String body = item.optString("title", item.optString("body", "Claim your reward within 7 days before it expires."));
                        alerts.add(new PendingAlert(dedupeKey, title, body, "mailbox", createdAt > 0 ? createdAt : now));
                    }
                }
            }

            // 5. Direct Admin DM Replies: adminMessages/{uid}
            JSONObject dmObj = fetchRtdbObject(ctx, "adminMessages/" + uid);
            if (dmObj != null) {
                Iterator<String> keys = dmObj.keys();
                while (keys.hasNext()) {
                    String id = keys.next();
                    JSONObject item = dmObj.optJSONObject(id);
                    if (item == null) continue;
                    if (item.optBoolean("deleted", false)) continue;
                    String from = item.optString("from", "");
                    if ("user".equalsIgnoreCase(from)) continue;

                    long createdAt = extractTimestamp(item);
                    if (createdAt > 0 && (now - createdAt) > FIVE_DAYS_MS) continue;

                    String dedupeKey = "dm:" + id;
                    if (isKeySeen(ctx, dedupeKey)) continue;

                    String text = item.optString("text", "Official Admin sent you a reply.");
                    alerts.add(new PendingAlert(dedupeKey, "Official Admin Reply", text, "admindm", createdAt > 0 ? createdAt : now));
                }
            }

            // 6. Global Active Announcements: announcements
            JSONObject annObj = fetchRtdbObject(ctx, "announcements");
            if (annObj != null) {
                Iterator<String> keys = annObj.keys();
                while (keys.hasNext()) {
                    String id = keys.next();
                    JSONObject item = annObj.optJSONObject(id);
                    if (item == null) continue;
                    if (item.has("active") && !item.optBoolean("active", true)) continue;

                    long createdAt = extractTimestamp(item);
                    if (createdAt > 0 && (now - createdAt) > TWO_DAYS_MS) continue;

                    String dedupeKey = "ann:" + id;
                    if (isKeySeen(ctx, dedupeKey)) continue;

                    String title = item.optString("title", "Punjab Esports Announcement");
                    String body = item.optString("body", item.optString("message", item.optString("text", "New announcement available.")));
                    alerts.add(new PendingAlert(dedupeKey, title, body, "notifications", createdAt > 0 ? createdAt : now));
                }
            }

            // 7. Deposit / Withdrawal request status flips (Approved / Rejected while closed)
            checkRequestStatusFlips(ctx, uid, "depositRequests", KEY_DEP_STATUS_MAP, "Deposit", alerts, now);
            checkRequestStatusFlips(ctx, uid, "withdrawalRequests", KEY_WD_STATUS_MAP, "Withdrawal", alerts, now);

            if (alerts.isEmpty()) {
                return;
            }

            Collections.sort(alerts, (a, b) -> Long.compare(b.ts, a.ts));

            int posted = 0;
            List<String> skippedToMarkSeen = new ArrayList<>();
            for (PendingAlert alert : alerts) {
                if (posted < MAX_NOTIFS_PER_RUN) {
                    boolean shown = showNotification(
                            ctx,
                            alert.dedupeKey,
                            alert.title,
                            alert.body,
                            alert.target
                    );
                    if (shown) {
                        posted++;
                    }
                } else {
                    skippedToMarkSeen.add(alert.dedupeKey);
                }
            }

            if (!skippedToMarkSeen.isEmpty()) {
                markKeysSeen(ctx, skippedToMarkSeen);
            }
        } catch (Throwable ignored) {
        } finally {
            BG_CHECK_RUNNING.set(false);
        }
    }

    private static void checkRequestStatusFlips(
            Context ctx,
            String uid,
            String nodePath,
            String prefKey,
            String label,
            List<PendingAlert> alerts,
            long now
    ) {
        try {
            JSONObject obj = fetchRtdbByUserId(ctx, nodePath, uid);
            if (obj == null) return;

            String savedRaw = prefs(ctx).getString(prefKey, "");
            boolean firstSeed = savedRaw.isEmpty();
            JSONObject prevMap = firstSeed ? new JSONObject() : new JSONObject(savedRaw);
            JSONObject nextMap = new JSONObject();

            Iterator<String> keys = obj.keys();
            while (keys.hasNext()) {
                String id = keys.next();
                JSONObject item = obj.optJSONObject(id);
                if (item == null) continue;
                String st = item.optString("status", "pending").toLowerCase(Locale.ROOT);
                nextMap.put(id, st);

                String prevSt = prevMap.optString(id, "");
                if (!firstSeed && !prevSt.isEmpty() && !prevSt.equals(st)
                        && ("approved".equals(st) || "completed".equals(st) || "rejected".equals(st))) {
                    boolean approved = "approved".equals(st) || "completed".equals(st);
                    double amt = item.optDouble("amount", 0.0);
                    String reason = item.optString("reason", "");
                    String title = label + (approved ? " Approved" : " Rejected");
                    String body = approved
                            ? ("Your " + label.toLowerCase(Locale.ROOT) + " of " + formatRupees(amt) + " has been approved.")
                            : ("Your " + label.toLowerCase(Locale.ROOT) + " of " + formatRupees(amt) + " was rejected"
                                    + (reason.isEmpty() ? "." : (": " + reason)));
                    String dedupeKey = "req:" + nodePath + ":" + id + ":" + st;
                    if (!isKeySeen(ctx, dedupeKey)) {
                        alerts.add(new PendingAlert(dedupeKey, title, body, "notifications", now));
                    }
                }
            }

            prefs(ctx).edit().putString(prefKey, nextMap.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private static String formatRupees(double val) {
        if (Math.abs(val - Math.rint(val)) < 0.005) {
            return "\u20B9" + Math.round(val);
        }
        DecimalFormat df = new DecimalFormat("0.##");
        return "\u20B9" + df.format(val);
    }

    private static long extractTimestamp(JSONObject obj) {
        long ts = obj.optLong("createdAt", 0L);
        if (ts <= 0L) ts = obj.optLong("timestamp", 0L);
        if (ts <= 0L) ts = obj.optLong("time", 0L);
        if (ts > 0L && ts < 100000000000L) {
            ts = ts * 1000L;
        }
        return ts;
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
        String raw = httpGetRtdb(dbUrl, path, null, token);
        if ("__AUTH_401__".equals(raw)) {
            String refreshed = refreshIdToken(context);
            if (!refreshed.isEmpty()) {
                raw = httpGetRtdb(dbUrl, path, null, refreshed);
            } else {
                raw = httpGetRtdb(dbUrl, path, null, "");
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

    public static JSONObject fetchRtdbByUserId(Context context, String path, String uid) {
        String dbUrl = getDatabaseUrl(context);
        if (dbUrl.isEmpty() || path == null || path.isEmpty() || uid == null || uid.isEmpty()) {
            return null;
        }
        try {
            String extraQuery = "orderBy=" + URLEncoder.encode("\"userId\"", "UTF-8")
                    + "&equalTo=" + URLEncoder.encode("\"" + uid + "\"", "UTF-8");
            String token = getIdToken(context);
            String raw = httpGetRtdb(dbUrl, path, extraQuery, token);
            if ("__AUTH_401__".equals(raw)) {
                String refreshed = refreshIdToken(context);
                if (!refreshed.isEmpty()) {
                    raw = httpGetRtdb(dbUrl, path, extraQuery, refreshed);
                } else {
                    raw = httpGetRtdb(dbUrl, path, extraQuery, "");
                }
            }
            if (raw == null || raw.isEmpty() || "null".equals(raw) || "__AUTH_401__".equals(raw)) {
                return null;
            }
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

    private static String httpGetRtdb(String dbUrl, String path, String extraQuery, String authToken) {
        HttpURLConnection conn = null;
        try {
            StringBuilder urlBuilder = new StringBuilder(dbUrl).append("/").append(path).append(".json");
            boolean hasQuery = false;
            if (extraQuery != null && !extraQuery.isEmpty()) {
                urlBuilder.append("?").append(extraQuery);
                hasQuery = true;
            }
            if (authToken != null && !authToken.isEmpty()) {
                urlBuilder.append(hasQuery ? "&" : "?").append("auth=").append(URLEncoder.encode(authToken, "UTF-8"));
            }
            URL url = new URL(urlBuilder.toString());
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
