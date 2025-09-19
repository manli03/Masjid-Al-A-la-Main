package app.web.masjidala;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * BroadcastReceiver to handle device boot events and reschedule prayer notifications
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "ManBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
          if (intent.getAction() != null) {
            String action = intent.getAction();
            if (action.equals(Intent.ACTION_LOCKED_BOOT_COMPLETED)) {
              Log.d(TAG, "Device booted with action: " + action + ", rescheduling prayer notifications.");

              // Ensure the daily 12 AM check is scheduled first
              DailyNotificationScheduling.scheduleDailyCheck(context);

              // Reschedule all prayer notifications for the upcoming period
              PrayerNotificationRescheduler.rescheduleAll(context);
            }
          }
        } catch (Exception e) {
            Log.e(TAG, "Error in boot receiver: " + e.getMessage());
        }
    }
}
