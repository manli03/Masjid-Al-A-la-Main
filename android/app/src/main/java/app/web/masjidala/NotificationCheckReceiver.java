package app.web.masjidala;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * BroadcastReceiver to handle periodic notification checks
 */
public class NotificationCheckReceiver extends BroadcastReceiver {
    private static final String TAG = "NotificationCheckReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Received notification check alarm");
        
        try {
            // Reschedule next day's check first
            PrayerNotificationHelper.scheduleDailyCheck(context);
            
            // Execute JavaScript to check and reschedule notifications
            executeJavaScript(context, "checkAndRescheduleNotifications");
        } catch (Exception e) {
            Log.e(TAG, "Error in onReceive: " + e.getMessage());
        }
    }
    
    /**
     * Execute JavaScript in the WebView to trigger functions
     */
    private void executeJavaScript(Context context, String functionName) {
        try {
            // Create an intent to start the MainActivity
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            launchIntent.putExtra("executeJs", "window.dispatchEvent(new CustomEvent('" + functionName + "'));");
            
            // Log what we're doing
            Log.d(TAG, "Executing JavaScript: " + functionName);
            
            // Start the app
            context.startActivity(launchIntent);
        } catch (Exception e) {
            Log.e(TAG, "Error executing JavaScript: " + e.getMessage());
        }
    }
} 