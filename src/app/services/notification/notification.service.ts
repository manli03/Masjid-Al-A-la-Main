import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor() {}

  async requestPermission() {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display === 'granted') {
      console.log('Notification permission granted');
    }
  }

  async scheduleNotifications(prayerName: string) {
    const prayerTimes = await Preferences.get({ key: 'yearlyPrayerTimes' });
    if (!prayerTimes.value) return;

    const times = JSON.parse(prayerTimes.value);
    const notifications = [];
    const today = new Date();

    for (let i = 0; i < 3; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];

      if (times[prayerName] && times[prayerName][dateString]) {
        const [hour, minute] = times[prayerName][dateString].split(':');

        const notificationTime = new Date();
        notificationTime.setDate(date.getDate());
        notificationTime.setHours(parseInt(hour), parseInt(minute), 0, 0);

        notifications.push({
          title: 'Prayer Reminder',
          body: `It's time for ${prayerName}`,
          schedule: { at: notificationTime },
          id: parseInt(`${date.getDate()}${hour}${minute}`),
        });
      }
    }

    await LocalNotifications.schedule({ notifications });
    console.log('Notifications scheduled:', notifications);

    LocalNotifications.addListener(
      'localNotificationActionPerformed',
      async () => {
        const pending = await LocalNotifications.getPending();

        if (pending.notifications.length === 0) {
          console.log('All notifications sent, rescheduling next 3 days...');
          const selectedPrayer = await Preferences.get({
            key: 'selectedPrayerName',
          });
          if (selectedPrayer.value) {
            await this.scheduleNotifications(selectedPrayer.value);
          }
        }
      }
    );
  }
}
