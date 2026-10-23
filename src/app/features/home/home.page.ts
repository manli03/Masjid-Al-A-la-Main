import { Component, OnDestroy } from '@angular/core';
import { DailyWisdomService } from './daily-wisdom.service';
import {
  Platform,
  ModalController,
} from '@ionic/angular';
import { ToastService } from '../../core/feedback/toast.service';
import { PrayerTimesService } from '../prayer/services/prayer-times.service';
import { NotificationSettingsComponent } from '../prayer/components/notification-settings/notification-settings.component';
import { PrayerZoneSelectorComponent } from '../prayer/components/prayer-zone-selector/prayer-zone-selector.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnDestroy {
  loaded: boolean = false;
  currentLocation: string = 'Memuatkan lokasi...';
  currentZoneCode: string = 'kdh01';
  currentHijriDate: string = '';
  remainingTime: string = '';
  rawPrayerTimes: { [key: string]: string } = {}; // For calculations (24‑hour strings)
  private intervalId: any;
  isDetectingLocation: boolean = false;

  upcomingPrayer: { name: string; time: string; date: Date } | null = null;
  currentDate: Date = new Date();

  // Properties for back button exit logic
  private exitDelay = 2000; // 2 seconds
  private backButtonSubscription: any;
  private currentToast: HTMLIonToastElement | null = null;
  private retryTimeout: any;
  private defaultDataRequested = false;
  private dataRetryCount = 0;
  private prayerDateKey = '';

  constructor(
    private prayerTimesService: PrayerTimesService,
    private platform: Platform,
    private toastService: ToastService,
    private modalController: ModalController,
    public dailyWisdom: DailyWisdomService,
  ) {}

  ionViewWillEnter() {
    void this.dailyWisdom.refresh();
  }

  async ionViewDidEnter() {
    console.log('Home page entered, starting to load data');

    try {
      // Load prayer data
      const dataLoaded = await this.loadPrayerData();

      // Subscribe to the hardware back button on the Home page
      this.backButtonSubscription =
        this.platform.backButton.subscribeWithPriority(10, async () => {
          if (!this.currentToast) {
            this.currentToast = await this.toastService.presentToastImmediate(
              'Tekan kembali lagi untuk keluar',
              {
                duration: this.exitDelay,
                position: 'top',
              },
            );
            // When the toast is dismissed, reset the reference.
            this.currentToast.onDidDismiss().then(() => {
              this.currentToast = null;
            });
          } else {
            // If the toast is already visible and back is pressed again, exit the app.
            (navigator as any)['app'].exitApp();
          }
        });

      // Set loaded to true after everything is loaded
      if (dataLoaded) {
        this.loaded = true;
      } else {
        this.loaded = true;
        this.schedulePrayerDataRetry();
      }
      console.log('Home page fully loaded, notifying app component');

      // Notify the app component that home page is fully loaded
      this.notifyAppLoaded();
    } catch (error) {
      console.error('Error loading home page:', error);
      // Even on error, we should hide the loading screen
      this.loaded = true;
      this.notifyAppLoaded();
    }
  }

  ionViewWillLeave() {
    // Unsubscribe to avoid multiple subscriptions when leaving the Home page
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
      this.backButtonSubscription = null;
    }
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
  }

  private async loadPrayerData(): Promise<boolean> {
    const savedData = await this.prayerTimesService.getSavedYearlyPrayerTimes();
    if (savedData) {
      const zone = savedData.zone;
      this.currentZoneCode = String(zone).toLowerCase();
      this.currentLocation =
        this.prayerTimesService.zoneNames[zone] ||
        this.prayerTimesService.zoneNames['kdh01']; // Default to KDH01
      const today = new Date();
      const formattedDate = this.prayerTimesService.formatDate(today);
      this.prayerDateKey = formattedDate;
      const prayerData = savedData.prayers.find(
        (p: any) => p.date === formattedDate,
      );
      if (prayerData) {
        this.rawPrayerTimes = {
          subuh: prayerData.fajr,
          zuhur: prayerData.dhuhr,
          asar: prayerData.asr,
          maghrib: prayerData.maghrib,
          isyak: prayerData.isha,
        };
        this.currentHijriDate = this.formatHijriDate(prayerData.hijri);
        this.currentDate = today;
        this.calculateRemainingTime(today);
        this.startUpdatingTime();
        return true;
      }
      this.upcomingPrayer = null;
      this.currentHijriDate = '';
    } else {
      this.currentLocation = 'Zon belum dipilih';
    }

    if (!this.defaultDataRequested) {
      this.defaultDataRequested = true;
      void this.prayerTimesService.getDefaultPrayerTimes();
    }
    return false;
  }

  private schedulePrayerDataRetry() {
    if (this.dataRetryCount >= 5 || this.retryTimeout) return;
    this.dataRetryCount += 1;
    this.retryTimeout = setTimeout(async () => {
      this.retryTimeout = null;
      if (await this.loadPrayerData()) {
        this.loaded = true;
      } else {
        this.schedulePrayerDataRetry();
      }
    }, 2000);
  }

  formatPrayerTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date
      .toLocaleTimeString('ms-MY', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      })
      .replace(/ (AM|PM|PG|PTG)/, ''); // Remove AM/PM
  }

  private formatHijriDate(hijriDate: string): string {
    const [hijriYear, hijriMonth, hijriDay] = hijriDate.split('-');
    const malayMonths = [
      'Muharram',
      'Safar',
      'Rabiulawal',
      'Rabiulakhir',
      'Jamadilawal',
      'Jamadilakhir',
      'Rejab',
      'Syaban',
      'Ramadan',
      'Syawal',
      'Zulkaedah',
      'Zulhijjah',
    ];
    return `${hijriDay} ${malayMonths[parseInt(hijriMonth) - 1]} ${hijriYear}`;
  }

  private startUpdatingTime() {
    // Clear any existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(() => {
      const now = new Date();
      this.currentDate = now;
      if (this.prayerTimesService.formatDate(now) !== this.prayerDateKey) {
        void this.loadPrayerData();
        return;
      }
      this.calculateRemainingTime(now);
    }, 30_000);
  }

  private calculateRemainingTime(now: Date) {
    const schedule = [
      { name: 'Subuh', key: 'subuh' },
      { name: 'Zuhur', key: 'zuhur' },
      { name: 'Asar', key: 'asar' },
      { name: 'Maghrib', key: 'maghrib' },
      { name: 'Isyak', key: 'isyak' },
    ].map(({ name, key }) => {
      const [hours, minutes] = this.rawPrayerTimes[key].split(':').map(Number);
      const date = new Date(now);
      date.setHours(hours, minutes, 0, 0);
      return { name, time: this.rawPrayerTimes[key], date };
    });

    const nextPrayer = schedule.find((prayer) => prayer.date > now);
    let upcomingPrayer = nextPrayer;
    if (!upcomingPrayer) {
      const firstPrayer = schedule[0];
      const tomorrow = new Date(firstPrayer.date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      upcomingPrayer = { ...firstPrayer, date: tomorrow };
    }
    this.upcomingPrayer = upcomingPrayer;

    this.updateRemainingTimeDisplay(
      upcomingPrayer.date.getTime() - now.getTime(),
    );
  }

  private updateRemainingTimeDisplay(diff: number) {
    if (diff >= 0) {
      const minutesRemaining = Math.ceil(diff / (1000 * 60));
      if (minutesRemaining <= 1) {
        this.remainingTime = 'Sebentar lagi';
      } else {
        const hoursRemaining = Math.floor(minutesRemaining / 60);
        const leftoverMinutes = minutesRemaining % 60;
        this.remainingTime = hoursRemaining
          ? `Dalam ${hoursRemaining} jam${leftoverMinutes ? ` ${leftoverMinutes} minit` : ''}`
          : `Dalam ${leftoverMinutes} minit`;
      }
    } else {
      this.remainingTime = 'Tiada solat seterusnya hari ini';
    }
  }

  async selectLocation() {
    const modal = await this.modalController.create({
      component: PrayerZoneSelectorComponent,
      componentProps: { currentZoneCode: this.currentZoneCode },
      cssClass: 'prayer-zone-sheet',
      breakpoints: [0, 0.58, 0.78, 0.92],
      initialBreakpoint: 0.78,
      handle: true,
      handleBehavior: 'cycle',
      backdropBreakpoint: 0.35,
    });
    await modal.present();

    const { data, role } = await modal.onDidDismiss<{
      zone?: { code: string; name: string };
    }>();
    if (role === 'selected' && data?.zone) {
      this.currentZoneCode = data.zone.code;
      this.currentLocation = data.zone.name;
      this.getManualPrayerTimes(data.zone.code);
    } else if (role === 'current-location') {
      await this.getAutomaticLocation();
    }
  }

  // New function to fetch manual prayer times based on the selected zone.
  getManualPrayerTimes(selectedZone: string) {
    this.currentZoneCode = selectedZone;
    this.loaded = false;
    this.prayerTimesService.getPrayerTimes(selectedZone, 'year').subscribe(
      async (data) => {
        if (data.status === 'OK!') {
          const yearlyPrayerTimes: any = data.prayerTime || [];
          await this.prayerTimesService.saveYearlyPrayerTimes(
            selectedZone,
            yearlyPrayerTimes,
            data.bearing,
            'zone',
          );
          this.loaded = await this.loadPrayerData();
        } else {
          console.log('Failed to fetch manual prayer times.');
          this.loaded = true;
          this.presentToast('Gagal untuk mendapatkan waktu solat.', 'danger');
        }
      },
      (error) => {
        console.error(error);
        this.loaded = true;
        this.presentToast('Ralat sewaktu mendapatkan data.', 'danger');
      },
    );
  }

  // Function to automatically detect user's location and set prayer times
  async getAutomaticLocation() {
    try {
      // Step 1: Show GPS dialog once (if GPS is disabled)
      await this.prayerTimesService.checkGpsStatus();

      // Step 2: Smart retry mechanism - check GPS status up to 10 times with 500ms intervals
      let gpsEnabled = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        if (await this.prayerTimesService.isGpsEnabled()) {
          gpsEnabled = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms between checks
      }

      if (!gpsEnabled) {
        this.presentToast(
          '❌ GPS tidak diaktifkan. Sila aktifkan GPS dan cuba lagi.',
          'danger',
        );
        return;
      }

      // Step 3: GPS is enabled! Show loading spinner and proceed with location detection
      this.isDetectingLocation = true;

      // Step 4: Get current location and zone using the service
      const detectedZone = await this.prayerTimesService.getCurrentLocation();

      if (detectedZone) {
        this.currentZoneCode = detectedZone;
        // Step 5: Update prayer times with the detected zone
        await this.prayerTimesService.refreshDataWithLocation(detectedZone);

        // Step 6: Update the current location display
        this.currentLocation =
          this.prayerTimesService.zoneNames[detectedZone] ||
          this.prayerTimesService.zoneNames['kdh01'];

        // Step 7: Reload prayer data to reflect the new zone
        this.loaded = await this.loadPrayerData();
        if (!this.loaded) this.schedulePrayerDataRetry();
      } else {
        this.presentToast(
          '❌ Gagal mengesan lokasi. Sila cuba lagi.',
          'danger',
        );
      }
    } catch (error: any) {
      console.error('Error detecting location:', error);
      if (error === 'Permintaan lokasi dibatalkan') return;

      if (error === 'Kebenaran lokasi ditolak') {
        // Show alert dialog to open app settings
        this.prayerTimesService.showOpenSettingsDialog();
        return; // Don't show additional error toast
      }

      this.presentToast(`❌ ${error}`, 'danger');
    } finally {
      this.isDetectingLocation = false;
    }
  }

  // Helper method to show toast messages
  async presentToast(message: string, color: string) {
    await this.toastService.presentToast(message, color);
  }

  async handleRefresh(event: CustomEvent) {
    void this.dailyWisdom.refresh();
    this.loaded = false;
    const dataLoaded = await this.loadPrayerData();
    this.loaded = true;
    if (!dataLoaded) this.schedulePrayerDataRetry();
    (event.target as HTMLIonRefresherElement).complete();
  }

  /**
   * Open notification settings modal
   */
  async openNotificationSettings() {
    const modal = await this.modalController.create({
      component: NotificationSettingsComponent,
      cssClass: 'notification-settings-modal',
    });

    return await modal.present();
  }

  // Notify the app component that home page is fully loaded
  private notifyAppLoaded() {
    console.log('Dispatching homePageLoaded event');
    const event = new CustomEvent('homePageLoaded', {
      detail: { loaded: true },
      bubbles: true, // Ensure the event bubbles up through the DOM
      composed: true, // Allows the event to cross the shadow DOM boundary
    });
    window.dispatchEvent(event);
  }
}
