import { Injectable } from '@angular/core';
import { LocalNotifications, Channel } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { ToastService } from './toast.service';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { BehaviorSubject } from 'rxjs';
import AndroidAudio from '../plugins/android-audio';
import {
  AndroidSettings,
  IOSSettings,
  NativeSettings,
} from 'capacitor-native-settings';

// Define notification settings interface
export interface PrayerNotificationSettings {
  enabledPrayers: string[];
  lastScheduled: string | null;
  selectedAzanSound: string;
  notificationAdvance: number;
  azanVolume: number; // New: Azan volume (0.0 to 1.0)
  currentChannelId?: string;
  currentDefaultChannelId?: string;
}

// Define interface for custom AndroidAudio plugin
interface AndroidAudioPlugin {
  playSound(resourceName: string): void;
  stopSound(): void;
  cancelNotification(): void;
  setNotification(): void;
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
    'Imsak',
    'Subuh',
    'Syuruk',
    'Dhuha',
    'Zuhur',
    'Asar',
    'Maghrib',
    'Isyak',
  ];

  // Prayer name mapping for internal to display names
  private readonly PRAYER_NAME_MAP: { [key: string]: string } = {
    subuh: 'Subuh',
    dhuhr: 'Zuhur',
    asr: 'Asar',
    maghrib: 'Maghrib',
    isha: 'Isyak',
    imsak: 'Imsak',
    syuruk: 'Syuruk',
    dhuha: 'Dhuha',
  };

  // Key for storing notification preferences
  private readonly PREFERENCES_KEY = 'prayer_notifications';

  // Max days to schedule ahead
  private readonly MAX_DAYS_AHEAD = 1;

  // Track if notification operations are in progress to prevent double-clicking
  private isProcessing = false;
  private isSavingSettings = false;
  private pendingPrayerToggles: Map<string, boolean> = new Map();
  private pendingSettings: PrayerNotificationSettings | null = null;
  private processingQueue = false;
  private processingQueueTimeout: any = null;

  // Track which specific prayers are disabled (in queue or processing)
  private disabledPrayers: Set<string> = new Set();

  // Observable for notification settings
  private settingsSubject =
    new BehaviorSubject<PrayerNotificationSettings | null>(null);

  // Observable for processing state
  private processingSubject = new BehaviorSubject<boolean>(false);

  // Observable for disabled prayers
  private disabledPrayersSubject = new BehaviorSubject<Set<string>>(new Set());

  // Expose settings as observable
  public settings$ = this.settingsSubject.asObservable();

  // Expose processing state as observable
  public isProcessing$ = this.processingSubject.asObservable();

  // Expose disabled prayers as observable
  public disabledPrayers$ = this.disabledPrayersSubject.asObservable();

  // Available azan sounds
  public readonly availableSounds = [
    {
      id: 'none',
      name: 'Notifikasi telefon',
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
    private toastService: ToastService,
    private router: Router,
  ) {
    // Set up notification listeners
    this.setupNotificationListeners();
  }

  /**
   * Initialize notifications service - request permissions and create channels
   */
  async initializeNotifications(): Promise<boolean> {
    try {
      // Request permission first
      const permResult = await LocalNotifications.requestPermissions();

      if (permResult.display !== 'prompt' && permResult.display !== 'granted') {
        // Show custom toast with OK button that opens notification settings
        await this.toastService.presentToastImmediate(
          'Notifikasi tidak dibenarkan. Sila aktifkan kebenaran notifikasi untuk menerima peringatan waktu solat.',
          {
            duration: 5000,
            position: 'top',
            color: 'warning',
            buttons: [
              {
                text: 'OK',
                role: 'cancel',
                handler: async () => {
                  await this.openNotificationSettings();
                },
              },
            ],
          }
        );
        return false;
      }

      // Create post notification channel for announcements
      if (Capacitor.getPlatform() === 'android') {
        await this.createPostNotificationChannel();
      }

      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  async checkToScheduleNotifications(): Promise<void> {
    // Check if we need to schedule/reschedule notifications
    const settings = await this.getNotificationSettings();
    if (this.shouldReschedule(settings.lastScheduled)) {
      console.log('Notification schedule outdated, rescheduling at startup...');
      await this.scheduleAllNotifications();
    } else {
      console.log(
        'Notifications are up to date, no rescheduling needed at startup',
      );
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

      // Add prayer to disabled set to prevent further clicks
      this.disabledPrayers.add(normalizedPrayerName);
      this.disabledPrayersSubject.next(new Set(this.disabledPrayers));

      // Schedule processing of the queue
      this.scheduleQueueProcessing();

      return true;
    } catch (error) {
      console.error('Error toggling prayer notification:', error);
      return false;
    }
  }

  /**
   * Get display name for a prayer from internal name
   */
  getDisplayName(internalName: string): string {
    return this.PRAYER_NAME_MAP[internalName.toLowerCase()] || internalName;
  }

  /**
   * Check if a specific prayer is currently disabled (in queue or processing)
   */
  isPrayerDisabled(prayerName: string): boolean {
    return this.disabledPrayers.has(prayerName);
  }

  /**
   * Update processing state and emit to subscribers
   */
  private updateProcessingState(): void {
    const isProcessing = this.processingQueue || this.isSavingSettings || this.isProcessing;
    this.processingSubject.next(isProcessing);
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

    // Update processing state
    this.updateProcessingState();
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
      this.updateProcessingState();

      // Get current settings
      const settings = await this.getNotificationSettings();
      let changed = false;
      const processedPrayers: string[] = [];

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

        // Track processed prayers
        processedPrayers.push(prayer);
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

      // Remove all processed prayers from disabled set
      for (const prayer of processedPrayers) {
        this.disabledPrayers.delete(prayer);
      }
      this.disabledPrayersSubject.next(new Set(this.disabledPrayers));
    } catch (error) {
      console.error('Error processing prayer toggle queue:', error);
    } finally {
      this.processingQueue = false;
      this.processingQueueTimeout = null;
      this.updateProcessingState();

      // Check if new toggles came in while we were processing
      if (this.pendingPrayerToggles.size > 0) {
        this.scheduleQueueProcessing();
      }
    }
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
      // Default settings with all prayers enabled
      const defaultSettings: PrayerNotificationSettings = {
        enabledPrayers: [...this.PRAYER_NAMES],
        lastScheduled: null,
        selectedAzanSound: 'azan8', // Default sound
        notificationAdvance: 0,
        azanVolume: 1.0, // Default volume (100%)
      };

      // Save default settings to storage so Android can find them
      try {
        await Preferences.set({
          key: this.PREFERENCES_KEY,
          value: JSON.stringify(defaultSettings),
        });
        console.log('Default notification settings saved to storage');
      } catch (error) {
        console.error('Error saving default notification settings:', error);
      }

      // Update settings observable
      this.settingsSubject.next(defaultSettings);
      console.log(
        'No settings found, using default settings:',
        defaultSettings,
      );

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
      azanVolume: parsedSettings.azanVolume || 1.0, // Default to 100% if not set
    };

    // Update settings observable
    this.settingsSubject.next(settings);

    console.log(
      'Settings found, using previously Loaded notification settings:',
      settings,
    );

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
      this.updateProcessingState();

      // Save settings to storage first
      await Preferences.set({
        key: this.PREFERENCES_KEY,
        value: JSON.stringify(settings),
      });

      // Update the settings observable
      this.settingsSubject.next(settings);

      // Schedule notifications with new settings
      await this.scheduleAllNotifications();

      console.log('Prayer notification settings saved');
    } catch (error) {
      console.error('Error saving prayer notification settings:', error);
      throw error;
    } finally {
      this.isSavingSettings = false;
      this.updateProcessingState();

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
   * Play azan sound for preview
   */
  private currentAudio: HTMLAudioElement | null = null;
  private currentPlayingAssetId: string | null = null;

  async playAzanSound(soundName: string, volume?: number): Promise<void> {
    // Stop any currently playing sound first
    await this.stopAzanSound();

    // Get current settings to use the saved volume if not provided
    const settings = await this.getNotificationSettings();
    const soundVolume = volume !== undefined ? volume : settings.azanVolume;

    // Handle differently based on platform
    if (Capacitor.isNativePlatform()) {
      // For native platforms (Android/iOS)
      if (Capacitor.getPlatform() === 'android') {
        try {
          console.log(
            `Playing Android native sound: ${soundName} with volume: ${soundVolume}`,
          );

          // On Android, use our custom plugin to play the sound with volume
          this.currentPlayingAssetId = soundName;
          await AndroidAudio.playSound({
            resourceName: soundName,
            volume: soundVolume,
          });
          return;
        } catch (error) {
          console.error('Error playing native audio:', error);
          // Fall back to web audio if native playback fails
          const audio = new Audio(`assets/sounds/${soundName}.mp3`);
          this.currentAudio = audio;
          audio.volume = soundVolume;
          return audio.play();
        }
      }

      // For iOS or fallback
      const audio = new Audio(`assets/sounds/${soundName}.mp3`);
      this.currentAudio = audio;
      audio.volume = soundVolume;
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
   * Set volume for currently playing azan sound
   */
  async setAzanVolume(volume: number): Promise<void> {
    try {
      // Clamp volume between 0.1 and 1.0
      const clampedVolume = Math.max(0.1, Math.min(1.0, volume));

      if (
        Capacitor.isNativePlatform() &&
        Capacitor.getPlatform() === 'android'
      ) {
        // For Android, use the setVolume method
        await AndroidAudio.setVolume({ volume: clampedVolume });
        console.log(`Set Android azan volume to: ${clampedVolume}`);
      } else if (this.currentAudio) {
        // For web, set volume directly on audio element
        this.currentAudio.volume = clampedVolume;
        console.log(`Set web azan volume to: ${clampedVolume}`);
      }
    } catch (error) {
      console.error('Error setting azan volume:', error);
    }
  }

  /**
   * Determine if we should reschedule notifications
   */
  private shouldReschedule(lastScheduled: string | null): boolean {
    // If never scheduled, we should schedule
    console.log(
      'Checking if reschedule is needed, lastScheduled:',
      lastScheduled,
    );
    if (!lastScheduled) {
      return true;
    }

    const now = new Date();
    const lastScheduleDate = new Date(lastScheduled);

    // If the last schedule was more than 24 hours ago, reschedule
    const hoursSinceLastSchedule =
      (now.getTime() - lastScheduleDate.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastSchedule > 24) {
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

      // Get notification settings
      const settings = await this.getNotificationSettings();

      // Schedule notification using AndroidAudio plugin
      if (Capacitor.getPlatform() === 'android') {
        try {
          await AndroidAudio.setNotification();
        } catch (error) {
          console.error(
            'Error scheduling Android notification using AndroidAudio plugin:',
            error,
          );
        }
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
      // Cancel all notifications in the system
      if (Capacitor.getPlatform() === 'android') {
        await AndroidAudio.cancelNotification();
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
    await this.toastService.presentToast(message, color);
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
      // Set flag to indicate we opened settings
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('notificationSettingsOpened', 'true');
      }

      if (Capacitor.getPlatform() === 'android') {
        await NativeSettings.open({
          optionAndroid: AndroidSettings.AppNotification,
          optionIOS: IOSSettings.AppNotification,
        });
      } else if (Capacitor.getPlatform() === 'ios') {
        await NativeSettings.open({
          optionAndroid: AndroidSettings.AppNotification,
          optionIOS: IOSSettings.AppNotification,
        });
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
   * Check notification permission and schedule notifications if enabled
   */
  async checkPermissionAndSchedule(): Promise<void> {
    try {
      const permResult = await LocalNotifications.checkPermissions();

      if (permResult.display === 'granted') {
        console.log('Notification permission granted, scheduling notifications...');
        await this.checkToScheduleNotifications();
      } else {
        console.log('Notification permission still denied');
      }
    } catch (error) {
      console.error('Error checking notification permission:', error);
    }
  }

  /**
   * Force reschedule all notifications
   */
  async forceRescheduleNotifications(
    showToasts: boolean = false,
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
   * Create post notification channel for announcements
   */
  private async createPostNotificationChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      return; // Only needed on Android
    }

    try {
      const channels = await LocalNotifications.listChannels();
      // Check for post notification channel
      const hasPostChannel = channels.channels.some(
        (c) => c.id === 'post_notifications',
      );

      if (!hasPostChannel) {
        // Create post notification channel
        await LocalNotifications.createChannel({
          id: 'post_notifications',
          name: 'Pengumuman',
          description: 'Notifikasi untuk pengumuman baharu',
          importance: 4,
          visibility: 1,
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
