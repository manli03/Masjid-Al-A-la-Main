import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  constructor() {}

  // Check if geolocation is supported in the browser
  isLocationSupported(): boolean {
    return 'geolocation' in navigator;
  }

  // Get the current location of the user
  getCurrentLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (this.isLocationSupported()) {
        navigator.geolocation.getCurrentPosition(resolve, (error) => {
          let errorMessage = 'Unknown error';
          switch (error.code) {
            case 1:
              errorMessage = 'Location Permission denied';
              break;
            case 2:
              errorMessage = 'Location Position unavailable';
              break;
            case 3:
              errorMessage = 'Timeout expired';
              break;
          }
          reject(errorMessage);
        });
      } else {
        reject('Geolocation is not supported by this browser');
      }
    });
  }

}
