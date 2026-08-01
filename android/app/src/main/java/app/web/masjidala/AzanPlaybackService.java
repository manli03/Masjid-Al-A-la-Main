package app.web.masjidala;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONException;
import org.json.JSONObject;

public class AzanPlaybackService extends Service implements MediaPlayer.OnCompletionListener, AudioManager.OnAudioFocusChangeListener {
    private static final String TAG = "AzanPlaybackService";
    private static final String CHANNEL_ID = NotificationUtils.AZAN_PLAYBACK_CHANNEL_ID;
    private static final int NOTIFICATION_ID = 1001;

    // Actions
    public static final String ACTION_START_AZAN = "START_AZAN";
    public static final String ACTION_STOP_AZAN = "STOP_AZAN";

    // Extras
    public static final String EXTRA_PRAYER_NAME = "prayer_name";
    public static final String EXTRA_SOUND_NAME = "sound_name";
    public static final String EXTRA_ADVANCE_MINUTES = "advance_minutes";

    // Static instance and synchronization to ensure only one service plays at a time
    private static AzanPlaybackService currentInstance = null;
    private static long lastPlaybackStartTime = 0;
    private static final Object playbackLock = new Object();
    private static Thread currentPlaybackThread = null; // Track current playback thread

    private MediaPlayer mediaPlayer;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private String prayerName; // Store locally to avoid being overwritten
    private String soundName;  // Store locally to avoid being overwritten
    private int advanceMinutes;
    private boolean hasAudioFocus = false;
    private boolean isStopping = false; // Prevent multiple stop calls

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "AzanPlaybackService created");

        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        createNotificationChannel();

        // Don't start foreground here - we'll do it when we have prayer data
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        Log.d(TAG, "onStartCommand with action: " + action);

        if (ACTION_START_AZAN.equals(action)) {
            prayerName = intent.getStringExtra(EXTRA_PRAYER_NAME);
            soundName = intent.getStringExtra(EXTRA_SOUND_NAME);
            advanceMinutes = intent.getIntExtra(EXTRA_ADVANCE_MINUTES, 0);

            // Check if another instance is already playing within the time window
            long currentTime = System.currentTimeMillis();
            if (currentInstance != null && currentInstance != this &&
                    currentTime - lastPlaybackStartTime < 10000) { // Within 10 seconds
                Log.d(TAG, "Another azan is already playing within 10 seconds for " + currentInstance.prayerName + ", stopping this new request for " + prayerName);
                stopSelf(); // Stop this service instance immediately
                return START_NOT_STICKY;
            }

            // Check if another instance is currently stopping
            if (currentInstance != null && currentInstance != this && currentInstance.isStopping) {
                Log.d(TAG, "Previous azan is currently stopping, waiting for it to complete before starting " + prayerName);
                // Wait a bit for the previous service to finish stopping
                try {
                    Thread.sleep(500);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }

            // Interrupt any previous playback thread
            if (currentPlaybackThread != null && currentPlaybackThread.isAlive()) {
                Log.d(TAG, "Interrupting previous playback thread for " + (currentInstance != null ? currentInstance.prayerName : "unknown"));
                currentPlaybackThread.interrupt();
                try {
                    // Wait a short time for the thread to finish
                    currentPlaybackThread.join(500); // Wait up to 500ms
                } catch (InterruptedException e) {
                    Log.w(TAG, "Interrupted while waiting for previous thread to finish", e);
                    Thread.currentThread().interrupt();
                }
            }

            // Stop any previous instance if it's still running
            if (currentInstance != null && currentInstance != this) {
                Log.d(TAG, "Stopping previous azan playback instance for " + currentInstance.prayerName);
                currentInstance.stopAzanPlayback();
            }

            // Set this as the current instance
            currentInstance = this;
            lastPlaybackStartTime = currentTime;

            // Start foreground service immediately to meet Android's 5-second requirement
            startForeground(NOTIFICATION_ID, createNotification());

            // Start playback in background thread to avoid blocking
            Thread newPlaybackThread = new Thread(this::startAzanPlayback);
            currentPlaybackThread = newPlaybackThread;
            newPlaybackThread.start();
        } else if (ACTION_STOP_AZAN.equals(action)) {
            stopAzanPlayback();
        }

        return START_NOT_STICKY;
    }

    private void startAzanPlayback() {
        Log.d(TAG, "Starting azan playback for " + prayerName + " with sound " + soundName);

        // Check if this thread has been interrupted before starting
        if (Thread.currentThread().isInterrupted()) {
            Log.d(TAG, "Playback thread was interrupted before starting for " + prayerName);
            return;
        }

        // Try to request audio focus, but don't fail if we can't get it
        boolean hasFocus = requestAudioFocus();
        if (!hasFocus) {
            Log.w(TAG, "Could not get audio focus, but will try to play anyway");
        }

        // Synchronize MediaPlayer creation and playback to prevent conflicts
        synchronized (playbackLock) {
            // Check for interruption after acquiring lock
            if (Thread.currentThread().isInterrupted()) {
                Log.d(TAG, "Playback thread was interrupted after acquiring lock for " + prayerName);
                return;
            }

            // Stop any existing playback
            stopMediaPlayer();

            // Determine which sound to use based on prayer type
            String soundToPlay = getSoundForPrayer(prayerName, soundName);
            Log.d(TAG, "Using sound: " + soundToPlay + " for prayer: " + prayerName);

            // Get the resource ID for the sound
            int resourceId = getResourceId(soundToPlay);
            if (resourceId == 0) {
                Log.e(TAG, "Sound resource not found: " + soundToPlay);
                stopSelf();
                return;
            }

            // Get volume from user settings
            float volume = getAzanVolume();
            Log.d(TAG, "Using volume: " + volume + " (" + (volume * 100) + "%)");

            try {
                // Check for interruption before creating MediaPlayer
                if (Thread.currentThread().isInterrupted()) {
                    Log.d(TAG, "Playback thread was interrupted before creating MediaPlayer for " + prayerName);
                    return;
                }

                // Create MediaPlayer manually to ensure proper audio attributes
                mediaPlayer = new MediaPlayer();
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                mediaPlayer.setAudioAttributes(audioAttributes);
                Log.d(TAG, "Set audio attributes to alarm type for azan: " + soundToPlay);

                try {
                    // Set data source and prepare
                    mediaPlayer.setDataSource(this, android.net.Uri.parse("android.resource://" + getPackageName() + "/" + resourceId));
                    mediaPlayer.prepare();
                } catch (Exception e) {
                    Log.e(TAG, "Failed to prepare MediaPlayer for resource: " + soundToPlay, e);
                    if (mediaPlayer != null) {
                        mediaPlayer.release();
                        mediaPlayer = null;
                    }
                    stopSelf();
                    return;
                }

                // Set volume before starting playback
                mediaPlayer.setVolume(volume, volume);
                mediaPlayer.setOnCompletionListener(this);
                mediaPlayer.setLooping(false); // Don't loop the azan

                // Check for interruption before sleep
                if (Thread.currentThread().isInterrupted()) {
                    Log.d(TAG, "Playback thread was interrupted before sleep for " + prayerName);
                    if (mediaPlayer != null) {
                        mediaPlayer.release();
                        mediaPlayer = null;
                    }
                    return;
                }

                // Delay azan playback to allow notification sound to finish first
                Log.d(TAG, "Waiting for notification sound to finish before playing azan...");
                try {
                    Thread.sleep(2500); // Wait 2.5 seconds for notification sound
                } catch (InterruptedException e) {
                    Log.w(TAG, "Sleep interrupted", e);
                    Thread.currentThread().interrupt();
                    // Clean up MediaPlayer if interrupted during sleep
                    if (mediaPlayer != null) {
                        mediaPlayer.release();
                        mediaPlayer = null;
                    }
                    return;
                }

                // Final check for interruption before starting playback
                if (Thread.currentThread().isInterrupted()) {
                    Log.d(TAG, "Playback thread was interrupted before starting playback for " + prayerName);
                    if (mediaPlayer != null) {
                        mediaPlayer.release();
                        mediaPlayer = null;
                    }
                    return;
                }

                // Start azan playback
                mediaPlayer.start();
                Log.d(TAG, "Azan playback started after notification sound delay with volume: " + (volume * 100) + "%");

            } catch (Exception e) {
                Log.e(TAG, "Error starting azan playback", e);
                if (mediaPlayer != null) {
                    mediaPlayer.release();
                    mediaPlayer = null;
                }
                stopSelf();
            }
        }
    }

    private void stopAzanPlayback() {
        // Prevent multiple stop calls
        if (isStopping) {
            Log.d(TAG, "Already stopping azan playback for " + prayerName + ", skipping duplicate call");
            return;
        }

        isStopping = true;
        Log.d(TAG, "Stopping azan playback for " + prayerName);

        // Clear the current instance if this is the current instance
        if (currentInstance == this) {
            currentInstance = null;
        }

        // Stop MediaPlayer immediately to prevent delays
        stopMediaPlayer();

        // Release audio focus
        releaseAudioFocus();

        // Stop foreground and service
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();

        // Create completion notification after stopping (non-blocking)
        try {
            createCompletionNotification();
        } catch (Exception e) {
            Log.e(TAG, "Error creating completion notification", e);
        }
    }

    private void stopMediaPlayer() {
        synchronized (playbackLock) {
            if (mediaPlayer != null) {
                try {
                    if (mediaPlayer.isPlaying()) {
                        mediaPlayer.stop();
                    }
                    mediaPlayer.release();
                } catch (Exception e) {
                    Log.e(TAG, "Error stopping media player", e);
                } finally {
                    mediaPlayer = null;
                }
            }
        }
    }

    @SuppressWarnings("deprecation")
    private boolean requestAudioFocus() {
        if (audioManager == null) {
            return false;
        }

        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();

            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(audioAttributes)
                    .setOnAudioFocusChangeListener(this)
                    .build();

            result = audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            result = audioManager.requestAudioFocus(this, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
        }

        hasAudioFocus = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        return hasAudioFocus;
    }

    @SuppressWarnings("deprecation")
    private void releaseAudioFocus() {
        if (audioManager != null && hasAudioFocus) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest);
            } else {
                audioManager.abandonAudioFocus(this);
            }
            hasAudioFocus = false;
        }
    }

    private String getSoundForPrayer(String prayerName, String selectedSound) {
        // Use zikir_pagi sound for morning prayers (Imsak, Syuruk, Dhuha)
        if ("Imsak".equals(prayerName) || "Syuruk".equals(prayerName) || "Dhuha".equals(prayerName)) {
            return "zikir_pagi";
        }
        // Use selected azan sound for other prayers
        return selectedSound;
    }

    @SuppressWarnings("DiscouragedApi")
    private int getResourceId(String resourceName) {
        try {
            return getResources().getIdentifier(resourceName, "raw", getPackageName());
        } catch (Exception e) {
            Log.e(TAG, "Error getting resource ID for: " + resourceName, e);
            return 0;
        }
    }

    private float getAzanVolume() {
        try {
            SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String notifJson = prefs.getString("prayer_notifications", null);

            if (notifJson != null) {
                JSONObject notifSettings = new JSONObject(notifJson);
                double volume = notifSettings.optDouble("azanVolume", 1.0); // Default to 100%
                return (float) Math.max(0.1, Math.min(1.0, volume)); // Clamp between 0.1 and 1.0
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error reading volume preference", e);
        }

        return 1.0f; // Default to 100% if error
    }

    private void createNotificationChannel() {
        // Shared utility ensures both azan and silent channels exist before use.
        // Safe to call multiple times and required before posting on Android O+.
        NotificationUtils.ensureNotificationChannels(this);
    }

    private Notification createNotification() {
        // Create intent for stopping the azan
        Intent stopIntent = new Intent(this, AzanPlaybackService.class);
        stopIntent.setAction(ACTION_STOP_AZAN);
        PendingIntent stopPendingIntent = PendingIntent.getService(
                this, 0, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Create intent for opening the app
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launchIntent.putExtra("deep_link", "/prayerTimes");
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Create delete intent to detect when notification is dismissed
        Intent deleteIntent = new Intent(this, NotificationDismissedReceiver.class);
        deleteIntent.putExtra(NotificationDismissedReceiver.EXTRA_PRAYER_NAME, prayerName);
        deleteIntent.putExtra(NotificationDismissedReceiver.EXTRA_SOUND_NAME, soundName);
        deleteIntent.putExtra(NotificationDismissedReceiver.EXTRA_ADVANCE_MINUTES, advanceMinutes);
        PendingIntent deletePendingIntent = PendingIntent.getBroadcast(
                this, 0, deleteIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Build the notification
        String title = "Waktu " + prayerName;
        String message = "Sekarang waktu " + prayerName;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_prayertimes_icon)
                .setColor(ContextCompat.getColor(this, R.color.notification_color))
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true) // Make it persistent while playing
                .setAutoCancel(false) // Don't auto-cancel when tapped
                .setContentIntent(contentIntent)
                .setDeleteIntent(deletePendingIntent) // Detect when dismissed
                .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                        .setShowActionsInCompactView(0) // Show first action in compact view
                        .setMediaSession(null)) // MediaStyle for better action visibility
                .addAction(R.drawable.ic_stop, "Hentikan Bunyi", stopPendingIntent);

        return builder.build();
    }

    @Override
    public void onCompletion(MediaPlayer mp) {
        synchronized (playbackLock) {
            Log.d(TAG, "Azan playback completed naturally for " + prayerName);
            // Create completion notification before stopping service
            createCompletionNotification();
            stopAzanPlayback();
        }
    }

    @Override
    public void onAudioFocusChange(int focusChange) {
        Log.d(TAG, "Audio focus changed: " + focusChange);

        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                // Stop playback when we lose audio focus
                stopAzanPlayback();
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                // Lower volume but continue playing
                synchronized (playbackLock) {
                    if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                        mediaPlayer.setVolume(0.3f, 0.3f);
                    }
                }
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                // Restore full volume
                synchronized (playbackLock) {
                    if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                        mediaPlayer.setVolume(1.0f, 1.0f);
                    }
                }
                break;
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "AzanPlaybackService destroyed for " + prayerName);

        // Clear the current instance if this is the current instance
        if (currentInstance == this) {
            currentInstance = null;
        }

        synchronized (playbackLock) {
            stopMediaPlayer();
            releaseAudioFocus();
        }
        super.onDestroy();
    }

    private void createCompletionNotification() {
        Log.d(TAG, "Creating completion notification for " + prayerName);

        // Create silent notification channel for completion
        createSilentNotificationChannel();

        // Get prayer time and location using NotificationUtils
        String prayerTime = NotificationUtils.getCurrentPrayerTime(this, prayerName);
        String location = NotificationUtils.getLocationName(this);

        // Create notification content using NotificationUtils with advance time
        String[] formattedMessage = NotificationUtils.formatNotificationMessage(prayerName, prayerTime, location, advanceMinutes);
        String title = formattedMessage[0];
        String message = formattedMessage[1];

        // Create intent for opening the app
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launchIntent.putExtra("deep_link", "/prayerTimes");
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Use silent channel for completion notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NotificationUtils.AZAN_PLAYBACK_CHANNEL_ID_SILENT)
                .setSmallIcon(R.drawable.ic_stat_prayertimes_icon)
                .setColor(ContextCompat.getColor(this, R.color.notification_color))
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOngoing(false) // Not ongoing - can be dismissed
                .setAutoCancel(true) // Auto-cancel when tapped
                .setContentIntent(contentIntent);

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID + 1, builder.build()); // Use different ID for completion notification
            Log.d(TAG, "Completion notification posted for " + prayerName);
        }
    }

    private void createSilentNotificationChannel() {
        // Shared utility ensures both azan and silent channels exist before use.
        NotificationUtils.ensureNotificationChannels(this);
    }


    @Override
    public IBinder onBind(Intent intent) {
        return null; // We don't provide binding
    }
}
