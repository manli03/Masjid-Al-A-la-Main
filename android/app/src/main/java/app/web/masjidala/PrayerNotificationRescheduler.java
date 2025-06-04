package app.web.masjidala;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public class PrayerNotificationRescheduler {
  private static final String TAG = "PrayerNotifRescheduler";
  private static final String PREFS_NAME = "CapacitorStorage";
  private static final String PREF_KEY_NOTIF = "prayer_notifications";
  private static final String PREF_KEY_SCHEDULED = "scheduled_notifications"; // To track for cancellation
  private static final String DEFAULT_PRAYER_CHANNEL_ID = "default_prayer_channel";

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
      String mainChannelId = notifSettings.optString("currentChannelId", null);

      if (mainChannelId == null || mainChannelId.isEmpty()) {
        Log.w(TAG, "No currentChannelId found in preferences. Prayer notifications will not be scheduled.");
        return;
      }
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
          String usedChannelId = mainChannelId;
          // Use default channel for Imsak, Syuruk, Dhuha as per your existing logic
          if ("Imsak".equals(prayerName) || "Syuruk".equals(prayerName) || "Dhuha".equals(prayerName)) {
            usedChannelId = DEFAULT_PRAYER_CHANNEL_ID;
          }

          // Use a unique request code for each prayer type (e.g., hash of prayer name)
          // This is still important for targeted cancellation/update.
          int requestCode = prayerName.hashCode();
          schedulePrayerAlarm(context, nextTriggerMillis, requestCode, prayerName, usedChannelId, advanceMinutes);

          // Track the scheduled notification for future cancellation/reference
          JSONObject notification = new JSONObject();
          notification.put("requestCode", requestCode);
          notification.put("prayerName", prayerName);
          notification.put("time", nextTriggerMillis);
          notification.put("channelId", usedChannelId);
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
  private static void cancelAllScheduledAlarms(Context context) {
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
    try {
      // Your JSON prayer times currently store "HH:mm:ss" like format.
      // If it's just HH:mm, change the SimpleDateFormat to "dd-MMM-yyyy HH:mm".
      SimpleDateFormat sdf = new SimpleDateFormat("dd-MMM-yyyy HH:mm:ss", Locale.getDefault());
      Date date = sdf.parse(dateStr + " " + timeStr);
      return date != null ? date.getTime() : 0;
    } catch (ParseException e) {
      Log.e(TAG, "Date parse error for " + dateStr + " " + timeStr + ": " + e.getMessage());
      return 0;
    }
  }

  // This method sets the actual alarm using AlarmManager.
  public static void schedulePrayerAlarm(Context context, long triggerAtMillis, int requestCode, String prayerName, String channelId, int advanceMinutes) {
    Log.d(TAG, "Scheduling alarm for " + prayerName + " at " + new Date(triggerAtMillis).toString() + " (RequestCode: " + requestCode + ")");
    Intent intent = new Intent(context, PrayerAlarmReceiver.class);
    intent.putExtra("channel_id", channelId);
    intent.putExtra("title", "Waktu " + prayerName);
    // Pass necessary info for the notification to be built correctly
    intent.putExtra("prayer_name", prayerName);
    intent.putExtra("advance_minutes", advanceMinutes);
    intent.putExtra("capacitor_request_code", requestCode); // Store request code if needed by receiver

    if ("Imsak".equals(prayerName) || "Syuruk".equals(prayerName) || "Dhuha".equals(prayerName)) {
      intent.putExtra("message", "Sekarang waktu " + prayerName);
    } else {
      intent.putExtra("message", "Sekarang waktu untuk solat " + prayerName);
    }

    PendingIntent pendingIntent = PendingIntent.getBroadcast(
      context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

    // This section uses the exact/allowWhileIdle logic from Capacitor for reliability.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      if (!alarmManager.canScheduleExactAlarms()) {
        Log.w(TAG, "Exact alarms not allowed in user settings. Scheduling " + prayerName + " with non-exact alarm.");
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
      } else {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
      }
    } else {
      // On older APIs, setExactAndAllowWhileIdle is generally preferred for reliability in Doze
      alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
    }
  }

  // This method was probably for external calls, keeping it as is.
  static void callCancelMethod(Context context) {
    cancelAllScheduledAlarms(context);
  }
}
