# Instant FCM Push Setup (Optional Upgrade)

Your Android app already checks Firebase in the background (even when completely closed or after phone restart) and posts real system notifications automatically with **zero extra setup**.

If you ALSO want **1-second instant real-time FCM push notifications** (even while the phone is in deep sleep):

1. Open **Firebase Console** -> project `punjab-turnaments` -> **Project Settings** -> **Your apps** -> **Add Android app**:
   - Android package name: `com.punjab.esports`
   - Download `google-services.json` and place it at `android/app/google-services.json`.
   - Rebuild the APK/AAB (GitHub Actions automatically detects `google-services.json` and activates FCM).

2. Deploy these Cloud Functions (requires Firebase Blaze plan):
   ```bash
   cd firebase-functions
   npm install
   firebase deploy --only functions --project punjab-turnaments
   ```

Once `google-services.json` is added, every user's device automatically saves its FCM token under `users/{uid}/fcmToken` and subscribes to topic `all_users` — you can also send broadcasts directly from Firebase Console -> Messaging!
