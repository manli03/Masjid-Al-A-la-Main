import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { PushNotifications } from '@capacitor/push-notifications';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { environment } from 'src/environments/environment';
import { StorageService } from './storage.service';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { PrayerNotificationsService } from './prayer-notifications.service';

@Injectable({
  providedIn: 'root',
})
export class FcmService {
  private apiUrl = environment.apiUrl;

  constructor(
    private storageService: StorageService,
    private http: HttpClient,
    private router: Router,
    private prayerNotificationsService: PrayerNotificationsService,
  ) {
    if (Capacitor.isNativePlatform()) {
      this.addListeners();
    }
  }

  private async addListeners() {
    await PushNotifications.addListener('registration', (token) => {
      console.info('Registration token: ', token.value);
      this.sendTokenToServer(token.value);
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('Registration error: ', err.error);
    });

    await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        console.log('Push notification received: ', notification);
        // Handle the notification (e.g., show an alert or update the UI)
      },
    );

    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification) => {
        console.log(
          'Push notification action performed',
          notification.actionId,
          notification.inputValue,
          notification.notification,
        );
        // Navigate to the announcement page
        this.handleNotificationClick(notification.notification);
      },
    );
  }

  private handleNotificationClick(notification: any) {
    console.log('Handling notification click with data:', notification);

    // Check different possible locations of the ID in the notification object
    const announcementId =
      notification.data?.announcementId || // Check custom data
      notification.announcementId || // Check direct property
      notification.data?.id || // Check generic id
      (typeof notification === 'string' ? notification : null); // Check if it's just the ID

    console.log('Extracted announcement ID:', announcementId);

    if (announcementId) {
      // Use the correct tabs path
      const route = `/tabs/announcement/${announcementId}`;
      console.log('Navigating to:', route);
      this.router.navigate(['/tabs/announcement'], {
        queryParams: { id: announcementId },
      });
    } else {
      console.warn('No announcement ID found in notification:', notification);
      // Fallback to main announcement page
      this.router.navigate(['/tabs/announcement']);
    }
  }

  async registerNotifications() {
    if (!Capacitor.isNativePlatform()) {
      console.warn(
        'Push notifications are only available on native platforms.',
      );
      return;
    }

    const notificationsEnabled = await this.prayerNotificationsService.initializeNotifications();

    if (!notificationsEnabled) {
      console.warn('Notifications are not enabled, aborting FCM registration.');
      return;
    }
    
    // Register for push notifications
    await PushNotifications.register();
  }

  public async getDeliveredNotifications() {
    const notificationList =
      await PushNotifications.getDeliveredNotifications();
    console.log('Delivered notifications', notificationList);
  }

  /**
   * Get the FCM token of the current device, if available.
   * The token is stored locally when registration succeeds so that
   * logout can tell the backend which device's token to remove.
   */
  public async getLocalFcmToken(): Promise<string | null> {
    try {
      const result = await SecureStoragePlugin.get({ key: 'fcmToken' });
      if (result && result.value) {
        return JSON.parse(result.value);
      }
    } catch (e) {
      // No token stored yet
    }
    return null;
  }

  private async sendTokenToServer(token: string) {
    // Check if user is logged in
    const user = await this.storageService.get('user');
    if (!user) {
      console.error('User not logged in, cannot send token to server');
      return;
    }
    
    // Get the ID token from secure storage directly (avoids circular dependency with AuthService)
    let idToken: string | null = null;
    try {
      const result = await SecureStoragePlugin.get({ key: 'idToken' });
      if (result && result.value) {
        idToken = JSON.parse(result.value);
      }
    } catch (e) {
      console.error('Could not get ID token from secure storage');
    }
    
    if (!idToken) {
      console.error('No auth token available, cannot send FCM token');
      return;
    }

    // Collect device metadata for better token management/multi-device support
    let deviceInfo: { name: string; platform: string } = {
      name: Capacitor.getPlatform(),
      platform: Capacitor.getPlatform(),
    };
    try {
      const info = await Device.getInfo();
      deviceInfo = {
        name: `${info.model || 'Unknown device'}`, // e.g. "Pixel 7"
        platform: `${info.platform}/${info.osVersion || 'unknown'}`, // e.g. "android/13"
      };
    } catch (e) {
      console.warn('Could not retrieve device info, using fallback:', e);
    }

    const response = await fetch(`${this.apiUrl}/store_token.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token, deviceInfo }),
    });

    const responseJson = await response.json();
    if (responseJson.success) {
      // Store the token locally so logout can remove only this device's token
      try {
        await SecureStoragePlugin.set({
          key: 'fcmToken',
          value: JSON.stringify(token),
        });
      } catch (e) {
        console.warn('Could not store FCM token locally:', e);
      }
      console.log('Token sent to server successfully');
    } else {
      console.error('Failed to send token to server:', responseJson.message);
    }
  }
}