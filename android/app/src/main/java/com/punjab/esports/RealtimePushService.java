package com.punjab.esports;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONObject;

/**
 * Persistent lightweight Android foreground service (remoteMessaging) that keeps
 * real-time Firebase RTDB Server-Sent Events (SSE) streams open in the background
 * so closed-app / screen-off notifications arrive in < 1 second without requiring
 * Firebase Blaze plan or manual battery settings.
 */
public class RealtimePushService extends Service {
    public static final String SERVICE_CHANNEL_ID = "punjab_esports_live_sync";
    private static final String SERVICE_CHANNEL_NAME = "Live Alerts Connection";
    private static final int SERVICE_NOTIF_ID = 44099;

    private static final long FIVE_DAYS_MS = 5L * 24L * 60L * 60L * 1000L;
    private static final long TWO_DAYS_MS = 2L * 24L * 60L * 60L * 1000L;
    private static final long MAIL_EXPIRY_MS = 7L * 24L * 60L * 60L * 1000L;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicInteger generation = new AtomicInteger(0);
    private final List<HttpURLConnection> activeConnections = new CopyOnWriteArrayList<>();
    private final List<Thread> workerThreads = new CopyOnWriteArrayList<>();

    private volatile String activeUid = "";
    private volatile long lastWalletNotifTs = 0L;
    private volatile long lastDiamondNotifTs = 0L;
    private ConnectivityManager.NetworkCallback networkCallback = null;

    public static void start(Context context) {
        if (context == null) return;
        Context appCtx = context.getApplicationContext();
        if (NotificationHelper.getUid(appCtx).isEmpty()) return;
        if (!NotificationHelper.canPostNotifications(appCtx)) return;
        try {
            Intent intent = new Intent(appCtx, RealtimePushService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(appCtx, intent);
            } else {
                appCtx.startService(intent);
            }
        } catch (Throwable ignored) {
        }
    }

    public static void stop(Context context) {
        if (context == null) return;
        try {
            Context appCtx = context.getApplicationContext();
            appCtx.stopService(new Intent(appCtx, RealtimePushService.class));
        } catch (Throwable ignored) {
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationHelper.ensureChannel(this);
        ensureServiceChannel();
        promoteToForeground();
        registerNetworkCallback();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        promoteToForeground();
        String uid = NotificationHelper.getUid(this);
        String dbUrl = NotificationHelper.getDatabaseUrl(this);
        if (uid.isEmpty() || dbUrl.isEmpty() || !NotificationHelper.canPostNotifications(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (!running.get() || !uid.equals(activeUid)) {
            startStreams(uid);
        }
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Context appCtx = getApplicationContext();
        if (!NotificationHelper.getUid(appCtx).isEmpty()) {
            NotificationHelper.scheduleQuickBackgroundCheck(appCtx);
            NotificationHelper.scheduleAlarmLoop(appCtx, NotificationHelper.ALARM_INTERVAL_MS);
        }
    }

    @Override
    public void onDestroy() {
        stopStreams();
        unregisterNetworkCallback();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void ensureServiceChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(SERVICE_CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(
                SERVICE_CHANNEL_ID,
                SERVICE_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_MIN
        );
        ch.setDescription("Keeps instant match, wallet, and reward notifications active");
        ch.setShowBadge(false);
        ch.enableLights(false);
        ch.enableVibration(false);
        ch.setSound(null, null);
        ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_SECRET);
        nm.createNotificationChannel(ch);
    }

    private void promoteToForeground() {
        try {
            Intent launch = new Intent(this, MainActivity.class);
            launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(
                    this,
                    SERVICE_NOTIF_ID,
                    launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            Notification notif = new NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_stat_notification)
                    .setColor(ContextCompat.getColor(this, R.color.notification_accent))
                    .setContentTitle("Punjab Esports")
                    .setContentText("Live alerts active")
                    .setPriority(NotificationCompat.PRIORITY_MIN)
                    .setCategory(NotificationCompat.CATEGORY_SERVICE)
                    .setSilent(true)
                    .setOngoing(true)
                    .setShowWhen(false)
                    .setContentIntent(pi)
                    .build();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(SERVICE_NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING);
            } else {
                startForeground(SERVICE_NOTIF_ID, notif);
            }
        } catch (Throwable ignored) {
        }
    }

    private void registerNetworkCallback() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return;
            NetworkRequest req = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build();
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    if (running.get() && !activeUid.isEmpty()) {
                        // Wake up any stalled sockets immediately when network recovers
                        for (HttpURLConnection conn : activeConnections) {
                            try {
                                conn.disconnect();
                            } catch (Throwable ignored) {
                            }
                        }
                    }
                }
            };
            cm.registerNetworkCallback(req, networkCallback);
        } catch (Throwable ignored) {
        }
    }

    private void unregisterNetworkCallback() {
        try {
            if (networkCallback != null) {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) {
                    cm.unregisterNetworkCallback(networkCallback);
                }
                networkCallback = null;
            }
        } catch (Throwable ignored) {
        }
    }

    private synchronized void startStreams(String uid) {
        stopStreams();
        activeUid = uid;
        running.set(true);
        final int gen = generation.incrementAndGet();

        spawnStream(gen, "notifications/" + uid, (ev, path, data, isInitial) ->
                handleNotificationsEvent(uid, path, data, isInitial));
        spawnStream(gen, "wallets/" + uid, (ev, path, data, isInitial) ->
                handleWalletEvent(path, data, isInitial));
        spawnStream(gen, "users/" + uid, (ev, path, data, isInitial) ->
                handleUserEvent(path, data, isInitial));
        spawnStream(gen, "adminMessages/" + uid, (ev, path, data, isInitial) ->
                handleAdminDmEvent(path, data, isInitial));
        spawnStream(gen, "announcements", (ev, path, data, isInitial) ->
                handleAnnouncementsEvent(path, data, isInitial));
        spawnStream(gen, "matchResults", (ev, path, data, isInitial) ->
                handleMatchResultsEvent(uid, path, data, isInitial));
        spawnStream(gen, "privateRoomCredentials", (ev, path, data, isInitial) ->
                handleRoomCredentialsEvent(uid, path, data, isInitial));

        // Lightweight periodic heartbeat for deposit/withdrawal status flips & token refresh
        Thread heartbeat = new Thread(() -> {
            long lastTokenRefresh = System.currentTimeMillis();
            while (running.get() && generation.get() == gen) {
                try {
                    Thread.sleep(30_000L);
                    if (!running.get() || generation.get() != gen) break;
                    long now = System.currentTimeMillis();
                    if ((now - lastTokenRefresh) >= 45L * 60L * 1000L) {
                        NotificationHelper.refreshIdToken(getApplicationContext());
                        lastTokenRefresh = now;
                    }
                    NotificationHelper.checkDepositWithdrawalOnly(getApplicationContext());
                } catch (InterruptedException e) {
                    break;
                } catch (Throwable ignored) {
                }
            }
        }, "PE-SSE-Heartbeat");
        heartbeat.setDaemon(true);
        workerThreads.add(heartbeat);
        heartbeat.start();
    }

    private synchronized void stopStreams() {
        running.set(false);
        generation.incrementAndGet();
        for (HttpURLConnection conn : activeConnections) {
            try {
                conn.disconnect();
            } catch (Throwable ignored) {
            }
        }
        activeConnections.clear();
        for (Thread t : workerThreads) {
            try {
                t.interrupt();
            } catch (Throwable ignored) {
            }
        }
        workerThreads.clear();
    }

    private interface SseHandler {
        void onEvent(String eventType, String path, Object data, boolean isInitialSnapshot);
    }

    private void spawnStream(final int gen, final String rtdbPath, final SseHandler handler) {
        Thread t = new Thread(() -> runSseLoop(gen, rtdbPath, handler), "PE-SSE-" + rtdbPath);
        t.setDaemon(true);
        workerThreads.add(t);
        t.start();
    }

    private void runSseLoop(int gen, String rtdbPath, SseHandler handler) {
        long backoffMs = 2_000L;
        boolean initialDelivered = false;

        while (running.get() && generation.get() == gen) {
            HttpURLConnection conn = null;
            try {
                Context ctx = getApplicationContext();
                String dbUrl = NotificationHelper.getDatabaseUrl(ctx);
                if (dbUrl.isEmpty() || NotificationHelper.getUid(ctx).isEmpty()) {
                    break;
                }
                String token = NotificationHelper.getIdToken(ctx);
                String targetUrl = dbUrl + "/" + rtdbPath + ".json";
                if (token != null && !token.isEmpty()) {
                    targetUrl += "?auth=" + URLEncoder.encode(token, "UTF-8");
                }

                conn = openSseConnection(targetUrl, 0);
                if (conn == null) {
                    sleepQuietly(backoffMs);
                    backoffMs = Math.min(30_000L, backoffMs * 2L);
                    continue;
                }
                activeConnections.add(conn);

                int code = conn.getResponseCode();
                if (code == 401 || code == 403) {
                    NotificationHelper.refreshIdToken(ctx);
                    sleepQuietly(1_500L);
                    continue;
                }
                if (code < 200 || code >= 300) {
                    sleepQuietly(backoffMs);
                    backoffMs = Math.min(30_000L, backoffMs * 2L);
                    continue;
                }

                // Connected successfully
                backoffMs = 2_000L;

                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String currentEvent = "";
                    StringBuilder dataBuf = new StringBuilder();
                    String line;

                    while (running.get() && generation.get() == gen && (line = reader.readLine()) != null) {
                        if (line.isEmpty()) {
                            if (!currentEvent.isEmpty() && dataBuf.length() > 0) {
                                String ev = currentEvent;
                                String rawData = dataBuf.toString();
                                currentEvent = "";
                                dataBuf.setLength(0);

                                if ("auth_revoked".equals(ev) || "cancel".equals(ev)) {
                                    NotificationHelper.refreshIdToken(ctx);
                                    break;
                                }
                                if ("put".equals(ev) || "patch".equals(ev)) {
                                    try {
                                        JSONObject payload = new JSONObject(rawData);
                                        String path = payload.optString("path", "/");
                                        Object data = payload.isNull("data") ? null : payload.opt("data");
                                        boolean isInitial = !initialDelivered && "put".equals(ev) && "/".equals(path);
                                        if (isInitial) {
                                            initialDelivered = true;
                                        }
                                        handler.onEvent(ev, path, data, isInitial);
                                    } catch (Throwable ignored) {
                                    }
                                }
                            } else {
                                currentEvent = "";
                                dataBuf.setLength(0);
                            }
                        } else if (line.startsWith("event:")) {
                            currentEvent = line.substring(6).trim();
                        } else if (line.startsWith("data:")) {
                            if (dataBuf.length() > 0) dataBuf.append('\n');
                            dataBuf.append(line.substring(5).trim());
                        }
                    }
                }
            } catch (Throwable ignored) {
            } finally {
                if (conn != null) {
                    activeConnections.remove(conn);
                    try {
                        conn.disconnect();
                    } catch (Throwable ignored) {
                    }
                }
            }

            if (running.get() && generation.get() == gen) {
                sleepQuietly(backoffMs);
                backoffMs = Math.min(30_000L, backoffMs * 2L);
            }
        }
    }

    private HttpURLConnection openSseConnection(String urlStr, int depth) throws Exception {
        if (depth > 5) return null;
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setInstanceFollowRedirects(false);
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(75_000);
        conn.setRequestProperty("Accept", "text/event-stream");
        conn.setRequestProperty("Cache-Control", "no-cache");
        int code = conn.getResponseCode();
        if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
            String loc = conn.getHeaderField("Location");
            conn.disconnect();
            if (loc == null || loc.isEmpty()) return null;
            return openSseConnection(loc, depth + 1);
        }
        return conn;
    }

    private void handleNotificationsEvent(String uid, String path, Object data, boolean isInitial) {
        if (data == null) return;
        Context ctx = getApplicationContext();
        if ("/".equals(path) && data instanceof JSONObject) {
            JSONObject map = (JSONObject) data;
            boolean hasAnySeen = !NotificationHelper.getSeenKeys(ctx).isEmpty();
            List<String> initialKeys = new ArrayList<>();
            Iterator<String> keys = map.keys();
            while (keys.hasNext()) {
                String id = keys.next();
                JSONObject item = map.optJSONObject(id);
                if (item == null) continue;
                if (isInitial && !hasAnySeen) {
                    initialKeys.add("notif:" + id);
                } else {
                    dispatchSingleNotification(ctx, id, item);
                }
            }
            if (!initialKeys.isEmpty()) {
                NotificationHelper.markKeysSeen(ctx, initialKeys);
            }
        } else if (path.startsWith("/") && path.length() > 1 && data instanceof JSONObject) {
            String trimmed = path.substring(1);
            int slash = trimmed.indexOf('/');
            String id = slash > 0 ? trimmed.substring(0, slash) : trimmed;
            if (slash < 0) {
                dispatchSingleNotification(ctx, id, (JSONObject) data);
            }
        }
    }

    private void dispatchSingleNotification(Context ctx, String id, JSONObject item) {
        if (id == null || id.isEmpty() || item == null) return;
        if (item.optBoolean("read", false)) return;
        if (item.optBoolean("synthetic", false) || id.startsWith("auto_")) return;
        String type = item.optString("type", "");
        if ("announcement".equalsIgnoreCase(type)) return;

        String title = item.optString("title", "New Notification");
        String body = item.optString("body", item.optString("message", "Tap to view details in Punjab Esports."));
        String combined = (type + " " + title + " " + body).toLowerCase(Locale.ROOT);
        if (combined.contains("balance") || combined.contains("wallet") || combined.contains("deposit")
                || combined.contains("withdraw") || combined.contains("refund") || combined.contains("reward")) {
            lastWalletNotifTs = System.currentTimeMillis();
        }
        if (combined.contains("diamond")) {
            lastDiamondNotifTs = System.currentTimeMillis();
        }
        NotificationHelper.showNotification(ctx, "notif:" + id, title, body, "notifications");
    }

    private void handleWalletEvent(String path, Object data, boolean isInitial) {
        if (data == null) return;
        Double newBal = null;
        if ("/".equals(path) && data instanceof JSONObject) {
            JSONObject obj = (JSONObject) data;
            if (obj.has("balance")) {
                double v = obj.optDouble("balance", Double.NaN);
                if (!Double.isNaN(v) && !Double.isInfinite(v)) newBal = v;
            }
        } else if ("/balance".equals(path)) {
            newBal = parseDoubleSafe(data);
        }
        if (newBal == null) return;

        Context ctx = getApplicationContext();
        if (!NotificationHelper.hasKnownBalance(ctx)) {
            NotificationHelper.saveSnapshots(ctx, newBal, null);
            return;
        }
        double prevBal = NotificationHelper.getLastKnownBalance(ctx);
        double diff = Math.round((newBal - prevBal) * 100.0) / 100.0;
        if (Math.abs(diff) < 0.01) {
            return;
        }

        NotificationHelper.saveSnapshots(ctx, newBal, null);
        // Brief pause in case an official notifications/{uid} event is arriving in the exact same instant
        if (!isInitial) {
            sleepQuietly(450L);
        }
        if ((System.currentTimeMillis() - lastWalletNotifTs) < 3_000L) {
            return;
        }

        NotificationHelper.recordBgNotifiedBalance(ctx, newBal);
        String actionLabel = diff > 0
                ? ("+" + formatRupees(diff) + " added")
                : (formatRupees(Math.abs(diff)) + " deducted");
        String body = "Your wallet was updated by admin (" + actionLabel
                + "). New balance: " + formatRupees(newBal) + ".";
        String key = "sse_bal_" + Math.round(prevBal * 100) + "_" + Math.round(newBal * 100)
                + "_" + (System.currentTimeMillis() / 10_000L);
        NotificationHelper.showNotification(ctx, key, "Wallet Balance Updated", body, "notifications");
    }

    private void handleUserEvent(String path, Object data, boolean isInitial) {
        if (data == null) return;
        Context ctx = getApplicationContext();

        if ("/diamonds".equals(path)) {
            Long newDia = parseLongSafe(data);
            if (newDia != null && newDia >= 0L) {
                handleDiamondsValue(ctx, newDia, isInitial);
            }
            return;
        }

        if (path.startsWith("/mailbox")) {
            if ("/mailbox".equals(path) && data instanceof JSONObject) {
                handleMailboxMap(ctx, (JSONObject) data, null, false);
            } else if (path.startsWith("/mailbox/") && data instanceof JSONObject) {
                String rest = path.substring("/mailbox/".length());
                int slash = rest.indexOf('/');
                if (slash < 0 && !rest.isEmpty()) {
                    dispatchSingleMailbox(ctx, rest, (JSONObject) data);
                }
            }
            return;
        }

        if ("/".equals(path) && data instanceof JSONObject) {
            JSONObject userObj = (JSONObject) data;
            if (userObj.has("diamonds")) {
                long newDia = userObj.optLong("diamonds", -1L);
                if (newDia >= 0L) {
                    handleDiamondsValue(ctx, newDia, isInitial);
                }
            }
            JSONObject mailObj = userObj.optJSONObject("mailbox");
            JSONObject deletedIdsObj = userObj.optJSONObject("deletedMailIds");
            if (mailObj != null) {
                handleMailboxMap(ctx, mailObj, deletedIdsObj, isInitial);
            }
        }
    }

    private void handleDiamondsValue(Context ctx, long newDia, boolean isInitial) {
        if (!NotificationHelper.hasKnownDiamonds(ctx)) {
            NotificationHelper.saveSnapshots(ctx, null, newDia);
            return;
        }
        long prevDia = NotificationHelper.getLastKnownDiamonds(ctx);
        long diff = newDia - prevDia;
        if (diff == 0L) return;

        NotificationHelper.saveSnapshots(ctx, null, newDia);
        if (!isInitial) {
            sleepQuietly(450L);
        }
        if ((System.currentTimeMillis() - lastDiamondNotifTs) < 3_000L) {
            return;
        }

        String actionLabel = diff > 0
                ? ("+" + diff + " Diamonds added")
                : (Math.abs(diff) + " Diamonds deducted");
        String body = "Your diamonds were updated by admin (" + actionLabel
                + "). Total: " + newDia + " Diamonds.";
        String key = "sse_dia_" + prevDia + "_" + newDia + "_" + (System.currentTimeMillis() / 10_000L);
        NotificationHelper.showNotification(ctx, key, "Diamonds Updated by Admin", body, "notifications");
    }

    private void handleMailboxMap(Context ctx, JSONObject mailObj, JSONObject deletedIdsObj, boolean isInitial) {
        boolean hasAnySeen = !NotificationHelper.getSeenKeys(ctx).isEmpty();
        List<String> seedKeys = new ArrayList<>();
        Iterator<String> keys = mailObj.keys();
        while (keys.hasNext()) {
            String id = keys.next();
            if (deletedIdsObj != null && deletedIdsObj.optBoolean(id, false)) continue;
            JSONObject item = mailObj.optJSONObject(id);
            if (item == null) continue;
            if (isInitial && !hasAnySeen) {
                seedKeys.add("mail:" + id);
            } else {
                dispatchSingleMailbox(ctx, id, item);
            }
        }
        if (!seedKeys.isEmpty()) {
            NotificationHelper.markKeysSeen(ctx, seedKeys);
        }
    }

    private void dispatchSingleMailbox(Context ctx, String id, JSONObject item) {
        if (id == null || id.isEmpty() || "welcome_vip_7d".equals(id) || item == null) return;
        if (item.optBoolean("deleted", false)) return;
        if (!"unclaimed".equalsIgnoreCase(item.optString("status", ""))) return;
        long now = System.currentTimeMillis();
        long createdAt = extractTimestamp(item);
        long expiresAt = item.optLong("expiresAt", createdAt > 0 ? createdAt + MAIL_EXPIRY_MS : 0L);
        if (expiresAt > 0 && now >= expiresAt) return;

        String body = item.optString("title", item.optString("body", "Claim your reward within 7 days before it expires."));
        NotificationHelper.showNotification(ctx, "mail:" + id, "New Gift in Mailbox!", body, "mailbox");
    }

    private void handleAdminDmEvent(String path, Object data, boolean isInitial) {
        if (data == null) return;
        Context ctx = getApplicationContext();
        if ("/".equals(path) && data instanceof JSONObject) {
            JSONObject map = (JSONObject) data;
            boolean hasAnySeen = !NotificationHelper.getSeenKeys(ctx).isEmpty();
            List<String> seedKeys = new ArrayList<>();
            Iterator<String> keys = map.keys();
            while (keys.hasNext()) {
                String id = keys.next();
                JSONObject item = map.optJSONObject(id);
                if (item == null) continue;
                if (isInitial && !hasAnySeen) {
                    seedKeys.add("dm:" + id);
                } else {
                    dispatchSingleAdminDm(ctx, id, item);
                }
            }
            if (!seedKeys.isEmpty()) {
                NotificationHelper.markKeysSeen(ctx, seedKeys);
            }
        } else if (path.startsWith("/") && path.length() > 1 && data instanceof JSONObject) {
            String rest = path.substring(1);
            if (rest.indexOf('/') < 0) {
                dispatchSingleAdminDm(ctx, rest, (JSONObject) data);
            }
        }
    }

    private void dispatchSingleAdminDm(Context ctx, String id, JSONObject item) {
        if (id == null || id.isEmpty() || item == null) return;
        if (item.optBoolean("deleted", false)) return;
        if ("user".equalsIgnoreCase(item.optString("from", ""))) return;
        long now = System.currentTimeMillis();
        long createdAt = extractTimestamp(item);
        if (createdAt > 0 && (now - createdAt) > FIVE_DAYS_MS) return;

        String text = item.optString("text", "Official Admin sent you a reply.");
        NotificationHelper.showNotification(ctx, "dm:" + id, "Official Admin Reply", text, "admindm");
    }

    private void handleAnnouncementsEvent(String path, Object data, boolean isInitial) {
        if (data == null) return;
        Context ctx = getApplicationContext();
        if ("/".equals(path) && data instanceof JSONObject) {
            JSONObject map = (JSONObject) data;
            boolean hasAnySeen = !NotificationHelper.getSeenKeys(ctx).isEmpty();
            List<String> seedKeys = new ArrayList<>();
            Iterator<String> keys = map.keys();
            while (keys.hasNext()) {
                String id = keys.next();
                JSONObject item = map.optJSONObject(id);
                if (item == null) continue;
                if (isInitial && !hasAnySeen) {
                    seedKeys.add("ann:" + id);
                } else {
                    dispatchSingleAnnouncement(ctx, id, item);
                }
            }
            if (!seedKeys.isEmpty()) {
                NotificationHelper.markKeysSeen(ctx, seedKeys);
            }
        } else if (path.startsWith("/") && path.length() > 1 && data instanceof JSONObject) {
            String rest = path.substring(1);
            if (rest.indexOf('/') < 0) {
                dispatchSingleAnnouncement(ctx, rest, (JSONObject) data);
            }
        }
    }

    private void dispatchSingleAnnouncement(Context ctx, String id, JSONObject item) {
        if (id == null || id.isEmpty() || item == null) return;
        if (item.has("active") && !item.optBoolean("active", true)) return;
        long now = System.currentTimeMillis();
        long createdAt = extractTimestamp(item);
        if (createdAt > 0 && (now - createdAt) > TWO_DAYS_MS) return;

        String title = item.optString("title", "Punjab Esports Announcement");
        String body = item.optString("body", item.optString("message", item.optString("text", "New announcement available.")));
        NotificationHelper.showNotification(ctx, "ann:" + id, title, body, "notifications");
    }

    private void handleMatchResultsEvent(String uid, String path, Object data, boolean isInitial) {
        if (data == null) return;
        Context ctx = getApplicationContext();
        if ("/".equals(path) && data instanceof JSONObject) {
            JSONObject map = (JSONObject) data;
            List<String> seedKeys = new ArrayList<>();
            Iterator<String> keys = map.keys();
            while (keys.hasNext()) {
                String matchId = keys.next();
                JSONObject res = map.optJSONObject(matchId);
                if (res == null) continue;
                if (!"approved".equalsIgnoreCase(res.optString("status", ""))) continue;
                JSONObject entries = res.optJSONObject("entries");
                JSONObject myEntry = entries != null ? entries.optJSONObject(uid) : null;
                if (myEntry == null) continue;
                String dedupeKey = buildResultKey(matchId, uid, myEntry);
                if (isInitial) {
                    seedKeys.add(dedupeKey);
                } else {
                    dispatchMatchResult(ctx, matchId, uid, myEntry);
                }
            }
            if (!seedKeys.isEmpty()) {
                NotificationHelper.markKeysSeen(ctx, seedKeys);
            }
            return;
        }

        if (path.startsWith("/") && path.length() > 1) {
            String rest = path.substring(1);
            int slash = rest.indexOf('/');
            String matchId = slash > 0 ? rest.substring(0, slash) : rest;
            if (matchId.isEmpty()) return;
            JSONObject res = NotificationHelper.fetchRtdbObject(ctx, "matchResults/" + matchId);
            if (res == null) return;
            if (!"approved".equalsIgnoreCase(res.optString("status", ""))) return;
            JSONObject entries = res.optJSONObject("entries");
            JSONObject myEntry = entries != null ? entries.optJSONObject(uid) : null;
            if (myEntry == null) return;
            dispatchMatchResult(ctx, matchId, uid, myEntry);
        }
    }

    private String buildResultKey(String matchId, String uid, JSONObject entry) {
        int rank = entry.optInt("rank", 0);
        int kills = entry.optInt("kills", 0);
        long rewardCents = Math.round(entry.optDouble("reward", 0.0) * 100.0);
        return "result:" + matchId + ":" + uid + ":" + rank + ":" + kills + ":" + rewardCents;
    }

    private void dispatchMatchResult(Context ctx, String matchId, String uid, JSONObject myEntry) {
        String dedupeKey = buildResultKey(matchId, uid, myEntry);
        if (NotificationHelper.isKeySeen(ctx, dedupeKey)) return;

        JSONObject matchObj = NotificationHelper.fetchRtdbObject(ctx, "tournaments/" + matchId);
        String matchTitle = matchObj != null ? matchObj.optString("title", "Tournament Match") : "Tournament Match";
        int rank = myEntry.optInt("rank", 0);
        int kills = myEntry.optInt("kills", 0);
        double reward = myEntry.optDouble("reward", 0.0);

        String rankLabel;
        if (rank == 1) rankLabel = "Rank #1";
        else if (rank == 2) rankLabel = "Rank #2";
        else if (rank == 3) rankLabel = "Rank #3";
        else if (rank > 0) rankLabel = "Rank #" + rank;
        else rankLabel = "Result Updated";

        String rewardPart = reward > 0.0 ? (" • Prize: " + formatRupees(reward)) : "";
        String body = matchTitle + ": " + rankLabel + " • " + kills + " Kills" + rewardPart;
        NotificationHelper.showNotification(ctx, dedupeKey, "Match Result Declared!", body, "notifications");
    }

    private void handleRoomCredentialsEvent(String uid, String path, Object data, boolean isInitial) {
        if (data == null) return;
        Context ctx = getApplicationContext();
        if ("/".equals(path) && data instanceof JSONObject) {
            if (isInitial) {
                JSONObject map = (JSONObject) data;
                List<String> seedKeys = new ArrayList<>();
                Iterator<String> keys = map.keys();
                while (keys.hasNext()) {
                    String matchId = keys.next();
                    JSONObject creds = map.optJSONObject(matchId);
                    if (creds == null) continue;
                    String rId = creds.optString("roomId", "");
                    String rPass = creds.optString("roomPass", "");
                    if (!rId.isEmpty() || !rPass.isEmpty()) {
                        seedKeys.add("room:" + matchId + ":" + rId + ":" + rPass);
                    }
                }
                if (!seedKeys.isEmpty()) {
                    NotificationHelper.markKeysSeen(ctx, seedKeys);
                }
            }
            return;
        }

        if (path.startsWith("/") && path.length() > 1) {
            String rest = path.substring(1);
            int slash = rest.indexOf('/');
            String matchId = slash > 0 ? rest.substring(0, slash) : rest;
            if (matchId.isEmpty()) return;

            JSONObject creds = NotificationHelper.fetchRtdbObject(ctx, "privateRoomCredentials/" + matchId);
            if (creds == null) return;
            String rId = creds.optString("roomId", "").trim();
            String rPass = creds.optString("roomPass", "").trim();
            if (rId.isEmpty() && rPass.isEmpty()) return;

            String dedupeKey = "room:" + matchId + ":" + rId + ":" + rPass;
            if (NotificationHelper.isKeySeen(ctx, dedupeKey)) return;

            // Only notify if THIS user is actually registered in this match!
            JSONObject myRegs = NotificationHelper.fetchRtdbByUserId(ctx, "registrations", uid);
            if (myRegs == null) return;
            boolean registered = false;
            Iterator<String> it = myRegs.keys();
            while (it.hasNext()) {
                JSONObject reg = myRegs.optJSONObject(it.next());
                if (reg == null) continue;
                if (matchId.equals(reg.optString("matchId", ""))
                        && !"cancelled".equalsIgnoreCase(reg.optString("status", "confirmed"))) {
                    registered = true;
                    break;
                }
            }
            if (!registered) return;

            JSONObject matchObj = NotificationHelper.fetchRtdbObject(ctx, "tournaments/" + matchId);
            String matchTitle = matchObj != null ? matchObj.optString("title", "Your Match") : "Your Match";
            String body = matchTitle + " — Room ID & Password are now ready. Open Punjab Esports to join!";
            NotificationHelper.showNotification(ctx, dedupeKey, "Room ID & Password Live!", body, "notifications");
        }
    }

    private static Double parseDoubleSafe(Object val) {
        if (val instanceof Number) {
            double d = ((Number) val).doubleValue();
            return (!Double.isNaN(d) && !Double.isInfinite(d)) ? d : null;
        }
        try {
            double d = Double.parseDouble(String.valueOf(val));
            return (!Double.isNaN(d) && !Double.isInfinite(d)) ? d : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static Long parseLongSafe(Object val) {
        if (val instanceof Number) {
            return ((Number) val).longValue();
        }
        try {
            return Long.parseLong(String.valueOf(val));
        } catch (Exception ignored) {
            return null;
        }
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

    private static String formatRupees(double val) {
        if (Math.abs(val - Math.rint(val)) < 0.005) {
            return "\u20B9" + Math.round(val);
        }
        DecimalFormat df = new DecimalFormat("0.##");
        return "\u20B9" + df.format(val);
    }

    private static void sleepQuietly(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }
}
