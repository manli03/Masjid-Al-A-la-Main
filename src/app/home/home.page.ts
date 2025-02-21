import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SplashScreen } from '@capacitor/splash-screen';
import { PrayerTimesService } from '../services/PrayerTimes/prayerTimes.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnDestroy {
  public loaded: boolean = false;
  prayerNames = ['Subuh', 'Zuhur', 'Asar', 'Maghrib', 'Isyak'];
  currentLocation: string = 'Memuatkan lokasi...';
  currentHijriDate: string = '';
  currentTime: string = '';
  remainingTime: string = '';
  prayerTimes: { [key: string]: string } = {}; // For display (12‑hour formatted)
  rawPrayerTimes: { [key: string]: string } = {}; // For calculations (24‑hour strings)
  zoneNames: { [key: string]: string };
  private intervalId: any;
  isDarkMode: boolean = false;

  // NEW properties for tracking calculated state
  currentPrayer: { name: string; time: string; date: Date } | null = null;
  upcomingPrayer: { name: string; time: string; date: Date } | null = null;
  currentPrayerRatio: number = 1; // fraction (remaining/total)
  currentDate: Date = new Date();

  constructor(
    private router: Router,
    private prayerTimesService: PrayerTimesService
  ) {
    this.zoneNames = {
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
  }

  async ionViewDidEnter() {
    await SplashScreen.hide();
    this.checkDarkMode();
    this.loadPrayerData();
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private loadPrayerData() {
    const savedData = this.prayerTimesService.getSavedYearlyPrayerTimes();
    if (savedData) {
      const zone = savedData.zone;
      this.currentLocation = this.zoneNames[zone] || 'Zon Tidak Dikenali';
      const today = new Date();
      const formattedDate = this.formatDate(today);
      const prayerData = savedData.prayers.find(
        (p: any) => p.date === formattedDate
      );
      if (prayerData) {
        // Store the raw 24-hour times for calculation
        this.rawPrayerTimes = {
          subuh: prayerData.fajr,
          zuhur: prayerData.dhuhr,
          asar: prayerData.asr,
          maghrib: prayerData.maghrib,
          isyak: prayerData.isha,
        };
        // Store the formatted prayer times (12-hour with no AM/PM) for display
        this.prayerTimes = {
          subuh: this.formatPrayerTime(prayerData.fajr),
          zuhur: this.formatPrayerTime(prayerData.dhuhr),
          asar: this.formatPrayerTime(prayerData.asr),
          maghrib: this.formatPrayerTime(prayerData.maghrib),
          isyak: this.formatPrayerTime(prayerData.isha),
        };
        this.currentHijriDate = this.formatHijriDate(prayerData.hijri);
      }
      this.startUpdatingTime();
    } else {
      this.prayerTimesService.getDefaultPrayerTimes();
      setTimeout(() => {
        this.loadPrayerData();
      }, 5000);
    }
  }

  private formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    };
    return date.toLocaleDateString('ms-MY', options).replace(/ /g, '-');
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
    this.intervalId = setInterval(() => {
      const now = new Date();
      this.currentDate = now; // store current time for later use
      this.currentTime = now.toLocaleTimeString('ms-MY', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      });
      this.calculateRemainingTime(now);
      if (!this.loaded) {
        this.loadPrayerData();
      }
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
      return { name, time: rawTime, date: prayerDate };
    });

    // Determine upcoming and current prayer.
    if (now < prayersArray[0].date) {
      // Before Subuh – no passed prayer for the new day.
      this.currentPrayer = prayersArray[4];
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
        // Adjust upcoming prayer time by adding 24 hours so that the times are on the same timeline.
        const adjustedUpcomingTime =
          this.upcomingPrayer.date.getTime() + 24 * 3600 * 1000;
        const totalDuration =
          adjustedUpcomingTime - this.currentPrayer.date.getTime();
        const remainingDuration = adjustedUpcomingTime - now.getTime();
        this.currentPrayerRatio = remainingDuration / totalDuration;
      } else {
        const totalDuration =
          this.upcomingPrayer.date.getTime() -
          this.currentPrayer.date.getTime();
        const remainingDuration =
          this.upcomingPrayer.date.getTime() - now.getTime();
        this.currentPrayerRatio = remainingDuration / totalDuration;
      }
    } else {
      this.currentPrayerRatio = 1;
    }

    // Update the remaining time display (for the upcoming prayer)
    const diff = this.upcomingPrayer.date.getTime() - now.getTime();
    this.updateRemainingTimeDisplay(diff, this.upcomingPrayer);
  }

  private updateRemainingTimeDisplay(
    diff: number,
    closestPrayer: { name: string; time: string }
  ) {
    if (closestPrayer && diff >= 0) {
      // Adjust by adding one minute (as in prayerTimes.page)
      const adjustedDiff = diff + 1000 * 60;
      const hoursRemaining = Math.floor(adjustedDiff / (1000 * 3600));
      const minutesRemaining = Math.floor(
        (adjustedDiff % (1000 * 3600)) / (1000 * 60)
      );
      if (diff === 0) {
        this.remainingTime = 'sekarang';
      } else if (hoursRemaining > 0 || minutesRemaining > 0) {
        this.remainingTime = `${closestPrayer.name} kurang dari ${
          hoursRemaining ? hoursRemaining + ' jam ' : ''
        }${minutesRemaining} minit`;
      } else {
        this.remainingTime = 'sekarang';
      }
    } else {
      this.remainingTime = 'Tiada solat seterusnya hari ini';
    }
    this.loaded = true;
  }

  // Dark mode detection
  private checkDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.isDarkMode = prefersDark.matches;
    prefersDark.addEventListener('change', (e) => {
      this.isDarkMode = e.matches;
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
      return { color: this.currentPrayerRatio > 0.3 ? '#14AE5C' : 'yellow' };
    }
    if (this.currentPrayer && prayerIndex < currentIndex && now >= subuhDate) {
      return { color: 'red' };
    }
    return { color: 'inherit' };
  }

  prayerTracker: { [key: string]: boolean } = {
    subuh: true,
    dzuhur: true,
    ashar: true,
    maghrib: false,
    isya: false,
  };

  checked: boolean[] = [true, true, true, false, false];

  navigateToPrayerTimes() {
    this.router.navigate(['/tabs/prayerTimes']);
  }

  toggleChecked(number: number) {
    this.checked[number] = !this.checked[number];
  }

  handleRefresh(event: CustomEvent) {
    setTimeout(() => {
      location.reload();
      (event.target as HTMLIonRefresherElement).complete();
    }, 2000);
  }
}
