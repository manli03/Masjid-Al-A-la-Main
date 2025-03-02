import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root',
})
export class PrayerTimesService {
  private apiUrl =
    'https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat';
  private userZoneApiUrl = 'https://mpt.i906.my/api/prayer'; // New API URL to fetch the zone code

  constructor(private http: HttpClient) {}

  // Fetch prayer times for the whole year
  getPrayerTimes(zone: string, period: string): Observable<any> {
    const url = `${this.apiUrl}&period=${period}&zone=${zone}`;
    return this.http.get<any>(url);
  }

  // Fetch user zone based on latitude and longitude
  getUserZoneCode(latitude: number, longitude: number): Observable<any> {
    const url = `${this.userZoneApiUrl}/${latitude},${longitude}`;
    return this.http.get<any>(url);
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
