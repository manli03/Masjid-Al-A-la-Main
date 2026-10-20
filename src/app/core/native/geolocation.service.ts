import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
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
    return new Promise((resolve, reject) => {
      const finish = (enabled: boolean, error?: unknown) => {
        clearTimeout(timer);
        window.removeEventListener('onGpsEnabled', gpsEnabledListener);
        window.removeEventListener('onGpsDisabled', gpsDisabledListener);
        if (error) reject(error);
        else resolve(enabled);
      };
      const gpsEnabledListener = () => {
        finish(true);
      };

      const gpsDisabledListener = () => {
        finish(false);
      };

      window.addEventListener('onGpsEnabled', gpsEnabledListener);
      window.addEventListener('onGpsDisabled', gpsDisabledListener);

      const timer = setTimeout(() => finish(false, new Error('Semakan GPS tamat masa.')), 5000);
      GpsEnabler.isGpsEnabled().catch((error) => finish(false, error));
    });
  }

  async ensureLocationEnabled(prompt = false): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return true;
    if (await this.isEnabled()) return true;
    if (prompt) {
      const alert = await this.alertController.create({
        header: 'Aktifkan Lokasi (GPS)',
        message: 'Lokasi (GPS) perlu dihidupkan untuk menggunakan lokasi semasa dan menentukan arah kiblat. Buka tetapan dan aktifkan lokasi, kemudian kembali ke aplikasi.',
        buttons: [
          { text: 'Batal', role: 'cancel' },
          {
            text: 'Buka Tetapan',
            handler: () => { void this.openLocationSettings(); },
          },
        ],
      });
      await alert.present();
      await alert.onDidDismiss();
    }
    return false;
  }

  private async openLocationSettings(): Promise<void> {
    try {
      await NativeSettings.openAndroid({ option: AndroidSettings.Location });
    } catch {
      // Keep manual instructions available when the settings activity is unavailable.
      const alert = await this.alertController.create({
        header: 'Aktifkan Lokasi (GPS)',
        message: 'Sila buka Tetapan telefon > Lokasi dan hidupkan lokasi. Kemudian kembali ke aplikasi. Lokasi GPS akan dikemas kini secara automatik.',
        buttons: ['Faham'],
      });
      await alert.present();
    }
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
      const isNative = Capacitor.isNativePlatform();
      const alert = await this.alertController.create({
        header: 'Kebenaran Lokasi Diperlukan',
        message:
          isNative
            ? 'Akses lokasi diperlukan untuk menggunakan GPS. Sila benarkan kebenaran lokasi aplikasi dalam tetapan, kemudian kembali ke aplikasi untuk mengemas kini GPS secara automatik.'
            : 'Akses lokasi diperlukan untuk menggunakan GPS. Sila hidupkan lokasi peranti dan benarkan akses lokasi dalam tetapan laman pelayar, kemudian kembali ke aplikasi untuk mengemas kini GPS secara automatik.',
        buttons: [
          {
            text: 'Batal',
            role: 'cancel',
          },
          {
            text: isNative ? 'Buka Tetapan' : 'Faham',
            handler: async () => {
              if (isNative) await this.openAppSettings();
            },
          },
        ],
        backdropDismiss: false,
      });
      await alert.present();
      await alert.onDidDismiss();
    } catch (error) {
      console.error('Error opening location settings:', error);
    }
  }

  async getCurrentLocation(options?: PositionOptions): Promise<GeolocationPosition> {
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
        }, options);
      } else {
        reject('Servis lokasi tidak disokong oleh pelayar ini');
      }
    });
  }
}
