package app.web.masjidala;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * BroadcastReceiver to handle daily notification rescheduling
 */
public class NotificationCheckReceiver extends BroadcastReceiver {
    private static final String TAG = "NotificationCheckReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Received notification check alarm");

        try {
            // Reschedule next day's check first
            DailyNotificationScheduling.scheduleDailyCheck(context);

          Log.d(TAG, "Checking and rescheduling notifications");
          PrayerNotificationRescheduler.rescheduleAll(context);
        } catch (Exception e) {
            Log.e(TAG, "Error in onReceive: " + e.getMessage());
        }
    }
}
