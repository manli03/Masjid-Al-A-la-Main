package app.web.masjidala;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidAudio")
public class AndroidAudio extends Plugin {
    private static final String TAG = "AndroidAudio";
    private MediaPlayer mediaPlayer;

    @Override
    public void load() {
        // Plugin is loaded
        Log.d(TAG, "AndroidAudio plugin loaded");
    }

    @PluginMethod
    public void playSound(PluginCall call) {
        String resourceName = call.getString("resourceName");
        if (resourceName == null) {
            call.reject("Resource name is required");
            return;
        }

        // Get volume parameter (optional, defaults to 1.0)
        Double volume = call.getDouble("volume", 1.0);

        try {
            // Stop any currently playing sound
            stopCurrentSound();

            // Get the resource ID from the name
            int resourceId = getResourceId(resourceName);
            if (resourceId == 0) {
                Log.e(TAG, "Resource not found: " + resourceName);
                call.reject("Resource not found: " + resourceName);
                return;
            }

            Log.d(TAG, "Creating MediaPlayer for resource: " + resourceName + " (ID: " + resourceId + ") with volume: " + volume);

            // Create MediaPlayer manually to ensure proper audio attributes
            mediaPlayer = new MediaPlayer();
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            mediaPlayer.setAudioAttributes(audioAttributes);
            Log.d(TAG, "Set audio attributes to alarm type for preview: " + resourceName);

            try {
                // Set data source and prepare
                mediaPlayer.setDataSource(getContext(), android.net.Uri.parse("android.resource://" + getContext().getPackageName() + "/" + resourceId));
                mediaPlayer.prepare();
            } catch (Exception e) {
                Log.e(TAG, "Failed to prepare MediaPlayer for resource: " + resourceName, e);
                mediaPlayer.release();
                mediaPlayer = null;
                call.reject("Failed to prepare MediaPlayer for resource: " + resourceName);
                return;
            }

            // Set volume
            assert volume != null;
            mediaPlayer.setVolume(volume.floatValue(), volume.floatValue());
            Log.d(TAG, "Set volume to: " + volume);

            // Set completion listener
            mediaPlayer.setOnCompletionListener(mp -> {
                Log.d(TAG, "Sound playback completed");
                // Clean up when sound completes
                stopCurrentSound();
            });

            // Start playback
            mediaPlayer.start();
            Log.d(TAG, "Started playing sound: " + resourceName);

            // Return success
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error playing sound: " + e.getMessage(), e);
            call.reject("Error playing sound: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopSound(PluginCall call) {
        try {
            stopCurrentSound();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error stopping sound: " + e.getMessage());
            call.reject("Error stopping sound: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double volume = call.getDouble("volume");
        if (volume == null) {
            call.reject("Volume parameter is required");
            return;
        }

        try {
            if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                // Set volume for currently playing sound
                mediaPlayer.setVolume(volume.floatValue(), volume.floatValue());
                Log.d(TAG, "Updated volume to: " + volume);
            } else {
                Log.w(TAG, "No active media player to set volume for");
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error setting volume: " + e.getMessage());
            call.reject("Error setting volume: " + e.getMessage(), e);
        }
    }

    private void stopCurrentSound() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
                mediaPlayer = null;
                Log.d(TAG, "Stopped and released media player");
            } catch (Exception e) {
                Log.e(TAG, "Error stopping sound: " + e.getMessage());
            }
        }
    }

    private int getResourceId(String resourceName) {
        try {
            // Get the raw resource ID from the name
            int resId = getContext().getResources().getIdentifier(
                    resourceName,
                    "raw",
                    getContext().getPackageName()
            );

            Log.d(TAG, "Resource ID for " + resourceName + ": " + resId);
            return resId;
        } catch (Exception e) {
            Log.e(TAG, "Error getting resource ID: " + e.getMessage());
            return 0;
        }
    }

    @PluginMethod
    public void cancelNotification(PluginCall call) {
        Log.d(TAG, "cancelNotification called");
        try {
            Context context = this.getContext();
            if (context == null) {
                Log.e(TAG, "Context is null");
                call.reject("Context is null");
                return;
            }
            PrayerNotificationRescheduler.cancelAllScheduledAlarms(context);
            call.resolve(); // Resolve the call after successful cancellation
        } catch (Exception e) {
            Log.e(TAG, "Error cancelling notifications: " + e.getMessage());
            e.printStackTrace();
            call.reject("Error cancelling notifications: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void setNotification(PluginCall call) {
        Log.d(TAG, "setNotification called");
        try {
            Context context = this.getContext();
            if (context == null) {
                Log.e(TAG, "Context is null");
                call.reject("Context is null");
                return;
            }

            // Schedule prayer notifications
            PrayerNotificationRescheduler.rescheduleAll(context);

            // 🔥 Also set up the daily repeating alarm
            DailyNotificationScheduling.scheduleDailyCheck(context);

            call.resolve(); // Resolve the call after successful scheduling
        } catch (Exception e) {
            Log.e(TAG, "Error scheduling notifications: " + e.getMessage());
            e.printStackTrace();
            call.reject("Error scheduling notifications: " + e.getMessage(), e);
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopCurrentSound();
    }
}
