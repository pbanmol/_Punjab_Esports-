package com.punjab.esports;

import android.accounts.AccountManager;
import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {

    @PluginMethod
    public void pickAccount(PluginCall call) {
        try {
            Intent intent = AccountManager.newChooseAccountIntent(
                    null,
                    null,
                    new String[]{"com.google"},
                    null,
                    null,
                    null,
                    null
            );
            startActivityForResult(call, intent, "handleAccountPickResult");
        } catch (Exception e) {
            call.reject("Account picker unavailable: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void handleAccountPickResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            String email = result.getData().getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
            if (email != null && !email.trim().isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("email", email.trim());
                ret.put("cancelled", false);
                call.resolve(ret);
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }
}
