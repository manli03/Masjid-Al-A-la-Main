package app.web.masjidala;

import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

import java.util.Arrays;
import java.util.List;

public class MainActivity extends BridgeActivity {
  private static final String TAG = "MainActivity";
  private static final String PREF_NAME = "masjidala_prefs";
  private static final String KEY_AUTOSTART_SHOWN = "autostart_shown";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(AndroidAudio.class);
    super.onCreate(savedInstanceState);

    DailyNotificationScheduling.scheduleDailyCheck(this);
//    PreferenceLogger.logAllPreferences(this);

    // Handle deep link
    Intent intent = getIntent();
    if (intent != null && intent.hasExtra("deep_link")) {
      String deepLink = intent.getStringExtra("deep_link");
      Log.d(TAG, "Received deep link: " + deepLink);

      // Wait for WebView to be ready
      getBridge().getWebView().postDelayed(() -> {
        String js = "setTimeout(function() { if (window.handleDeepLink) { window.handleDeepLink('" + deepLink + "'); } }, 1000);";
        getBridge().getWebView().evaluateJavascript(js, null);
      }, 1000); // Delay 1s to wait for WebView to finish loading
    }
  }

  @Override
  public void onResume() {
    super.onResume();

    Intent intent = getIntent();
    if (intent != null && intent.hasExtra("deep_link")) {
      String route = intent.getStringExtra("deep_link");
      Log.d("DeepLink", "Received deepLink route: " + route);

      if (route != null) {
        // Inject JS into the WebView
        new Handler(Looper.getMainLooper()).post(() -> {
          String jsCode = "window.handleDeepLink && window.handleDeepLink('" + route + "');";
          getBridge().getWebView().evaluateJavascript(jsCode, null);
        });

        // Prevent repeating the action next time
        intent.removeExtra("openPage");
      }
    }
  }


  @Override
  public void onStart() {
    super.onStart();
    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this::showStartupDialogs, 5000);
  }

  private void showStartupDialogs() {
    maybeShowAutostartSettingsOnce();
    maybeRequestExactAlarmPermissionOnce();
  }

  private void maybeShowAutostartSettingsOnce() {
    SharedPreferences prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    boolean alreadyShown = prefs.getBoolean(KEY_AUTOSTART_SHOWN, false);

    List<String> allowedManufacturers = Arrays.asList(
      "xiaomi", "oppo", "vivo", "letv", "asus", "huawei", "honor", "oneplus",
      "itel", "tecno", "infinix"
    );
    String manufacturer = Build.MANUFACTURER.toLowerCase();

    if (!allowedManufacturers.contains(manufacturer) || alreadyShown) {
      maybeRequestBatteryOptimizationDisable();
      return;
    }

    new AlertDialog.Builder(this)
      .setTitle("Aktifkan Auto Start")
      .setMessage("Untuk memastikan azan dimainkan selepas phone reboot, sila aktifkan Auto-Start untuk Masjid A'la dalam setting telefon anda.")
      .setPositiveButton("Buka Setting", (dialog, which) -> {
        prefs.edit().putBoolean(KEY_AUTOSTART_SHOWN, true).apply();
        openAutoStartSettings(manufacturer);
      })
      .setNegativeButton("Abaikan", (dialog, which) -> maybeRequestBatteryOptimizationDisable())
      .setCancelable(false)
      .show();
  }

  private void openAutoStartSettings(String manufacturer) {
    Intent intent = new Intent();
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

    try {
      if (manufacturer.toLowerCase().contains("itel") ||
        manufacturer.toLowerCase().contains("tecno") ||
        manufacturer.toLowerCase().contains("infinix")) {

        intent.setComponent(new ComponentName("com.transsion.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity"));
        startActivity(intent);

      } else if (manufacturer.equalsIgnoreCase("xiaomi")) {
        intent.setComponent(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
        startActivity(intent);

      } else if (manufacturer.equalsIgnoreCase("oppo")) {
        intent.setComponent(new ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
        startActivity(intent);

      } else if (manufacturer.equalsIgnoreCase("vivo")) {
        intent.setComponent(new ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"));
        startActivity(intent);

      } else if (manufacturer.equalsIgnoreCase("letv")) {
        intent.setComponent(new ComponentName("com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"));
        startActivity(intent);

      } else if (manufacturer.equalsIgnoreCase("asus")) {
        intent.setComponent(new ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.entry.FunctionActivity"));
        startActivity(intent);

      } else if (manufacturer.equalsIgnoreCase("huawei")) {
        intent.setComponent(new ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
        startActivity(intent);

      } else if (manufacturer.equalsIgnoreCase("honor")) {
        intent.setComponent(new ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"));
        startActivity(intent);

      } else if (manufacturer.equalsIgnoreCase("oneplus")) {
        intent.setComponent(new ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"));
        startActivity(intent);

      } else {
        // Unknown manufacturer: open general settings as fallback
        startActivity(new Intent(Settings.ACTION_SETTINGS));
      }
    } catch (Exception e) {
      Log.e(TAG, "Unable to open AutoStart settings on manufacturer: " + manufacturer);

      Log.e(TAG, "Unable to open AutoStart settings: " + e.getMessage());
      startActivity(new Intent(Settings.ACTION_SETTINGS));
    }
  }

  private void maybeRequestBatteryOptimizationDisable() {
    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
    String packageName = getPackageName();

    if (!pm.isIgnoringBatteryOptimizations(packageName)) {
      Log.d(TAG, "App is NOT exempted. Prompting user...");
      new AlertDialog.Builder(this)
        .setTitle("Elakkan Notifikasi Azan Lewat")
        .setMessage("Sila benarkan aplikasi ini berjalan di latar belakang tanpa sekatan bateri. Ini penting untuk memastikan notifikasi azan dihantar tepat pada waktunya.")
        .setPositiveButton("Buka Setting", (dialog, which) -> {
          try {
            @SuppressLint("BatteryLife") Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
          } catch (Exception e) {
            Log.e(TAG, "Unable to open battery optimization settings: " + e.getMessage());
            startActivity(new Intent(Settings.ACTION_SETTINGS));
          }
        })
        .setNegativeButton("Abaikan", null)
        .setCancelable(false)
        .show();
    } else {
      Log.d(TAG, "App is already exempted from battery optimization");
    }
  }

  private void maybeRequestExactAlarmPermissionOnce() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { // For Android 12 (S) and above
      AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
      if (alarmManager == null) {
        Log.e(TAG, "AlarmManager service not available.");
        return;
      }

      SharedPreferences prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);

      if (!alarmManager.canScheduleExactAlarms()) {
        Log.d(TAG, "Exact alarm permission not granted. Prompting user.");
        new AlertDialog.Builder(this)
          .setTitle("Ketepatan Notifikasi Azan")
          .setMessage("Untuk memastikan notifikasi azan dihantar tepat pada waktunya, sila benarkan aplikasi ini untuk menjadualkan penggera yang tepat. Ini membantu notifikasi tidak lewat.")
          .setPositiveButton("Buka Setting", (dialog, which) -> {
            try {
              Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
              intent.setData(Uri.parse("package:" + getPackageName()));
              intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
              startActivity(intent);
            } catch (Exception e) {
              Log.e(TAG, "Unable to open exact alarm settings: " + e.getMessage());
              startActivity(new Intent(Settings.ACTION_SETTINGS)); // Fallback
            }
          })
          .setNegativeButton("Abaikan", (dialog, which) -> {
          })
          .setCancelable(false)
          .show();
      } else if (alarmManager.canScheduleExactAlarms()) {
        Log.d(TAG, "Exact alarm permission already granted.");
      } else {
        Log.d(TAG, "Exact alarm permission prompt already shown.");
      }
    } else {
      Log.d(TAG, "Exact alarm permission not applicable for this Android version (<S).");
    }
  }
}
