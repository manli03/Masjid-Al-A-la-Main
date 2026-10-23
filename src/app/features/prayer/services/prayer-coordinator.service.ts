import { Injectable } from '@angular/core';
import { PrayerTimesService } from './prayer-times.service';
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
    // Prayer data must load independently of notification permission.
    await this.prayerTimesService.initializePrayerTimes();
    console.log('Prayer times initialized');

    // Step 3: Schedule notifications if needed
    await this.prayerNotificationsService.checkPermissionAndSchedule();
  }
}
