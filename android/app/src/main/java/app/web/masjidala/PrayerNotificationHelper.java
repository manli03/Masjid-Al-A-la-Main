package app.web.masjidala;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Calendar;

/**
 * Helper class for managing prayer notifications
 */
public class PrayerNotificationHelper {
    private static final String TAG = "PrayerNotificationHelper";
    private static final String PREFERENCES_NAME = "prayer_notification_helper";
    private static final String KEY_LAST_CHECK = "last_notification_check";
    private static final String NOTIFICATION_CHECK_ACTION = "app.web.masjidala.CHECK_NOTIFICATIONS";

    // Interval to check for notifications (24 hours in milliseconds)
    private static final long CHECK_INTERVAL = 24 * 60 * 60 * 1000;

    /**
     * Schedule a daily check for prayer notifications
     */
    public static void scheduleDailyCheck(Context context) {
        Log.d(TAG, "Scheduling daily notification check");

        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                Log.e(TAG, "Failed to get AlarmManager");
                return;
            }

            // Check if the app can schedule exact alarms
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!alarmManager.canScheduleExactAlarms()) {
                    // Permission is not granted, request it
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    return; // Exit if permission is not granted
                } else {
                    Log.d(TAG, "Exact alarms permission is granted");
                }
            }

            // Create intent for notification check
            Intent intent = new Intent(context, NotificationCheckReceiver.class);
            intent.setAction(NOTIFICATION_CHECK_ACTION);

            // Create pending intent
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    0,
                    intent,
              PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // Set repeating alarm
            Calendar calendar = Calendar.getInstance();
            calendar.set(Calendar.HOUR_OF_DAY, 0); // Midnight
            calendar.set(Calendar.MINUTE, 5);      // 5 minutes after midnight
            calendar.set(Calendar.SECOND, 0);

            // If time has already passed today, set for tomorrow
            if (calendar.getTimeInMillis() < System.currentTimeMillis()) {
                calendar.add(Calendar.DAY_OF_YEAR, 1);
            }

            Log.d(TAG, "Setting alarm for " + calendar.getTime().toString());

            // Use setExactAndAllowWhileIdle for newer Android versions
            alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    calendar.getTimeInMillis(),
                    pendingIntent
            );
            Log.d(TAG, "Set exact and allow while idle alarm");

            // Save the scheduled time
            SharedPreferences preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
            preferences.edit().putLong(KEY_LAST_CHECK, calendar.getTimeInMillis()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Error scheduling daily check: " + e.getMessage());
        }
    }

    /**
     * Reschedule notifications after device reboot
     */
    public static void rescheduleNotifications(Context context) {
        Log.d(TAG, "Rescheduling notifications after boot");

        try {
            // Schedule the daily check
            scheduleDailyCheck(context);

            // Execute JavaScript to trigger notification rescheduling
            executeJavaScript(context, "triggerNotificationReschedule");
        } catch (Exception e) {
            Log.e(TAG, "Error rescheduling notifications: " + e.getMessage());
        }
    }

    /**
     * Execute JavaScript in the WebView to trigger functions
     */
    private static void executeJavaScript(Context context, String functionName) {
        try {
            // Create an intent to start the MainActivity
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            launchIntent.putExtra("executeJs", "window.dispatchEvent(new CustomEvent('" + functionName + "'));");

            // Log what we're doing
            Log.d(TAG, "Executing JavaScript: " + functionName);

            // Start the app
            context.startActivity(launchIntent);
        } catch (Exception e) {
            Log.e(TAG, "Error executing JavaScript: " + e.getMessage());
        }
    }
}
