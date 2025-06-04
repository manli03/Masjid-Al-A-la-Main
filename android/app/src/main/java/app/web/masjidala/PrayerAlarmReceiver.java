package app.web.masjidala;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

public class PrayerAlarmReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    // Acquire a partial wake lock to ensure CPU stays on
    PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
    PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
      PowerManager.PARTIAL_WAKE_LOCK,
      "MasjidAla::PrayerAlarmWakeLock"
    );
    wakeLock.acquire(30 * 1000L); // 30 seconds max, enough to post notification

    try {
      String channelId = intent.getStringExtra("channel_id");
      String title = intent.getStringExtra("title");
      String message = intent.getStringExtra("message");

      Intent launchIntent = new Intent(context, MainActivity.class);
      launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      launchIntent.putExtra("deep_link", "/tabs/prayerTimes");  // Use this route in Ionic

      PendingIntent contentIntent = PendingIntent.getActivity(
        context,
        0,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
      );

      NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle(title)
        .setContentText(message)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setAutoCancel(true)
        .setContentIntent(contentIntent);

      NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
      int notificationId = (int) System.currentTimeMillis();
      notificationManager.notify(notificationId, builder.build());
    } finally {
      wakeLock.release(); // Always release to avoid battery drain
    }
  }
}
