package com.punjab.esports;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Keeps live notifications resilient if the user accidentally swipes away the
 * silent foreground notification on Android 14+ / ColorOS.
 */
public class ServiceRestartReceiver extends BroadcastReceiver {
    public static final String ACTION_RESTART_LIVE_SERVICE = "com.punjab.esports.ACTION_RESTART_LIVE_SERVICE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        Context appCtx = context.getApplicationContext();
        if (NotificationHelper.getUid(appCtx).isEmpty()) return;

        // If server-side FCM is active, no foreground service is needed at all
        if (NotificationHelper.shouldUseServerFcmOnly(appCtx)) {
            return;
        }

        // Re-post / keep the live service alive and arm fallback checks
        RealtimePushService.start(appCtx);
        NotificationHelper.scheduleQuickBackgroundCheck(appCtx);
        NotificationHelper.scheduleAlarmLoop(appCtx, NotificationHelper.ALARM_INTERVAL_MS);
    }
}
