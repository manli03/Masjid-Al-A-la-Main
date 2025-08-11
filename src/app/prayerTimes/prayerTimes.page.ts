import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { PrayerTimesService } from '../services/prayerTimes.service';
import {
  ToastController,
  ModalController,
  Platform,
} from '@ionic/angular';
import { LocationService } from '../services/geolocation.service';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs/internal/firstValueFrom';
import { PrayerNotificationsService } from '../services/prayer-notifications.service';
import { NotificationSettingsComponent } from './notification-settings/notification-settings.component';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import * as htmlToImage from 'html-to-image';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Define the prayer type
interface Prayer {
  name: string;
  time: string;
  date: string;
  notificationEnabled?: boolean;
}

@Component({
  selector: 'app-prayerTimes',
  templateUrl: './prayerTimes.page.html',
  styleUrls: ['./prayerTimes.page.scss'],
})
export class prayerTimesPage implements OnInit {
  @ViewChild('yearlyTable', { static: false }) yearlyTable!: ElementRef;
  // Add ViewChild for the shareable content div to ensure it exists before trying to access it
  @ViewChild('prayerTimesToShareContainer', { static: false })
  prayerTimesToShareContainer!: ElementRef<HTMLDivElement>;
  loaded: boolean = false;
  isDarkMode: boolean = false;
  prayers: Prayer[] = [];
  clickedRow: any = null;
  closestPrayer: string | null = null;
  remainingTime: string = '';
  location: string = 'Zon tidak dikenali';
  currentDate: Date = new Date();
  currentHijriDate: string = '';
  zone: string = 'KDH01'; // Default zone code for Kubang Pasu
  showYearlyPrayerTimes: boolean = false;
  yearlyPrayers: any[] = [];
  userLocation: string = '';
  lastUpdated: string = '';
  private intervalId: any;
  isLoading: boolean = false;
  closestPrayerTime: any;
  sameData: boolean = false;
  notificationsEnabled: boolean = false;
  backButtonSubscription: any;
  justDeselected: any;

  constructor(
    private prayerTimesService: PrayerTimesService,
    private locationService: LocationService,
    private toastController: ToastController,
    private router: Router,
    private prayerNotificationsService: PrayerNotificationsService,
    private modalController: ModalController,
    private platform: Platform,
  ) {}

  async ngOnInit() {
    // First initialize notifications service
    this.notificationsEnabled =
      await this.prayerNotificationsService.initializeNotifications();

    // Then initialize prayer times which will trigger notification status update
    await this.initializePrayerTimes();

    this.checkDarkMode();
  }

  // Handle page resume
  ionViewWillEnter() {
    this.loaded = false;
    this.initializePrayerTimes();

    // Back button logic
    this.backButtonSubscription =
      this.platform.backButton.subscribeWithPriority(10, () => {
        if (this.justDeselected) {
          // If we just deselected, consume this back press and reset the flag
          console.log('Consumed back press after deselection.');
          this.justDeselected = false;
          return; // Stop further processing in this handler
        }
        if (this.showYearlyPrayerTimes) {
          this.backToMainPrayerTimes();
          this.justDeselected = true; // Set the flag to indicate we just deselected
        } else {
          this.router.navigateByUrl('/tabs/home');
        }
      });
  }

  ionViewWillLeave() {
    // Unsubscribe to avoid multiple subscriptions when entering the announcement page
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
      this.backButtonSubscription = null;
    }
  }

  ngOnDestroy() {
    // Stop the interval when the component is destroyed to prevent memory leaks
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('Interval cleared');
    }
    // Clean up subscription to prevent memory leaks
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
  }

  checkDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.isDarkMode = prefersDark.matches;
    prefersDark.addEventListener('change', (e) => {
      this.isDarkMode = e.matches;
    });
  }

  async initializePrayerTimes() {
    try {
      // Get the saved data from localStorage if available
      const savedData =
        await this.prayerTimesService.getSavedYearlyPrayerTimes();

      if (savedData) {
        // Load saved yearly prayers from localStorage
        this.yearlyPrayers = savedData.prayers;
        this.zone = savedData.zone;

        // Fetch the full zone name from the mapping object
        const fullZoneName =
          this.zoneNames[this.zone] ||
          'KDH01 - Kota Setar, Kubang Pasu, Pokok Sena (Daerah Kecil)';

        // Update the location to display the full zone name
        this.location = fullZoneName;

        // Get the last updated timestamp from localStorage
        this.lastUpdated = this.formatTimestamp(savedData.timestamp);

        // Fetch today's prayer times and wait for it to complete
        await this.fetchTodayPrayerTimes();
        this.startUpdatingRemainingTime();
      } else {
        await this.fetchNewData();
      }
    } catch (error) {
      console.error('Error initializing prayer times:', error);
      await this.showError('Error loading prayer times');
    }
  }

  // Fetch new data from API
  refreshData() {
    this.fetchNewData();
  }

  // Function to refresh data from API
  async fetchNewData(): Promise<void> {
    this.sameData = false;
    try {
      // Get the user's current location
      const positionPromise = this.getCurrentLocation();
      const position = await positionPromise;

      if (!position) {
        return;
      }

      // Update prayer times and location
      await this.getLocationAndUpdatePrayerTimes(position);

      setTimeout(async () => {
        if (this.sameData) {
          // Show a success toast message
          await this.presentToast(
            'Data waktu solat adalah terkini.',
            'success',
          );
          this.sameData = false; // Reset the flag
        } else {
          // Show a success toast message
          await this.presentToast(
            'Data waktu solat harian telah dikemaskini! Sila periksa semula masa solat harian anda.',
            'success',
          );
        }
      }, 1000);
    } catch (error) {
      // Show an error toast message
      setTimeout(() => this.presentToast('' + error, 'danger'), 1000);
    } finally {
      // Set isLoading to false after 1 second
      setTimeout(() => (this.isLoading = false), 1000);
    }
  }

  // Helper function to format timestamp to 'dd MMM yyyy, h:mm a' format
  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('ms-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',

      hour12: true,
    });
  }

  // Get current location from LocationService
  async getCurrentLocation(): Promise<string> {
    try {
      if (Capacitor.getPlatform() === 'android') {
        const isGpsEnabled = await this.locationService.checkGpsStatus();
        if (!isGpsEnabled) {
          console.log('GPS is not enabled');
          await this.presentToast(
            'GPS tidak diaktifkan. Sila aktifkan GPS untuk menggunakan perkhidmatan lokasi.',
            'danger',
          );
          return '';
        }
      }

      this.isLoading = true;

      // Get current location
      const position = await this.locationService.getCurrentLocation();
      console.log('Current location:', position);

      // Call the new API to fetch the user zone code based on latitude and longitude
      try {
        const zoneResponse = await firstValueFrom(
          this.prayerTimesService.getUserZoneCode(
            position.coords.latitude,
            position.coords.longitude,
          ),
        );
        const zoneCode = zoneResponse.data.attributes.jakim_code; // Extract the 'jakim_code'
        return zoneCode;
      } catch (error) {
        console.error('Error getting zone code:', error);
        this.isLoading = false;
        await this.presentToast(
          'Koordinat tidak sah. Sila cuba lagi.',
          'danger',
        );
        return '';
      }
    } catch (error) {
      console.error('Error getting location:', error);
      this.isLoading = false;
      await this.presentToast('' + error, 'danger');
      return '';
    }
  }

  // Fetch and update prayer times if no data saved in localStorage
  async getLocationAndUpdatePrayerTimes(currentLocation: string) {
    this.zone = currentLocation;

    // Fetch the full zone name from the mapping object
    const fullZoneName = this.zoneNames[this.zone] || 'Zon Tidak Dikenali';

    // Update the location to display the full zone name
    this.location = fullZoneName;

    // Fetch yearly prayer times from API
    this.fetchYearlyPrayerTimes();
  }

  // Method to fetch prayer times for the updated date
  async fetchTodayPrayerTimes() {
    const formattedDate = this.formatDate(this.currentDate);
    // Find the prayer times for the selected date in yearlyPrayers
    const selectedPrayer = this.yearlyPrayers.find(
      (prayer) => prayer.date === formattedDate,
    );

    if (selectedPrayer) {
      this.prayers = [
        {
          name: 'Imsak',
          time: selectedPrayer.imsak,
          date: selectedPrayer.date,
        },
        { name: 'Subuh', time: selectedPrayer.fajr, date: selectedPrayer.date },
        {
          name: 'Syuruk',
          time: selectedPrayer.syuruk,
          date: selectedPrayer.date,
        },
        {
          name: 'Dhuha',
          time: selectedPrayer.dhuha,
          date: selectedPrayer.date,
        },
        {
          name: 'Zuhur',
          time: selectedPrayer.dhuhr,
          date: selectedPrayer.date,
        },
        { name: 'Asar', time: selectedPrayer.asr, date: selectedPrayer.date },
        {
          name: 'Maghrib',
          time: selectedPrayer.maghrib,
          date: selectedPrayer.date,
        },
        { name: 'Isyak', time: selectedPrayer.isha, date: selectedPrayer.date },
      ];

      // Format the Hijri date using Malay language
      this.currentHijriDate = this.formatHijriDate(selectedPrayer.hijri);
      this.currentDate = new Date(selectedPrayer.date);

      // Always update notification status after prayer times are set
      if (this.notificationsEnabled) {
        await this.updatePrayerNotificationStatus();
      }
    } else {
      await this.showError('Tiada waktu solat untuk hari ini.');
    }
  }

  // Helper function to format Hijri date in Malay
  formatHijriDate(hijriDate: string): string {
    const hijriDateParts = hijriDate.split('-'); // Assuming the format is YYYY-MM-DD
    const [hijriYear, hijriMonth, hijriDay] = hijriDateParts;

    // Malay Hijri month names
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

    // Return Hijri date in Malay (using normal digits for the day and year)
    const malayDate = `${hijriDay} ${
      malayMonths[parseInt(hijriMonth) - 1]
    } ${hijriYear}`;
    return malayDate;
  }

  // Helper function to format Date to 'dd-MMM-yyyy'
  formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    };
    return date.toLocaleDateString('en-MY', options).replace(/ /g, '-'); // Convert to 'dd-MMM-yyyy' format
  }

  // Fetch yearly prayer times and save them to localStorage
  fetchYearlyPrayerTimes() {
    this.prayerTimesService.getPrayerTimes(this.zone, 'year').subscribe(
      async (data) => {
        const savedData =
          await this.prayerTimesService.getSavedYearlyPrayerTimes();
        if (data.status === 'OK!') {
          if (
            savedData &&
            savedData.prayers &&
            JSON.stringify(data.prayerTime) ===
              JSON.stringify(savedData.prayers)
          ) {
            // If the data is the same, don't update
            this.sameData = true;
            return;
          }
          const yearlyPrayerTimes = data.prayerTime || [];
          this.yearlyPrayers = yearlyPrayerTimes;
          this.prayerTimesService.saveYearlyPrayerTimes(
            this.zone,
            yearlyPrayerTimes,
          ); // Save to localStorage
          this.initializePrayerTimes();
        } else {
          this.showError('Gagal untuk mendapatkan waktu solat tahunan');
          this.currentHijriDate = '';
        }
      },
      (error) => {
        this.showError('Terjadi ralat sewaktu mendapatkan waktu solat tahunan');
      },
    );
  }

  // Handle errors
  async showError(message: string) {
    await this.presentToast(message, 'danger');
  }

  // Zone names mapping
  zoneNames: { [key: string]: string } = {
    jhr01: 'JHR01 - Pulau Aur dan Pulau Pemanggil',
    jhr02: 'JHR02 - Johor Bharu, Kota Tinggi, Mersing',
    jhr03: 'JHR03 - Kluang, Pontian',
    jhr04: 'JHR04 - Batu Pahat, Muar, Segamat, Gemas Johor',
    kdh01: 'KDH01 - Kota Setar, Kubang Pasu, Pokok Sena (Daerah Kecil)',
    kdh02: 'KDH02 - Kuala Muda, Yan, Pendang',
    kdh03: 'KDH03 - Padang Terap, Sik',
    kdh04: 'KDH04 - Baling',
    kdh05: 'KDH05 - Bandar Baharu, Kulim',
    kdh06: 'KDH06 - Langkawi',
    kdh07: 'KDH07 - Gunung Jerai',
    ktn01:
      'KTN01 - Bachok, Kota Bharu, Machang, Pasir Mas, Pasir Puteh, Tanah Merah, Tumpat, Kuala Krai, Mukim Chiku',
    ktn03: 'KTN03 - Gua Musang (Daerah Galas Dan Bertam), Jeli',
    mlk01: 'MLK01 - SELURUH NEGERI MELAKA',
    ngs01: 'NGS01 - Tampin, Jempol',
    ngs02: 'NGS02 - Jelebu, Kuala Pilah, Port Dickson, Rembau, Seremban',
    phg01: 'PHG01 - Pulau Tioman',
    phg02: 'PHG02 - Kuantan, Pekan, Rompin, Muadzam Shah',
    phg03: 'PHG03 - Jerantut, Temerloh, Maran, Bera, Chenor, Jengka',
    phg04: 'PHG04 - Bentong, Lipis, Raub',
    phg05: 'PHG05 - Genting Sempah, Janda Baik, Bukit Tinggi',
    phg06: 'PHG06 - Cameron Highlands, Genting Higlands, Bukit Fraser',
    pls01: 'PLS01 - Kangar, Padang Besar, Arau',
    png01: 'PNG01 - Seluruh Negeri Pulau Pinang',
    prk01: 'PRK01 - Tapah, Slim River, Tanjung Malim',
    prk02:
      'PRK02 - Kuala Kangsar, Sg. Siput (Daerah Kecil), Ipoh, Batu Gajah, Kampar',
    prk03: 'PRK03 - Lenggong, Pengkalan Hulu, Grik',
    prk04: 'PRK04 - Temengor, Belum',
    prk05:
      'PRK05 - Kg Gajah, Teluk Intan, Bagan Datuk, Seri Iskandar, Beruas, Parit, Lumut, Sitiawan, Pulau Pangkor',
    prk06: 'PRK06 - Selama, Taiping, Bagan Serai, Parit Buntar',
    prk07: 'PRK07 - Bukit Larut',
    sbh01:
      'SBH01 - Bahagian Sandakan (Timur), Bukit Garam, Semawang, Temanggong, Tambisan, Bandar Sandakan',
    sbh02:
      'SBH02 - Beluran, Telupid, Pinangah, Terusan, Kuamut, Bahagian Sandakan (Barat)',
    sbh03:
      'SBH03 - Lahad Datu, Silabukan, Kunak, Sahabat, Semporna, Tungku, Bahagian Tawau (Timur)',
    sbh04:
      'SBH04 - Bandar Tawau, Balong, Merotai, Kalabakan, Bahagian Tawau (Barat)',
    sbh05: 'SBH05 - Kudat, Kota Marudu, Pitas, Pulau Banggi, Bahagian Kudat',
    sbh06: 'SBH06 - Gunung Kinabalu',
    sbh07:
      'SBH07 - Kota Kinabalu, Ranau, Kota Belud, Tuaran, Penampang, Papar, Putatan, Bahagian Pantai Barat',
    sbh08:
      'SBH08 - Pensiangan, Keningau, Tambunan, Nabawan, Bahagian Pendalaman (Atas)',
    sbh09:
      'SBH09 - Beaufort, Kuala Penyu, Sipitang, Tenom, Long Pa Sia, Membakut, Weston, Bahagian Pendalaman (Bawah)',
    sgr01:
      'SGR01 - Gombak, Petaling, Sepang, Hulu Langat, Hulu Selangor, Rawang, S.Alam',
    sgr02: 'SGR02 - Kuala Selangor, Sabak Bernam',
    sgr03: 'SGR03 - Klang, Kuala Langat',
    swk01: 'SWK01 - Limbang, Lawas, Sundar, Trusan',
    swk02: 'SWK02 - Miri, Niah, Bekenu, Sibuti, Marudi',
    swk03: 'SWK03 - Pandan, Belaga, Suai, Tatau, Sebauh, Bintulu',
    swk04:
      'SWK04 - Sibu, Mukah, Dalat, Song, Igan, Oya, Balingian, Kanowit, Kapit',
    swk05: 'SWK05 - Sarikei, Matu, Julau, Rajang, Daro, Bintangor, Belawai',
    swk06:
      'SWK06 - Lubok Antu, Sri Aman, Roban, Debak, Kabong, Lingga, Engkelili, Betong, Spaoh, Pusa, Saratok',
    swk07: 'SWK07 - Serian, Simunjan, Samarahan, Sebuyau, Meludam',
    swk08: 'SWK08 - Kuching, Bau, Lundu, Sematan',
    swk09: 'SWK09 - Zon Khas (Kampung Patarikan)',
    trg01: 'TRG01 - Kuala Terengganu, Marang, Kuala Nerus',
    trg02: 'TRG02 - Besut, Setiu',
    trg03: 'TRG03 - Hulu Terengganu',
    trg04: 'TRG04 - Dungun, Kemaman',
    wly01: 'WLY01 - Kuala Lumpur, Putrajaya',
    wly02: 'WLY02 - Labuan',
  };

  // Calculate remaining time for the closest prayer
  calculateRemainingTime() {
    const currentTime = new Date();
    let closestPrayerTime: Prayer | null = null;
    let minTimeDiff = Infinity;
    let prayerDate = '';

    // Iterate through the list of prayers and find the closest one by both date and time
    this.prayers.forEach((prayer) => {
      const [hours, minutes] = prayer.time
        .split(':')
        .map((num) => parseInt(num, 10));
      const prayerTime = new Date();
      prayerTime.setHours(hours);
      prayerTime.setMinutes(minutes);
      prayerTime.setSeconds(0);

      // Compare both date and time
      const prayerDateTime = new Date(prayer.date + ' ' + prayer.time);
      const timeDiff = prayerDateTime.getTime() - currentTime.getTime();

      // If the prayer time is in the future and closer than the current closest prayer time
      if (timeDiff > 0 && timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestPrayerTime = prayer;
        prayerDate = prayer.date;
      }
    });

    // If no prayer times are found for the current date, fetch prayer times for the next day
    if (!closestPrayerTime || minTimeDiff < 0) {
      // Check for tomorrow's prayer times
      const nextDay = new Date(this.currentDate);
      nextDay.setDate(this.currentDate.getDate() + 1);
      this.currentDate = nextDay;

      // Fetch next day's prayer times
      this.fetchTodayPrayerTimes();
      return; // Exit the function as we're moving to the next day's prayer times
    }

    // If a closest prayer time is found for today, calculate the remaining time
    if (closestPrayerTime) {
      this.closestPrayer = (closestPrayerTime as Prayer).name;
      this.closestPrayerTime = this.convertTimeToDate(
        (closestPrayerTime as Prayer).time,
      ).toLocaleTimeString('ms-MY', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      });
      const adjustedMinTimeDiff = minTimeDiff + 1000 * 60; // Adjust by adding one minute
      const hoursRemaining = Math.floor(adjustedMinTimeDiff / (1000 * 3600));
      const minutesRemaining = Math.floor(
        (adjustedMinTimeDiff % (1000 * 3600)) / (1000 * 60),
      );
      if (minTimeDiff === 0) {
        this.remainingTime = 'sekarang';
      } else if (hoursRemaining > 0 || minutesRemaining > 0) {
        this.remainingTime = `${this.closestPrayer} akan bermula dalam ${
          hoursRemaining > 0 ? hoursRemaining + ' jam ' : ''
        }${minutesRemaining} minit`;
      } else {
        this.remainingTime = 'sekarang';
      }
    } else {
      this.remainingTime = 'Tiada solat terdekat pada masa ini';
    }
    this.loaded = true;
  }

  // Toggle the visibility of the yearly prayer times table
  viewYearlyPrayerTimes() {
    this.showYearlyPrayerTimes = true;
    setTimeout(() => {
      if (this.yearlyTable) {
        // Scroll to the current day row when the view is shown
        const currentDayRow =
          this.yearlyTable.nativeElement.querySelector('.current-day');
        if (currentDayRow) {
          currentDayRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 100);
  }

  // Check if the given prayer's date is today's date
  isToday(prayerTime: string): boolean {
    const prayerDate = new Date(prayerTime);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    prayerDate.setHours(0, 0, 0, 0);

    return today.toDateString() === prayerDate.toDateString();
  }

  setClickedRow(prayer: any) {
    this.clickedRow = prayer;
    // set the current clicked row to use class clicked-row
    // console.log('Clicked row:', this.clickedRow);
  }

  // Convert a time string (HH:mm:ss) into a Date object
  convertTimeToDate(time: string): Date {
    const date = new Date();
    const [hours, minutes, seconds] = time
      .split(':')
      .map((num) => parseInt(num, 10));
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(seconds);
    return date;
  }

  // Navigate back to the main prayer times
  backToMainPrayerTimes() {
    this.showYearlyPrayerTimes = false;
  }

  // Go to the previous day
  goToPreviousDay() {
    this.currentDate.setDate(this.currentDate.getDate() - 1);
    this.fetchTodayPrayerTimes(); // Fetch prayer times for the new date
  }

  // Go to the next day
  goToNextDay() {
    this.currentDate.setDate(this.currentDate.getDate() + 1);
    this.fetchTodayPrayerTimes(); // Fetch prayer times for the new date
  }

  // Check if there is data for the previous day and return false if previous day is day before current day
  canNavigatePrevious(): boolean {
    const previousDate = new Date(this.currentDate);
    previousDate.setDate(previousDate.getDate() - 1);

    // Return false if the previous date is less than today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    previousDate.setHours(0, 0, 0, 0);

    if (previousDate < today) {
      return false;
    }

    return this.isDataAvailableForDate(previousDate);
  }

  // Check if there is data for the next day
  canNavigateNext(): boolean {
    const nextDate = new Date(this.currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return this.isDataAvailableForDate(nextDate);
  }

  // Helper function to check if data exists for a specific date
  isDataAvailableForDate(date: Date): boolean {
    const formattedDate = this.formatDate(date);
    return this.yearlyPrayers.some((prayer) => prayer.date === formattedDate);
  }

  /**
   * Toggle notification for a specific prayer
   */
  async setReminder(prayerName: string): Promise<void> {
    // Find the prayer index first
    const index = this.prayers.findIndex((p) => p.name === prayerName);
    if (index === -1) return;

    try {
      // Provide haptic feedback
      if (
        Capacitor.getPlatform() === 'android' ||
        Capacitor.getPlatform() === 'ios'
      ) {
        await Haptics.impact({ style: ImpactStyle.Light });
      }

      // Check if notifications are enabled
      if (!this.notificationsEnabled) {
        // Request permission
        this.notificationsEnabled =
          await this.prayerNotificationsService.initializeNotifications();
        if (!this.notificationsEnabled) {
          await this.presentToast(
            'Notifikasi tidak diaktifkan. Sila periksa tetapan peranti anda.',
            'warning',
          );
          return;
        }
      }

      // Toggle the notification state optimistically in UI
      this.prayers[index].notificationEnabled =
        !this.prayers[index].notificationEnabled;

      // Toggle notification in service (non-blocking)
      this.prayerNotificationsService
        .togglePrayerNotification(prayerName)
        .then((success) => {
          // Only handle failure - revert UI if toggle failed
          if (!success) {
            this.prayers[index].notificationEnabled =
              !this.prayers[index].notificationEnabled;
            this.presentToast(
              'Ralat mengemas kini notifikasi. Sila cuba lagi.',
              'danger',
            );
          }
        })
        .catch((error) => {
          console.error('Error setting reminder:', error);
          // On error, refresh actual state from service
          this.updatePrayerNotificationStatus();
          this.presentToast('Ralat mengaktifkan notifikasi', 'danger');
        });
    } catch (error) {
      console.error('Error in setReminder:', error);
    }
  }

  /**
   * Present a toast message
   */
  async presentToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color,
    });
    await toast.present();
  }

  /**
   * Update UI to reflect which prayers have notifications enabled
   */
  async updatePrayerNotificationStatus() {
    if (!this.notificationsEnabled || !this.prayers.length) return;

    // For each prayer, check if notification is enabled
    for (const prayer of this.prayers) {
      prayer.notificationEnabled =
        await this.prayerNotificationsService.isPrayerNotificationEnabled(
          prayer.name,
        );
    }
  }

  startUpdatingRemainingTime() {
    // Clear any existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    // Set up a periodic update to check for the remaining time every second
    this.intervalId = setInterval(() => {
      this.calculateRemainingTime();
    }, 1000); // Update every second
  }

  handleRefresh(event: CustomEvent) {
    setTimeout(() => {
      this.loaded = false;
      (event.target as HTMLIonRefresherElement).complete();
      this.initializePrayerTimes();
    }, 1000);
  }

  navigateTo(path: string) {
    this.router.navigateByUrl(path);
  }

  // Method to open the notification settings modal
  async openNotificationSettings() {
    try {
      const modal = await this.modalController.create({
        component: NotificationSettingsComponent,
        cssClass: 'notification-settings-modal',
      });

      await modal.present();

      const { data } = await modal.onDidDismiss();
      if (data?.saved) {
        await this.presentToast('Tetapan notifikasi telah disimpan', 'success');
        await this.updatePrayerNotificationStatus();
      }
    } catch (error) {
      console.error('Error opening notification settings:', error);
      await this.presentToast('Ralat membuka tetapan notifikasi', 'danger');
    }
  }

  async sharePrayerTimes() {
    if (!this.loaded || this.prayers.length === 0) {
      await this.presentToast(
        'Data waktu solat belum dimuatkan atau tiada.',
        'warning',
      );
      return;
    }

    // Ensure the container div is available
    if (
      !this.prayerTimesToShareContainer ||
      !this.prayerTimesToShareContainer.nativeElement
    ) {
      console.error('Shareable container element not found');
      await this.presentToast(
        'Ralat: Elemen untuk dikongsi tidak ditemui.',
        'danger',
      );
      return;
    }
    const shareContainerElement =
      this.prayerTimesToShareContainer.nativeElement;
    const shareContentElement = document.getElementById(
      'prayerTimesToShareContent',
    );

    if (!shareContentElement) {
      console.error('Shareable content element not found');
      await this.presentToast(
        'Ralat: Elemen kandungan untuk dikongsi tidak ditemui.',
        'danger',
      );
      return;
    }

    // 1. Populate the shareable element
    const shareTitleEl = document.getElementById('shareTitle');
    const shareLocationEl = document.getElementById('shareLocation');
    const shareHijriDateEl = document.getElementById('shareHijriDate');
    const sharePrayerTableBodyEl = document.getElementById(
      'sharePrayerTableBody',
    );

    if (
      !shareTitleEl ||
      !shareLocationEl ||
      !shareHijriDateEl ||
      !sharePrayerTableBodyEl
    ) {
      console.error('Required elements within shareable div not found');
      await this.presentToast(
        'Ralat: Struktur untuk dikongsi tidak lengkap.',
        'danger',
      );
      return;
    }

    const formattedCurrentDate = this.currentDate.toLocaleDateString('ms-MY', {
      day: 'numeric', // '2-digit' can cause issues on some browsers/OS with long, use numeric.
      month: 'long',
      year: 'numeric',
    });
    shareTitleEl.innerText = `Waktu Solat - ${formattedCurrentDate}`;
    shareLocationEl.innerText = this.location;
    shareHijriDateEl.innerText = this.currentHijriDate;

    // Clear previous table rows
    sharePrayerTableBodyEl.innerHTML = '';

    // Populate new table rows
    // Iterate through each prayer to populate the prayer times table for sharing
    this.prayers.forEach((prayer) => {
      // Get the table body element where new rows will be inserted
      const sharePrayerTableBodyEl = document.getElementById('sharePrayerTableBody') as HTMLTableSectionElement;
      
      // Create a new table row
      const row = sharePrayerTableBodyEl.insertRow();
      
      // Create cells for the prayer name and time
      const cell1 = row.insertCell();
      const cell2 = row.insertCell();

      // Style the cells
      cell1.style.padding = '10px';
      cell1.style.border = '1px solid #ccc';
      cell1.style.fontSize = '1em';
      cell1.style.display = 'flex';
      cell1.style.alignItems = 'center';

      cell2.style.padding = '10px';
      cell2.style.border = '1px solid #ccc';
      cell2.style.fontSize = '1em';

      // Create and style the prayer icon
      const icon = document.createElement('img');
      icon.src = `../../assets/icon/${prayer.name.toLowerCase()}-white.svg`;
      icon.alt = `${prayer.name} icon`;
      icon.style.width = '20px';
      icon.style.height = '20px';
      icon.style.marginRight = '5px';

      // Append the icon and prayer name to the first cell
      cell1.appendChild(icon);
      cell1.appendChild(document.createTextNode(prayer.name));

      // Format and set the prayer time in the second cell
      cell2.innerText = this.convertTimeToDate(prayer.time).toLocaleTimeString(
        'ms-MY',
        {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        },
      );
    });

    // Make the container temporarily visible for rendering, but off-screen
    shareContainerElement.style.display = 'block'; // This will make children like prayerTimesToShareContent visible too.

    let tempFileName = '';

    try {
      this.isLoading = true;

      // Wait a brief moment for DOM updates
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataUrl = await htmlToImage.toPng(shareContentElement, {
        pixelRatio: 2, // For better quality on high DPI screens
        // Ensure styles are applied by the browser before capture
        // Explicitly set background if needed, though defined in the div's style
        // backgroundColor: '#ffffff',
      });

      tempFileName = `waktu_solat_${new Date().getTime()}.png`;
      const savedFile = await Filesystem.writeFile({
        path: tempFileName,
        data: dataUrl, // dataUrl is already base64
        directory: Directory.Cache,
      });

      await Share.share({
        title: `Waktu Solat ${formattedCurrentDate}`,
        text: `Berikut adalah waktu solat untuk ${this.location} pada ${formattedCurrentDate} (${this.currentHijriDate}).`,
        url: savedFile.uri,
        dialogTitle: 'Kongsi Waktu Solat',
      });
    } catch (error: any) {
      console.error('Error sharing prayer times:', error);
      if (
        (error &&
          error.message &&
          error.message.toLowerCase().includes('share canceled')) ||
        error.message.toLowerCase().includes('share dismissed')
      ) {
        await this.presentToast('Perkongsian dibatalkan.', 'medium');
      } else if (
        error &&
        error.message &&
        error.message.toLowerCase().includes('activity not found')
      ) {
        await this.presentToast(
          'Tiada aplikasi untuk berkongsi ditemui.',
          'warning',
        );
      } else {
        await this.presentToast(
          'Ralat semasa cuba berkongsi waktu solat.',
          'danger',
        );
      }
    } finally {
      // Hide the element again
      shareContainerElement.style.display = 'none';
      this.isLoading = false;

      // Clean up the temporary file
      if (tempFileName) {
        try {
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache,
          });
        } catch (cleanupError) {
          console.warn('Error cleaning up temporary share file:', cleanupError);
        }
      }
    }
  }
}
