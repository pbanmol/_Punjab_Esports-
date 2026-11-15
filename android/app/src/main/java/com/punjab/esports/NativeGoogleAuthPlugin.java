package com.punjab.esports;

import android.accounts.Account;
import android.accounts.AccountManager;
import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {

    @PluginMethod
    public void getDeviceAccounts(PluginCall call) {
        try {
            AccountManager am = AccountManager.get(getContext());
            Account[] accounts = am.getAccountsByType("com.google");
            JSArray arr = new JSArray();
            if (accounts != null) {
                for (Account acc : accounts) {
                    if (acc != null && acc.name != null && !acc.name.trim().isEmpty()) {
                        String email = acc.name.trim();
                        String[] parts = email.split("@");
                        JSObject obj = new JSObject();
                        obj.put("email", email);
                        obj.put("name", parts.length > 0 ? parts[0] : email);
                        arr.put(obj);
                    }
                }
            }
            JSObject ret = new JSObject();
            ret.put("accounts", arr);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("accounts", new JSArray());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void pickAccount(PluginCall call) {
        try {
            Intent intent = AccountManager.newChooseAccountIntent(
                    null,
                    null,
                    new String[]{"com.google"},
                    "🎮 Choose your Gmail account for Punjab Esports",
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
