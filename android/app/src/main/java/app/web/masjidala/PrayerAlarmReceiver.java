package app.web.masjidala;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;

public class PrayerAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String channelId = intent.getStringExtra("channel_id");
        String title = intent.getStringExtra("title");
        String message = intent.getStringExtra("message");
        String sound = intent.getStringExtra("sound");

        // Build notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.mipmap.ic_launcher) // Ensure this resource exists
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);

        // Set custom sound if provided
        if (sound != null && !sound.equals("default")) {
            // You may need to map 'sound' to a URI in your res/raw folder
            int soundResId = context.getResources().getIdentifier(sound, "raw", context.getPackageName());
            if (soundResId != 0) {
                Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + soundResId);
                builder.setSound(soundUri);
            } else {
                builder.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
            }
        } else {
            builder.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
        }

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, builder.build());
    }
}
