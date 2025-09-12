package app.web.masjidala;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import android.util.Log;

/**
 * BroadcastReceiver to handle daily notification rescheduling (triggered by DailyNotificationScheduling)
 */
public class NotificationCheckReceiver extends BroadcastReceiver {
  private static final String TAG = "NotificationCheckReceiver";

  @Override
  public void onReceive(Context context, Intent intent) {
    Log.d(TAG, "Received notification check alarm. Acquiring WakeLock...");

    // **CRUCIAL: Acquire a WakeLock to keep the CPU running**
    PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
    PowerManager.WakeLock wakeLock = null;
    if (powerManager != null) {
      wakeLock = powerManager.newWakeLock(
        PowerManager.PARTIAL_WAKE_LOCK,
        "MasjidAla::DailyRescheduleWakeLock"
      );
      // Acquire the lock for up to 3 minutes, which is more than enough time.
      // This prevents the device from sleeping while we reschedule.
      wakeLock.acquire(3 * 60 * 1000L);
    }

    try {
      // Reschedule all individual prayer notifications for the upcoming period
      Log.d(TAG, "WakeLock acquired. Checking and rescheduling individual prayer notifications.");
      PrayerNotificationRescheduler.rescheduleAll(context);
      Log.d(TAG, "Prayer notifications rescheduled.");

      // 🔥 Reschedule the daily alarm for tomorrow (since setAlarmClock is one-time)
      DailyNotificationScheduling.scheduleDailyCheck(context);
      Log.d(TAG, "Daily alarm rescheduled for tomorrow.");

    } catch (Exception e) {
      Log.e(TAG, "Error in onReceive for NotificationCheckReceiver: " + e.getMessage());
    } finally {
      // **CRUCIAL: Always release the WakeLock in a finally block**
      if (wakeLock != null && wakeLock.isHeld()) {
        wakeLock.release();
        Log.d(TAG, "WakeLock released.");
      }
    }
  }
}
