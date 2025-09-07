package app.web.masjidala;

import android.app.Notification;
import android.app.NotificationChannel;
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
import android.media.RingtoneManager;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONException;
import org.json.JSONObject;

public class AzanPlaybackService extends Service implements MediaPlayer.OnCompletionListener, AudioManager.OnAudioFocusChangeListener {
    private static final String TAG = "AzanPlaybackService";
    private static final String CHANNEL_ID = "azan_playback_channel";
    private static final int NOTIFICATION_ID = 1001;

    // Actions
    public static final String ACTION_START_AZAN = "START_AZAN";
    public static final String ACTION_STOP_AZAN = "STOP_AZAN";

    // Extras
    public static final String EXTRA_PRAYER_NAME = "prayer_name";
    public static final String EXTRA_SOUND_NAME = "sound_name";
    public static final String EXTRA_ADVANCE_MINUTES = "advance_minutes";

    private MediaPlayer mediaPlayer;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private String currentPrayerName;
    private String currentSoundName;
    private int advanceMinutes;
    private boolean hasAudioFocus = false;

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
            currentPrayerName = intent.getStringExtra(EXTRA_PRAYER_NAME);
            currentSoundName = intent.getStringExtra(EXTRA_SOUND_NAME);
            advanceMinutes = intent.getIntExtra(EXTRA_ADVANCE_MINUTES, 0);

            // Start playback in background thread to avoid blocking
            new Thread(this::startAzanPlayback).start();
        } else if (ACTION_STOP_AZAN.equals(action)) {
            stopAzanPlayback();
        }

        return START_NOT_STICKY;
    }

    private void startAzanPlayback() {
        Log.d(TAG, "Starting azan playback for " + currentPrayerName + " with sound " + currentSoundName);

        // Start foreground service immediately to meet Android's 5-second requirement
        startForeground(NOTIFICATION_ID, createNotification());

        // Try to request audio focus, but don't fail if we can't get it
        boolean hasFocus = requestAudioFocus();
        if (!hasFocus) {
            Log.w(TAG, "Could not get audio focus, but will try to play anyway");
        }

        // Stop any existing playback
        stopMediaPlayer();

        // Determine which sound to use based on prayer type
        String soundToPlay = getSoundForPrayer(currentPrayerName, currentSoundName);
        Log.d(TAG, "Using sound: " + soundToPlay + " for prayer: " + currentPrayerName);

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
            // Create MediaPlayer manually to ensure proper audio attributes
            mediaPlayer = new MediaPlayer();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                mediaPlayer.setAudioAttributes(audioAttributes);
                Log.d(TAG, "Set audio attributes to alarm type for azan: " + soundToPlay);
            } else {
                // For older Android versions, set audio stream type
                mediaPlayer.setAudioStreamType(android.media.AudioManager.STREAM_ALARM);
                Log.d(TAG, "Set audio stream to alarm type for azan (legacy): " + soundToPlay);
            }

            try {
                // Set data source and prepare
                mediaPlayer.setDataSource(this, android.net.Uri.parse("android.resource://" + getPackageName() + "/" + resourceId));
                mediaPlayer.prepare();
            } catch (Exception e) {
                Log.e(TAG, "Failed to prepare MediaPlayer for resource: " + soundToPlay, e);
                mediaPlayer.release();
                mediaPlayer = null;
                stopSelf();
                return;
            }

            // Set volume before starting playback
            mediaPlayer.setVolume(volume, volume);
            mediaPlayer.setOnCompletionListener(this);
            mediaPlayer.setLooping(false); // Don't loop the azan

            // Delay azan playback to allow notification sound to finish first
            Log.d(TAG, "Waiting for notification sound to finish before playing azan...");
            try {
                Thread.sleep(2500); // Wait 2.5 seconds for notification sound
            } catch (InterruptedException e) {
                Log.w(TAG, "Sleep interrupted", e);
                Thread.currentThread().interrupt();
            }

            // Start azan playback
            mediaPlayer.start();
            Log.d(TAG, "Azan playback started after notification sound delay with volume: " + (volume * 100) + "%");

        } catch (Exception e) {
            Log.e(TAG, "Error starting azan playback", e);
            stopSelf();
        }
    }

    private void stopAzanPlayback() {
        Log.d(TAG, "Stopping azan playback");

        stopMediaPlayer();
        releaseAudioFocus();
        stopForeground(true);
        stopSelf();
    }

    private void stopMediaPlayer() {
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Azan Playback",
                    NotificationManager.IMPORTANCE_HIGH // Changed to HIGH for floating
            );
            channel.setDescription("Controls for azan playback");

            // Set a default alarm sound to enable floating
            channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build());

            channel.enableVibration(true);
            channel.setShowBadge(true);

            // Additional settings for heads-up notifications
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                channel.setAllowBubbles(true);
            }

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createInitialNotification() {
        // Create a basic notification for initial foreground start
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_prayertimes_icon)
                .setColor(ContextCompat.getColor(this, R.color.notification_color))
                .setContentTitle("Memuatkan azan...")
                .setContentText("Sedia untuk memainkan azan")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setAutoCancel(false);

        return builder.build();
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
        launchIntent.putExtra("deep_link", "/tabs/prayerTimes");
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Create delete intent to detect when notification is dismissed
        Intent deleteIntent = new Intent(this, NotificationDismissedReceiver.class);
        deleteIntent.putExtra(NotificationDismissedReceiver.EXTRA_PRAYER_NAME, currentPrayerName);
        deleteIntent.putExtra(NotificationDismissedReceiver.EXTRA_SOUND_NAME, currentSoundName);
        deleteIntent.putExtra(NotificationDismissedReceiver.EXTRA_ADVANCE_MINUTES, advanceMinutes);
        PendingIntent deletePendingIntent = PendingIntent.getBroadcast(
                this, 0, deleteIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Build the notification
        String title = "Waktu " + currentPrayerName;
        String message = "Sekarang waktu " + currentPrayerName;

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
        Log.d(TAG, "Azan playback completed naturally");
        // Create completion notification before stopping service
        createCompletionNotification();
        stopAzanPlayback();
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
                if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                    mediaPlayer.setVolume(0.3f, 0.3f);
                }
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                // Restore full volume
                if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                    mediaPlayer.setVolume(1.0f, 1.0f);
                }
                break;
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "AzanPlaybackService destroyed");
        stopMediaPlayer();
        releaseAudioFocus();
        super.onDestroy();
    }

    private void createCompletionNotification() {
        Log.d(TAG, "Creating completion notification for " + currentPrayerName);

        // Create silent notification channel for completion
        createSilentNotificationChannel();

        // Get prayer time and location using NotificationUtils
        String prayerTime = NotificationUtils.getCurrentPrayerTime(this, currentPrayerName);
        String location = NotificationUtils.getLocationName(this);

        // Create notification content using NotificationUtils
        String[] formattedMessage = NotificationUtils.formatNotificationMessage(currentPrayerName, prayerTime, location);
        String title = formattedMessage[0];
        String message = formattedMessage[1];

        // Create intent for opening the app
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launchIntent.putExtra("deep_link", "/tabs/prayerTimes");
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Use silent channel for completion notification
        String silentChannelId = CHANNEL_ID + "_silent";
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, silentChannelId)
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
            Log.d(TAG, "Completion notification posted for " + currentPrayerName);
        }
    }

    private void createSilentNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            String silentChannelId = CHANNEL_ID + "_silent";
            NotificationChannel channel = new NotificationChannel(
                    silentChannelId,
                    "Azan Completion",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Silent notifications for azan completion");
            channel.setSound(null, null); // No sound
            channel.setVibrationPattern(null); // No vibration
            channel.setShowBadge(true);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }



    @Override
    public IBinder onBind(Intent intent) {
        return null; // We don't provide binding
    }
}
