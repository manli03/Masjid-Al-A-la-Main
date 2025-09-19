import { Component, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import {
  Platform,
  ActionSheetController,
  ModalController,
} from '@ionic/angular';
import { ToastService } from '../services/toast.service';
import { PrayerTimesService } from '../services/prayerTimes.service';
import { PrayerNotificationsService } from '../services/prayer-notifications.service';
import { NotificationSettingsComponent } from '../prayerTimes/notification-settings/notification-settings.component';
import { Device } from '@capacitor/device';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnDestroy {
  loaded: boolean = false;
  prayerNames = ['Subuh', 'Syuruk', 'Zuhur', 'Asar', 'Maghrib', 'Isyak'];
  currentLocation: string = 'Memuatkan lokasi...';
  currentHijriDate: string = '';
  currentTime: string = '';
  remainingTime: string = '';
  prayerTimes: { [key: string]: string } = {}; // For display (12‑hour formatted)
  rawPrayerTimes: { [key: string]: string } = {}; // For calculations (24‑hour strings)
  private intervalId: any;
  isDetectingLocation: boolean = false;
  isDarkMode: boolean = false;
  prayerNotification: { [key: string]: boolean } = {};
  reloadQiblaCompass: boolean = false;
  isProcessingNotifications: boolean = false;
  disabledPrayers: Set<string> = new Set();

  // Properties for tracking calculated state
  currentPrayer: { name: string; time: string; date: Date } | null = null;
  upcomingPrayer: { name: string; time: string; date: Date } | null = null;
  currentPrayerRatio: number = 1; // fraction (remaining/total)
  currentDate: Date = new Date();

  // Properties for back button exit logic
  private exitDelay = 2000; // 2 seconds
  private backButtonSubscription: any;
  private currentToast: HTMLIonToastElement | null = null;
  private processingSubscription: any;
  firstLoad: boolean = false;

  @Output() homePageLoaded = new EventEmitter<boolean>();

  constructor(
    private router: Router,
    private prayerTimesService: PrayerTimesService,
    private platform: Platform,
    private toastService: ToastService,
    private actionSheetController: ActionSheetController,
    private prayerNotificationsService: PrayerNotificationsService,
    private modalController: ModalController,
  ) {}

  async ionViewDidEnter() {
    console.log('Home page entered, starting to load data');

    const info = await Device.getInfo();
    if (info.androidSDKVersion && info.androidSDKVersion >= 35) {
      const headerLocation = document.querySelector(
        '.header-location',
      ) as HTMLElement;
      if (headerLocation) {
        headerLocation.style.paddingTop = '15px';
      }
    }

    // Set loaded to false when entering the view
    this.loaded = false;

    try {
      // Check dark mode
      this.checkDarkMode();

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

      // Load notification status for each prayer
      await this.updatePrayerNotificationStatus();

      // Subscribe to processing state
      this.processingSubscription =
        this.prayerNotificationsService.isProcessing$.subscribe(
          (isProcessing) => {
            this.isProcessingNotifications = isProcessing;
          },
        );

      // Subscribe to disabled prayers
      this.prayerNotificationsService.disabledPrayers$.subscribe(
        (disabledPrayers) => {
          this.disabledPrayers = disabledPrayers;
        },
      );

      // Set loaded to true after everything is loaded
      if (dataLoaded) {
        this.loaded = true;
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

  /**
   * Update notification status for all prayers
   */
  async updatePrayerNotificationStatus() {
    const prayerMap: { [key: string]: string } = {
      subuh: 'Subuh',
      dhuhr: 'Zuhur',
      asr: 'Asar',
      maghrib: 'Maghrib',
      isha: 'Isyak',
    };

    // Reset all notifications
    this.prayerNotification = {
      subuh: false,
      dhuhr: false,
      asr: false,
      maghrib: false,
      isha: false,
    };

    // Check status for each prayer
    for (const [key, value] of Object.entries(prayerMap)) {
      this.prayerNotification[key] =
        await this.prayerNotificationsService.isPrayerNotificationEnabled(
          value,
        );
    }
  }

  /**
   * Toggle notification for a specific prayer
   */
  async togglePrayerNotification(prayerName: string) {
    // Get display name from service
    const prayerDisplayName =
      this.prayerNotificationsService.getDisplayName(prayerName);

    if (!prayerDisplayName) return;

    try {
      // Optimistically update UI first for immediate feedback
      this.prayerNotification[prayerName] =
        !this.prayerNotification[prayerName];

      // Add haptic feedback for better user experience
      if (this.platform.is('capacitor')) {
        try {
          const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
          await Haptics.impact({ style: ImpactStyle.Light });
        } catch (error) {
          console.log('Haptics not available');
        }
      }

      // Toggle notification using the service
      this.prayerNotificationsService
        .togglePrayerNotification(prayerDisplayName)
        .then((success) => {
          // Only handle failure cases
          if (!success) {
            // Revert UI change if failed
            this.prayerNotification[prayerName] =
              !this.prayerNotification[prayerName];
            this.presentToast('Gagal mengemas kini notifikasi', 'danger');
          }
        })
        .catch((error) => {
          console.error('Error toggling prayer notification:', error);
          // Revert UI change in case of error
          this.prayerNotification[prayerName] =
            !this.prayerNotification[prayerName];
          this.presentToast('Ralat mengemas kini notifikasi', 'danger');

          // Refresh the actual state to ensure UI is in sync
          this.updatePrayerNotificationStatus();
        });
    } catch (error) {
      console.error('Error in togglePrayerNotification:', error);
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
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
    if (this.processingSubscription) {
      this.processingSubscription.unsubscribe();
    }
  }

  private async loadPrayerData(isFirstLoad: boolean = true): Promise<boolean> {
    const savedData = await this.prayerTimesService.getSavedYearlyPrayerTimes();
    if (savedData) {
      const zone = savedData.zone;
      this.currentLocation =
        this.prayerTimesService.zoneNames[zone] ||
        this.prayerTimesService.zoneNames['kdh01']; // Default to KDH01
      const today = new Date();
      const formattedDate = this.formatDate(today);
      const prayerData = savedData.prayers.find(
        (p: any) => p.date === formattedDate,
      );
      if (prayerData) {
        // Store the raw 24-hour times for calculation
        this.rawPrayerTimes = {
          subuh: prayerData.fajr,
          syuruk: prayerData.syuruk,
          zuhur: prayerData.dhuhr,
          asar: prayerData.asr,
          maghrib: prayerData.maghrib,
          isyak: prayerData.isha,
        };
        // Store the formatted prayer times (12-hour with no AM/PM) for display
        this.prayerTimes = {
          subuh: this.formatPrayerTime(prayerData.fajr),
          syuruk: this.formatPrayerTime(prayerData.syuruk),
          zuhur: this.formatPrayerTime(prayerData.dhuhr),
          asar: this.formatPrayerTime(prayerData.asr),
          maghrib: this.formatPrayerTime(prayerData.maghrib),
          isyak: this.formatPrayerTime(prayerData.isha),
        };
        this.currentHijriDate = this.formatHijriDate(prayerData.hijri);
      }
      this.startUpdatingTime();
      return true;
    } else {
      // if (!isFirstLoad) {
      //   SplashScreen.hide();
      //   return false;
      // }
      this.prayerTimesService.getDefaultPrayerTimes();
      setTimeout(async () => {
        const loaded = await this.loadPrayerData(false);
        if (loaded) {
          this.loaded = true;
        }
      }, 2000);
      return false;
    }
  }

  private formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    };
    const formattedDate = date.toLocaleDateString('en-MY', options);
    const [day, month, year] = formattedDate.split(' ');
    return `${day}-${month.slice(0, 3)}-${year}`; // Use english format since api use english format
  }

  private formatPrayerTime(time: string): string {
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
      this.currentDate = now; // store current time for later use
      this.currentTime = now.toLocaleTimeString('ms-MY', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      });
      this.calculateRemainingTime(now);
    }, 1000);
  }

  // CalculateRemainingTime to track current prayer
  private calculateRemainingTime(now: Date) {
    // Build an array of today's prayer times using the raw 24-hour times.
    const prayersArray = this.prayerNames.map((name) => {
      const key = name.toLowerCase();
      const rawTime = this.rawPrayerTimes[key];
      const [hours, minutes] = rawTime.split(':').map(Number);
      let prayerDate = new Date(now);
      prayerDate.setHours(hours, minutes, 0, 0);
      // if (key === 'syuruk') {
      //   prayerDate = new Date(prayerDate.getTime() - 28 * 60 * 1000);
      // }
      return { name, time: rawTime, date: prayerDate };
    });

    // Determine upcoming and current prayer.
    if (now < prayersArray[0].date) {
      // Before Subuh – no passed prayer for the new day.
      this.currentPrayer = prayersArray[5];
      this.upcomingPrayer = prayersArray[0];
    } else {
      const upcomingIndex = prayersArray.findIndex((p) => now < p.date);
      if (upcomingIndex === -1) {
        // All prayers passed; current = last prayer, upcoming = first prayer of tomorrow.
        this.currentPrayer = prayersArray[prayersArray.length - 1];
        const firstPrayer = prayersArray[0];
        let tomorrow = new Date(firstPrayer.date);
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.upcomingPrayer = {
          name: firstPrayer.name,
          time: firstPrayer.time,
          date: tomorrow,
        };
      } else {
        // The prayer immediately before upcoming is the current (active) prayer.
        this.currentPrayer =
          upcomingIndex > 0 ? prayersArray[upcomingIndex - 1] : null;
        this.upcomingPrayer = prayersArray[upcomingIndex];
      }
    }

    // Compute the ratio for the active prayer (if any)
    if (this.currentPrayer) {
      if (this.currentPrayer.name.toLowerCase() === 'isyak') {
        // For Isyak, the prayer time might belong to the previous day if now is after 12 AM.
        let currentPrayerTime = this.currentPrayer.date.getTime();
        // If current prayer's time is later than the upcoming prayer's time,
        // then currentPrayer was computed with today's date but should reflect yesterday.
        if (currentPrayerTime > this.upcomingPrayer.date.getTime()) {
          currentPrayerTime -= 24 * 3600 * 1000;
        }
        const totalDuration =
          this.upcomingPrayer.date.getTime() - currentPrayerTime;
        const remainingDuration =
          this.upcomingPrayer.date.getTime() - now.getTime();
        this.currentPrayerRatio = remainingDuration / totalDuration;
      } else {
        const totalDuration =
          this.upcomingPrayer.date.getTime() -
          this.currentPrayer.date.getTime();
        const remainingDuration =
          this.upcomingPrayer.date.getTime() - now.getTime();
        this.currentPrayerRatio = remainingDuration / totalDuration;
      }
      // console.log('ratio', this.currentPrayerRatio);
    } else {
      this.currentPrayerRatio = 1;
    }

    // Update the remaining time display (for the upcoming prayer)
    const diff = this.upcomingPrayer.date.getTime() - now.getTime();
    this.updateRemainingTimeDisplay(diff, this.upcomingPrayer);
    // if (!this.firstLoad) {
    //   SplashScreen.hide();
    //   this.firstLoad = true;
    // }
    this.reloadQiblaCompass = true;
  }

  private updateRemainingTimeDisplay(
    diff: number,
    closestPrayer: { name: string; time: string },
  ) {
    if (closestPrayer && diff >= 0) {
      // Adjust by adding one minute (as in prayerTimes.page)
      let adjustedDiff = diff + 1000 * 60;
      const hoursRemaining = Math.floor(adjustedDiff / (1000 * 3600));
      const minutesRemaining = Math.floor(
        (adjustedDiff % (1000 * 3600)) / (1000 * 60),
      );
      if (diff === 0) {
        this.remainingTime = 'sekarang';
      } else if (hoursRemaining > 0 || minutesRemaining > 0) {
        let currentPrayer = this.currentPrayer?.name;
        if (closestPrayer.name.toLowerCase() === 'zuhur') {
          currentPrayer = 'Zuhur';
          this.remainingTime = `${currentPrayer} akan bermula dalam ${
            hoursRemaining ? hoursRemaining + ' jam ' : ''
          }${minutesRemaining} minit`;
        } else {
          this.remainingTime = `${this.currentPrayer?.name} akan tamat dalam ${
            hoursRemaining ? hoursRemaining + ' jam ' : ''
          }${minutesRemaining} minit`;
        }
      } else {
        this.remainingTime = 'sekarang';
      }
    } else {
      this.remainingTime = 'Tiada solat seterusnya hari ini';
    }
  }

  // Return a header text based on the current prayer.
  getPrayerHeaderText(): string {
    if (!this.loaded || !this.currentPrayer) {
      return 'Mulakan hari anda dengan solat';
    }
    switch (this.currentPrayer.name.toLowerCase()) {
      case 'subuh':
        return 'Mulakan hari dengan solat Subuh';
      case 'syuruk':
        return 'Nikmati matahari terbit';
      case 'zuhur':
        return 'Rehat dan tenangkan jiwa';
      case 'asar':
        return 'Hargai waktu sebelum senja';
      case 'maghrib':
        return 'Syukuri nikmat di penghujung hari';
      case 'isyak':
        return 'Lepaskan lelah dengan ketenangan';
      default:
        return 'Mulakan hari dengan keberkatan';
    }
  }

  // Dark mode detection
  private checkDarkMode() {
    // Check if the document element has the ion-palette-dark class
    this.isDarkMode =
      document.documentElement.classList.contains('ion-palette-dark');

    // Create a MutationObserver to watch for changes to the ion-palette-dark class
    const observer = new MutationObserver(() => {
      this.isDarkMode =
        document.documentElement.classList.contains('ion-palette-dark');
    });

    // Observe changes to the document element class list
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  // --- HELPER: returns today's Subuh Date based on rawPrayerTimes ---
  private getSubuhDate(): Date {
    const subuhRaw = this.rawPrayerTimes['subuh'];
    const [hours, minutes] = subuhRaw.split(':').map(Number);
    let subuhDate = new Date(this.currentDate);
    subuhDate.setHours(hours, minutes, 0, 0);
    return subuhDate;
  }

  getPrayerIconSrc(prayerName: string): string {
    const basePath = '../../assets/icon/';
    const normalizedName = prayerName.toLowerCase();
    const now = this.currentDate;
    const subuhDate = this.getSubuhDate();
    const currentIndex = this.currentPrayer
      ? this.prayerNames.indexOf(this.currentPrayer.name)
      : -1;
    const prayerIndex = this.prayerNames.indexOf(prayerName);

    // For the active (current) prayer, choose green or yellow based on remaining ratio.
    if (this.currentPrayer && prayerName === this.currentPrayer.name) {
      if (this.currentPrayerRatio > 0.3) {
        return `${basePath}${normalizedName}-green.svg`;
      } else {
        return `${basePath}${normalizedName}-yellow.svg`;
      }
    }
    // For passed prayers (only if now is after Subuh – new day check)
    if (this.currentPrayer && prayerIndex < currentIndex && now >= subuhDate) {
      return `${basePath}${normalizedName}-red.svg`;
    }
    // Otherwise (upcoming prayer or before Subuh), use default icon per dark mode.
    return this.isDarkMode
      ? `${basePath}${normalizedName}-white.svg`
      : `${basePath}${normalizedName}.svg`;
  }

  // --- UPDATED getPrayerStyle() ---
  getPrayerStyle(prayerName: string): { color: string } {
    const now = this.currentDate;
    const subuhDate = this.getSubuhDate();
    const currentIndex = this.currentPrayer
      ? this.prayerNames.indexOf(this.currentPrayer.name)
      : -1;
    const prayerIndex = this.prayerNames.indexOf(prayerName);

    if (this.currentPrayer && prayerName === this.currentPrayer.name) {
      return { color: this.currentPrayerRatio > 0.3 ? '#14AE5C' : '#FFD700' };
    }
    if (this.currentPrayer && prayerIndex < currentIndex && now >= subuhDate) {
      return { color: 'red' };
    }
    return { color: 'inherit' };
  }

  async selectLocation() {
    // Group zone codes by state
    const stateGroups: { [state: string]: { code: string; name: string }[] } = {
      Johor: [
        { code: 'jhr01', name: this.prayerTimesService.zoneNames['jhr01'] },
        { code: 'jhr02', name: this.prayerTimesService.zoneNames['jhr02'] },
        { code: 'jhr03', name: this.prayerTimesService.zoneNames['jhr03'] },
        { code: 'jhr04', name: this.prayerTimesService.zoneNames['jhr04'] },
      ],
      Kedah: [
        { code: 'kdh01', name: this.prayerTimesService.zoneNames['kdh01'] },
        { code: 'kdh02', name: this.prayerTimesService.zoneNames['kdh02'] },
        { code: 'kdh03', name: this.prayerTimesService.zoneNames['kdh03'] },
        { code: 'kdh04', name: this.prayerTimesService.zoneNames['kdh04'] },
        { code: 'kdh05', name: this.prayerTimesService.zoneNames['kdh05'] },
        { code: 'kdh06', name: this.prayerTimesService.zoneNames['kdh06'] },
        { code: 'kdh07', name: this.prayerTimesService.zoneNames['kdh07'] },
      ],
      Kelantan: [
        { code: 'ktn01', name: this.prayerTimesService.zoneNames['ktn01'] },
        { code: 'ktn03', name: this.prayerTimesService.zoneNames['ktn03'] },
      ],
      Melaka: [
        { code: 'mlk01', name: this.prayerTimesService.zoneNames['mlk01'] },
      ],
      'Negeri Sembilan': [
        { code: 'ngs01', name: this.prayerTimesService.zoneNames['ngs01'] },
        { code: 'ngs02', name: this.prayerTimesService.zoneNames['ngs02'] },
      ],
      Pahang: [
        { code: 'phg01', name: this.prayerTimesService.zoneNames['phg01'] },
        { code: 'phg02', name: this.prayerTimesService.zoneNames['phg02'] },
        { code: 'phg03', name: this.prayerTimesService.zoneNames['phg03'] },
        { code: 'phg04', name: this.prayerTimesService.zoneNames['phg04'] },
        { code: 'phg05', name: this.prayerTimesService.zoneNames['phg05'] },
        { code: 'phg06', name: this.prayerTimesService.zoneNames['phg06'] },
      ],
      Perlis: [
        { code: 'pls01', name: this.prayerTimesService.zoneNames['pls01'] },
      ],
      'Pulau Pinang': [
        { code: 'png01', name: this.prayerTimesService.zoneNames['png01'] },
      ],
      Perak: [
        { code: 'prk01', name: this.prayerTimesService.zoneNames['prk01'] },
        { code: 'prk02', name: this.prayerTimesService.zoneNames['prk02'] },
        { code: 'prk03', name: this.prayerTimesService.zoneNames['prk03'] },
        { code: 'prk04', name: this.prayerTimesService.zoneNames['prk04'] },
        { code: 'prk05', name: this.prayerTimesService.zoneNames['prk05'] },
        { code: 'prk06', name: this.prayerTimesService.zoneNames['prk06'] },
        { code: 'prk07', name: this.prayerTimesService.zoneNames['prk07'] },
      ],
      Sabah: [
        { code: 'sbh01', name: this.prayerTimesService.zoneNames['sbh01'] },
        { code: 'sbh02', name: this.prayerTimesService.zoneNames['sbh02'] },
        { code: 'sbh03', name: this.prayerTimesService.zoneNames['sbh03'] },
        { code: 'sbh04', name: this.prayerTimesService.zoneNames['sbh04'] },
        { code: 'sbh05', name: this.prayerTimesService.zoneNames['sbh05'] },
        { code: 'sbh06', name: this.prayerTimesService.zoneNames['sbh06'] },
        { code: 'sbh07', name: this.prayerTimesService.zoneNames['sbh07'] },
        { code: 'sbh08', name: this.prayerTimesService.zoneNames['sbh08'] },
        { code: 'sbh09', name: this.prayerTimesService.zoneNames['sbh09'] },
      ],
      Selangor: [
        { code: 'sgr01', name: this.prayerTimesService.zoneNames['sgr01'] },
        { code: 'sgr02', name: this.prayerTimesService.zoneNames['sgr02'] },
        { code: 'sgr03', name: this.prayerTimesService.zoneNames['sgr03'] },
      ],
      Sarawak: [
        { code: 'swk01', name: this.prayerTimesService.zoneNames['swk01'] },
        { code: 'swk02', name: this.prayerTimesService.zoneNames['swk02'] },
        { code: 'swk03', name: this.prayerTimesService.zoneNames['swk03'] },
        { code: 'swk04', name: this.prayerTimesService.zoneNames['swk04'] },
        { code: 'swk05', name: this.prayerTimesService.zoneNames['swk05'] },
        { code: 'swk06', name: this.prayerTimesService.zoneNames['swk06'] },
        { code: 'swk07', name: this.prayerTimesService.zoneNames['swk07'] },
        { code: 'swk08', name: this.prayerTimesService.zoneNames['swk08'] },
        { code: 'swk09', name: this.prayerTimesService.zoneNames['swk09'] },
      ],
      Terengganu: [
        { code: 'trg01', name: this.prayerTimesService.zoneNames['trg01'] },
        { code: 'trg02', name: this.prayerTimesService.zoneNames['trg02'] },
        { code: 'trg03', name: this.prayerTimesService.zoneNames['trg03'] },
        { code: 'trg04', name: this.prayerTimesService.zoneNames['trg04'] },
      ],
      'Wilayah Persekutuan': [
        { code: 'wly01', name: this.prayerTimesService.zoneNames['wly01'] },
        { code: 'wly02', name: this.prayerTimesService.zoneNames['wly02'] },
      ],
    };

    // Build grouped buttons with headers
    const buttons: any[] = [];

    // Add automatic location detection option at the top
    buttons.push({
      text: '📍 Gunakan Lokasi Semasa (Automatik)',
      cssClass: 'location-option',
      handler: () => {
        this.getAutomaticLocation();
      },
    });

    const stateIcons: { [state: string]: string } = {
      Johor: '🟦',
      Kedah: '🟩',
      Kelantan: '🟧',
      Melaka: '🟫',
      'Negeri Sembilan': '🟪',
      Pahang: '🟨',
      Perlis: '⬜',
      'Pulau Pinang': '🟦',
      Perak: '⬛',
      Sabah: '🟧',
      Selangor: '🟪',
      Sarawak: '🟩',
      Terengganu: '🟦',
      'Wilayah Persekutuan': '⭐',
    };
    Object.keys(stateGroups).forEach((state) => {
      buttons.push({
        text: `${stateIcons[state] || ''} ${state}`,
        role: 'header',
        cssClass: 'state-header',
        handler: () => {}, // No action for header
      });
      stateGroups[state].forEach((zone) => {
        buttons.push({
          text: zone.name,
          handler: () => {
            this.currentLocation = zone.name;
            this.getManualPrayerTimes(zone.code);
          },
        });
      });
    });

    // Add a Cancel button at the end
    buttons.push({
      text: 'Cancel',
      role: 'cancel',
      handler: () => {
        console.log('Cancelled');
      },
    });

    const actionSheet = await this.actionSheetController.create({
      header: 'Pilih Lokasi Anda',
      buttons: buttons,
    });
    await actionSheet.present();
  }

  // New function to fetch manual prayer times based on the selected zone.
  getManualPrayerTimes(selectedZone: string) {
    this.prayerTimesService.getPrayerTimes(selectedZone, 'year').subscribe(
      (data) => {
        if (data.status === 'OK!') {
          const yearlyPrayerTimes: any = data.prayerTime || [];
          // Save the fetched times into localStorage via the service
          this.prayerTimesService.saveYearlyPrayerTimes(
            selectedZone,
            yearlyPrayerTimes,
          );
          // Optionally, re-initialize data on the page (for example, reload prayer times display)
          this.loadPrayerData();
        } else {
          console.log('Failed to fetch manual prayer times.');
          this.presentToast('Gagal untuk mendapatkan waktu solat.', 'danger');
        }
      },
      (error) => {
        console.error(error);
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
        this.prayerTimesService.presentToast(
          `✅ Lokasi dikesan: ${this.prayerTimesService.zoneNames[detectedZone]}`,
          'success',
        );

        // Step 5: Update prayer times with the detected zone
        await this.prayerTimesService.refreshDataWithLocation(detectedZone);

        // Step 6: Update the current location display
        this.currentLocation =
          this.prayerTimesService.zoneNames[detectedZone] ||
          this.prayerTimesService.zoneNames['kdh01'];

        // Step 7: Reload prayer data to reflect the new zone
        await this.loadPrayerData();
      } else {
        this.presentToast(
          '❌ Gagal mengesan lokasi. Sila cuba lagi.',
          'danger',
        );
      }
    } catch (error: any) {
      console.error('Error detecting location:', error);
      let errorMessage = 'Ralat sewaktu mengesan lokasi';

      if (error.message) {
        if (error.message.includes('GPS')) {
          errorMessage =
            'GPS tidak diaktifkan. Sila aktifkan GPS dan cuba lagi.';
        } else if (error.message.includes('permission')) {
          errorMessage =
            'Kebenaran lokasi diperlukan. Sila benarkan akses lokasi.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Ralat rangkaian. Sila periksa sambungan internet.';
        } else if (error.message.includes('Koordinat')) {
          errorMessage = 'Koordinat lokasi tidak sah. Sila cuba lagi.';
        }
      }

      this.presentToast(`❌ ${errorMessage}`, 'danger');
    } finally {
      this.isDetectingLocation = false;
    }
  }

  // Helper method to show toast messages
  async presentToast(message: string, color: string) {
    await this.toastService.presentToast(message, color);
  }

  navigateToPrayerTimes() {
    this.router.navigate(['/tabs/prayerTimes']);
  }

  async handleRefresh(event: CustomEvent) {
    this.loaded = false;
    const dataLoaded = await this.loadPrayerData();
    if (dataLoaded) {
      this.loaded = true;
    }
    (event.target as HTMLIonRefresherElement).complete();
    this.updatePrayerNotificationStatus();
  }

  /**
   * Open notification settings modal
   */
  async openNotificationSettings() {
    const modal = await this.modalController.create({
      component: NotificationSettingsComponent,
      cssClass: 'notification-settings-modal',
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data?.saved) {
        // Update notification status if settings were saved
        await this.updatePrayerNotificationStatus();
      }
    });

    return await modal.present();
  }

  /**
   * Check if a specific prayer is currently disabled
   */
  isPrayerDisabled(prayerName: string): boolean {
    return this.disabledPrayers.has(prayerName);
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
