package com.punjab.esports;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ServiceRestartReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) {
            return;
        }
        Context appCtx = context.getApplicationContext();
        if (!NotificationHelper.getUid(appCtx).isEmpty()) {
            RealtimePushService.startIfLoggedIn(appCtx);
            NotificationHelper.scheduleAlarmLoop(appCtx, NotificationHelper.ALARM_INTERVAL_MS);
        }
    }
}
