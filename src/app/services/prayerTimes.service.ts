import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { from, map, Observable } from 'rxjs';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { PrayerNotificationsService } from './prayer-notifications.service';
import { LocationService } from './geolocation.service';
import { Capacitor } from '@capacitor/core';
import { ToastService } from './toast.service';

// Define the prayer type
export interface Prayer {
  name: string;
  time: string;
  date: string;
  notificationEnabled?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PrayerTimesService {
  private prayerApiUrl =
    'https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat'; // API URL to fetch prayer times
  private userZoneApiUrl = 'https://mpt.i906.my/api/prayer'; // API URL to fetch the zone code
  private compassApiUrl = 'https://api.aladhan.com/v1/qibla'; // API URL to fetch the compass data

  // Current zone code
  private zone: string = 'KDH01';

  constructor(
    private http: HttpClient,
    private prayerNotificationsService: PrayerNotificationsService,
    private locationService: LocationService,
    private toastService: ToastService,
  ) {}

  // Method to initialize and update prayer times on app start
  async initializePrayerTimes(): Promise<void> {
    try {
      const savedData = await this.getSavedYearlyPrayerTimes();

      if (!savedData) {
        // If no data exists, fetch default prayer times
        await this.getDefaultPrayerTimes();
        return;
      }

      const now = new Date();
      const savedTimestamp = new Date(savedData.timestamp);
      const daysSinceLastUpdate = Math.floor(
        (now.getTime() - savedTimestamp.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Check if data needs updating (more than 1 day old or new year)
      const needsUpdate =
        daysSinceLastUpdate > 1 ||
        now.getFullYear() !== savedTimestamp.getFullYear();

      if (needsUpdate) {
        console.log('Data is old, checking for updates...');

        // Data needs updating - check GPS status
        const isGpsEnabled = await this.isGpsEnabled();

        if (isGpsEnabled) {
          // GPS enabled - fetch data based on current location
          try {
            console.log('GPS enabled, fetching data based on location...');
            await this.refreshData();
            console.log('Prayer times updated with location successfully!');
            return;
          } catch (locationError) {
            console.warn(
              'Location-based update failed, falling back to manual zone:',
              locationError,
            );
            // Fall through to manual update
          }
        }

        // GPS disabled or location failed - update using saved/default zone
        console.log('Using manual zone for data update...');
        this.getPrayerTimes(savedData.zone, 'year').subscribe(
          async (data) => {
            if (data.status === 'OK!') {
              await this.saveYearlyPrayerTimes(
                savedData.zone,
                data.prayerTime || [],
              );
              console.log(
                'Prayer times updated with manual zone successfully!',
              );
            } else {
              console.error('Failed to update prayer times with manual zone');
            }
          },
          (error) => {
            console.error(
              'Error updating prayer times with manual zone:',
              error,
            );
          },
        );
      } else {
        console.log('Data is fresh, no update needed');
      }
    } catch (error) {
      console.error('Error initializing prayer times:', error);
      // Fallback to default prayer times if there's an error
      await this.getDefaultPrayerTimes();
    }
  }

  // Fetch prayer times for the whole year
  getPrayerTimes(zone: string, period: string): Observable<any> {
    const url = `${this.prayerApiUrl}&period=${period}&zone=${zone}`;
    return this.http.get<any>(url);
  }

  // Fetch user zone based on latitude and longitude
  getUserZoneCode(latitude: number, longitude: number): Observable<any> {
    const url = `${this.userZoneApiUrl}/${latitude},${longitude}`;
    this.getCompassDirection(latitude, longitude);
    return this.http.get<any>(url);
  }

  // Fetch compass direction based on latitude and longitude
  getCompassDirection(latitude: number, longitude: number): void {
    const url = `${this.compassApiUrl}/${latitude}/${longitude}`;
    this.http.get<any>(url).subscribe({
      next: (response) => {
        const direction = response.data.direction;
        Preferences.set({ key: 'compassDirection', value: direction });
        console.log('Fetched compass direction:', direction);
        this.cacheQiblaImage(latitude, longitude, direction);
      },
      error: (error) => {
        console.error('Error fetching compass direction:', error);
        Preferences.set({
          key: 'compassDirection',
          value: '291.52845530594317',
        });
        this.cacheQiblaImage(latitude, longitude, '291.52845530594317');
      },
    });
  }

  // Fetch and cache the Qibla compass image
  async cacheQiblaImage(lat: number, lon: number, direction: string) {
    if (direction === '291.52845530594317') {
      return; // Default image
    }
    const apiUrl = `${this.compassApiUrl}/${lat}/${lon}/compass`;

    try {
      // Fetch the image as a blob
      const response = await fetch(apiUrl);
      const blob = await response.blob();
      const reader = new FileReader();

      // Convert blob to base64 for Filesystem
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        const fileName = `qibla_compass.png`;

        const permissions = await Filesystem.requestPermissions();
        if (!permissions.publicStorage) {
          console.log('No permissions to write to public storage');
          return;
        }
        console.log('Public storage permissions granted');

        // Save to filesystem
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache, // Stores in app cache
        });

        this.getCachedQiblaImage();
      };
    } catch (error) {
      console.error('Failed to cache image:', error);
    }
  }

  // Check for a cached image matching current coordinates
  async getCachedQiblaImage() {
    const fileName = `qibla_compass.png`;

    try {
      // Check if the file exists
      const { data } = await Filesystem.readFile({
        path: fileName,
        directory: Directory.Cache,
      });

      // Return the cached image as a base64 URL
      return `data:image/png;base64,${data}`;
    } catch (error) {
      return null; // No cached image found
    }
  }

  // Save the fetched prayer times into Preferences
  async saveYearlyPrayerTimes(
    zone: string,
    yearlyPrayers: any[],
  ): Promise<void> {
    const data = {
      zone: zone,
      prayers: yearlyPrayers,
      timestamp: new Date().toISOString(),
    };
    await Preferences.set({
      key: 'yearlyPrayerTimes',
      value: JSON.stringify(data),
    });
    this.presentToast('Data waktu solat telah dikemaskini!', 'success');
    console.log('Choosen prayer times saved successfully!');
    this.prayerNotificationsService.forceRescheduleNotifications(true);
  }

  // Retrieve saved yearly prayer times from Preferences
  async getSavedYearlyPrayerTimes(): Promise<any> {
    const { value } = await Preferences.get({ key: 'yearlyPrayerTimes' });
    if (value) {
      return JSON.parse(value);
    }
    console.log('No saved data found!');
    return null;
  }

  getQiblaDirection(): Observable<number> {
    return from(Preferences.get({ key: 'compassDirection' })).pipe(
      map((data) => {
        if (data && data.value) {
          return parseFloat(data.value);
        } else {
          return 291.52845530594317;
        }
      }),
    );
  }

  // Fetch and save default prayer times for the whole year
  async getDefaultPrayerTimes(): Promise<void> {
    let zone = 'KDH01'; // Default zone code for this app = Kubang Pasu
    let period = 'year';
    this.getPrayerTimes(zone, period).subscribe(async (data) => {
      if (data.status === 'OK!') {
        const yearlyPrayerTimes: any = data.prayerTime || [];
        const defaultData = {
          zone: zone,
          prayers: yearlyPrayerTimes,
          timestamp: new Date().toISOString(),
        };
        await Preferences.set({
          key: 'yearlyPrayerTimes',
          value: JSON.stringify(defaultData),
        });
        console.log('Default prayer times saved successfully!');
      } else {
        console.log('Failed to fetch default prayer times!');
      }
    });
  }

  // Check if the stored location is the same as the current one
  async isLocationChanged(newLocation: string): Promise<boolean> {
    const savedData = await this.getSavedYearlyPrayerTimes();
    if (savedData && savedData.zone !== newLocation) {
      return true;
    }
    return false;
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
    const formattedDate = date.toLocaleDateString('en-MY', options);
    const [day, month, year] = formattedDate.split(' ');
    return `${day}-${month.slice(0, 3)}-${year}`; // Use english format since api use english format
  }

  // Helper function to check if data exists for a specific date
  isDataAvailableForDate(date: Date, yearlyPrayers: any[]): boolean {
    const formattedDate = this.formatDate(date);
    return yearlyPrayers.some((prayer) => prayer.date === formattedDate);
  }

  // Calculate remaining time for the closest prayer
  calculateRemainingTime(
    prayers: Prayer[],
    currentDate: Date,
  ): {
    closestPrayer: string | null;
    remainingTime: string;
    closestPrayerTime: Date | null;
  } {
    if (prayers.length === 0) {
      return {
        closestPrayer: null,
        remainingTime: 'Tiada solat terdekat pada masa ini',
        closestPrayerTime: null,
      };
    }

    let closestPrayer: Prayer = prayers[0];
    let minTimeDiff = Infinity;

    // Iterate through the list of prayers and find the closest one by both date and time
    for (const prayer of prayers) {
      const [hours, minutes] = prayer.time
        .split(':')
        .map((num) => parseInt(num, 10));
      const prayerTime = new Date();
      prayerTime.setHours(hours);
      prayerTime.setMinutes(minutes);
      prayerTime.setSeconds(0);

      // Compare both date and time
      const prayerDateTime = new Date(prayer.date + ' ' + prayer.time);
      const timeDiff = prayerDateTime.getTime() - currentDate.getTime();

      // If the prayer time is in the future and closer than the current closest prayer time
      if (timeDiff > 0 && timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestPrayer = prayer;
      }
    }

    // If no future prayer times are found, return null values
    if (minTimeDiff === Infinity) {
      return {
        closestPrayer: null,
        remainingTime: 'Tiada solat terdekat pada masa ini',
        closestPrayerTime: null,
      };
    }

    // Calculate the remaining time
    const adjustedMinTimeDiff = minTimeDiff + 1000 * 60; // Adjust by adding one minute
    const hoursRemaining = Math.floor(adjustedMinTimeDiff / (1000 * 3600));
    const minutesRemaining = Math.floor(
      (adjustedMinTimeDiff % (1000 * 3600)) / (1000 * 60),
    );

    let remainingTime: string;
    if (minTimeDiff === 0) {
      remainingTime = 'sekarang';
    } else if (hoursRemaining > 0 || minutesRemaining > 0) {
      remainingTime = `${closestPrayer.name} akan bermula dalam ${
        hoursRemaining > 0 ? hoursRemaining + ' jam ' : ''
      }${minutesRemaining} minit`;
    } else {
      remainingTime = 'sekarang';
    }

    return {
      closestPrayer: closestPrayer.name,
      remainingTime,
      closestPrayerTime: new Date(
        closestPrayer.date + ' ' + closestPrayer.time,
      ),
    };
  }

  // Get today's prayer times from yearly data
  getTodayPrayerTimes(
    yearlyPrayers: any[],
    currentDate: Date,
  ): { prayers: Prayer[]; hijriDate: string; currentDate: Date } | null {
    const formattedDate = this.formatDate(currentDate);
    // Find the prayer times for the selected date in yearlyPrayers
    const selectedPrayer = yearlyPrayers.find(
      (prayer) => prayer.date === formattedDate,
    );

    if (!selectedPrayer) {
      return null;
    }

    const prayers: Prayer[] = [
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
    const currentHijriDate = this.formatHijriDate(selectedPrayer.hijri);

    return {
      prayers,
      hijriDate: currentHijriDate,
      currentDate: new Date(selectedPrayer.date),
    };
  }

  // Fetch yearly prayer times and save them to localStorage
  fetchYearlyPrayerTimes(zone: string): Observable<any> {
    return this.getPrayerTimes(zone, 'year');
  }

  // Update prayer notification status for all prayers
  async updatePrayerNotificationStatus(
    prayers: Prayer[],
    prayerNotificationsService: any,
  ): Promise<void> {
    if (!prayers.length) return;

    // For each prayer, check if notification is enabled
    for (const prayer of prayers) {
      prayer.notificationEnabled =
        await prayerNotificationsService.isPrayerNotificationEnabled(
          prayer.name,
        );
    }
  }

  // Check if there is data for the previous day
  canNavigatePrevious(currentDate: Date, yearlyPrayers: any[]): boolean {
    const previousDate = new Date(currentDate);
    previousDate.setDate(previousDate.getDate() - 1);

    // Return false if the previous date is less than today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    previousDate.setHours(0, 0, 0, 0);

    if (previousDate < today) {
      return false;
    }

    return this.isDataAvailableForDate(previousDate, yearlyPrayers);
  }

  // Check if there is data for the next day
  canNavigateNext(currentDate: Date, yearlyPrayers: any[]): boolean {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return this.isDataAvailableForDate(nextDate, yearlyPrayers);
  }

  // Navigate to the previous day
  getPreviousDay(currentDate: Date): Date {
    const previousDate = new Date(currentDate);
    previousDate.setDate(previousDate.getDate() - 1);
    return previousDate;
  }

  // Navigate to the next day
  getNextDay(currentDate: Date): Date {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate;
  }

  // Convert a time string (HH:mm:ss) into a Date object
  convertTimeToDate(time: string): Date {
    const date = new Date();
    const [hours, minutes, seconds] = time
      .split(':')
      .map((num) => parseInt(num, 10));
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(seconds || 0);
    return date;
  }

  // Check if the given prayer's date is today's date
  isToday(prayerTime: string): boolean {
    const prayerDate = new Date(prayerTime);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    prayerDate.setHours(0, 0, 0, 0);

    return today.toDateString() === prayerDate.toDateString();
  }

  // Get current location and return zone code
  async getCurrentLocation(): Promise<string> {
    try {
      // Get current location (GPS check is handled by the calling method)
      const position = await this.locationService.getCurrentLocation();
      console.log('Current location:', position);

      // Call the new API to fetch the user zone code based on latitude and longitude
      try {
        const zoneResponse = await this.getUserZoneCode(
          position.coords.latitude,
          position.coords.longitude,
        ).toPromise();
        const zoneCode = zoneResponse.data.attributes.jakim_code; // Extract the 'jakim_code'
        return zoneCode;
      } catch (error) {
        console.error('Error getting zone code:', error);
        throw new Error('Koordinat tidak sah. Sila cuba lagi.');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      throw error;
    }
  }

  // Refresh data with location-based zone
  async refreshData(): Promise<void> {
    try {
      // Get the user's current location
      const position = await this.getCurrentLocation();

      if (!position) {
        throw new Error('Unable to get location');
      }

      // Update prayer times and location
      await this.refreshDataWithLocation(position);
    } catch (error) {
      console.error('Error refreshing data:', error);
      throw error;
    }
  }

  // Update prayer times with location-based zone
  async refreshDataWithLocation(currentLocation: string): Promise<void> {
    this.zone = currentLocation;

    // Fetch yearly prayer times from API
    const data = await this.fetchYearlyPrayerTimes(currentLocation).toPromise();

    if (data.status === 'OK!') {
      if (data.prayerTime && data.prayerTime.length > 0) {
        const yearlyPrayerTimes = data.prayerTime;
        await this.saveYearlyPrayerTimes(currentLocation, yearlyPrayerTimes);
        console.log('Prayer times updated with location successfully!');
      } else {
        throw new Error('Gagal untuk mendapatkan waktu solat tahunan');
      }
    } else {
      throw new Error('Gagal untuk mendapatkan waktu solat tahunan');
    }
  }

  // Get zone name from zone code
  getZoneName(zoneCode: string): string {
    return this.zoneNames[zoneCode] || 'Zon Tidak Dikenali';
  }

  // Check if GPS is enabled
  async isGpsEnabled(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'android') {
      return await this.locationService.isEnabled();
    }
    return true; // iOS/web don't need GPS check
  }

  // Check GPS status and show dialog if disabled (public method for pages to use)
  async checkGpsStatus(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'android') {
      return await this.locationService.checkGpsStatus();
    }
    return true; // iOS/web don't need GPS check
  }

  /**
   * Present a toast message
   */
  async presentToast(message: string, color: string) {
    await this.toastService.presentToast(message, color);
  }
}
