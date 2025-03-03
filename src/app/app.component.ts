import { Component } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import '@angular/common/locales/global/ms';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { BackgroundRunner } from '@capacitor/background-runner';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor() {
    // Check permission and register background task
    this.requestPermission();
    if (Capacitor.getPlatform() !== 'web') {
      this.registerBackgroundTask();
    }

    self.addEventListener('myCustomEvent', async () => {
      console.log('Background task executed');
      // Check if all notifications are finished
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length === 0) {
        console.log('All notifications sent, rescheduling next 3 days...');
        // Reschedule notifications for the next 3 days
        const selectedPrayer = await Preferences.get({
          key: 'prayerNotification',
        });
        // Check if a prayer is selected and schedule notifications if so
        if (selectedPrayer.value) {
          const prayerNotification = JSON.parse(selectedPrayer.value);
          const activePrayer = Object.keys(prayerNotification).find(
            (prayer) => prayerNotification[prayer]
          );
          if (activePrayer) {
            // Get the yearly prayer times from storage
            const yearlyPrayerTimes = await Preferences.get({
              key: 'yearlyPrayerTimes',
            });
            if (yearlyPrayerTimes.value) {
              const prayerTimes = JSON.parse(yearlyPrayerTimes.value);
              const today = new Date();
              const notifications = [];
              // Schedule notifications for the next 3 days
              for (let i = 0; i < 3; i++) {
                const date = new Date();
                date.setDate(today.getDate() + i);
                const dateString = date.toISOString().split('T')[0];
                // Check if the active prayer is available for the given date
                if (
                  prayerTimes.prayers[activePrayer] &&
                  prayerTimes.prayers[activePrayer][dateString]
                ) {
                  // Extract the hour and minute from the prayer time
                  const [hour, minute] =
                    prayerTimes.prayers[activePrayer][dateString].split(':');
                  const notificationTime = new Date();
                  notificationTime.setDate(date.getDate());
                  notificationTime.setHours(
                    parseInt(hour),
                    parseInt(minute),
                    0,
                    0
                  );
                  // Create a notification for the given date and time
                  notifications.push({
                    title: 'Prayer Reminder',
                    body: `It's time for ${activePrayer}`,
                    schedule: { at: notificationTime },
                    id: parseInt(`${date.getDate()}${hour}${minute}`),
                  });
                }
              }
              // Schedule the notifications
              await LocalNotifications.schedule({ notifications });
              console.log('Notifications rescheduled');
            }
          }
        }
      }
    });
  }

  async requestPermission() {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display === 'granted') {
      console.log('Notification permission granted');
    }
    if (Capacitor.getPlatform() !== 'web') {
      await BackgroundRunner.requestPermissions({ apis: ['notifications'] });
    }
  }

  async registerBackgroundTask() {
    await BackgroundRunner.dispatchEvent({
      label: 'com.mjidala.prayer.background.task',
      event: 'myCustomEvent',
      details: {},
    });
    console.log('Background task registered');
  }
}
