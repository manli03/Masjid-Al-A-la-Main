import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, Platform } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { PrayerTimesService } from 'src/app/services/PrayerTimes/prayerTimes.service';

declare const AbsoluteOrientationSensor: any; // Declare AbsoluteOrientationSensor to avoid TypeScript errors

@Component({
  selector: 'app-qibla-compass',
  templateUrl: './qibla-compass.component.html',
  styleUrls: ['./qibla-compass.component.scss'],
})
export class QiblaCompassComponent implements OnInit, OnDestroy {
  compassHeading: number = 0;
  displayHeading: number = 0;
  errorMessageCompass: string | null = null;
  qiblaHeading: number = 292; // Default qibla heading
  qiblaImageUrl: string = '../../assets/icon/kompasKiblat2.png';
  isQiblaAligned: boolean = false;
  loadPage: boolean = false;
  private sensor: any;
  accumulatedRotation: number = 0;
  previousHeading: number | null = null;

  constructor(
    private alertController: AlertController,
    private platform: Platform,
    private prayerTimesService: PrayerTimesService
  ) {}

  ngOnInit() {
    this.platform
      .ready()
      .then(() => {
        this.checkCompassSupport();
      })
      .catch((err) => {
        console.error('Platform not ready', err);
      });

    this.platform.resume.subscribe(() => {
      this.checkCompassSupport();
    });
    this.loadCompassResources();
  }

  async loadCompassResources() {
    this.qiblaHeading = await firstValueFrom(
      this.prayerTimesService.getQiblaDirection()
    );
    console.log('Qibla heading:', this.qiblaHeading);

    // When offline: Try to load cached image
    const cachedImage = await this.prayerTimesService.getCachedQiblaImage();
    if (cachedImage) {
      this.qiblaImageUrl = cachedImage;
      console.log('Loaded cached image');
    } else {
      // Fallback: Render a compass locally (see previous solution)
      console.error('Failed to load cached image');
      this.qiblaImageUrl = '../../assets/icon/kompasKiblat2.png';
    }
  }

  async checkCompassSupport() {
    // Check for sensor permissions and support
    if (!('AbsoluteOrientationSensor' in window)) {
      this.errorMessageCompass = 'Peranti tidak menyokong kompas.';
      this.loadPage = false;
      return;
    }

    const sensor = new AbsoluteOrientationSensor({
      frequency: 60,
      referenceFrame: 'device',
    });

    try {
      // Check permissions for accelerometer, magnetometer, and gyroscope
      const results = await Promise.all([
        navigator.permissions.query({ name: 'accelerometer' as any }),
        navigator.permissions.query({ name: 'magnetometer' as any }),
        navigator.permissions.query({ name: 'gyroscope' as any }),
      ]);

      if (results.every((result) => result.state === 'granted')) {
        // Start the sensor if permissions are granted
        this.loadPage = true;
        this.sensor = sensor;
        this.startCompass();
      } else {
        this.loadPage = false;
        this.errorMessageCompass =
          'Tiada kebenaran untuk menggunakan AbsoluteOrientationSensor.';
        console.log('No permissions to use AbsoluteOrientationSensor.');
      }
    } catch (error) {
      this.loadPage = false;
      this.errorMessageCompass = 'Tidak dapat mengakses kompas.';
      console.error('Compass permission error:', error);
    }
  }

  startCompass() {
    let alpha = 0.2; // Low-pass filter factor for noise reduction
    let previousYaw = 0;

    this.sensor.addEventListener('reading', () => {
      const [x, y, z, w] = this.sensor.quaternion;

      // Calculate Yaw
      let yaw =
        Math.atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z)) *
        (180 / Math.PI);

      // Invert the yaw to reverse the rotation direction
      yaw = -yaw;
      // Adjust yaw to be within 0-360 degrees
      if (yaw < 0) yaw += 360;

      // Low-pass filter to stabilize
      yaw = alpha * yaw + (1 - alpha) * previousYaw;

      this.compassHeading = yaw;
      previousYaw = yaw;

      // Initialize accumulated rotation to the starting position
      if (this.previousHeading === null) {
        this.accumulatedRotation = yaw; // Set initial offset
      } else {
        // Calculate accumulated rotation for continuous rotation
        let difference = yaw - this.previousHeading;

        // Adjust difference to be minimal across the 0/360 boundary
        if (difference > 180) difference -= 360;
        if (difference < -180) difference += 360;

        this.accumulatedRotation += difference;

        // Magnetic distortion auto-reset
        if (Math.abs(difference) > 30) {
          console.warn('Magnetic distortion detected, resetting...');
          this.accumulatedRotation = yaw;
        }
      }

      this.previousHeading = yaw;
      this.displayHeading = this.compassHeading;
      this.checkQiblaAlignment();
    });

    this.sensor.addEventListener(
      'error',
      (event: { error: { name: string } }) => {
        if (event.error.name === 'NotReadableError') {
          this.errorMessageCompass = 'Sensor tidak tersedia.';
        }
      }
    );

    this.sensor.start();
  }

  checkQiblaAlignment() {
    const tolerance = 1; // Allowable deviation in degrees
    const headingDiff = Math.abs(this.compassHeading - this.qiblaHeading);
    this.isQiblaAligned =
      headingDiff <= tolerance || headingDiff >= 360 - tolerance;
  }

  ngOnDestroy() {
    if (this.sensor) {
      this.sensor.stop(); // Stop the sensor if necessary
    }
  }

  async presentAlert(
    header: string,
    message: string,
    btnText: string,
    anyFunction: () => void
  ) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: [
        {
          text: btnText,
          handler: () => {
            anyFunction();
          },
        },
      ],
      backdropDismiss: false,
      mode: 'ios',
    });

    await alert.present();
  }
}