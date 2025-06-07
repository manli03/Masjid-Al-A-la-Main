import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { environment } from 'src/environments/environment';
import { StorageService } from './storage.service';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class FcmService {
  private apiUrl = environment.apiUrl;

  constructor(
    private storageService: StorageService,
    private http: HttpClient,
    private router: Router,
  ) {
    if (Capacitor.isNativePlatform()) {
      this.initializePushNotifications();
    }
  }

  // Public method to initialize FCM after sign in
  async setFcmToken() {
    if (Capacitor.isNativePlatform()) {
      try {
        await this.addListeners();
      } catch (error) {
        console.error('Error initializing FCM:', error);
      }
    }
  }

  private async initializePushNotifications() {
    await this.registerNotifications();
    this.addListeners();
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

  private async registerNotifications() {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      throw new Error('User denied permissions!');
    }

    // Register for push notifications
    await PushNotifications.register();
  }

  public async getDeliveredNotifications() {
    const notificationList =
      await PushNotifications.getDeliveredNotifications();
    console.log('Delivered notifications', notificationList);
  }

  private async sendTokenToServer(token: string) {
    // Check if user is logged in
    const user = await this.storageService.get('user');
    if (!user) {
      console.error('User not logged in, cannot send token to server');
      return;
    }
    const userId = await this.getUserIdFromDatabase(); // Fetch user ID from database
    const response = await fetch(`${this.apiUrl}/store_token.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, userId }),
    });

    const responseJson = await response.json();
    if (responseJson.success) {
      console.log('Token sent to server successfully');
    } else {
      console.error('Failed to send token to server:', responseJson.message);
    }
  }

  private async getUserIdFromDatabase(): Promise<string> {
    const user = await this.storageService.get('user');

    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/auth.php`, {
          action: 'get_user_details',
          email: user.email,
        }),
      );

      if (response.success && response.user) {
        console.info('User ID from database:', response.user.id);
        return response.user.id;
      } else if (response.error === 'Pengguna tidak dijumpai') {
        return '';
      } else {
        console.error('Error checking user id from database:', response.error);
        return '';
      }
    } catch (error) {
      console.error('Error checking user id from database:', error);
      return '';
    }
  }
}
