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

        // Create an intent to open the app to prayer times page 
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage("app.web.masjidala");
        if (launchIntent != null) {
            // Add flags to create new task and clear top
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            // Add data to indicate we want to show prayer times
            launchIntent.putExtra("openPage", "prayerTimes");
        }

        // Create the pending intent
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
    }
}
