package app.web.masjidala;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class TimeChangeReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    String action = intent.getAction();
    if (Intent.ACTION_TIME_CHANGED.equals(action) || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
      Log.d("TimeChangeReceiver", "Time/Timezone changed, triggering full rescheduling.");

      // Full reschedule on time/timezone changes
      PrayerNotificationRescheduler.rescheduleAll(context);
      DailyNotificationScheduling.scheduleDailyCheck(context); // Also reset the daily 12 AM check

      Log.d("TimeChangeReceiver", "All notifications and daily check rescheduled.");
    }
  }
}
