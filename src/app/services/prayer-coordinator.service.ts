import { Injectable } from '@angular/core';
import { PrayerTimesService } from './prayerTimes.service';
import { PrayerNotificationsService } from './prayer-notifications.service';

@Injectable({
  providedIn: 'root',
})
export class PrayerCoordinatorService {
  constructor(
    private prayerTimesService: PrayerTimesService,
    private prayerNotificationsService: PrayerNotificationsService,
  ) {}

  async initialize(): Promise<void> {
    // Step 1: Initialize notifications
    const notificationsReady =
      await this.prayerNotificationsService.initializeNotifications();
    if (!notificationsReady) return;

    // Step 2: Initialize prayer times (fetch or update as needed)
    await this.prayerTimesService.initializePrayerTimes();
    console.log('Prayer times initialized');

    // Step 3: Schedule notifications if needed
    await this.prayerNotificationsService.checkToScheduleNotifications();
  }
}
