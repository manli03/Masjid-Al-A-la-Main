package app.web.masjidala;

import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
//import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

import java.util.Arrays;
import java.util.List;

public class MainActivity extends BridgeActivity {
  private static final String TAG = "MainActivity";
  private static final String PREF_NAME = "masjidala_prefs";
  private static final String KEY_AUTOSTART_SHOWN = "autostart_shown";

  private String pendingJsExecution = null;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(AndroidAudio.class);
    super.onCreate(savedInstanceState);

    PrayerNotificationHelper.scheduleDailyCheck(this);

    Intent intent = getIntent();
    if (intent != null && intent.hasExtra("executeJs")) {
      pendingJsExecution = intent.getStringExtra("executeJs");
    }
  }

  @Override
  public void onStart() {
    super.onStart();
    executePendingJavascript();
    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this::showStartupDialogs, 5000);
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

  private void executePendingJavascript() {
    if (pendingJsExecution != null && getBridge() != null && getBridge().getWebView() != null) {
      getBridge().getWebView().evaluateJavascript(pendingJsExecution, null);
      pendingJsExecution = null;
    }
  }

  private void showStartupDialogs() {
    maybeShowAutostartSettingsOnce(this::maybeRequestBatteryOptimizationDisable);
  }

  private void maybeShowAutostartSettingsOnce(Runnable onComplete) {
    SharedPreferences prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    boolean alreadyShown = prefs.getBoolean(KEY_AUTOSTART_SHOWN, false);

    List<String> allowedManufacturers = Arrays.asList(
      "xiaomi", "oppo", "vivo", "letv", "asus", "huawei", "honor", "oneplus"
    );
    String manufacturer = Build.MANUFACTURER.toLowerCase();

    if (!allowedManufacturers.contains(manufacturer) || alreadyShown) {
      onComplete.run();
      return;
    }

    new AlertDialog.Builder(this)
      .setTitle("Enable Auto Start")
      .setMessage("Untuk memastikan azan dimainkan selepas phone reboot, sila aktifkan Auto-Start untuk Masjid A'la dalam setting telefon anda.")
      .setPositiveButton("Buka Setting", (dialog, which) -> {
        openAutoStartSettings(manufacturer);
        prefs.edit().putBoolean(KEY_AUTOSTART_SHOWN, true).apply();
        onComplete.run();
      })
      .setNegativeButton("Abaikan", (dialog, which) -> onComplete.run())
      .setCancelable(false)
      .show();
  }

  private void openAutoStartSettings(String manufacturer) {
    Intent intent = new Intent();
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

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
      startActivity(intent);
    } catch (Exception e) {
      Log.e(TAG, "Unable to open AutoStart settings: " + e.getMessage());
      startActivity(new Intent(Settings.ACTION_SETTINGS));
    }
  }

  private void maybeRequestBatteryOptimizationDisable() {
//    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
//    String packageName = getPackageName();
//
//    if (!pm.isIgnoringBatteryOptimizations(packageName)) {
//      new AlertDialog.Builder(this)
//        .setTitle("Disable Battery Optimization")
//        .setMessage("Untuk memastikan azan dan notifikasi tidak tertunda, sila matikan Battery Optimization untuk Masjid A'la dalam setting telefon anda.")
//        .setPositiveButton("Buka Setting", (dialog, which) -> {
//          try {
//            Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
//            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
//            startActivity(intent);
//          } catch (Exception e) {
//            Log.e(TAG, "Unable to open battery optimization settings: " + e.getMessage());
//            startActivity(new Intent(Settings.ACTION_SETTINGS));
//          }
//        })
//        .setNegativeButton("Abaikan", null)
//        .setCancelable(false)
//        .show();
//    }
  }
}
