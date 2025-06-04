package app.web.masjidala;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * BroadcastReceiver to handle daily notification rescheduling (triggered by DailyNotificationScheduling)
 */
public class NotificationCheckReceiver extends BroadcastReceiver {
    private static final String TAG = "NotificationCheckReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Received notification check alarm");

        try {
          // First, reschedule the next 12 AM daily check to ensure continuity
          DailyNotificationScheduling.scheduleDailyCheck(context);

          // Now, reschedule all individual prayer notifications for the upcoming period
          Log.d(TAG, "Checking and rescheduling individual prayer notifications.");
          PrayerNotificationRescheduler.rescheduleAll(context);
        } catch (Exception e) {
            Log.e(TAG, "Error in onReceive: " + e.getMessage());
        }
    }
}
