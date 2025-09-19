import { Injectable } from '@angular/core';
import { registerPlugin } from '@capacitor/core';

// Register the custom plugin
const GpsEnabler = registerPlugin<GpsEnablerPlugin>('GpsEnabler');

interface GpsEnablerPlugin {
  showGpsDialog: () => Promise<void>;
  isGpsEnabled: () => Promise<void>;
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  constructor() {
  }

  enableGps() {
    // console.log('Plugins:', Capacitor.Plugins);
    try {
      // Show native GPS dialog
      GpsEnabler.showGpsDialog();
      console.log('GPS dialog shown');
    } catch (error) {
      console.error('GPS Error:', error);
    }
  }

  async checkGpsStatus(): Promise<boolean> {

    return new Promise((resolve) => {
      const gpsEnabledListener = () => {
        window.removeEventListener('onGpsEnabled', gpsEnabledListener);
        window.removeEventListener('onGpsDisabled', gpsDisabledListener);
        console.log('GPS enabled');
        resolve(true);
      };

      const gpsDisabledListener = () => {
        window.removeEventListener('onGpsEnabled', gpsEnabledListener);
        window.removeEventListener('onGpsDisabled', gpsDisabledListener);
        console.log('GPS disabled');
        this.enableGps();
        resolve(false);
      };

      window.addEventListener('onGpsEnabled', gpsEnabledListener);
      window.addEventListener('onGpsDisabled', gpsDisabledListener);

      GpsEnabler.isGpsEnabled();
    });
  }

  async isEnabled(): Promise<boolean> {
    return new Promise((resolve) => {
      const gpsEnabledListener = () => {
        window.removeEventListener('onGpsEnabled', gpsEnabledListener);
        window.removeEventListener('onGpsDisabled', gpsDisabledListener);
        console.log('GPS enabled');
        resolve(true);
      };

      const gpsDisabledListener = () => {
        window.removeEventListener('onGpsEnabled', gpsEnabledListener);
        window.removeEventListener('onGpsDisabled', gpsDisabledListener);
        console.log('GPS disabled');
        resolve(false);
      };

      window.addEventListener('onGpsEnabled', gpsEnabledListener);
      window.addEventListener('onGpsDisabled', gpsDisabledListener);

      GpsEnabler.isGpsEnabled();
    });
  }

  isLocationSupported(): boolean {
    return 'geolocation' in navigator;
  }

  async getCurrentLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (this.isLocationSupported()) {
        navigator.geolocation.getCurrentPosition(resolve, (error) => {
          let errorMessage = 'Unknown error';
          switch (error.code) {
            case 1:
              errorMessage = 'Kebenaran lokasi ditolak';
              break;
            case 2:
              errorMessage = 'Posisi lokasi tidak tersedia';
              break;
            case 3:
              errorMessage = 'Waktu tamat';
              break;
          }
          console.error('Ralat semasa mendapatkan lokasi anda:', error);
          reject(errorMessage);
        });
      } else {
        reject('Geolocation tidak disokong oleh pelayar ini');
      }
    });
  }
}
