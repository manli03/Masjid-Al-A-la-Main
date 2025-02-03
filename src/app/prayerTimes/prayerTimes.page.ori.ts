import { Component, OnInit } from '@angular/core';
import { PrayerTimesService } from '../services/PrayerTimes/prayerTimes.service';
import { AlertController } from '@ionic/angular';
import { LocationService } from '../services/Geolocation/geolocation.service';

// Define the prayer type
interface Prayer {
  name: string;
  time: string;
}

@Component({
  selector: 'app-prayerTimes',
  templateUrl: './prayerTimes.page.html',
  styleUrls: ['./prayerTimes.page.scss'],
})
export class prayerTimesPage implements OnInit {
  prayers: Prayer[] = [];
  clickedRow: any = null; // Track clicked row
  closestPrayer: string | null = null;
  remainingTime: string = '';
  location: string = 'Memuatkan lokasi...'; // Initially setting location to "Loading"
  currentDate: Date = new Date();
  currentHijriDate: string = 'Memuatkan tarikh Hijri...';  // Initially setting Hijri date to "Loading"
  zone: string = ''; // Placeholder zone
  showYearlyPrayerTimes: boolean = false; // Flag to control visibility of yearly prayer times
  yearlyPrayers: any[] = [];  // Array to store yearly prayer times

  constructor(
    private prayerTimesService: PrayerTimesService,
    private alertController: AlertController,
    private locationService: LocationService // Inject the location service
  ) { }

  ngOnInit() {
    this.getLocationAndUpdatePrayerTimes();
  }

  // Zone names mapping
  zoneNames: { [key: string]: string } = {
    'JHR01': 'Pulau Aur dan Pulau Pemanggil',
    'JHR02': 'Johor Bharu, Kota Tinggi, Mersing',
    'JHR03': 'Kluang, Pontian',
    'JHR04': 'Batu Pahat, Muar, Segamat, Gemas Johor',
    'KDH01': 'Kota Setar, Kubang Pasu, Pokok Sena (Daerah Kecil)',
    'KDH02': 'Kuala Muda, Yan, Pendang',
    'KDH03': 'Padang Terap, Sik',
    'KDH04': 'Baling',
    'KDH05': 'Bandar Baharu, Kulim',
    'KDH06': 'Langkawi',
    'KDH07': 'Gunung Jerai',
    'KTN01': 'Bachok, Kota Bharu, Machang, Pasir Mas, Pasir Puteh, Tanah Merah, Tumpat, Kuala Krai, Mukim Chiku',
    'KTN03': 'Gua Musang (Daerah Galas Dan Bertam), Jeli',
    'MLK01': 'SELURUH NEGERI MELAKA',
    'NGS01': 'Tampin, Jempol',
    'NGS02': 'Jelebu, Kuala Pilah, Port Dickson, Rembau, Seremban',
    'PHG01': 'Pulau Tioman',
    'PHG02': 'Kuantan, Pekan, Rompin, Muadzam Shah',
    'PHG03': 'Jerantut, Temerloh, Maran, Bera, Chenor, Jengka',
    'PHG04': 'Bentong, Lipis, Raub',
    'PHG05': 'Genting Sempah, Janda Baik, Bukit Tinggi',
    'PHG06': 'Cameron Highlands, Genting Higlands, Bukit Fraser',
    'PLS01': 'Kangar, Padang Besar, Arau',
    'PNG01': 'Seluruh Negeri Pulau Pinang',
    'PRK01': 'Tapah, Slim River, Tanjung Malim',
    'PRK02': 'Kuala Kangsar, Sg. Siput (Daerah Kecil), Ipoh, Batu Gajah, Kampar',
    'PRK03': 'Lenggong, Pengkalan Hulu, Grik',
    'PRK04': 'Temengor, Belum',
    'PRK05': 'Kg Gajah, Teluk Intan, Bagan Datuk, Seri Iskandar, Beruas, Parit, Lumut, Sitiawan, Pulau Pangkor',
    'PRK06': 'Selama, Taiping, Bagan Serai, Parit Buntar',
    'PRK07': 'Bukit Larut',
    'SBH01': 'Bahagian Sandakan (Timur), Bukit Garam, Semawang, Temanggong, Tambisan, Bandar Sandakan',
    'SBH02': 'Beluran, Telupid, Pinangah, Terusan, Kuamut, Bahagian Sandakan (Barat)',
    'SBH03': 'Lahad Datu, Silabukan, Kunak, Sahabat, Semporna, Tungku, Bahagian Tawau (Timur)',
    'SBH04': 'Bandar Tawau, Balong, Merotai, Kalabakan, Bahagian Tawau (Barat)',
    'SBH05': 'Kudat, Kota Marudu, Pitas, Pulau Banggi, Bahagian Kudat',
    'SBH06': 'Gunung Kinabalu',
    'SBH07': 'Kota Kinabalu, Ranau, Kota Belud, Tuaran, Penampang, Papar, Putatan, Bahagian Pantai Barat',
    'SBH08': 'Pensiangan, Keningau, Tambunan, Nabawan, Bahagian Pendalaman (Atas)',
    'SBH09': 'Beaufort, Kuala Penyu, Sipitang, Tenom, Long Pa Sia, Membakut, Weston, Bahagian Pendalaman (Bawah)',
    'SGR01': 'Gombak, Petaling, Sepang, Hulu Langat, Hulu Selangor, Rawang, S.Alam',
    'SGR02': 'Kuala Selangor, Sabak Bernam',
    'SGR03': 'Klang, Kuala Langat',
    'SWK01': 'Limbang, Lawas, Sundar, Trusan',
    'SWK02': 'Miri, Niah, Bekenu, Sibuti, Marudi',
    'SWK03': 'Pandan, Belaga, Suai, Tatau, Sebauh, Bintulu',
    'SWK04': 'Sibu, Mukah, Dalat, Song, Igan, Oya, Balingian, Kanowit, Kapit',
    'SWK05': 'Sarikei, Matu, Julau, Rajang, Daro, Bintangor, Belawai',
    'SWK06': 'Lubok Antu, Sri Aman, Roban, Debak, Kabong, Lingga, Engkelili, Betong, Spaoh, Pusa, Saratok',
    'SWK07': 'Serian, Simunjan, Samarahan, Sebuyau, Meludam',
    'SWK08': 'Kuching, Bau, Lundu, Sematan',
    'SWK09': 'Zon Khas (Kampung Patarikan)',
    'TRG01': 'Kuala Terengganu, Marang, Kuala Nerus',
    'TRG02': 'Besut, Setiu',
    'TRG03': 'Hulu Terengganu',
    'TRG04': 'Dungun, Kemaman',
    'WLY01': 'Kuala Lumpur, Putrajaya',
    'WLY02': 'Labuan'
  };

  // Get the user's current location and update prayer times
  async getLocationAndUpdatePrayerTimes() {
    try {
      const position = await this.locationService.getCurrentLocation();

      // Determine the prayer zone based on the latitude and longitude
      this.zone = this.getZoneBasedOnLocation(position.coords.latitude, position.coords.longitude);

      // Fetch the full zone name from the mapping object
      const fullZoneName = this.zoneNames[this.zone] || 'Zon Tidak Dikenali';

      // Update the location to display the full zone name
      this.location = fullZoneName;

      // Fetch prayer times and Hijri date
      this.fetchTodayPrayerTimes();
    } catch (error) {
      console.error('Error getting location:', error);
      this.showError('Gagal untuk mendapatkan lokasi anda');
    }
  }

  // Fetch today's prayer times and the current Hijri date
  fetchTodayPrayerTimes() {
    this.prayerTimesService.getPrayerTimes(this.zone, 'today').subscribe(
      data => {
        if (data.status === 'OK!') {
          const prayerTimes = data.prayerTime[0];
          this.prayers = [
            { name: 'Imsak', time: prayerTimes.imsak },
            { name: 'Subuh', time: prayerTimes.fajr },
            { name: 'Syuruk', time: prayerTimes.syuruk },
            { name: 'Dhuha', time: prayerTimes.dhuha },
            { name: 'Zuhur', time: prayerTimes.dhuhr },
            { name: 'Asar', time: prayerTimes.asr },
            { name: 'Maghrib', time: prayerTimes.maghrib },
            { name: 'Isyak', time: prayerTimes.isha },
          ];
          this.currentHijriDate = prayerTimes.hijri;
          this.calculateRemainingTime();
        } else {
          this.showError('Gagal untuk mendapatkan waktu solat');
        }
      },
      error => {
        this.showError('Terjadi ralat sewaktu mendapatkan waktu solat');
      }
    );
  }

  // Fetch prayer times for the whole year
  fetchYearlyPrayerTimes() {
    this.prayerTimesService.getPrayerTimes(this.zone, 'year').subscribe(
      data => {
        // console.log("Fetched yearly prayer times: ", data);  // Log the fetched data
        if (data.status === 'OK!') {
          // Assuming the API returns a list of prayer times for the year
          this.yearlyPrayers = data.prayerTime || [];
        } else {
          this.showError('Gagal untuk mendapatkan waktu solat tahunan');
        }
      },
      error => {
        console.error('Error fetching yearly prayer times: ', error); // Log error details
        this.showError('Terjadi ralat sewaktu mendapatkan waktu solat tahunan');
      }
    );
  }

  // Determine the correct zone based on latitude and longitude using the provided data from the PDF
  getZoneBasedOnLocation(lat: number, lon: number): string {
    // Kedah Zones
    if (lat >= 6.0 && lat <= 6.5 && lon >= 99.0 && lon <= 100.5) {
      return 'KDH01'; // Zone 1: Kota Setar, Pokok Sena, Kubang Pasu
    }
    if (lat >= 5.5 && lat <= 6.0 && lon >= 100.0 && lon <= 100.5) {
      return 'KDH02'; // Zone 2: Kuala Muda, Pendang, Yan
    }
    if (lat >= 6.0 && lat <= 6.5 && lon >= 100.5 && lon <= 101.0) {
      return 'KDH03'; // Zone 3: Padang Terap, Sik
    }
    if (lat >= 5.3 && lat <= 5.6 && lon >= 100.5 && lon <= 101.0) {
      return 'KDH04'; // Zone 4: Baling
    }
    if (lat >= 5.1 && lat <= 5.2 && lon >= 100.4 && lon <= 100.7) {
      return 'KDH05'; // Zone 5: Kulim, Bandar Baharu
    }
    if (lat >= 6.2 && lat <= 6.5 && lon >= 99.5 && lon <= 100.0) {
      return 'KDH06'; // Zone 6: Langkawi
    }
    if (lat >= 5.7 && lat <= 6.0 && lon >= 100.4 && lon <= 100.7) {
      return 'KDH07'; // Zone 7: Gunung Jerai
    }

    // Pulau Pinang Zone
    if (lat >= 5.2 && lat <= 5.3 && lon >= 100.1 && lon <= 100.3) {
      return 'PNP01'; // Zone: Pulau Pinang
    }

    // Perak Zones
    if (lat >= 3.8 && lat <= 4.0 && lon >= 101.5 && lon <= 102.0) {
      return 'PRK01'; // Zone 1: Tapah, Slim River, Tanjung Malim
    }
    if (lat >= 4.3 && lat <= 4.6 && lon >= 100.7 && lon <= 101.0) {
      return 'PRK02'; // Zone 2: Ipoh, Batu Gajah, Kampar
    }
    if (lat >= 4.5 && lat <= 5.0 && lon >= 101.0 && lon <= 101.3) {
      return 'PRK03'; // Zone 3: Pengkalan Hulu, Gerik, Lenggong
    }
    if (lat >= 5.0 && lat <= 5.3 && lon >= 101.3 && lon <= 101.7) {
      return 'PRK04'; // Zone 4: Temengor, Belum
    }
    if (lat >= 4.5 && lat <= 4.7 && lon >= 100.5 && lon <= 101.0) {
      return 'PRK05'; // Zone 5: Teluk Intan, Bagan Datuk
    }

    // Selangor Zones
    if (lat >= 3.4 && lat <= 4.0 && lon >= 100.0 && lon <= 101.0) {
      return 'SLG01'; // Zone 1: Hulu Selangor, Gombak, Petaling/Shah Alam, Hulu Langat, Sepang
    }
    if (lat >= 3.5 && lat <= 4.0 && lon >= 100.5 && lon <= 101.5) {
      return 'SLG02'; // Zone 2: Sabak Bernam, Kuala Selangor
    }
    if (lat >= 2.8 && lat <= 3.2 && lon >= 101.0 && lon <= 101.5) {
      return 'SLG03'; // Zone 3: Klang, Kuala Langat
    }

    // Wilayah Persekutuan Zones (Kuala Lumpur and Putrajaya)
    if (lat >= 3.4 && lat <= 3.6 && lon >= 101.2 && lon <= 101.5) {
      return 'WP01'; // Zone 1: Kuala Lumpur, Putrajaya
    }

    // Negeri Sembilan Zones
    if (lat >= 2.5 && lat <= 3.0 && lon >= 102.0 && lon <= 103.0) {
      return 'NS01'; // Zone 1: Jempol, Tampin
    }
    if (lat >= 2.3 && lat <= 2.6 && lon >= 101.5 && lon <= 101.9) {
      return 'NS02'; // Zone 2: Port Dickson, Seremban, Kuala Pilah
    }

    // Melaka Zone
    if (lat >= 2.3 && lat <= 2.5 && lon >= 101.9 && lon <= 102.1) {
      return 'MLK01'; // Zone: Seluruh Negeri Melaka
    }

    // Johor Zones
    if (lat >= 2.5 && lat <= 2.7 && lon >= 104.0 && lon <= 104.5) {
      return 'JHR01'; // Zone 1: Pulau Aur, Pulau Pemangil
    }
    if (lat >= 1.5 && lat <= 2.0 && lon >= 103.0 && lon <= 103.5) {
      return 'JHR02'; // Zone 2: Kota Tinggi, Mersing, Johor Bahru
    }
    if (lat >= 1.4 && lat <= 2.0 && lon >= 102.5 && lon <= 103.0) {
      return 'JHR03'; // Zone 3: Kluang, Pontian
    }
    if (lat >= 2.1 && lat <= 2.4 && lon >= 102.5 && lon <= 103.0) {
      return 'JHR04'; // Zone 4: Batu Pahat, Muar, Segamat, Gemas
    }

    // Kelantan Zones
    if (lat >= 5.9 && lat <= 6.1 && lon >= 101.5 && lon <= 102.0) {
      return 'KLN01'; // Zone 1: Kota Bharu, Bachok, Pasir Puteh, Tumpat, Pasir Mas
    }
    if (lat >= 4.8 && lat <= 5.2 && lon >= 101.5 && lon <= 101.8) {
      return 'KLN02'; // Zone 2: Jeli, Gua Musang, Lojing
    }

    // Terengganu Zones
    if (lat >= 5.0 && lat <= 5.2 && lon >= 102.5 && lon <= 103.0) {
      return 'TRG01'; // Zone 1: Kuala Terengganu, Marang, Kuala Nerus
    }
    if (lat >= 5.2 && lat <= 5.5 && lon >= 102.2 && lon <= 102.5) {
      return 'TRG02'; // Zone 2: Besut, Setiu
    }
    if (lat >= 5.0 && lat <= 5.3 && lon >= 102.3 && lon <= 102.7) {
      return 'TRG03'; // Zone 3: Hulu Terengganu
    }
    if (lat >= 4.5 && lat <= 5.0 && lon >= 102.5 && lon <= 103.0) {
      return 'TRG04'; // Zone 4: Dungun, Kemaman
    }

    // Pahang Zones
    if (lat >= 3.0 && lat <= 3.2 && lon >= 102.5 && lon <= 103.0) {
      return 'PHG01'; // Zone 1: Pulau Tioman
    }
    if (lat >= 3.0 && lat <= 3.5 && lon >= 102.7 && lon <= 103.0) {
      return 'PHG02'; // Zone 2: Rompin, Pekan, Muadzam Shah, Kuantan
    }
    if (lat >= 3.3 && lat <= 3.6 && lon >= 102.0 && lon <= 102.3) {
      return 'PHG03'; // Zone 3: Maran, Temerloh, Bera
    }
    if (lat >= 3.6 && lat <= 3.9 && lon >= 101.7 && lon <= 102.0) {
      return 'PHG04'; // Zone 4: Bentong, Raub, Lipis
    }

    // Sabah Zones
    if (lat >= 5.3 && lat <= 5.5 && lon >= 117.5 && lon <= 118.0) {
      return 'SBH01'; // Zone 1: Sandakan (East)
    }

    // Fallback for unmatched zones
    return 'Unknown Zone';
  }

  // Calculate remaining time for the closest prayer
  calculateRemainingTime() {
    const currentTime = new Date();
    let closestPrayerTime: Prayer | null = null;
    let minTimeDiff = Infinity;

    this.prayers.forEach(prayer => {
      const [hours, minutes] = prayer.time.split(':').map(num => parseInt(num, 10));
      const prayerTime = new Date();
      prayerTime.setHours(hours);
      prayerTime.setMinutes(minutes);
      prayerTime.setSeconds(0);

      const timeDiff = prayerTime.getTime() - currentTime.getTime();

      if (timeDiff > 0 && timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestPrayerTime = prayer;
      }
    });

    if (closestPrayerTime) {
      this.closestPrayer = (closestPrayerTime as Prayer).name;
      const hoursRemaining = Math.floor(minTimeDiff / (1000 * 3600));
      const minutesRemaining = Math.floor((minTimeDiff % (1000 * 3600)) / (1000 * 60));
      if (hoursRemaining > 0 || minutesRemaining > 0) {
        this.remainingTime = `Dalam ${hoursRemaining > 0 ? hoursRemaining + ' jam ' : ''}${minutesRemaining} minit`;
      } else {
        this.remainingTime = 'sekarang';
      }
    } else if (this.prayers.length === 0) {
      // If there are no prayers for current date, fetch prayer times for the next day and 
      // show next day closest prayers from now
      
    } else {
      this.remainingTime = 'Tiada solat terdekat pada masa ini';
    }
  }

  // Show error alert
  async showError(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  // Toggle the visibility of the yearly prayer times table
  viewYearlyPrayerTimes() {
    this.fetchYearlyPrayerTimes();  // Fetch prayer times for the year when the view is shown
    this.showYearlyPrayerTimes = true;
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
    console.log('Clicked row:', this.clickedRow);
  }


  // Convert a time string (HH:mm:ss) into a Date object
  convertTimeToDate(time: string): Date {
    const date = new Date();
    const [hours, minutes, seconds] = time.split(':').map(num => parseInt(num, 10));
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(seconds);
    return date;
  }


  // Navigate back to the main prayer times
  backToMainPrayerTimes() {
    this.showYearlyPrayerTimes = false;
  }

  setReminder(prayerName: string) {
    alert(`Peringatan ditetapkan untuk ${prayerName}`);
  }
}
