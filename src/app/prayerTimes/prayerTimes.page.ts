import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { PrayerTimesService } from '../services/PrayerTimes/prayerTimes.service';
import { AlertController, ToastController } from '@ionic/angular';
import { LocationService } from '../services/Geolocation/geolocation.service';
import { Router } from '@angular/router';

// Define the prayer type
interface Prayer {
  name: string;
  time: string;
  date: string;
}

@Component({
  selector: 'app-prayerTimes',
  templateUrl: './prayerTimes.page.html',
  styleUrls: ['./prayerTimes.page.scss'],
})
export class prayerTimesPage implements OnInit {
  @ViewChild('yearlyTable', { static: false }) yearlyTable!: ElementRef;
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
  intervalId: any;
  isLoading: boolean = false;
  closestPrayerTime: any;
  sameData: boolean = false;

  constructor(
    private prayerTimesService: PrayerTimesService,
    private alertController: AlertController,
    private locationService: LocationService,
    private toastController: ToastController,
    private router: Router
  ) {}

  ngOnInit() {
    this.initializePrayerTimes();
    this.checkDarkMode();
  }

  checkDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.isDarkMode = prefersDark.matches;
    prefersDark.addEventListener('change', (e) => {
      this.isDarkMode = e.matches;
    });
  }

  async initializePrayerTimes() {
    // Get the saved data from localStorage if available
    const savedData = this.prayerTimesService.getSavedYearlyPrayerTimes();

    if (savedData) {
      // Load saved yearly prayers from localStorage
      this.yearlyPrayers = savedData.prayers;
      this.zone = savedData.zone;

      // Fetch the full zone name from the mapping object
      const fullZoneName = this.zoneNames[this.zone] || 'Zon Tidak Dikenali';

      // Update the location to display the full zone name
      this.location = fullZoneName;

      // Get the last updated timestamp from localStorage
      this.lastUpdated = this.formatTimestamp(savedData.timestamp);

      // Fetch today's prayer times
      this.fetchTodayPrayerTimes();
      this.startUpdatingRemainingTime(); // Start updating the remaining time and closest prayer every second
    } else {
      this.fetchNewData();
    }
  }

  // Fetch new data from API
  refreshData() {
    this.isLoading = true;
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
          await this.showToast('Data waktu solat adalah terkini.', 'success');
          this.sameData = false; // Reset the flag
        } else {
          // Show a success toast message
          await this.showToast(
            'Data waktu solat harian telah dikemaskini! Sila periksa semula masa solat harian anda.',
            'success'
          );
        }
      }, 1000);
    } catch (error) {
      // Show an error toast message
      setTimeout(() => this.showToast('' + error, 'danger'), 1000);
    } finally {
      // Set isLoading to false after 1 second
      setTimeout(() => (this.isLoading = false), 1000);
      this.loaded = true;
    }
  }

  // Function to show toast message
  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000, // Duration in milliseconds
      color: color, // 'success' or 'danger' for success/error styling
      position: 'bottom', // Position of the toast (top, middle, bottom)
    });
    toast.present();
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
      const isLocationSupported =
        await this.locationService.isLocationSupported();
      if (!isLocationSupported) {
        console.error('Location services are not suppoerted.');
        this.isLoading = false;
        this.location = 'Zon Tidak Dikenali';
        await this.showToast('Peranti anda tidak menyokong lokasi.', 'danger');
        return '';
      }

      const position = await this.locationService.getCurrentLocation();
      console.log('Current location:', position);

      // Call the new API to fetch the user zone code based on latitude and longitude
      const zoneResponse = await this.prayerTimesService
        .getUserZoneCode(position.coords.latitude, position.coords.longitude)
        .toPromise();
      const zoneCode = zoneResponse.data.attributes.jakim_code; // Extract the 'jakim_code'

      // Return the zone code fetched from the API
      return zoneCode;
    } catch (error) {
      console.error('Error getting location:', error);
      this.isLoading = false;
      this.location = 'Zon Tidak Dikenali'; // set to default value
      await this.showToast('' + error, 'danger');
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
  fetchTodayPrayerTimes() {
    const formattedDate = this.formatDate(this.currentDate);
    // Find the prayer times for the selected date in yearlyPrayers
    const selectedPrayer = this.yearlyPrayers.find(
      (prayer) => prayer.date === formattedDate
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
      this.currentDate = new Date(selectedPrayer.date); // Update displayed date
    } else {
      this.showError('Tiada waktu solat untuk hari ini.');
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
      (data) => {
        const savedData = this.prayerTimesService.getSavedYearlyPrayerTimes();
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
            yearlyPrayerTimes
          ); // Save to localStorage
          this.initializePrayerTimes();
        } else {
          this.showError('Gagal untuk mendapatkan waktu solat tahunan');
          this.currentHijriDate = '';
        }
      },
      (error) => {
        this.showError('Terjadi ralat sewaktu mendapatkan waktu solat tahunan');
      }
    );
  }

  // Handle errors
  async showError(message: string) {
    const alert = await this.alertController.create({
      header: '',
      message,
      buttons: ['OK'],
    });
    await alert.present();
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
        (closestPrayerTime as Prayer).time
      ).toLocaleTimeString('ms-MY', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      });
      const adjustedMinTimeDiff = minTimeDiff + 1000 * 60; // Adjust by adding one minute
      const hoursRemaining = Math.floor(adjustedMinTimeDiff / (1000 * 3600));
      const minutesRemaining = Math.floor(
        (adjustedMinTimeDiff % (1000 * 3600)) / (1000 * 60)
      );
      if (minTimeDiff === 0) {
        this.remainingTime = 'sekarang';
      } else if (hoursRemaining > 0 || minutesRemaining > 0) {
        this.remainingTime = `${this.closestPrayer} kurang dari ${
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

  setReminder(prayerName: string) {
    alert(`Peringatan ditetapkan untuk ${prayerName}`);
  }

  startUpdatingRemainingTime() {
    // Set up a periodic update to check for the remaining time every second
    this.intervalId = setInterval(() => {
      this.calculateRemainingTime();
    }, 1000); // Update every second
  }

  handleRefresh(event: CustomEvent) {
    setTimeout(() => {
      // Reload Page
      location.reload();
      (event.target as HTMLIonRefresherElement).complete();
    }, 2000);
  }

  ngOnDestroy() {
    // Stop the interval when the component is destroyed to prevent memory leaks
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  navigateTo(path: string) {
    this.router.navigateByUrl(path);
  }
}
