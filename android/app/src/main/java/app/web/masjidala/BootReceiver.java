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
            if (intent.getAction() != null && intent.getAction().equals(Intent.ACTION_BOOT_COMPLETED)) {
                Log.d(TAG, "Device booted, rescheduling prayer notifications");

                // Reschedule notifications using helper
                PrayerNotificationHelper.rescheduleNotifications(context);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in boot receiver: " + e.getMessage());
        }
    }
}
