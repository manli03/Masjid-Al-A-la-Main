import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { from, map, Observable } from 'rxjs';
import { Filesystem, Directory } from '@capacitor/filesystem';

@Injectable({
  providedIn: 'root',
})
export class PrayerTimesService {
  private prayerApiUrl =
    'https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat'; // API URL to fetch prayer times
  private userZoneApiUrl = 'https://mpt.i906.my/api/prayer'; // API URL to fetch the zone code
  private compassApiUrl = 'https://api.aladhan.com/v1/qibla'; // API URL to fetch the compass data

  constructor(private http: HttpClient) {}

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
    yearlyPrayers: any[]
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
      })
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
}
