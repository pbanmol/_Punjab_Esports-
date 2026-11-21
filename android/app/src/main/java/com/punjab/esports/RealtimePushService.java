package com.punjab.esports;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class RealtimePushService extends Service {
    public static final String SERVICE_CHANNEL_ID = "punjab_esports_live_service";
    private static final String SERVICE_CHANNEL_NAME = "Background Alert Sync";
    private static final int SERVICE_NOTIF_ID = 90421;
    private static final int RESTART_REQ_CODE = 44091;
    private static final long FAST_SWEEP_SECONDS = 12L;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private final List<HttpURLConnection> activeStreams = new ArrayList<>();
    private ExecutorService streamExecutor;
    private ScheduledExecutorService sweepExecutor;

    public static void startIfLoggedIn(Context context) {
        if (context == null) {
            return;
        }
        Context appCtx = context.getApplicationContext();
        if (NotificationHelper.getUid(appCtx).isEmpty() || !NotificationHelper.canPostNotifications(appCtx)) {
            return;
        }
        try {
            Intent intent = new Intent(appCtx, RealtimePushService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(appCtx, intent);
            } else {
                appCtx.startService(intent);
            }
        } catch (Throwable ignored) {
            // Android 14+ may block starting foreground service from background; fallback alarm stays active.
            NotificationHelper.scheduleAlarmLoop(appCtx, NotificationHelper.ALARM_INTERVAL_MS);
        }
    }

    public static void stopService(Context context) {
        if (context == null) {
            return;
        }
        try {
            Context appCtx = context.getApplicationContext();
            appCtx.stopService(new Intent(appCtx, RealtimePushService.class));
        } catch (Throwable ignored) {
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ensureServiceChannel();
        NotificationHelper.ensureChannel(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String uid = NotificationHelper.getUid(this);
        if (uid.isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            Notification notif = buildServiceNotification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(SERVICE_NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(SERVICE_NOTIF_ID, notif);
            }
        } catch (Throwable ignored) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (running.compareAndSet(false, true)) {
            startLiveWatchers(uid);
        }

        return START_STICKY;
    }

    @Override
    public void onTimeout(int startId, int fgsType) {
        // Android 15/16 dataSync foreground service timeout handler: stop cleanly and keep alarm sync alive.
        shutdownWorkers();
        NotificationHelper.scheduleAlarmLoop(getApplicationContext(), 30_000L);
        stopSelf();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Context appCtx = getApplicationContext();
        if (!NotificationHelper.getUid(appCtx).isEmpty()) {
            scheduleQuickRestart(appCtx, 2_000L);
            NotificationHelper.scheduleAlarmLoop(appCtx, NotificationHelper.ALARM_INTERVAL_MS);
        }
    }

    @Override
    public void onDestroy() {
        shutdownWorkers();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void ensureServiceChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) {
            return;
        }
        NotificationChannel existing = nm.getNotificationChannel(SERVICE_CHANNEL_ID);
        if (existing != null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                SERVICE_CHANNEL_ID,
                SERVICE_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_MIN
        );
        channel.setDescription("Keeps live tournament and wallet notifications active");
        channel.setShowBadge(false);
        channel.enableLights(false);
        channel.enableVibration(false);
        channel.setSound(null, null);
        nm.createNotificationChannel(channel);
    }

    private Notification buildServiceNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                this,
                SERVICE_NOTIF_ID,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notification)
                .setColor(ContextCompat.getColor(this, R.color.notification_accent))
                .setContentTitle("Punjab Esports")
                .setContentText("Live alerts active")
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setVisibility(NotificationCompat.VISIBILITY_SECRET)
                .setOngoing(true)
                .setSilent(true)
                .setShowWhen(false)
                .setContentIntent(pi)
                .build();
    }

    private void startLiveWatchers(String uid) {
        final Context appCtx = getApplicationContext();
        streamExecutor = Executors.newFixedThreadPool(6);
        sweepExecutor = Executors.newSingleThreadScheduledExecutor();

        // Immediate baseline check + fast 12s sweep for requests, match results, room IDs & fallback
        sweepExecutor.scheduleWithFixedDelay(() -> {
            if (!running.get()) return;
            try {
                if (NotificationHelper.getUid(appCtx).isEmpty()) {
                    stopSelf();
                    return;
                }
                NotificationHelper.runBackgroundCheck(appCtx);
            } catch (Throwable ignored) {
            }
        }, 2L, FAST_SWEEP_SECONDS, TimeUnit.SECONDS);

        // Live Firebase RTDB SSE streams for <1s instant notification triggers
        String[] livePaths = new String[]{
                "notifications/" + uid,
                "wallets/" + uid + "/balance",
                "users/" + uid + "/diamonds",
                "users/" + uid + "/mailbox",
                "adminMessages/" + uid,
                "announcements"
        };

        for (final String path : livePaths) {
            final boolean needsSettleDelay = path.endsWith("/balance") || path.endsWith("/diamonds");
            streamExecutor.execute(() -> runSseLoop(appCtx, path, needsSettleDelay));
        }
    }

    private void runSseLoop(Context appCtx, String path, boolean settleDelay) {
        long backoffMs = 2_000L;
        while (running.get()) {
            String uid = NotificationHelper.getUid(appCtx);
            String dbUrl = NotificationHelper.getDatabaseUrl(appCtx);
            if (uid.isEmpty() || dbUrl.isEmpty()) {
                return;
            }

            HttpURLConnection conn = null;
            try {
                String token = NotificationHelper.getIdToken(appCtx);
                String fullUrl = dbUrl + "/" + path + ".json";
                if (token != null && !token.isEmpty()) {
                    fullUrl += "?auth=" + URLEncoder.encode(token, "UTF-8");
                }

                URL url = new URL(fullUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Accept", "text/event-stream");
                conn.setRequestProperty("Cache-Control", "no-cache");
                conn.setConnectTimeout(15_000);
                conn.setReadTimeout(70_000);
                registerConn(conn);

                int code = conn.getResponseCode();
                if (code == 401 || code == 403) {
                    NotificationHelper.refreshIdToken(appCtx);
                    sleepQuietly(2_000L);
                    continue;
                }
                if (code < 200 || code >= 300) {
                    sleepQuietly(backoffMs);
                    backoffMs = Math.min(30_000L, backoffMs * 2);
                    continue;
                }

                backoffMs = 2_000L;
                boolean initialPutSkipped = false;
                String currentEvent = "";

                try (BufferedReader br = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while (running.get() && (line = br.readLine()) != null) {
                        if (line.startsWith("event:")) {
                            currentEvent = line.substring(6).trim();
                        } else if (line.startsWith("data:")) {
                            if ("auth_revoked".equals(currentEvent) || "cancel".equals(currentEvent)) {
                                NotificationHelper.refreshIdToken(appCtx);
                                break;
                            }
                            if ("put".equals(currentEvent) || "patch".equals(currentEvent)) {
                                if (!initialPutSkipped && "put".equals(currentEvent)) {
                                    initialPutSkipped = true;
                                } else {
                                    triggerInstantCheck(appCtx, settleDelay);
                                }
                            }
                        }
                    }
                }
            } catch (Throwable ignored) {
                sleepQuietly(backoffMs);
                backoffMs = Math.min(30_000L, backoffMs * 2);
            } finally {
                unregisterConn(conn);
                if (conn != null) {
                    try {
                        conn.disconnect();
                    } catch (Throwable ignored) {
                    }
                }
            }
        }
    }

    private void triggerInstantCheck(Context appCtx, boolean settleDelay) {
        if (!running.get() || sweepExecutor == null || sweepExecutor.isShutdown()) {
            return;
        }
        long delayMs = settleDelay ? 1_400L : 250L;
        try {
            sweepExecutor.schedule(() -> {
                if (!running.get()) return;
                try {
                    NotificationHelper.runBackgroundCheck(appCtx);
                } catch (Throwable ignored) {
                }
            }, delayMs, TimeUnit.MILLISECONDS);
        } catch (Throwable ignored) {
        }
    }

    private void registerConn(HttpURLConnection conn) {
        synchronized (activeStreams) {
            activeStreams.add(conn);
        }
    }

    private void unregisterConn(HttpURLConnection conn) {
        if (conn == null) return;
        synchronized (activeStreams) {
            activeStreams.remove(conn);
        }
    }

    private void shutdownWorkers() {
        running.set(false);
        synchronized (activeStreams) {
            for (HttpURLConnection c : activeStreams) {
                try {
                    c.disconnect();
                } catch (Throwable ignored) {
                }
            }
            activeStreams.clear();
        }
        if (streamExecutor != null) {
            try {
                streamExecutor.shutdownNow();
            } catch (Throwable ignored) {
            }
            streamExecutor = null;
        }
        if (sweepExecutor != null) {
            try {
                sweepExecutor.shutdownNow();
            } catch (Throwable ignored) {
            }
            sweepExecutor = null;
        }
    }

    private static void sleepQuietly(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    private static void scheduleQuickRestart(Context appCtx, long delayMs) {
        try {
            AlarmManager am = (AlarmManager) appCtx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent intent = new Intent(appCtx, ServiceRestartReceiver.class);
            PendingIntent pi = PendingIntent.getBroadcast(
                    appCtx,
                    RESTART_REQ_CODE,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            am.setAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + delayMs,
                    pi
            );
        } catch (Throwable ignored) {
        }
    }
}
