package com.punjab.esports;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import org.json.JSONObject;

public class NotificationSyncWorker extends Worker {
    private static final long FIVE_DAYS_MS = 5L * 24L * 60L * 60L * 1000L;
    private static final long TWO_DAYS_MS = 2L * 24L * 60L * 60L * 1000L;
    private static final long MAIL_EXPIRY_MS = 7L * 24L * 60L * 60L * 1000L;
    private static final int MAX_NOTIFS_PER_RUN = 4;

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

    public NotificationSyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        String uid = NotificationHelper.getUid(ctx);
        if (uid.isEmpty()) {
            return Result.success();
        }
        if (!NotificationHelper.canPostNotifications(ctx)) {
            return Result.success();
        }

        long now = System.currentTimeMillis();
        List<PendingAlert> alerts = new ArrayList<>();

        // 1. User Notifications: notifications/{uid}
        JSONObject notifsObj = NotificationHelper.fetchRtdbObject(ctx, "notifications/" + uid);
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
                if (NotificationHelper.isKeySeen(ctx, dedupeKey)) continue;

                String title = item.optString("title", "New Notification");
                String body = item.optString("body", item.optString("message", "Tap to view details in Punjab Esports."));
                long ts = extractTimestamp(item);
                alerts.add(new PendingAlert(dedupeKey, title, body, "notifications", ts));
            }
        }

        // 2. Unclaimed Mailbox Gifts: users/{uid}/mailbox
        JSONObject mailObj = NotificationHelper.fetchRtdbObject(ctx, "users/" + uid + "/mailbox");
        if (mailObj != null) {
            Iterator<String> keys = mailObj.keys();
            while (keys.hasNext()) {
                String id = keys.next();
                JSONObject item = mailObj.optJSONObject(id);
                if (item == null) continue;
                if (item.optBoolean("deleted", false)) continue;
                String status = item.optString("status", "");
                if (!"unclaimed".equalsIgnoreCase(status)) continue;

                long createdAt = extractTimestamp(item);
                long expiresAt = item.optLong("expiresAt", createdAt > 0 ? createdAt + MAIL_EXPIRY_MS : 0L);
                if (expiresAt > 0 && now >= expiresAt) continue;

                String dedupeKey = "mail:" + id;
                if (NotificationHelper.isKeySeen(ctx, dedupeKey)) continue;

                String title = "New Gift in Mailbox!";
                String body = item.optString("title", item.optString("body", "Claim your reward within 7 days before it expires."));
                alerts.add(new PendingAlert(dedupeKey, title, body, "mailbox", createdAt));
            }
        }

        // 3. Direct Admin DM Replies: adminMessages/{uid}
        JSONObject dmObj = NotificationHelper.fetchRtdbObject(ctx, "adminMessages/" + uid);
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
                if (NotificationHelper.isKeySeen(ctx, dedupeKey)) continue;

                String text = item.optString("text", "Official Admin sent you a reply.");
                alerts.add(new PendingAlert(dedupeKey, "Official Admin Reply", text, "admindm", createdAt));
            }
        }

        // 4. Global Active Announcements: announcements
        JSONObject annObj = NotificationHelper.fetchRtdbObject(ctx, "announcements");
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
                if (NotificationHelper.isKeySeen(ctx, dedupeKey)) continue;

                String title = item.optString("title", "Punjab Esports Announcement");
                String body = item.optString("body", item.optString("message", item.optString("text", "New announcement available.")));
                alerts.add(new PendingAlert(dedupeKey, title, body, "notifications", createdAt));
            }
        }

        if (alerts.isEmpty()) {
            return Result.success();
        }

        Collections.sort(alerts, (a, b) -> Long.compare(b.ts, a.ts));

        int posted = 0;
        List<String> skippedToMarkSeen = new ArrayList<>();
        for (PendingAlert alert : alerts) {
            if (posted < MAX_NOTIFS_PER_RUN) {
                boolean shown = NotificationHelper.showNotification(
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
            NotificationHelper.markKeysSeen(ctx, skippedToMarkSeen);
        }

        return Result.success();
    }

    private long extractTimestamp(JSONObject obj) {
        long ts = obj.optLong("createdAt", 0L);
        if (ts <= 0L) ts = obj.optLong("timestamp", 0L);
        if (ts <= 0L) ts = obj.optLong("time", 0L);
        if (ts > 0L && ts < 100000000000L) {
            ts = ts * 1000L;
        }
        return ts;
    }
}
