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
  prayerNames = ['Subuh', 'Zuhur', 'Asar', 'Maghrib', 'Isyak'];
  currentLocation: string = 'Memuatkan lokasi...';
  currentHijriDate: string = '';
  currentTime: string = '';
  remainingTime: string = '';
  prayerTimes: { [key: string]: string } = {};
  zoneNames: { [key: string]: string };
  private intervalId: any;
  isDarkMode = false;
  currentPrayerName: string = '';

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
    this.startUpdatingTime();
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
        this.prayerTimes = {
          subuh: this.formatPrayerTime(prayerData.fajr),
          zuhur: this.formatPrayerTime(prayerData.dhuhr),
          asar: this.formatPrayerTime(prayerData.asr),
          maghrib: this.formatPrayerTime(prayerData.maghrib),
          isyak: this.formatPrayerTime(prayerData.isha),
        };
        this.currentHijriDate = this.formatHijriDate(prayerData.hijri);
      }
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
      this.currentTime = now.toLocaleTimeString('ms-MY', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      });
      this.calculateRemainingTime(now);
    }, 1000);
  }

  // Update calculateRemainingTime to track current prayer
  private calculateRemainingTime(now: Date) {
  let closestPrayer: { name: string; time: string; date: Date } | null = null;
  let currentPrayer: { name: string; time: string; date: Date } | null = null;
  let minDiff = Infinity;
  let previousPrayerDate: Date | null = null;

  this.prayerNames.forEach((prayerName) => {
    const time = this.prayerTimes[prayerName.toLowerCase()];
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create initial prayer time with current date
    let prayerDate = new Date(now);
    prayerDate.setHours(hours, minutes, 0, 0);

    // Adjust date if prayer time is earlier than previous prayer
    if (previousPrayerDate && prayerDate < previousPrayerDate) {
      prayerDate.setDate(prayerDate.getDate() + 1);
    }

    // Update previous prayer reference
    previousPrayerDate = prayerDate;

    // Check if current time is within this prayer period
    if (now >= prayerDate) {
      currentPrayer = { name: prayerName, time, date: prayerDate };
    }

    // Calculate time difference for closest prayer
    const diff = prayerDate.getTime() - now.getTime();
    if (diff > 0 && diff < minDiff) {
      minDiff = diff;
      closestPrayer = { name: prayerName, time, date: prayerDate };
    }
  });

  // Handle midnight crossover for current prayer
  if (!currentPrayer) {
    // Check if we're between last prayer of yesterday and first prayer of today
    const lastPrayerName = this.prayerNames[this.prayerNames.length - 1];
    const lastPrayerTime = this.prayerTimes[lastPrayerName.toLowerCase()];
    const [lastHours, lastMinutes] = lastPrayerTime.split(':').map(Number);
    const lastPrayerDate = new Date(now);
    lastPrayerDate.setHours(lastHours, lastMinutes, 0, 0);
    
    if (now >= lastPrayerDate) {
      currentPrayer = { 
        name: lastPrayerName, 
        time: lastPrayerTime, 
        date: lastPrayerDate 
      };
    }
  }

  this.currentPrayerName = currentPrayer?.name || '';
  this.updateRemainingTimeDisplay(minDiff, closestPrayer || undefined);
}

  private updateRemainingTimeDisplay(
    diff: number,
    closestPrayer?: { name: string; time: string }
  ) {
    if (closestPrayer && diff !== Infinity) {
      const hours = Math.floor(diff / (1000 * 3600));
      const minutes = Math.floor((diff % (1000 * 3600)) / (1000 * 60));
      this.remainingTime = `${closestPrayer.name} kurang daripada ${
        hours ? `${hours} jam ` : ''
      }${minutes} minit`;
    } else {
      this.remainingTime = 'Tiada solat seterusnya hari ini';
    }
  }

  // Dark mode detection
  private checkDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.isDarkMode = prefersDark.matches;
    prefersDark.addEventListener('change', (e) => {
      this.isDarkMode = e.matches;
    });
  }

  // Icon path resolver
  getPrayerIconSrc(prayerName: string): string {
    const basePath = '../../assets/icon/';
    const normalizedName = prayerName.toLowerCase();

    if (prayerName === this.currentPrayerName) {
      return `${basePath}${normalizedName}-green.svg`;
    }

    return this.isDarkMode
      ? `${basePath}${normalizedName}-white.svg`
      : `${basePath}${normalizedName}.svg`;
  }

  getPrayerStyle(prayerName: string): { color: string } {
    const isCurrent =
      prayerName.toLowerCase() === this.currentPrayerName.toLowerCase();
    return { color: isCurrent ? '#14AE5C' : 'inherit' };
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
