package com.punjab.esports;

import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;
import java.util.concurrent.Executors;

public class PunjabFirebaseMessagingService extends FirebaseMessagingService {

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        NotificationHelper.saveFcmToken(this, token);
        NativeNotificationPlugin.notifyTokenRefreshed(token);
        Executors.newSingleThreadExecutor().execute(() ->
                NotificationHelper.syncFcmTokenToDatabase(getApplicationContext(), token)
        );
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Map<String, String> data = remoteMessage.getData();
        String title = data.get("title");
        String body = data.get("body");
        String target = data.get("target");
        String dedupeKey = data.get("dedupeKey");

        RemoteMessage.Notification notif = remoteMessage.getNotification();
        if (notif != null) {
            if (title == null || title.trim().isEmpty()) {
                title = notif.getTitle();
            }
            if (body == null || body.trim().isEmpty()) {
                body = notif.getBody();
            }
        }

        if (title == null || title.trim().isEmpty()) {
            title = "Punjab Esports";
        }
        if (body == null || body.trim().isEmpty()) {
            body = "You have a new update.";
        }
        if (target == null || target.trim().isEmpty()) {
            target = "notifications";
        }
        if (dedupeKey == null || dedupeKey.trim().isEmpty()) {
            String msgId = remoteMessage.getMessageId();
            dedupeKey = (msgId != null && !msgId.isEmpty()) ? ("fcm:" + msgId) : ("fcm:" + System.currentTimeMillis());
        }

        NotificationHelper.showNotification(getApplicationContext(), dedupeKey, title, body, target);
    }
}
