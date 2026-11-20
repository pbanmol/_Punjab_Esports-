package com.punjab.esports;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            Context appCtx = context.getApplicationContext();
            if (!NotificationHelper.getUid(appCtx).isEmpty()) {
                NotificationHelper.ensureChannel(appCtx);
                NotificationHelper.schedulePeriodicSync(appCtx);
                NotificationHelper.scheduleAlarmLoop(appCtx, 45_000L);
            }
        }
    }
}
