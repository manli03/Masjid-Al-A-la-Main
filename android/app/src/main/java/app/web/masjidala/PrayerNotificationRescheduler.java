package app.web.masjidala;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Date;
import java.util.Locale;
import java.util.HashMap;
import java.util.Map;

public class PrayerNotificationRescheduler {
    private static final String TAG = "PrayerNotifRescheduler";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String PREF_KEY_NOTIF = "prayer_notifications";
    private static final String PREF_KEY_SCHEDULED = "scheduled_notifications"; // To track for cancellation

    // Call this method when you need to reschedule (e.g., on boot, daily check, time change)
    public static void rescheduleAll(Context context) {
        Log.d(TAG, "Attempting to reschedule all prayer notifications.");
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String notifJson = prefs.getString(PREF_KEY_NOTIF, null);

        if (notifJson == null) {
            Log.w(TAG, "No notification settings found. Skipping rescheduling.");
            return;
        }

        try {
            JSONObject notifSettings = new JSONObject(notifJson);
            JSONArray enabledPrayers = notifSettings.optJSONArray("enabledPrayers");
            int advanceMinutes = notifSettings.optInt("notificationAdvance", 0);
            String mainChannelId = "azan_playback_channel";

            if (enabledPrayers == null || enabledPrayers.length() == 0) {
                Log.w(TAG, "No enabled prayers found. Skipping rescheduling.");
                return;
            }

            // Always cancel all old alarms before scheduling new ones
            cancelAllScheduledAlarms(context);

            JSONArray scheduledNotifications = new JSONArray(); // To track what we've scheduled
            int scheduledCount = 0;

            for (int i = 0; i < enabledPrayers.length(); i++) {
                String prayerName = enabledPrayers.getString(i);

                // **CRITICAL CHANGE**: Use NextPrayerTimeCalculator to get the *absolute* next trigger time.
                long nextTriggerMillis = NextPrayerTimeCalculator.getNextTriggerTime(context, prayerName, advanceMinutes);

                if (nextTriggerMillis > System.currentTimeMillis()) { // Only schedule if in the future
                    Log.d(TAG, "Scheduling prayer: " + prayerName + " at " + new Date(nextTriggerMillis) + " with channelId: " + mainChannelId);

                    // Use a unique request code for each prayer type (e.g., hash of prayer name)
                    // This is still important for targeted cancellation/update.
                    int requestCode = prayerName.hashCode();
                    schedulePrayerAlarm(context, nextTriggerMillis, requestCode, prayerName, mainChannelId, advanceMinutes);

                    // Track the scheduled notification for future cancellation/reference
                    JSONObject notification = new JSONObject();
                    notification.put("requestCode", requestCode);
                    notification.put("prayerName", prayerName);
                    notification.put("time", nextTriggerMillis);
                    notification.put("channelId", mainChannelId);
                    notification.put("advanceMinutes", advanceMinutes);
                    scheduledNotifications.put(notification);
                    scheduledCount++;
                } else {
                    Log.d(TAG, "Prayer time for " + prayerName + " is in the past or not found. Skipping scheduling for now.");
                    // This means for a particular prayer, its calculated next trigger time has already passed
                    // at the moment rescheduleAll is executing.
                    // This could happen if the 12 AM sync was very late (e.g., past Subuh time).
                    // We don't schedule it and rely on the next daily check for its next instance.
                }
            }

            // Save the current set of scheduled notifications
            prefs.edit().putString(PREF_KEY_SCHEDULED, scheduledNotifications.toString()).apply();
            Log.i(TAG, "Rescheduled " + scheduledCount + " prayer notifications for the upcoming period.");

        } catch (JSONException e) {
            Log.e(TAG, "JSON parse error during rescheduling: ", e);
        }
    }

    // This method handles cancelling previous alarms based on saved request codes.
    public static void cancelAllScheduledAlarms(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String scheduledJson = prefs.getString(PREF_KEY_SCHEDULED, null);

        if (scheduledJson == null || scheduledJson.isEmpty()) {
            Log.d(TAG, "No previously scheduled notifications found to cancel.");
            return;
        }

        try {
            JSONArray scheduledNotifications = new JSONArray(scheduledJson);
            int cancelCount = 0;

            for (int i = 0; i < scheduledNotifications.length(); i++) {
                JSONObject notification = scheduledNotifications.getJSONObject(i);
                int requestCode = notification.getInt("requestCode");
                // The Intent must match the one used to set the alarm
                Intent intent = new Intent(context, PrayerAlarmReceiver.class);
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                        context, requestCode, intent,
                        PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
                );
                if (pendingIntent != null && alarmManager != null) {
                    alarmManager.cancel(pendingIntent);
                    pendingIntent.cancel(); // Explicitly cancel the PendingIntent
                    cancelCount++;
                }
            }

            // Clear the tracking list after cancellation
            prefs.edit().remove(PREF_KEY_SCHEDULED).apply();
            Log.d(TAG, "Cancelled " + cancelCount + " previous notifications.");
        } catch (JSONException e) {
            Log.e(TAG, "Error cancelling alarms: ", e);
        }
    }

    // Helper method to map prayer display names to JSON keys.
    // This is public static now, as NextPrayerTimeCalculator needs to call it.
    public static String findPrayerTime(JSONObject day, String prayerName) {
        Map<String, String> mapping = new HashMap<>();
        mapping.put("Imsak", "imsak");
        mapping.put("Subuh", "fajr");
        mapping.put("Syuruk", "syuruk");
        mapping.put("Dhuha", "dhuha");
        mapping.put("Zuhur", "dhuhr");
        mapping.put("Asar", "asr");
        mapping.put("Maghrib", "maghrib");
        mapping.put("Isyak", "isha");

        return day.optString(mapping.getOrDefault(prayerName, prayerName.toLowerCase(Locale.ROOT)), null);
    }

    // Helper method to convert date and time strings to milliseconds.
    // This is public static now, as NextPrayerTimeCalculator needs to call it.
    public static long convertToMillis(String dateStr, String timeStr) {
        long millis = NotificationUtils.parsePrayerApiDateTimeMillis(dateStr, timeStr);
        if (millis == 0) {
            Log.e(TAG, "Date parse error for " + dateStr + " " + timeStr);
        }
        return millis;
    }

    // This method sets the actual alarm using AlarmManager with setAlarmClock
    public static void schedulePrayerAlarm(Context context, long triggerAtMillis, int requestCode, String prayerName, String channelId, int advanceMinutes) {
        Log.d(TAG, "Scheduling alarm for " + prayerName + " at " + new Date(triggerAtMillis) + " (RequestCode: " + requestCode + ")");

        // Create the main alarm intent that will trigger the notification
        Intent intent = new Intent(context, PrayerAlarmReceiver.class);
        intent.putExtra("channel_id", channelId);
        intent.putExtra("title", "Waktu " + prayerName);
        intent.putExtra("prayer_name", prayerName);
        intent.putExtra("advance_minutes", advanceMinutes);
        intent.putExtra("capacitor_request_code", requestCode);
        intent.putExtra("message", "Sekarang waktu " + prayerName);

        // Create the main pending intent for the alarm
        PendingIntent alarmPendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Create a "show alarm" intent that will be triggered when user taps the alarm clock icon
        Intent showIntent = new Intent(context, MainActivity.class); // Opens the main app
        showIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent showPendingIntent = PendingIntent.getActivity(
                context,
                requestCode,
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            // Use setAlarmClock which is ideal for prayer times as it:
            // 1. Shows a system UI indicator that an alarm is set
            // 2. Guarantees delivery even in Doze mode
            // 3. Is more appropriate for time-critical notifications
            AlarmManager.AlarmClockInfo alarmClockInfo = new AlarmManager.AlarmClockInfo(triggerAtMillis, showPendingIntent);
            alarmManager.setAlarmClock(alarmClockInfo, alarmPendingIntent);

            Log.d(TAG, "Successfully scheduled AlarmClock for " + prayerName + " using setAlarmClock");
        } else {
            Log.e(TAG, "Failed to schedule alarm for " + prayerName + " - AlarmManager was null");
        }
    }
}
