package app.web.masjidala;

import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final String PREF_NAME = "masjidala_prefs";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidAudio.class);
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

//    PreferenceLogger.logAllPreferences(this);

        // Handle deep link from app launch
        handleDeepLinkIntent(getIntent());
    }

    private void handleDeepLinkIntent(Intent intent) {
        if (intent != null && intent.hasExtra("deep_link")) {
            String deepLink = intent.getStringExtra("deep_link");
            Log.d(TAG, "Received deep link: " + deepLink);

            if (deepLink != null && !deepLink.isEmpty()) {
                // Wait for WebView to be ready, then inject JavaScript
                getBridge().getWebView().postDelayed(() -> {
                    String js = "setTimeout(function() { if (window.handleDeepLink) { window.handleDeepLink('" + deepLink + "'); } }, 500);";
                    getBridge().getWebView().evaluateJavascript(js, null);
                }, 500); // Reduced delay for better responsiveness
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent); // Update the current intent

        // Handle deep link from new intent (when app is already running)
        handleDeepLinkIntent(intent);
    }


    @Override
    public void onStart() {
        super.onStart();
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this::showStartupDialogs, 5000);
    }

    private void showStartupDialogs() {
        maybeRequestExactAlarmPermissionOnce();
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
