package app.web.masjidala;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class NextPrayerTimeCalculator {
  private static final String TAG = "NextPrayerTimeCalc";
  private static final String PREFS_NAME = "CapacitorStorage"; // Your existing storage name
  private static final String PREF_KEY_TIMES = "yearlyPrayerTimes";

  /**
   * Calculates the next exact trigger time for a given prayer name relative to the current moment.
   * It looks for today's time if it hasn't passed, otherwise tomorrow's.
   *
   * @param context   The application context.
   * @param prayerName The name of the prayer (e.g., "Subuh", "Zuhur").
   * @param advanceMinutes The number of minutes to advance the notification.
   * @return The timestamp in milliseconds for the next prayer notification, or 0 if not found.
   */
  public static long getNextTriggerTime(Context context, String prayerName, int advanceMinutes) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    String timesJson = prefs.getString(PREF_KEY_TIMES, null);

    if (timesJson == null) {
      Log.e(TAG, "Yearly prayer times data not found in SharedPreferences.");
      return 0;
    }

    try {
      JSONObject yearlyPrayerTimes = new JSONObject(timesJson);
      JSONArray prayers = yearlyPrayerTimes.getJSONArray("prayers");

      Calendar now = Calendar.getInstance();
      now.set(Calendar.SECOND, 0);
      now.set(Calendar.MILLISECOND, 0);
      long currentTimeMillis = now.getTimeInMillis(); // Current actual system time

      // 1. Try to find today's prayer time
      long todayPrayerTimeMillis = getPrayerTimeForSpecificDay(now.getTime(), prayerName, prayers);
      if (todayPrayerTimeMillis != 0) {
        todayPrayerTimeMillis -= (long) advanceMinutes * 60 * 1000;

        // If today's adjusted prayer time is in the future, return it
        if (todayPrayerTimeMillis > currentTimeMillis) {
          return todayPrayerTimeMillis;
        }
      }

      // 2. If today's time has passed or was not found, try tomorrow's
      Calendar tomorrow = (Calendar) now.clone();
      tomorrow.add(Calendar.DAY_OF_YEAR, 1);
      long tomorrowPrayerTimeMillis = getPrayerTimeForSpecificDay(tomorrow.getTime(), prayerName, prayers);
      if (tomorrowPrayerTimeMillis != 0) {
        tomorrowPrayerTimeMillis -= (long) advanceMinutes * 60 * 1000;
        return tomorrowPrayerTimeMillis;
      }

      Log.w(TAG, "No future prayer time found for " + prayerName + " from current day onward.");
      return 0;

    } catch (JSONException e) {
      Log.e(TAG, "Error parsing prayer times JSON: " + e.getMessage());
      return 0;
    }
  }

  /**
   * Finds the prayer time for a specific prayer on a given exact calendar date.
   *
   * @param targetDate The exact calendar date to search for (e.g., "01-Jan-2025").
   * @param prayerName The name of the prayer.
   * @param prayersJsonArray The JSON array containing prayer times.
   * @return The timestamp in milliseconds for the prayer on the target date, or 0 if not found.
   */
  private static long getPrayerTimeForSpecificDay(Date targetDate, String prayerName, JSONArray prayersJsonArray) {
    SimpleDateFormat sdfDateMatcher = new SimpleDateFormat("dd-MMM-yyyy", Locale.ENGLISH);
    String targetDateString = sdfDateMatcher.format(targetDate);

    try {
      for (int i = 0; i < prayersJsonArray.length(); i++) {
        JSONObject dayData = prayersJsonArray.getJSONObject(i);
        String dateFromJson = dayData.optString("date", null);
        Log.d(TAG, "Checking date: " + dateFromJson + " against target: " + targetDateString);

        if (targetDateString.equals(dateFromJson)) {
          // Use helper from PrayerNotificationRescheduler for consistency in finding and converting time
          String timeStr = PrayerNotificationRescheduler.findPrayerTime(dayData, prayerName);
          if (timeStr != null && !timeStr.isEmpty()) {
            return PrayerNotificationRescheduler.convertToMillis(dateFromJson, timeStr);
          }
          break; // Found the date, but no time for this specific prayer
        }
      }
    } catch (JSONException e) {
      Log.e(TAG, "Error reading prayer times from JSON array: " + e.getMessage());
    }
    return 0;
  }
}
