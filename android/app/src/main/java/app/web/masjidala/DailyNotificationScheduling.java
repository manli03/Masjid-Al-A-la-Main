package app.web.masjidala;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import java.util.Calendar;

/**
 * Helper class for managing prayer notifications
 */
public class DailyNotificationScheduling {
    private static final String TAG = "DailyNotificationScheduling";
    private static final String PREFERENCES_NAME = "prayer_notification_helper";
    private static final String KEY_LAST_CHECK = "last_notification_check";
    private static final String NOTIFICATION_CHECK_ACTION = "app.web.masjidala.CHECK_NOTIFICATIONS";

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
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                Log.w(TAG, "Exact alarms permission NOT granted. Daily check might be delayed by the OS.");
              // We will proceed with setAndAllowWhileIdle, but warn the developer.
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Log.d(TAG, "Exact alarms permission IS granted. Daily check should be punctual.");
            }

            // Create intent for notification check
            Intent intent = new Intent(context, NotificationCheckReceiver.class);
            intent.setAction(NOTIFICATION_CHECK_ACTION);

            // Create pending intent
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    0, // Using 0 as request code for this single daily check
                    intent,
              PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // 🔥 Cancel any existing alarm
            alarmManager.cancel(pendingIntent);

            // Schedule for 00:00 AM
            Calendar calendar = Calendar.getInstance();
            calendar.set(Calendar.HOUR_OF_DAY, 0); // Midnight
            calendar.set(Calendar.MINUTE, 0);      // 0 minutes
            calendar.set(Calendar.SECOND, 0);      // 0 seconds
            calendar.set(Calendar.MILLISECOND, 0); // Precise midnight

            // If time has already passed today, set for tomorrow
            if (calendar.getTimeInMillis() < System.currentTimeMillis()) {
                calendar.add(Calendar.DAY_OF_YEAR, 1);
            }

            Log.d(TAG, "Setting daily check alarm for " + calendar.getTime().toString());

            // Use setExactIfPossible logic, but without attempting to request permission here
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
              alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calendar.getTimeInMillis(), pendingIntent);
            } else {
              alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calendar.getTimeInMillis(), pendingIntent);
            }

            // Save the scheduled time
            SharedPreferences preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
            preferences.edit().putLong(KEY_LAST_CHECK, calendar.getTimeInMillis()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Error scheduling daily check: " + e.getMessage());
        }
    }
}
