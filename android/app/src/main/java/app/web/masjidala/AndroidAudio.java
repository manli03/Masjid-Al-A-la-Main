package app.web.masjidala;

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
            
            Log.d(TAG, "Creating MediaPlayer for resource: " + resourceName + " (ID: " + resourceId + ")");
            
            // Create MediaPlayer from resource ID directly
            mediaPlayer = MediaPlayer.create(getContext(), resourceId);
            
            if (mediaPlayer == null) {
                Log.e(TAG, "Failed to create MediaPlayer for resource: " + resourceName);
                call.reject("Failed to create MediaPlayer for resource: " + resourceName);
                return;
            }
            
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
    
    @Override
    protected void handleOnDestroy() {
        stopCurrentSound();
    }
} 