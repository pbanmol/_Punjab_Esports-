package com.punjab.esports;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int IMAGE_PERMISSION_REQUEST_CODE = 1001;
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1002;

    private boolean isRequestingPermission = false;
    private boolean openedSettingsForPermission = false;
    private long permissionPromptStartedAt = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeGoogleAuthPlugin.class);
        registerPlugin(NativeNotificationPlugin.class);
        super.onCreate(savedInstanceState);
        NotificationHelper.ensureChannel(this);
        handleNotificationIntent(getIntent());
        checkAndEnforceImagePermission();
        if (hasImagePermission()) {
            requestNotificationPermissionIfNeeded();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (openedSettingsForPermission) {
            openedSettingsForPermission = false;
            if (!hasImagePermission()) {
                closeAppImmediately();
            } else {
                requestNotificationPermissionIfNeeded();
            }
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        NotificationHelper.scheduleQuickBackgroundCheck(this);
        NotificationHelper.scheduleAlarmLoop(this, NotificationHelper.ALARM_INTERVAL_MS);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) {
            return;
        }
        String target = intent.getStringExtra(NotificationHelper.EXTRA_OPEN_TARGET);
        if (target == null || target.trim().isEmpty()) {
            target = intent.getStringExtra("target");
        }
        if (target != null && !target.trim().isEmpty()) {
            NotificationHelper.setPendingOpenTarget(this, target.trim());
            NativeNotificationPlugin.notifyTapFromActivity(target.trim());
            intent.removeExtra(NotificationHelper.EXTRA_OPEN_TARGET);
            intent.removeExtra("target");
        }
    }

    @SuppressLint("InlinedApi")
    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return;
        }
        if (NotificationHelper.hasNotificationPermission(this)) {
            return;
        }
        if (NotificationHelper.hasAskedNotificationPermission(this)) {
            return;
        }
        NotificationHelper.markAskedNotificationPermission(this);
        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST_CODE);
    }

    private String getRequiredImagePermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? Manifest.permission.READ_MEDIA_IMAGES
                : Manifest.permission.READ_EXTERNAL_STORAGE;
    }

    private boolean hasImagePermission() {
        return checkSelfPermission(getRequiredImagePermission()) == PackageManager.PERMISSION_GRANTED;
    }

    private void checkAndEnforceImagePermission() {
        if (hasImagePermission() || isRequestingPermission) {
            return;
        }
        isRequestingPermission = true;
        permissionPromptStartedAt = System.currentTimeMillis();
        requestPermissions(new String[]{getRequiredImagePermission()}, IMAGE_PERMISSION_REQUEST_CODE);
    }

    private void closeAppImmediately() {
        finishAndRemoveTask();
        finishAffinity();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                NotificationHelper.schedulePeriodicSync(this);
                NotificationHelper.scheduleAlarmLoop(this, NotificationHelper.ALARM_INTERVAL_MS);
            }
            return;
        }
        if (requestCode != IMAGE_PERMISSION_REQUEST_CODE) {
            return;
        }
        isRequestingPermission = false;

        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            requestNotificationPermissionIfNeeded();
            return;
        }

        long elapsed = System.currentTimeMillis() - permissionPromptStartedAt;
        boolean canShowSystemDialogAgain = shouldShowRequestPermissionRationale(getRequiredImagePermission());

        if (canShowSystemDialogAgain || elapsed >= 250) {
            closeAppImmediately();
            return;
        }

        new AlertDialog.Builder(this)
                .setTitle("Photos & Media Access Needed")
                .setMessage("Punjab Esports needs access to your device photos so you can set your profile picture, team logo, and upload match result screenshots. Please allow Photos access in Settings to continue.")
                .setCancelable(false)
                .setPositiveButton("Open Settings", (d, w) -> {
                    openedSettingsForPermission = true;
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.fromParts("package", getPackageName(), null));
                    startActivity(intent);
                })
                .setNegativeButton("Exit App", (d, w) -> closeAppImmediately())
                .show();
    }
}
