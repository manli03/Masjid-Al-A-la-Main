package app.web.masjidala;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
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

            // 🔥 Cancel any existing alarm
            alarmManager.cancel(pendingIntent);

            // Schedule for 00:00 AM
            Calendar calendar = Calendar.getInstance();
            calendar.set(Calendar.HOUR_OF_DAY, 0); // Midnight
            calendar.set(Calendar.MINUTE, 0);      // 0 minutes
            calendar.set(Calendar.SECOND, 0);      // 0 seconds

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
}
