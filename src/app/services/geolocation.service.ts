import { Injectable } from '@angular/core';
import { registerPlugin } from '@capacitor/core';
import { AlertController } from '@ionic/angular';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';

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
  constructor(
    private alertController: AlertController,
  ) {
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

  private async openAppSettings(): Promise<void> {
    try {
      await NativeSettings.open({
        optionAndroid: AndroidSettings.ApplicationDetails,
        optionIOS: IOSSettings.App,
      });
    } catch (error) {
      console.error('Error opening app settings:', error);
    }
  }

  async showOpenSettingsDialog(): Promise<void> {
    try {
      const alert = await this.alertController.create({
        header: 'Kebenaran Lokasi Diperlukan',
        message:
          'Kebenaran lokasi telah ditolak. Sila benarkan akses lokasi dalam tetapan.',
        buttons: [
          {
            text: 'Batal',
            role: 'cancel',
          },
          {
            text: 'Buka Tetapan',
            handler: async () => {
              await this.openAppSettings();
            },
          },
        ],
        backdropDismiss: false,
      });
      await alert.present();
    } catch (error) {
      console.error('Error opening location settings:', error);
    }
  }

  async getCurrentLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (this.isLocationSupported()) {
        navigator.geolocation.getCurrentPosition(resolve, (error) => {
          let errorMessage = 'Ralat tidak diketahui';
          switch (error.code) {
            case 1:
              errorMessage = 'Kebenaran lokasi ditolak';
              break;
            case 2:
              errorMessage = 'Koordinat lokasi tidak tersedia';
              break;
            case 3:
              errorMessage = 'Permintaan lokasi tamat masa';
              break;
          }
          console.error('Ralat semasa mendapatkan lokasi anda:', error);
          reject(errorMessage);
        });
      } else {
        reject('Servis lokasi tidak disokong oleh pelayar ini');
      }
    });
  }
}
