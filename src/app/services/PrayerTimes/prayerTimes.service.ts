import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PrayerTimesService {
  private apiUrl = 'https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat';
  private userZoneApiUrl = 'https://mpt.i906.my/api/prayer';  // New API URL to fetch the zone code

  constructor(private http: HttpClient) { }

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

  // Save the fetched prayer times into localStorage
  saveYearlyPrayerTimes(zone: string, yearlyPrayers: any[]) {
    const data = {
      zone: zone,
      prayers: yearlyPrayers,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('yearlyPrayerTimes', JSON.stringify(data));
  }

  // Retrieve saved yearly prayer times from localStorage
  getSavedYearlyPrayerTimes(): any {
    const savedData = localStorage.getItem('yearlyPrayerTimes');
    if (savedData) {
      return JSON.parse(savedData);
    }
    return null;
  }

  // Check if the stored location is the same as the current one
  isLocationChanged(newLocation: string): boolean {
    const savedData = this.getSavedYearlyPrayerTimes();
    if (savedData && savedData.zone !== newLocation) {
      return true;
    }
    return false;
  }
}
