package com.punjab.esports;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public class NotificationSyncWorker extends Worker {

    public NotificationSyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        if (NotificationHelper.isIgnoringBatteryOptimizations(ctx)) {
            RealtimePushService.startIfLoggedIn(ctx);
        }
        NotificationHelper.runBackgroundCheck(ctx, true);
        NotificationHelper.scheduleAlarmLoop(ctx, NotificationHelper.ALARM_INTERVAL_MS);
        return Result.success();
    }
}
