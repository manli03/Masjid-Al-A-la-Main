import { Injectable } from '@angular/core';
import { LocalNotifications, Channel } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { BehaviorSubject } from 'rxjs';
import AndroidAudio from '../plugins/android-audio';

// Define notification settings interface
export interface PrayerNotificationSettings {
  enabledPrayers: string[];
  lastScheduled: string | null;
  selectedAzanSound: string;
  notificationAdvance: number;
  currentChannelId?: string;
  currentDefaultChannelId: string;
}

// Define interface for custom AndroidAudio plugin
interface AndroidAudioPlugin {
  playSound(resourceName: string): void;
  stopSound(): void;
  cancelNotification(): void;
}

// Extend Window interface to include our custom plugin
declare global {
  interface Window {
    AndroidAudio?: AndroidAudioPlugin;
  }
}

@Injectable({
  providedIn: 'root',
})
export class PrayerNotificationsService {
  // Prayer names
  private readonly PRAYER_NAMES = [
    'Subuh',
    'Syuruk',
    'Dhuha',
    'Zuhur',
    'Asar',
    'Maghrib',
    'Isyak',
  ];

  // Key for storing notification preferences
  private readonly PREFERENCES_KEY = 'prayer_notifications';

  // Key for post notification channel
  private readonly POST_NOTIFICATION_CHANNEL_ID = 'post_notifications';

  // Max days to schedule ahead
  private readonly MAX_DAYS_AHEAD = 1;

  // Notification channel IDs
  private readonly CHANNEL_ID_PREFIX = 'prayer_times_';
  private readonly DEFAULT_CHANNEL_PREFIX = 'default_prayer_';
  private currentChannelId: string = '';
  private currentDefaultChannelId: string = '';

  // Track if notification operations are in progress to prevent double-clicking
  private isProcessing = false;
  private isSavingSettings = false;
  private pendingPrayerToggles: Map<string, boolean> = new Map();
  private pendingSettings: PrayerNotificationSettings | null = null;
  private processingQueue = false;
  private processingQueueTimeout: any = null;

  // Observable for notification settings
  private settingsSubject =
    new BehaviorSubject<PrayerNotificationSettings | null>(null);

  // Expose settings as observable
  public settings$ = this.settingsSubject.asObservable();

  // Available azan sounds
  public readonly availableSounds = [
    {
      id: 'none',
      name: 'Lalai',
      file: '',
    },
    {
      id: 'azan1',
      name: 'Azan 1',
      file: 'android/app/src/main/res/raw/azan1.mp3',
    },
    {
      id: 'azan2',
      name: 'Azan 2',
      file: 'android/app/src/main/res/raw/azan2.mp3',
    },
    {
      id: 'azan3',
      name: 'Azan 3',
      file: 'android/app/src/main/res/raw/azan3.mp3',
    },
    {
      id: 'azan4',
      name: 'Azan 4',
      file: 'android/app/src/main/res/raw/azan4.mp3',
    },
    {
      id: 'azan5',
      name: 'Azan 5',
      file: 'android/app/src/main/res/raw/azan5.mp3',
    },
    {
      id: 'azan6',
      name: 'Azan 6',
      file: 'android/app/src/main/res/raw/azan6.mp3',
    },
    {
      id: 'azan7',
      name: 'Azan 7',
      file: 'android/app/src/main/res/raw/azan7.mp3',
    },
    {
      id: 'azan8',
      name: 'Azan 8',
      file: 'android/app/src/main/res/raw/azan8.mp3',
    },
    {
      id: 'azan9',
      name: 'Azan 9',
      file: 'android/app/src/main/res/raw/azan9.mp3',
    },
    {
      id: 'azan10',
      name: 'Azan 10',
      file: 'android/app/src/main/res/raw/azan10.mp3',
    },
  ];

  constructor(
    private toastController: ToastController,
    private router: Router,
  ) {
    // Set up notification listeners
    this.setupNotificationListeners();

    // Initialize with a new channel ID
    this.refreshChannelIds();
  }

  private refreshChannelIds(): void {
    this.currentChannelId = this.generateNewChannelId(this.CHANNEL_ID_PREFIX);
    this.currentDefaultChannelId = this.generateNewChannelId(
      this.DEFAULT_CHANNEL_PREFIX,
    );
  }

  private generateNewChannelId(prefix: string): string {
    const timestamp = new Date().getTime();
    return `${prefix}${timestamp}`;
  }

  /**
   * Initialize notifications service - request permissions and create channels
   */
  async initialize(): Promise<boolean> {
    try {
      // Request permission first
      const permResult = await LocalNotifications.requestPermissions();

      if (!permResult.display) {
        await this.showToast(
          'Notifikasi tidak dibenarkan. Sila aktifkan kebenaran notifikasi untuk menerima peringatan waktu solat.',
          'warning',
        );
        return false;
      }

      // For Android, only create channels if they don't exist yet
      if (Capacitor.getPlatform() === 'android') {
        const channels = await LocalNotifications.listChannels();

        // Only create post notification channel if it doesn't exist
        if (
          !channels.channels.some(
            (c) => c.id === this.POST_NOTIFICATION_CHANNEL_ID,
          )
        ) {
          await this.createPostNotificationChannel();
        }

        // Only create prayer notification channel if none exist
        if (
          !channels.channels.some((c) =>
            c.id.startsWith(this.CHANNEL_ID_PREFIX),
          )
        ) {
          const settings = await this.getNotificationSettings();
          await this.recreateNotificationChannel(settings);
        } else {
          // Set the current channel ID to the existing one
          const existingChannel = channels.channels.find((c) =>
            c.id.startsWith(this.CHANNEL_ID_PREFIX),
          );
          if (existingChannel) {
            this.currentChannelId = existingChannel.id;
          }
        }

        // Create default prayer channel
        await this.createDefaultPrayerChannel();
      }

      // Check if we need to schedule/reschedule notifications
      const settings = await this.getNotificationSettings();
      if (this.shouldReschedule(settings.lastScheduled)) {
        console.log(
          'Notification schedule outdated, rescheduling at startup...',
        );
        await this.scheduleAllNotifications();
      } else {
        console.log(
          'Notifications are up to date, no rescheduling needed at startup',
        );
      }

      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  /**
   * Toggle notifications for a specific prayer
   */
  async togglePrayerNotification(prayerName: string): Promise<boolean> {
    try {
      // Use haptic feedback to indicate the button press
      await Haptics.impact({ style: ImpactStyle.Light });

      // Get current settings
      const settings = await this.getNotificationSettings();

      // Normalize the prayer name
      const normalizedPrayerName =
        this.PRAYER_NAMES.find(
          (name) => name.toLowerCase() === prayerName.toLowerCase(),
        ) || prayerName;

      // Check if this prayer is currently enabled
      const currentlyEnabled =
        settings.enabledPrayers.includes(normalizedPrayerName);

      // Toggle the prayer in the settings
      if (currentlyEnabled) {
        settings.enabledPrayers = settings.enabledPrayers.filter(
          (p) => p !== normalizedPrayerName,
        );
      } else {
        settings.enabledPrayers.push(normalizedPrayerName);
      }

      // Update the settings observable to reflect UI changes immediately
      this.settingsSubject.next(settings);

      // Add to pending toggles queue instead of processing immediately
      this.pendingPrayerToggles.set(normalizedPrayerName, !currentlyEnabled);

      // Schedule processing of the queue
      this.scheduleQueueProcessing();

      return true;
    } catch (error) {
      console.error('Error toggling prayer notification:', error);
      return false;
    }
  }

  /**
   * Schedule processing of the toggle queue
   * This ensures we process the most recent state of each prayer
   */
  private scheduleQueueProcessing(): void {
    // If we're already processing or have a pending timeout, don't schedule another
    if (this.processingQueue || this.processingQueueTimeout) {
      return;
    }

    // Clear any existing timeout
    if (this.processingQueueTimeout) {
      clearTimeout(this.processingQueueTimeout);
    }

    // Schedule processing with a short delay to group rapid toggles
    this.processingQueueTimeout = setTimeout(() => {
      this.processToggleQueue();
    }, 300); // 300ms delay to group rapid clicks
  }

  /**
   * Process the queue of prayer toggles
   */
  private async processToggleQueue(): Promise<void> {
    if (this.pendingPrayerToggles.size === 0 || this.processingQueue) {
      this.processingQueueTimeout = null;
      return;
    }

    try {
      this.processingQueue = true;

      // Get current settings
      const settings = await this.getNotificationSettings();
      let changed = false;

      // Process all pending toggles
      for (const [
        prayer,
        shouldEnable,
      ] of this.pendingPrayerToggles.entries()) {
        // Check if we need to update this prayer
        const isCurrentlyEnabled = settings.enabledPrayers.includes(prayer);

        if (shouldEnable && !isCurrentlyEnabled) {
          // Need to enable this prayer
          settings.enabledPrayers.push(prayer);
          changed = true;
        } else if (!shouldEnable && isCurrentlyEnabled) {
          // Need to disable this prayer
          settings.enabledPrayers = settings.enabledPrayers.filter(
            (p) => p !== prayer,
          );
          changed = true;
        }
      }

      // Clear the pending toggles
      this.pendingPrayerToggles.clear();

      // Only save settings if changes were made
      if (changed) {
        // Save the settings and update notifications
        await this.saveNotificationSettings(settings);
        console.log('Processed prayer toggles queue and saved settings');
      } else {
        console.log('Processed prayer toggles queue - no changes needed');
      }
    } catch (error) {
      console.error('Error processing prayer toggle queue:', error);
    } finally {
      this.processingQueue = false;
      this.processingQueueTimeout = null;

      // Check if new toggles came in while we were processing
      if (this.pendingPrayerToggles.size > 0) {
        this.scheduleQueueProcessing();
      }
    }
  }

  /**
   * Implementation of the toggle prayer notification functionality
   * This is kept for backward compatibility but no longer used directly
   */
  private async togglePrayerNotificationImpl(
    prayerName: string,
  ): Promise<boolean> {
    // Use the new queue-based toggle method
    return this.togglePrayerNotification(prayerName);
  }

  /**
   * Check if notifications are enabled for a specific prayer
   */
  async isPrayerNotificationEnabled(prayerName: string): Promise<boolean> {
    const settings = await this.getNotificationSettings();

    // First try exact match
    if (settings.enabledPrayers.includes(prayerName)) {
      return true;
    }

    // Then try case-insensitive match
    return settings.enabledPrayers.some(
      (p) => p.toLowerCase() === prayerName.toLowerCase(),
    );
  }

  /**
   * Get all notification settings
   */
  async getNotificationSettings(): Promise<PrayerNotificationSettings> {
    const { value } = await Preferences.get({ key: this.PREFERENCES_KEY });
    if (!value) {
      // Default settings with new fields
      const defaultSettings: PrayerNotificationSettings = {
        enabledPrayers: [],
        lastScheduled: null,
        selectedAzanSound: 'azan7', // Default sound
        notificationAdvance: 0,
        currentChannelId: this.currentChannelId,
        currentDefaultChannelId: this.currentDefaultChannelId,
      };

      // Update settings observable
      this.settingsSubject.next(defaultSettings);

      return defaultSettings;
    }

    const parsedSettings = JSON.parse(value);
    // console.log('Parsed settings:', parsedSettings);

    // Ensure all fields exist (backward compatibility)
    const settings: PrayerNotificationSettings = {
      enabledPrayers: parsedSettings.enabledPrayers || [],
      lastScheduled: parsedSettings.lastScheduled || null,
      selectedAzanSound: parsedSettings.selectedAzanSound || 'none',
      notificationAdvance: parsedSettings.notificationAdvance || 0,
      currentChannelId:
        parsedSettings.currentChannelId || this.currentChannelId,
      currentDefaultChannelId:
        parsedSettings.currentDefaultChannelId || this.currentDefaultChannelId,
    };

    // Update settings observable
    this.settingsSubject.next(settings);

    return settings;
  }

  /**
   * Save notification settings to preferences
   */
  async saveNotificationSettings(
    settings: PrayerNotificationSettings,
  ): Promise<void> {
    // If already saving settings, store these as pending to be processed after
    if (this.isSavingSettings) {
      console.log('Already saving settings, storing as pending...');
      this.pendingSettings = { ...settings };
      return;
    }

    try {
      this.isSavingSettings = true;

      // Make sure both channel IDs are set
      settings.currentChannelId = this.currentChannelId;
      settings.currentDefaultChannelId = this.currentDefaultChannelId;

      // Save settings to storage first
      await Preferences.set({
        key: this.PREFERENCES_KEY,
        value: JSON.stringify(settings),
      });

      // Update the settings observable
      this.settingsSubject.next(settings);

      // Recreate the notification channel with new settings
      if (Capacitor.getPlatform() === 'android') {
        await this.recreateNotificationChannel(settings);
      }

      // Schedule notifications with new settings
      await this.scheduleAllNotifications();

      console.log('Prayer notification settings saved and channel updated');
    } catch (error) {
      console.error('Error saving prayer notification settings:', error);
      throw error;
    } finally {
      this.isSavingSettings = false;

      // Check if we have pending settings to process
      if (this.pendingSettings) {
        const pendingSettings = { ...this.pendingSettings };
        this.pendingSettings = null;
        // Process the pending settings after a short delay
        setTimeout(() => {
          this.saveNotificationSettings(pendingSettings);
        }, 100);
      }
    }
  }

  /**
   * Recreate notification channel with updated settings
   * This ensures that changes to notification settings are applied
   */
  private async recreateNotificationChannel(
    settings: PrayerNotificationSettings,
  ): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    try {
      // List all existing channels
      const channels = await LocalNotifications.listChannels();
      console.log('Current channels before deletion:', channels.channels);

      // Delete all channels except post notification
      for (const channel of channels.channels) {
        if (channel.id !== this.POST_NOTIFICATION_CHANNEL_ID) {
          console.log(`Deleting channel: ${channel.id}`);
          await LocalNotifications.deleteChannel({ id: channel.id });
        }
      }

      // Generate new channel IDs
      this.refreshChannelIds();

      // Set sound for main prayer channel
      let sound: string | undefined = undefined;
      if (settings.selectedAzanSound && settings.selectedAzanSound !== 'none') {
        sound = settings.selectedAzanSound;
      }

      // Create main prayer channel
      const mainChannelConfig: Channel = {
        id: this.currentChannelId,
        name: 'Waktu Solat',
        description: 'Notifikasi waktu solat',
        importance: 3,
        visibility: 1,
        sound: sound,
        vibration: true,
        lights: true,
      };

      await LocalNotifications.createChannel(mainChannelConfig);
      console.log(
        'Main prayer channel created with config:',
        mainChannelConfig,
      );

      // Create default prayer channel for morning prayers
      const defaultChannelConfig: Channel = {
        id: this.currentDefaultChannelId,
        name: 'Notifikasi Waktu Biasa',
        description: 'Notifikasi untuk Imsak, Syuruk, Dhuha',
        importance: 3,
        visibility: 1,
        vibration: true,
        lights: true,
        sound: settings.selectedAzanSound !== 'none' ? 'zikir_pagi' : undefined,
      };

      await LocalNotifications.createChannel(defaultChannelConfig);
      console.log(
        'Morning prayers channel created with config:',
        defaultChannelConfig,
      );

      // Update settings with new channel IDs
      const updatedSettings = {
        ...settings,
        lastScheduled: new Date().toISOString(),
        currentChannelId: this.currentChannelId,
        currentDefaultChannelId: this.currentDefaultChannelId,
      };

      // Save the new channel IDs to preferences
      await Preferences.set({
        key: this.PREFERENCES_KEY,
        value: JSON.stringify(updatedSettings),
      });

      // Update settings in memory
      this.settingsSubject.next(updatedSettings);

      console.log('Notification settings updated with new channel IDs');

      // Verify channels were created with correct settings
      const updatedChannels = await LocalNotifications.listChannels();
      console.log('Channels after recreation:', updatedChannels.channels);

      const mainChannel = updatedChannels.channels.find(
        (c) => c.id === this.currentChannelId,
      );
      const defaultChannel = updatedChannels.channels.find(
        (c) => c.id === this.currentDefaultChannelId,
      );

      console.log('Created main channel settings:', mainChannel);
      console.log('Created default channel settings:', defaultChannel);
    } catch (error) {
      console.error('Error creating notification channels:', error);
      throw error;
    }
  }

  /**
   * Create default prayer notification channel
   */
  private async createDefaultPrayerChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
      const channels = await LocalNotifications.listChannels();
      if (
        !channels.channels.some((c) => c.id === this.currentDefaultChannelId)
      ) {
        const settings = await this.getNotificationSettings();
        const useZikirSound = settings.selectedAzanSound !== 'none';

        await LocalNotifications.createChannel({
          id: this.currentDefaultChannelId,
          name: 'Notifikasi Waktu Biasa',
          description: 'Notifikasi untuk Imsak, Syuruk, Dhuha',
          importance: 3,
          visibility: 1,
          vibration: true,
          lights: true,
          sound: useZikirSound ? 'zikir_pagi' : undefined,
        });
        console.log(
          'Default prayer channel created with sound:',
          useZikirSound ? 'zikir_pagi' : 'default',
        );
      }
    } catch (error) {
      console.error('Error creating default prayer channel:', error);
    }
  }

  /**
   * Reschedule notifications (for use after settings change)
   */
  async rescheduleNotifications(): Promise<void> {
    await this.cancelAllNotifications();
    await this.scheduleAllNotifications();
  }

  /**
   * Play azan sound for preview
   */
  private currentAudio: HTMLAudioElement | null = null;
  private currentPlayingAssetId: string | null = null;

  async playAzanSound(soundName: string): Promise<void> {
    // Stop any currently playing sound first
    await this.stopAzanSound();

    // Handle differently based on platform
    if (Capacitor.isNativePlatform()) {
      // For native platforms (Android/iOS)
      if (Capacitor.getPlatform() === 'android') {
        try {
          console.log(`Playing Android native sound: ${soundName}`);

          // On Android, use our custom plugin to play the sound
          this.currentPlayingAssetId = soundName;
          await AndroidAudio.playSound({ resourceName: soundName });
          return;
        } catch (error) {
          console.error('Error playing native audio:', error);
          // Fall back to web audio if native playback fails
          const audio = new Audio(`assets/sounds/${soundName}.mp3`);
          this.currentAudio = audio;
          return audio.play();
        }
      }

      // For iOS or fallback
      const audio = new Audio(`assets/sounds/${soundName}.mp3`);
      this.currentAudio = audio;
      return audio.play();
    } else {
      // For web platform, show message instead of playing sound
      await this.showToast(
        'Bunyi azan hanya tersedia dalam aplikasi mudah alih.',
        'warning',
      );
      return Promise.resolve();
    }
  }

  async stopAzanSound(): Promise<void> {
    try {
      // Stop web audio if playing
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio = null;
      }

      // Stop native Android audio if playing
      if (this.currentPlayingAssetId) {
        try {
          await AndroidAudio.stopSound();
        } catch (error) {
          console.error('Error stopping Android native audio:', error);
        } finally {
          this.currentPlayingAssetId = null;
        }
      }
    } catch (error) {
      console.error('Error in stopAzanSound:', error);
    }
  }

  /**
   * Determine if we should reschedule notifications
   */
  private shouldReschedule(lastScheduled: string | null): boolean {
    // If never scheduled, we should schedule
    if (!lastScheduled) {
      return true;
    }

    const now = new Date();
    const lastScheduleDate = new Date(lastScheduled);

    // If the last schedule was more than 10 minutes ago, reschedule
    const minutesSinceLastSchedule =
      (now.getTime() - lastScheduleDate.getTime()) / (1000 * 60);

    if (minutesSinceLastSchedule > 10) {
      return true;
    }

    return false;
  }

  /**
   * Log complete notification configuration for debugging
   */
  private logNotificationConfig(
    settings: PrayerNotificationSettings,
    savedPrayerTimes: any,
  ) {
    console.log('=== Notification Configuration Debug ===');
    console.log('Enabled prayers:', settings.enabledPrayers);
    console.log('Selected azan sound:', settings.selectedAzanSound);
    console.log(
      'Notification advance time:',
      settings.notificationAdvance,
      'minutes',
    );
    console.log('Prayer times data:', {
      zone: savedPrayerTimes.zone,
      total_days: savedPrayerTimes.prayers.length,
      first_day: savedPrayerTimes.prayers[0].date,
      last_day:
        savedPrayerTimes.prayers[savedPrayerTimes.prayers.length - 1].date,
    });

    // Check the first day's data structure
    const sampleDay = savedPrayerTimes.prayers[0];
    console.log('Sample prayer data format:', sampleDay);

    // Check the mapping between prayer names and properties
    for (const prayerName of this.PRAYER_NAMES) {
      const property = this.mapPrayerNameToProperty(prayerName);
      const hasTime = property && sampleDay[property];
      console.log(
        `Prayer ${prayerName} maps to property '${property}': ${hasTime ? 'OK' : 'NOT FOUND'}`,
      );
    }
    console.log('========================================');
  }

  /**
   * Schedule all enabled prayer notifications for the next few days
   */
  private async scheduleAllNotifications(): Promise<void> {
    // If process is already locked, just log and return
    if (this.isProcessing) {
      console.log(
        'Already processing notifications, skipping scheduleAllNotifications',
      );
      return;
    }

    this.isProcessing = true;

    try {
      console.log('Starting notification scheduling process...');

      // Cancel any existing scheduled notifications
      await this.cancelAllNotifications();
      if (Capacitor.getPlatform() === 'android') {
        await AndroidAudio.cancelNotification();
      }

      // Get notification settings
      const settings = await this.getNotificationSettings();

      // If no prayers enabled, nothing to schedule
      if (settings.enabledPrayers.length === 0) {
        console.log('No prayers enabled for notifications');

        // Still update the lastScheduled timestamp
        settings.lastScheduled = new Date().toISOString();
        await Preferences.set({
          key: this.PREFERENCES_KEY,
          value: JSON.stringify(settings),
        });

        // Update settings observable
        this.settingsSubject.next(settings);

        return;
      }

      console.log(
        'Scheduling notifications for prayers:',
        settings.enabledPrayers,
      );

      // Get the prayer times for the next few days
      const result = await Preferences.get({ key: 'yearlyPrayerTimes' });
      const savedPrayerTimes = result.value ? JSON.parse(result.value) : null;

      if (!savedPrayerTimes || !savedPrayerTimes.prayers) {
        console.error('No prayer times available to schedule notifications');
        return;
      }

      // Log complete configuration for debugging
      // this.logNotificationConfig(settings, savedPrayerTimes);

      console.log(
        `Found ${savedPrayerTimes.prayers.length} days of prayer times data`,
      );

      const today = new Date();
      const notifications = [];
      let scheduledCount = 0;
      let missingPrayerTimes = 0;

      // Loop through the next MAX_DAYS_AHEAD days
      for (let dayOffset = 0; dayOffset < this.MAX_DAYS_AHEAD; dayOffset++) {
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + dayOffset);

        // Get the prayer times for this date
        const dateStr = this.formatDate(targetDate);
        console.log(`Looking for prayer times for ${dateStr}`);

        const dayPrayers = savedPrayerTimes.prayers.find(
          (p: any) => p.date === dateStr,
        );

        if (!dayPrayers) {
          console.log(`No prayer times found for ${dateStr}`);
          missingPrayerTimes++;
          continue;
        }

        // For each enabled prayer, schedule a notification
        for (const prayerName of settings.enabledPrayers) {
          const prayerProperty = this.mapPrayerNameToProperty(prayerName);

          if (!prayerProperty || !dayPrayers[prayerProperty]) {
            console.log(
              `No time found for ${prayerName} (property: ${prayerProperty}) on ${dateStr}`,
              dayPrayers,
            );
            continue;
          }

          // Get the prayer time
          const timeStr = dayPrayers[prayerProperty];

          // Create a date for the prayer time
          const prayerDateTime = this.createDateFromTimeString(
            targetDate,
            timeStr,
          );

          // Apply notification advance time if set
          if (settings.notificationAdvance > 0) {
            prayerDateTime.setMinutes(
              prayerDateTime.getMinutes() - settings.notificationAdvance,
            );
          }

          // Only schedule if it's in the future
          if (prayerDateTime > new Date()) {
            // Create a unique ID based on date and prayer
            const notificationId = parseInt(
              `${targetDate.getDate()}${targetDate.getMonth() + 1}${this.PRAYER_NAMES.indexOf(prayerName)}`,
              10,
            );

            // Determine channel: default for Imsak, Syuruk, Dhuha; custom for others
            let channelId = this.currentChannelId;
            if (
              prayerName === 'Imsak' ||
              prayerName === 'Syuruk' ||
              prayerName === 'Dhuha'
            ) {
              channelId = this.currentDefaultChannelId;
            }

            // Prepare notification options based on settings
            const notificationOptions: any = {
              id: notificationId,
              title: `Waktu ${prayerName}`,
              body:
                prayerName === 'Imsak' ||
                prayerName === 'Syuruk' ||
                prayerName === 'Dhuha'
                  ? `Sekarang waktu ${prayerName}`
                  : `Sekarang waktu untuk solat ${prayerName}`,
              schedule: { at: prayerDateTime, allowWhileIdle: true },
              channelId: channelId,
              autoCancel: true,
              ongoing: false,
            };

            // Extra Android options - use the channel ID consistently
            if (Capacitor.getPlatform() === 'android') {
              notificationOptions.channelId = channelId;
              notificationOptions.extra = {
                channel_id: channelId,
              };
            }

            notifications.push(notificationOptions);
            scheduledCount++;

            console.log(
              `Scheduled notification for ${prayerName} on ${prayerDateTime.toLocaleString()} (channel: ${channelId})`,
            );
          }
        }
      }

      // Schedule all the notifications at once
      if (notifications.length > 0) {
        await LocalNotifications.schedule({
          notifications: notifications,
        });

        console.log(
          `${notifications.length} notifications scheduled successfully`,
        );
      } else {
        console.log(
          `No notifications to schedule (missing data: ${missingPrayerTimes}, scheduled: ${scheduledCount})`,
        );
      }

      // Always update the lastScheduled timestamp, even if no notifications were scheduled
      // This prevents constant rescheduling attempts
      settings.lastScheduled = new Date().toISOString();

      // Use the Preferences API directly to avoid recursive call to saveNotificationSettings
      await Preferences.set({
        key: this.PREFERENCES_KEY,
        value: JSON.stringify(settings),
      });

      // Update settings observable
      this.settingsSubject.next(settings);
    } catch (error) {
      console.error('Error scheduling notifications:', error);
      // Don't rethrow to avoid breaking the app
    } finally {
      // Always release the lock, even in case of errors
      setTimeout(() => {
        this.isProcessing = false;
      }, 300);
    }
  }

  /**
   * Cancel all scheduled prayer notifications
   */
  private async cancelAllNotifications(): Promise<void> {
    try {
      // Get pending notifications
      const pending = await LocalNotifications.getPending();

      // Cancel pending notifications
      if (pending.notifications.length > 0) {
        const descriptors = pending.notifications.map((n) => ({ id: n.id }));
        await LocalNotifications.cancel({ notifications: descriptors });
        console.log(`Cancelled ${descriptors.length} pending notifications`);
      }
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }
  }

  /**
   * Map prayer name to property name in the API response
   */
  private mapPrayerNameToProperty(prayerName: string): string | null {
    // Map from prayer display names to API property names
    const map: { [key: string]: string } = {
      Imsak: 'imsak',
      Subuh: 'fajr',
      Syuruk: 'syuruk',
      Dhuha: 'dhuha',
      Zuhur: 'dhuhr',
      Asar: 'asr',
      Maghrib: 'maghrib',
      Isyak: 'isha',
      // Add lowercase mappings for case-insensitive lookup
      imsak: 'imsak',
      subuh: 'fajr',
      syuruk: 'syuruk',
      dhuha: 'dhuha',
      zuhur: 'dhuhr',
      asar: 'asr',
      maghrib: 'maghrib',
      isyak: 'isha',
    };

    // Exact match lookup
    return map[prayerName] || null;
  }

  /**
   * Format date as dd-MMM-yyyy for matching prayer times data
   */
  private formatDate(date: Date): string {
    // Format to match the format in prayer times data: "01-Jan-2025"
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  }

  /**
   * Create a Date object from a date and a time string (HH:MM)
   */
  private createDateFromTimeString(date: Date, timeStr: string): Date {
    const result = new Date(date);

    // Reset seconds and milliseconds
    result.setSeconds(0);
    result.setMilliseconds(0);

    // Parse time string (expected format: "HH:MM")
    const timeParts = timeStr.split(':');
    if (timeParts.length >= 2) {
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);

      if (!isNaN(hours) && !isNaN(minutes)) {
        result.setHours(hours, minutes);
      } else {
        console.error(`Invalid time format: ${timeStr}`);
      }
    } else {
      console.error(`Invalid time format: ${timeStr}`);
    }

    return result;
  }

  /**
   * Show a toast message
   */
  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color,
      buttons: [
        {
          text: 'OK',
          role: 'cancel',
        },
      ],
    });

    await toast.present();
  }

  /**
   * Set up notification listeners
   */
  private setupNotificationListeners(): void {
    LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (notification) => {
        console.log('Notification action performed', notification);
        // Navigate to prayer times page when notification is tapped
        this.router.navigate(['/tabs/prayerTimes']);
      },
    );
  }

  /**
   * Open device notification settings
   */
  async openNotificationSettings(): Promise<void> {
    try {
      // For Android, we can use the native app settings
      if (Capacitor.getPlatform() === 'android') {
        // @ts-ignore - This is available in Android
        await Capacitor.Plugins.App.openAppSettings();
      } else if (Capacitor.getPlatform() === 'ios') {
        // On iOS, redirect to app settings through Capacitor
        // @ts-ignore - This is available in iOS
        await Capacitor.Plugins.App.openAppSettings();
      } else {
        // For web, just show a message
        await this.showToast(
          'Sila semak tetapan notifikasi dalam pelayar anda.',
          'info',
        );
      }
    } catch (error) {
      console.error('Error opening notification settings:', error);
      throw error;
    }
  }

  /**
   * Force reschedule all notifications
   */
  async forceRescheduleNotifications(
    showToasts: boolean = true,
  ): Promise<void> {
    try {
      // First make sure we're not in the middle of processing queue
      if (this.processingQueue) {
        console.log('Already processing notification queue, waiting...');
        await new Promise((resolve) => {
          const checkQueue = () => {
            if (!this.processingQueue) {
              resolve(true);
            } else {
              setTimeout(checkQueue, 100);
            }
          };
          checkQueue();
        });
      }

      // Cancel all existing notifications first
      await this.cancelAllNotifications();

      // Then schedule new ones
      await this.scheduleAllNotifications();

      if (showToasts) {
        await this.showToast('Notifikasi telah dijadualkan semula', 'success');
      }
    } catch (error) {
      console.error('Error rescheduling notifications:', error);
      if (showToasts) {
        await this.showToast('Ralat menjadualkan semula notifikasi', 'danger');
      }
      throw error;
    }
  }

  /**
   * Create post notification channel
   */
  private async createPostNotificationChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      return; // Only needed on Android
    }

    try {
      const channels = await LocalNotifications.listChannels();
      // Check for post notification channel
      const hasPostChannel = channels.channels.some(
        (c) => c.id === this.POST_NOTIFICATION_CHANNEL_ID,
      );

      if (!hasPostChannel) {
        // Create post notification channel
        await LocalNotifications.createChannel({
          id: this.POST_NOTIFICATION_CHANNEL_ID,
          name: 'Pengumuman',
          description: 'Notifikasi untuk pengumuman baharu',
          importance: 4 as any,
          visibility: 1 as any,
          lights: true,
          vibration: true,
        });
        console.log('Post notification channel created successfully');
      }
    } catch (error) {
      console.error('Error creating post notification channel:', error);
    }
  }
}
