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
      // TODO: Reschedule next prayer time alarm here
      Log.d("TimeChangeReceiver", "Time/Timezone changed, rescheduling prayer notification...");

      // Call alarm scheduling
      PrayerNotificationRescheduler.rescheduleAll(context);
      Log.d("TimeChangeReceiver", "Prayer notification rescheduled");
    }
  }
}
