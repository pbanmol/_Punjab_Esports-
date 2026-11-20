package com.punjab.esports;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class NotificationAlarmReceiver extends BroadcastReceiver {
    public static final String ACTION_POLL = "com.punjab.esports.ACTION_POLL_NOTIFICATIONS";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) {
            return;
        }
        final Context appCtx = context.getApplicationContext();
        if (NotificationHelper.getUid(appCtx).isEmpty()) {
            return;
        }

        final PendingResult pendingResult = goAsync();
        EXECUTOR.execute(() -> {
            PowerManager.WakeLock wakeLock = null;
            try {
                PowerManager pm = (PowerManager) appCtx.getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PunjabEsports:NotifSync");
                    wakeLock.setReferenceCounted(false);
                    wakeLock.acquire(20_000L);
                }
                NotificationHelper.runBackgroundCheck(appCtx);
            } catch (Throwable ignored) {
            } finally {
                NotificationHelper.scheduleAlarmLoop(appCtx, NotificationHelper.ALARM_INTERVAL_MS);
                if (wakeLock != null && wakeLock.isHeld()) {
                    try {
                        wakeLock.release();
                    } catch (Throwable ignored) {
                    }
                }
                if (pendingResult != null) {
                    try {
                        pendingResult.finish();
                    } catch (Throwable ignored) {
                    }
                }
            }
        });
    }
}
