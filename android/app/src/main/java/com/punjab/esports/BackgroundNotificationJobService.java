package com.punjab.esports;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONObject;

public class BackgroundNotificationJobService extends JobService {
    public static final String CHANNEL_ID = "punjab_esports_alerts";
    public static final String PREFS_NAME = "pe_notif_prefs";
    public static final int PERIODIC_JOB_ID = 4101;
    public static final int QUICK_JOB_ID = 4102;

    private volatile boolean cancelled = false;

    public static void ensureNotificationChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
            if (existing != null) return;

            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID,
                    "Matches, Wallet & Rewards",
                    NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("Important alerts for wallet updates, deposits, withdrawals, match rooms & rewards.");
            ch.enableLights(true);
            ch.setLightColor(Color.parseColor("#D4AF37"));
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 180, 90, 180});
            ch.setShowBadge(true);
            ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            AudioAttributes audioAttrs = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();
            ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), audioAttrs);
            nm.createNotificationChannel(ch);
        }
    }

    @SuppressLint("MissingPermission")
    public static void schedulePeriodic(Context ctx) {
        try {
            JobScheduler scheduler = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (scheduler == null) return;
            ComponentName component = new ComponentName(ctx, BackgroundNotificationJobService.class);
            JobInfo info = new JobInfo.Builder(PERIODIC_JOB_ID, component)
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setPeriodic(15 * 60 * 1000L)
                    .setPersisted(true)
                    .build();
            scheduler.schedule(info);
        } catch (Exception ignored) {
        }
    }

    public static void scheduleQuickCheck(Context ctx, long delayMs) {
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            if (!prefs.getBoolean("active", false)) return;
            JobScheduler scheduler = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (scheduler == null) return;
            ComponentName component = new ComponentName(ctx, BackgroundNotificationJobService.class);
            JobInfo.Builder builder = new JobInfo.Builder(QUICK_JOB_ID, component)
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setMinimumLatency(Math.max(5000L, delayMs))
                    .setOverrideDeadline(Math.max(15000L, delayMs * 2L));
            scheduler.schedule(builder.build());
        } catch (Exception ignored) {
        }
    }

    public static void cancelAll(Context ctx) {
        try {
            JobScheduler scheduler = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (scheduler != null) {
                scheduler.cancel(PERIODIC_JOB_ID);
                scheduler.cancel(QUICK_JOB_ID);
            }
        } catch (Exception ignored) {
        }
    }

    public static boolean canPostNotifications(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return NotificationManagerCompat.from(ctx).areNotificationsEnabled();
    }

    @SuppressLint("MissingPermission")
    public static void postSystemNotification(Context ctx, String notifId, String title, String body) {
        if (!canPostNotifications(ctx)) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ActivityCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        ensureNotificationChannel(ctx);

        String cleanId = (notifId == null || notifId.trim().isEmpty())
                ? String.valueOf(System.currentTimeMillis())
                : notifId.trim();

        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> seenSet = new HashSet<>(prefs.getStringSet("seen_notif_ids", new HashSet<>()));
        if (seenSet.contains(cleanId)) {
            return;
        }
        seenSet.add(cleanId);
        if (seenSet.size() > 160) {
            List<String> trimmed = new ArrayList<>(seenSet);
            seenSet = new HashSet<>(trimmed.subList(Math.max(0, trimmed.size() - 120), trimmed.size()));
        }
        prefs.edit().putStringSet("seen_notif_ids", seenSet).apply();

        Intent launchIntent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launchIntent == null) {
            launchIntent = new Intent(ctx, MainActivity.class);
        }
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(ctx, cleanId.hashCode(), launchIntent, pendingFlags);

        Bitmap largeIcon = null;
        try {
            largeIcon = BitmapFactory.decodeResource(ctx.getResources(), R.mipmap.ic_launcher_round);
        } catch (Exception ignored) {
        }

        String safeTitle = (title == null || title.trim().isEmpty()) ? "Punjab Esports" : title.trim();
        String safeBody = (body == null) ? "" : body.trim();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notif_esports)
                .setColor(Color.parseColor("#D4AF37"))
                .setContentTitle(safeTitle)
                .setContentText(safeBody)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(safeBody))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setContentIntent(contentIntent);

        if (largeIcon != null) {
            builder.setLargeIcon(largeIcon);
        }

        try {
            NotificationManagerCompat.from(ctx).notify(cleanId.hashCode(), builder.build());
        } catch (SecurityException ignored) {
        }
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        cancelled = false;
        new Thread(() -> {
            try {
                runSyncCheck(getApplicationContext());
            } catch (Exception ignored) {
            } finally {
                if (!cancelled) {
                    jobFinished(params, false);
                }
            }
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        cancelled = true;
        return true;
    }

    private void runSyncCheck(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        if (!prefs.getBoolean("active", false)) return;

        String uid = prefs.getString("uid", "");
        String refreshToken = prefs.getString("refreshToken", "");
        String apiKey = prefs.getString("apiKey", "");
        String dbUrl = prefs.getString("dbUrl", "");
        if (uid.isEmpty() || refreshToken.isEmpty() || apiKey.isEmpty() || dbUrl.isEmpty()) return;

        String idToken = exchangeRefreshToken(prefs, refreshToken, apiKey);
        if (idToken == null || idToken.isEmpty()) return;

        String baseUrl = dbUrl.endsWith("/") ? dbUrl.substring(0, dbUrl.length() - 1) : dbUrl;
        String authParam = URLEncoder.encode(idToken, "UTF-8");
        boolean postedAnyNotif = false;

        // 1. Check unread items in notifications/{uid}
        try {
            String notifJson = httpGet(baseUrl + "/notifications/" + URLEncoder.encode(uid, "UTF-8") + ".json?auth=" + authParam);
            if (notifJson != null && notifJson.trim().startsWith("{")) {
                JSONObject obj = new JSONObject(notifJson);
                Iterator<String> keys = obj.keys();
                Set<String> seenSet = prefs.getStringSet("seen_notif_ids", new HashSet<>());
                while (keys.hasNext()) {
                    String key = keys.next();
                    JSONObject n = obj.optJSONObject(key);
                    if (n == null) continue;
                    if (n.optBoolean("read", false)) continue;
                    String type = n.optString("type", "");
                    if ("announcement".equals(type)) continue;
                    if (!seenSet.contains(key)) {
                        String title = n.optString("title", "Punjab Esports");
                        String body = n.optString("body", "You have a new update.");
                        postSystemNotification(ctx, key, title, body);
                        postedAnyNotif = true;
                    }
                }
            }
        } catch (Exception ignored) {
        }

        // 2. Check wallet balance changes by admin while app was closed
        try {
            String balRaw = httpGet(baseUrl + "/wallets/" + URLEncoder.encode(uid, "UTF-8") + "/balance.json?auth=" + authParam);
            if (balRaw != null && !balRaw.trim().equals("null")) {
                double newBal = Double.parseDouble(balRaw.trim());
                if (prefs.contains("last_balance")) {
                    double prevBal = Double.longBitsToDouble(prefs.getLong("last_balance", Double.doubleToRawLongBits(newBal)));
                    double diff = Math.round((newBal - prevBal) * 100.0) / 100.0;
                    if (Math.abs(diff) >= 0.01 && !postedAnyNotif) {
                        String action = diff > 0
                                ? String.format(Locale.US, "+₹%.2f added", diff)
                                : String.format(Locale.US, "₹%.2f deducted", Math.abs(diff));
                        postSystemNotification(
                                ctx,
                                "bg_bal_" + Math.round(newBal * 100.0) + "_" + (System.currentTimeMillis() / 15000L),
                                "💰 Wallet Balance Updated",
                                String.format(Locale.US, "Admin updated your wallet (%s). New balance: ₹%.2f.", action, newBal)
                        );
                    }
                }
                prefs.edit().putLong("last_balance", Double.doubleToRawLongBits(newBal)).apply();
            }
        } catch (Exception ignored) {
        }

        // 3. Check depositRequests and withdrawalRequests status transitions
        checkRequestStatusTransitions(ctx, prefs, baseUrl, uid, authParam, "depositRequests", "seen_dep_statuses", "Deposit");
        checkRequestStatusTransitions(ctx, prefs, baseUrl, uid, authParam, "withdrawalRequests", "seen_wd_statuses", "Withdrawal");
    }

    private void checkRequestStatusTransitions(
            Context ctx,
            SharedPreferences prefs,
            String baseUrl,
            String uid,
            String authParam,
            String node,
            String prefKey,
            String label
    ) {
        try {
            String orderBy = URLEncoder.encode("\"userId\"", "UTF-8");
            String equalTo = URLEncoder.encode("\"" + uid + "\"", "UTF-8");
            String url = baseUrl + "/" + node + ".json?orderBy=" + orderBy + "&equalTo=" + equalTo + "&auth=" + authParam;
            String raw = httpGet(url);
            if (raw == null || !raw.trim().startsWith("{")) return;

            JSONObject obj = new JSONObject(raw);
            JSONObject prevMap = new JSONObject(prefs.getString(prefKey, "{}"));
            boolean firstRun = prevMap.length() == 0;
            JSONObject nextMap = new JSONObject();

            Iterator<String> keys = obj.keys();
            while (keys.hasNext()) {
                String id = keys.next();
                JSONObject item = obj.optJSONObject(id);
                if (item == null) continue;
                String status = item.optString("status", "pending").toLowerCase(Locale.US);
                String prevStatus = prevMap.optString(id, "");
                nextMap.put(id, status);

                boolean transitioned = !firstRun && !prevStatus.isEmpty() && !prevStatus.equals(status);
                if (transitioned && ("approved".equals(status) || "completed".equals(status) || "rejected".equals(status))) {
                    double amt = item.optDouble("amount", 0.0);
                    boolean ok = "approved".equals(status) || "completed".equals(status);
                    String title = (ok ? "✅ " : "❌ ") + label + (ok ? " Approved" : " Rejected");
                    String body = ok
                            ? String.format(Locale.US, "Your %s of ₹%.2f has been approved!", label.toLowerCase(Locale.US), amt)
                            : String.format(Locale.US, "Your %s request of ₹%.2f was rejected.", label.toLowerCase(Locale.US), amt);
                    postSystemNotification(ctx, "bg_" + node + "_" + id + "_" + status, title, body);
                }
            }
            prefs.edit().putString(prefKey, nextMap.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private String exchangeRefreshToken(SharedPreferences prefs, String refreshToken, String apiKey) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL("https://securetoken.googleapis.com/v1/token?key=" + URLEncoder.encode(apiKey, "UTF-8"));
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

            String payload = "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(refreshToken, "UTF-8");
            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload.getBytes("UTF-8"));
            }

            if (conn.getResponseCode() >= 200 && conn.getResponseCode() < 300) {
                try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"))) {
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                    JSONObject json = new JSONObject(sb.toString());
                    String newRefresh = json.optString("refresh_token", "");
                    if (!newRefresh.isEmpty()) {
                        prefs.edit().putString("refreshToken", newRefresh).apply();
                    }
                    return json.optString("id_token", "");
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    private String httpGet(String urlStr) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            if (conn.getResponseCode() >= 200 && conn.getResponseCode() < 300) {
                try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                    return sb.toString();
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }
}
