package app.web.masjidala;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class NotificationDismissedReceiver extends BroadcastReceiver {
    private static final String TAG = "NotificationDismissedReceiver";
    private static final String CHANNEL_ID = "azan_playback_channel";
    private static final int NOTIFICATION_ID = 1001;

    // Extras to match AzanPlaybackService
    public static final String EXTRA_PRAYER_NAME = "prayer_name";
    public static final String EXTRA_SOUND_NAME = "sound_name";
    public static final String EXTRA_ADVANCE_MINUTES = "advance_minutes";

    @Override
    public void onReceive(Context context, Intent intent) {
        android.util.Log.d(TAG, "Notification dismissed, re-posting...");

        // Check if the AzanPlaybackService is still running
        if (isServiceRunning(context, AzanPlaybackService.class)) {
            // Re-post the notification with original details
            createAndShowNotification(context, intent);
        }
    }

    private boolean isServiceRunning(Context context, Class<?> serviceClass) {
        android.app.ActivityManager manager = (android.app.ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (manager != null) {
            for (android.app.ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
                if (serviceClass.getName().equals(service.service.getClassName())) {
                    return true;
                }
            }
        }
        return false;
    }

    private void createAndShowNotification(Context context, Intent originalIntent) {
        // Get prayer details from the original intent
        String prayerName = originalIntent.getStringExtra(EXTRA_PRAYER_NAME);
        String soundName = originalIntent.getStringExtra(EXTRA_SOUND_NAME);
        int advanceMinutes = originalIntent.getIntExtra(EXTRA_ADVANCE_MINUTES, 0);

        // Create notification channel if needed
        createNotificationChannel(context);
        createSilentNotificationChannel(context); // For reappearing notifications

        // Create intent for stopping the azan
        Intent stopIntent = new Intent(context, AzanPlaybackService.class);
        stopIntent.setAction(AzanPlaybackService.ACTION_STOP_AZAN);
        PendingIntent stopPendingIntent = PendingIntent.getService(
                context, 0, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Create intent for opening the app
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launchIntent.putExtra("deep_link", "/tabs/prayerTimes");
        PendingIntent contentIntent = PendingIntent.getActivity(
                context, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Create delete intent to detect when notification is dismissed again
        Intent deleteIntent = new Intent(context, NotificationDismissedReceiver.class);
        if (prayerName != null) deleteIntent.putExtra(EXTRA_PRAYER_NAME, prayerName);
        if (soundName != null) deleteIntent.putExtra(EXTRA_SOUND_NAME, soundName);
        deleteIntent.putExtra(EXTRA_ADVANCE_MINUTES, advanceMinutes);
        PendingIntent deletePendingIntent = PendingIntent.getBroadcast(
                context, 0, deleteIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Build the notification with same title and message as original
        String title = "Waktu " + (prayerName != null ? prayerName : "Solat");
        String message = "Sekarang waktu " + prayerName;

        // Use silent channel for reappearing notifications (no sound since azan already played)
        String silentChannelId = CHANNEL_ID + "_silent";
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, silentChannelId)
                .setSmallIcon(R.drawable.ic_stat_prayertimes_icon)
                .setColor(ContextCompat.getColor(context, R.color.notification_color))
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true) // Make it persistent
                .setAutoCancel(false) // Don't auto-cancel when tapped
                .setContentIntent(contentIntent)
                .setDeleteIntent(deletePendingIntent) // Detect when dismissed
                .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                  .setShowActionsInCompactView(0) // Show first action in compact view
                  .setMediaSession(null)) // MediaStyle for better action visibility
                .addAction(R.drawable.ic_stop, "Hentikan Bunyi", stopPendingIntent);

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID, builder.build());
        }
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Azan Playback",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Controls for azan playback");
            channel.setSound(null, null); // No sound for this channel
            channel.setShowBadge(false); // Don't show badge

            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private void createSilentNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            String silentChannelId = CHANNEL_ID + "_silent";
            NotificationChannel channel = new NotificationChannel(
                    silentChannelId,
                    "Azan Playback (Silent)",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Silent reappearing notifications for azan playback");
            channel.setSound(null, null); // No sound - azan already played
            channel.setVibrationPattern(null); // No vibration
            channel.setShowBadge(false); // Don't show badge

            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }


}
