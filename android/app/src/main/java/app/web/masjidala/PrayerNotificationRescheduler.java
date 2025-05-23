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
import java.util.Objects;
import java.util.TimeZone;

public class PrayerNotificationRescheduler {
    private static final String TAG = "PrayerNotifRescheduler";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String PREF_KEY_NOTIF = "prayer_notifications";
    private static final String PREF_KEY_TIMES = "yearlyPrayerTimes";

    // Call this method when you need to reschedule
    public static void rescheduleAll(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String notifJson = prefs.getString(PREF_KEY_NOTIF, null);
        String timesJson = prefs.getString(PREF_KEY_TIMES, null);
        final String DEFAULT_PRAYER_CHANNEL_ID = "default_prayer_channel";

        if (notifJson == null || timesJson == null) {
            Log.w(TAG, "No notification or prayer times preferences found.");
            return;
        }

        try {
            JSONObject notifSettings = new JSONObject(notifJson);
            JSONArray enabledPrayers = notifSettings.optJSONArray("enabledPrayers");
            int advanceMinutes = notifSettings.optInt("notificationAdvance", 0);
            String channelId = notifSettings.optString("currentChannelId", null);
            if (channelId == null || channelId.isEmpty()) {
                Log.w(TAG, "No currentChannelId found in preferences. Prayer notifications will not be scheduled.");
                return;
            }

            JSONObject yearlyPrayerTimes = new JSONObject(timesJson);
            JSONArray prayers = yearlyPrayerTimes.getJSONArray("prayers");

            // Cancel all existing notifications before scheduling new ones
            cancelAllScheduledAlarms(context);

            // Channel is assumed to already exist; do not recreate it.

            long now = System.currentTimeMillis();
            int requestCodeBase = 1000; // Arbitrary base for unique PendingIntent
            int scheduledCount = 0;

            for (int i = 0; i < Objects.requireNonNull(enabledPrayers).length(); i++) {
                String prayerName = enabledPrayers.getString(i);
                for (int j = 0; j < prayers.length(); j++) {
                    JSONObject day = prayers.getJSONObject(j);
                    String dateStr = day.optString("date", null); // e.g. 01-Jan-2025
                    String timeStr = findPrayerTime(day, prayerName);
                    long prayerTimeMillis = convertToMillis(dateStr, timeStr);
                    prayerTimeMillis -= (long) advanceMinutes * 60 * 1000;
                    if (prayerTimeMillis > now) {
                        // Use default channel for Imsak, Syuruk, Dhuha
                        String usedChannelId = channelId;
                        if ("Imsak".equals(prayerName) || "Syuruk".equals(prayerName) || "Dhuha".equals(prayerName)) {
                            usedChannelId = DEFAULT_PRAYER_CHANNEL_ID;
                        }
                        schedulePrayerAlarm(context, prayerTimeMillis, requestCodeBase + scheduledCount, prayerName, usedChannelId);
                        scheduledCount++;
                        break; // Only schedule the next one for this prayer
                    }
                }
            }

            // Update lastScheduled timestamp
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
            String isoTimestamp = sdf.format(new Date());

            // Save the timestamp
            notifSettings.put("lastScheduled", isoTimestamp);

            prefs.edit()
            .putString(PREF_KEY_NOTIF, notifSettings.toString())
            .apply();

            Log.i(TAG, "Rescheduled " + scheduledCount + " prayer notifications.");
        } catch (JSONException e) {
            Log.e(TAG, "JSON parse error: ", e);
        }
    }

    // Cancel all previously scheduled alarms/notifications
    private static void cancelAllScheduledAlarms(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String notifJson = prefs.getString(PREF_KEY_NOTIF, null);
        if (notifJson == null) return;
        try {
            JSONObject notifSettings = new JSONObject(notifJson);
            JSONArray enabledPrayers = notifSettings.optJSONArray("enabledPrayers");
            if (enabledPrayers == null) return;
            int requestCodeBase = 1000;
            for (int i = 0; i < enabledPrayers.length(); i++) {
                for (int k = 0; k < 10; k++) { // Cancel up to 10 future alarms per prayer
                    int requestCode = requestCodeBase + i + k;
                    PendingIntent pendingIntent = PendingIntent.getBroadcast(
                        context, requestCode, new Intent(context, PrayerAlarmReceiver.class),
                        PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
                    );
                    if (pendingIntent != null && alarmManager != null) {
                        alarmManager.cancel(pendingIntent);
                    }
                }
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error cancelling alarms: ", e);
        }
    }


    private static String findPrayerTime(JSONObject day, String prayerName) {
        // Map display names to JSON keys
        java.util.Map<String, String> mapping = new java.util.HashMap<>();
        mapping.put("Imsak", "imsak");
        mapping.put("Subuh", "fajr");
        mapping.put("Syuruk", "syuruk");
        mapping.put("Dhuha", "dhuha");
        mapping.put("Zuhur", "dhuhr");
        mapping.put("Asar", "asr");
        mapping.put("Maghrib", "maghrib");
        mapping.put("Isyak", "isha");

      String jsonKey = null;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        jsonKey = mapping.getOrDefault(prayerName, prayerName.toLowerCase(Locale.ROOT));
      }
      return day.optString(jsonKey, null);
    }

    private static long convertToMillis(String dateStr, String timeStr) {
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("dd-MMM-yyyy HH:mm:ss", Locale.getDefault());
            Date date = sdf.parse(dateStr + " " + timeStr);
            return date != null ? date.getTime() : 0;
        } catch (ParseException e) {
            Log.e(TAG, "Date parse error: ", e);
            return 0;
        }
    }

    private static void schedulePrayerAlarm(Context context, long triggerAtMillis, int requestCode, String prayerName, String channelId) {
        Intent intent = new Intent(context, PrayerAlarmReceiver.class);
        intent.putExtra("channel_id", channelId);
        intent.putExtra("title", "Waktu " + prayerName);
        // Use the same message logic as the service
        if ("Imsak".equals(prayerName) || "Syuruk".equals(prayerName) || "Dhuha".equals(prayerName)) {
            intent.putExtra("message", "Sekarang waktu " + prayerName);
        } else {
            intent.putExtra("message", "Sekarang waktu untuk solat " + prayerName);
        }
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
    }

    static void callCancelMethod(Context context) {
      cancelAllScheduledAlarms(context);
    }
}
