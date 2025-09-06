import { Component, OnInit } from '@angular/core';
import { ModalController, ToastController, IonicModule } from '@ionic/angular';
import {
  PrayerNotificationsService,
  PrayerNotificationSettings,
} from '../../services/prayer-notifications.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-notification-settings',
  templateUrl: './notification-settings.component.html',
  styleUrls: ['./notification-settings.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
})
export class NotificationSettingsComponent implements OnInit {
  prayerNames: string[] = [
    'Imsak',
    'Subuh',
    'Syuruk',
    'Dhuha',
    'Zuhur',
    'Asar',
    'Maghrib',
    'Isyak',
  ];

  // Notification settings
  notificationSettings: PrayerNotificationSettings = {
    enabledPrayers: [],
    selectedAzanSound: 'azan1',
    notificationAdvance: 0,
    azanVolume: 1.0, // Default volume (100%)
    lastScheduled: null,
    currentChannelId: '', // Will be populated from service
    currentDefaultChannelId: '', // Will be populated from service
  };

  // Reference to available azan sounds from service
  availableSounds: any[] = [];
  isAzanPlaying: boolean = false;
  isNativePlatform: boolean = false;

  advanceTimeOptions = [
    { value: 0, label: 'Tepat pada waktu' },
    { value: 5, label: '5 minit sebelum' },
    { value: 10, label: '10 minit sebelum' },
    { value: 15, label: '15 minit sebelum' },
    { value: 30, label: '30 minit sebelum' },
  ];

  isLoading = false;

  constructor(
    private modalCtrl: ModalController,
    private prayerNotificationsService: PrayerNotificationsService,
    private toastController: ToastController,
  ) {
    // Check if running on native platform
    this.isNativePlatform = Capacitor.isNativePlatform();
  }

  async ngOnInit() {
    this.isLoading = true;

    try {
      // Get available sounds from service
      this.availableSounds = this.prayerNotificationsService.availableSounds;

      // Load current notification settings
      const settings =
        await this.prayerNotificationsService.getNotificationSettings();
      this.notificationSettings = {
        ...this.notificationSettings,
        ...settings,
      };
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async togglePrayerNotification(prayerName: string) {
    // Only update local state
    if (this.notificationSettings.enabledPrayers.includes(prayerName)) {
      this.notificationSettings.enabledPrayers =
        this.notificationSettings.enabledPrayers.filter(
          (p) => p !== prayerName,
        );
    } else {
      this.notificationSettings.enabledPrayers.push(prayerName);
    }
  }

  async saveSettings() {
    this.isLoading = true;

    try {
      // Save and reschedule all notification with new settings
      await this.prayerNotificationsService.saveNotificationSettings(
        this.notificationSettings,
      );

      this.showToast('Tetapan notifikasi telah disimpan', 'success');
      this.dismiss();
    } catch (error) {
      console.error('Error saving notification settings:', error);
      this.showToast('Ralat menyimpan tetapan notifikasi', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async playAzanPreview() {
    if (this.notificationSettings.selectedAzanSound === 'none') {
      this.showToast(
        'Azan senyap dipilih. Tiada bunyi untuk dimainkan.',
        'warning',
      );
      return;
    }

    try {
      this.isAzanPlaying = true;

      // Show loading toast for better UX
      const loadingToast = await this.toastController.create({
        message: 'Memainkan bunyi azan...',
        duration: 1000,
        position: 'bottom',
        color: 'primary',
      });
      await loadingToast.present();

      // If on web and not a native app
      if (!this.isNativePlatform) {
        // The service will show a toast with appropriate message
        await this.prayerNotificationsService.playAzanSound(
          this.notificationSettings.selectedAzanSound,
        );
        // For web, immediately reset the playing state since there's no actual sound
        this.isAzanPlaying = false;
        return;
      }

      // For native platforms, play the sound with current UI volume (not saved volume)
      console.log(
        `Playing azan sound: ${this.notificationSettings.selectedAzanSound} with volume: ${this.notificationSettings.azanVolume}`,
      );
      await this.prayerNotificationsService.playAzanSound(
        this.notificationSettings.selectedAzanSound,
        this.notificationSettings.azanVolume, // Use current UI volume, not saved volume
      );

      // We leave isAzanPlaying as true until stopAzanPreview is called
    } catch (error) {
      console.error('Error playing azan preview:', error);
      this.showToast('Ralat memainkan bunyi azan', 'danger');
      this.isAzanPlaying = false;
    }
  }

  async stopAzanPreview() {
    try {
      await this.prayerNotificationsService.stopAzanSound();
      this.isAzanPlaying = false;
    } catch (error) {
      console.error('Error stopping azan preview:', error);
      this.showToast('Ralat menghentikan bunyi azan', 'danger');
    }
  }

  // Add toggleAzanPreview method
  async toggleAzanPreview() {
    if (this.isAzanPlaying) {
      await this.stopAzanPreview();
    } else {
      await this.playAzanPreview();
    }
  }

  ngOnDestroy() {
    if (this.isAzanPlaying) {
      this.stopAzanPreview();
    }
  }

  dismiss() {
    this.modalCtrl.dismiss({
      saved: true,
    });
  }

  cancel() {
    this.modalCtrl.dismiss({
      saved: false,
    });
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  // Called when the user changes the selected sound
  soundChanged() {
    console.log(
      `Sound changed to: ${this.notificationSettings.selectedAzanSound}`,
    );
    // If a sound is playing, stop it
    if (this.isAzanPlaying) {
      this.stopAzanPreview();
    }
  }

  // Called when the user changes the volume
  onVolumeChange(event: any) {
    const volume = event.detail.value;
    console.log(`Volume changed to: ${volume}`);

    // If sound is currently playing, update volume in real-time
    if (this.isAzanPlaying) {
      this.prayerNotificationsService.setAzanVolume(volume);
    }
  }

  // Increase volume by 5%
  increaseVolume() {
    const newVolume = Math.min(1.0, this.notificationSettings.azanVolume + 0.05);
    this.notificationSettings.azanVolume = Math.round(newVolume * 20) / 20; // Round to nearest 5%
    console.log(`Volume increased to: ${this.notificationSettings.azanVolume}`);

    // If sound is currently playing, update volume in real-time
    if (this.isAzanPlaying) {
      this.prayerNotificationsService.setAzanVolume(this.notificationSettings.azanVolume);
    }
  }

  // Decrease volume by 5%
  decreaseVolume() {
    const newVolume = Math.max(0.1, this.notificationSettings.azanVolume - 0.05);
    this.notificationSettings.azanVolume = Math.round(newVolume * 20) / 20; // Round to nearest 5%
    console.log(`Volume decreased to: ${this.notificationSettings.azanVolume}`);

    // If sound is currently playing, update volume in real-time
    if (this.isAzanPlaying) {
      this.prayerNotificationsService.setAzanVolume(this.notificationSettings.azanVolume);
    }
  }
}
