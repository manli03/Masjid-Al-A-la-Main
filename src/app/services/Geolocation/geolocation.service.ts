import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { ToastController } from '@ionic/angular';

// Register the custom plugin
const GpsEnabler = registerPlugin<GpsEnablerPlugin>('GpsEnabler');

interface GpsEnablerPlugin {
  showGpsDialog: () => Promise<void>;
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  constructor(private toastController: ToastController) {}

  async enableGps() {
    // console.log('Plugins:', Capacitor.Plugins);
    try {
      // Show native GPS dialog
      await GpsEnabler.showGpsDialog();
      console.log('GPS dialog shown');

      // Listen for events
      window.addEventListener('onGpsEnabled', () => this.handleGpsEnabled());
      window.addEventListener('onGpsDisabled', () => this.handleGpsDisabled());
    } catch (error) {
      console.error('GPS Error:', error);
    }
  }

  handleGpsEnabled() {
    console.log('GPS enabled');
    // Use location services
  }

  handleGpsDisabled() {
    console.log('GPS disabled');
    // Show error message
    this.showToast(
      'GPS is disabled. Please enable it to use location services.',
      'danger'
    );
  }

  isLocationSupported(): boolean {
    return 'geolocation' in navigator;
  }

  async getCurrentLocation(): Promise<GeolocationPosition> {
    if (Capacitor.getPlatform() === 'android') {
      await this.enableGps();
    }
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
          this.showToast('Ralat: ' + errorMessage, 'danger');
          reject(errorMessage);
        });
      } else {
        reject('Geolocation tidak disokong oleh pelayar ini');
      }
    });
  }

  // Implementing the showToast method
  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'bottom',
    });
    toast.present();
  }
}
