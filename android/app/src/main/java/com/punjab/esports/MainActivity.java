package com.punjab.esports;

import android.Manifest;
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

    private boolean isRequestingPermission = false;
    private boolean openedSettingsForPermission = false;
    private long permissionPromptStartedAt = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeGoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);
        checkAndEnforceImagePermission();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (openedSettingsForPermission) {
            openedSettingsForPermission = false;
            if (!hasImagePermission()) {
                closeAppImmediately();
            }
        }
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
        if (requestCode != IMAGE_PERMISSION_REQUEST_CODE) {
            return;
        }
        isRequestingPermission = false;

        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            return;
        }

        long elapsed = System.currentTimeMillis() - permissionPromptStartedAt;
        boolean canShowSystemDialogAgain = shouldShowRequestPermissionRationale(getRequiredImagePermission());

        if (canShowSystemDialogAgain || elapsed >= 250) {
            closeAppImmediately();
            return;
        }

        new AlertDialog.Builder(this)
                .setTitle("Images Permission Required")
                .setMessage("Punjab Esports requires access to Photos/Images to continue. Please allow permission in Settings.")
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
