package app.web.masjidala;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONException;
import org.json.JSONObject;

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
      String prayerName = intent.getStringExtra("prayer_name");
      int advanceMinutes = intent.getIntExtra("advance_minutes", 0);

      // Check user's sound preference
      String selectedAzanSound = getSelectedAzanSound(context);
      boolean hasSoundEnabled = selectedAzanSound != null && !"none".equals(selectedAzanSound);

      if (hasSoundEnabled && prayerName != null) {
        // Start AzanPlaybackService for continuous sound playback
        Intent serviceIntent = new Intent(context, AzanPlaybackService.class);
        serviceIntent.setAction(AzanPlaybackService.ACTION_START_AZAN);
        serviceIntent.putExtra(AzanPlaybackService.EXTRA_PRAYER_NAME, prayerName);
        serviceIntent.putExtra(AzanPlaybackService.EXTRA_SOUND_NAME, selectedAzanSound);
        serviceIntent.putExtra(AzanPlaybackService.EXTRA_ADVANCE_MINUTES, advanceMinutes);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(serviceIntent);
        }
      } else {
        // Create regular notification without sound service
        createRegularNotification(context, channelId, title, message, prayerName);
      }

    } finally {
      wakeLock.release(); // Always release to avoid battery drain
    }
  }

  private String getSelectedAzanSound(Context context) {
    try {
      SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
      String notifJson = prefs.getString("prayer_notifications", null);

      if (notifJson != null) {
        JSONObject notifSettings = new JSONObject(notifJson);
        return notifSettings.optString("selectedAzanSound", "none");
      }
    } catch (JSONException e) {
      android.util.Log.e("PrayerAlarmReceiver", "Error reading sound preference", e);
    }

    return "none";
  }

  private void createRegularNotification(Context context, String channelId, String title, String message, String prayerName) {
    // Get formatted prayer time and location using NotificationUtils
    String prayerTime = NotificationUtils.getCurrentPrayerTime(context, prayerName);
    String location = NotificationUtils.getLocationName(context);

    // Create formatted message using NotificationUtils
    String[] formattedMessage = NotificationUtils.formatNotificationMessage(prayerName, prayerTime, location);
    String formattedTitle = formattedMessage[0];
    String formattedMessageText = formattedMessage[1];

    Intent launchIntent = new Intent(context, MainActivity.class);
    launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    launchIntent.putExtra("deep_link", "/tabs/prayerTimes");

    PendingIntent contentIntent = PendingIntent.getActivity(
      context,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );

    NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
      .setSmallIcon(R.drawable.ic_stat_prayertimes_icon)
      .setColor(ContextCompat.getColor(context, R.color.notification_color))
      .setContentTitle(formattedTitle)
      .setContentText(formattedMessageText)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(formattedMessageText))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(contentIntent);

    NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    int notificationId = (int) System.currentTimeMillis();
    notificationManager.notify(notificationId, builder.build());
  }


}
