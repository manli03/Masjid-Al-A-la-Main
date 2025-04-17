package app.web.masjidala;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity {
  private static final String TAG = "MainActivity";
  private static final String PREF_NAME = "masjidala_prefs";
  private static final String KEY_AUTOSTART_SHOWN = "autostart_shown";

  private String pendingJsExecution = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register our plugins before super.onCreate
        registerPlugin(AndroidAudio.class);

        super.onCreate(savedInstanceState);

        // Schedule the daily notification check when app starts
        PrayerNotificationHelper.scheduleDailyCheck(this);

        maybeShowAutostartSettingsOnce(this); // 👈 Show only one time

        // Check for JavaScript execution requests from intents
        Intent intent = getIntent();
        if (intent != null && intent.hasExtra("executeJs")) {
            pendingJsExecution = intent.getStringExtra("executeJs");
        }
    }

    @Override
    public void onStart() {
        super.onStart();

        // Execute any pending JavaScript after a delay to ensure WebView is ready
        if (pendingJsExecution != null) {
            final String jsToExecute = pendingJsExecution;
            pendingJsExecution = null;

            // Use a handler with a delay to ensure the WebView is fully loaded
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    Log.d(TAG, "Executing JavaScript: " + jsToExecute);
                    getBridge().getWebView().evaluateJavascript(jsToExecute, null);
                } else {
                    Log.e(TAG, "Bridge or WebView not ready for JavaScript execution");
                }
            }, 1000); // 1 second delay
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        if (intent.hasExtra("executeJs")) {
            final String jsToExecute = intent.getStringExtra("executeJs");

            // Execute JavaScript if bridge is ready
            if (getBridge() != null && getBridge().getWebView() != null) {
                Log.d(TAG, "Executing JavaScript on new intent: " + jsToExecute);
                assert jsToExecute != null;
                getBridge().getWebView().evaluateJavascript(jsToExecute, null);
            } else {
                Log.e(TAG, "Bridge or WebView not ready for JavaScript execution on new intent");
                // Store for later execution
                pendingJsExecution = jsToExecute;
            }
        }
    }

  private void maybeShowAutostartSettingsOnce(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    boolean alreadyShown = prefs.getBoolean(KEY_AUTOSTART_SHOWN, false);

    if (!alreadyShown) {
      new android.app.AlertDialog.Builder(this)
        .setTitle("Enable Auto Start")
        .setMessage("To ensure prayer notifications work after reboot, please allow the app to auto-start in your phone's settings.")
        .setPositiveButton("Open Settings", (dialog, which) -> {
          openAutoStartSettings(context);
          prefs.edit().putBoolean(KEY_AUTOSTART_SHOWN, true).apply(); // Save flag as shown
        })
        .setNegativeButton("Cancel", null)
        .setCancelable(true)
        .show();

      Log.d(TAG, "Autostart settings dialog shown");
    }
    Log.d(TAG, "Autostart settings dialog already shown before");
  }

  private void openAutoStartSettings(Context context) {
    Intent intent = new Intent();
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    String manufacturer = Build.MANUFACTURER.toLowerCase();

    switch (manufacturer) {
      case "xiaomi":
        intent.setComponent(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
        break;
      case "oppo":
        intent.setComponent(new ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
        break;
      case "vivo":
        intent.setComponent(new ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"));
        break;
      case "letv":
        intent.setComponent(new ComponentName("com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"));
        break;
      case "asus":
        intent.setComponent(new ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.entry.FunctionActivity"));
        break;
      case "huawei":
      case "honor":
        intent.setComponent(new ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
        break;
      case "oneplus":
        intent.setComponent(new ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"));
        break;
      default:
        intent.setAction(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        break;
    }

    try {
      context.startActivity(intent);
    } catch (Exception e) {
      Log.e(TAG, "Unable to open autostart/battery settings: " + e.getMessage());
      context.startActivity(new Intent(Settings.ACTION_SETTINGS));
    }
  }
}
