import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, Platform } from '@ionic/angular';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';

declare const AbsoluteOrientationSensor: any; // Declare AbsoluteOrientationSensor to avoid TypeScript errors

@Component({
  selector: 'app-qiblaCompass',
  templateUrl: './qiblaCompass.page.html',
  styleUrls: ['./qiblaCompass.page.scss'],
})
export class qiblaCompassPage implements OnInit, OnDestroy {
  compassHeading: number = 0;
  displayHeading: number = 0;
  errorMessageCompass: string | null = null;
  qiblaHeading: number = 292; // Qibla heading for Malaysia
  isQiblaAligned: boolean = false;
  loadPage: boolean = false;
  private sensor: any;
  accumulatedRotation: number = 0;
  previousHeading: number | null = null;


  constructor(
    private alertController: AlertController,
    private platform: Platform,
    private router: Router
  ) { }

  ngOnInit() {
    this.platform.ready().then(() => {
      this.checkCompassSupport();
    }).catch(err => {
      console.error('Platform not ready', err);
    });

    this.platform.resume.subscribe(() => {
      this.checkCompassSupport();
    });
  }

  async checkCompassSupport() {
    // Check for sensor permissions and support
    if (!('AbsoluteOrientationSensor' in window)) {
      this.errorMessageCompass = 'Peranti tidak menyokong kompas.';
      this.loadPage = false;
      return;
    }
  
    const sensor = new AbsoluteOrientationSensor({ frequency: 60, referenceFrame: 'device' });
  
    try {
      // Check permissions for accelerometer, magnetometer, and gyroscope
      const results = await Promise.all([
        navigator.permissions.query({ name: "accelerometer" as any }),
        navigator.permissions.query({ name: "magnetometer" as any }),
        navigator.permissions.query({ name: "gyroscope" as any }),
      ]);
  
      if (results.every((result) => result.state === "granted")) {
        // Start the sensor if permissions are granted
        this.loadPage = true;
        this.sensor = sensor;
        this.startCompass();
      } else {
        this.loadPage = false;
        this.errorMessageCompass = 'Tiada kebenaran untuk menggunakan AbsoluteOrientationSensor.';
        console.log("No permissions to use AbsoluteOrientationSensor.");
      }
    } catch (error) {
      this.loadPage = false;
      this.errorMessageCompass = 'Tidak dapat mengakses kompas.';
      console.error('Compass permission error:', error);
    }
  }
  

  startCompass() {
    this.sensor.addEventListener('reading', () => {
      const [x, y, z, w] = this.sensor.quaternion;

      // Standard formula for compass heading from quaternion
      let yaw = Math.atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z)) * (180 / Math.PI);

      // Invert the yaw to reverse the rotation direction
      yaw = -yaw;

      // Adjust yaw to be within 0-360 degrees
      if (yaw < 0) {
        yaw += 360;
      }

      this.compassHeading = yaw;

      // Initialize accumulated rotation to the starting position
      if (this.previousHeading === null) {
        this.accumulatedRotation = yaw - 291; // Set initial offset
      } else {
        // Calculate accumulated rotation for continuous rotation
        let difference = yaw - this.previousHeading;

        // Adjust difference to be minimal across the 0/360 boundary
        if (difference > 180) {
          difference -= 360;
        } else if (difference < -180) {
          difference += 360;
        }

        this.accumulatedRotation += difference;
      }

      this.previousHeading = yaw;
      this.displayHeading = this.compassHeading;
      this.checkQiblaAlignment();
    });

    this.sensor.addEventListener('error', (event: { error: { name: string; }; }) => {
      if (event.error.name === 'NotReadableError') {
        this.errorMessageCompass = 'Sensor tidak tersedia.';
      }
    });

    this.sensor.start();
  }

  checkQiblaAlignment() {
    const tolerance = 5; // Allowable deviation in degrees
    const headingDiff = Math.abs(this.compassHeading - this.qiblaHeading);
    this.isQiblaAligned = headingDiff <= tolerance || headingDiff >= (360 - tolerance);
  }

  ngOnDestroy() {
    if (this.sensor) {
      this.sensor.stop(); // Stop the sensor if necessary
    }
  }

  async presentAlert(header: string, message: string, btnText: string, anyFunction: () => void) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: [{ text: btnText, handler: () => { anyFunction(); } }],
      backdropDismiss: false,
      mode: 'ios'
    });

    await alert.present();
  }

  handleRefresh(event: CustomEvent) {
    setTimeout(() => {
      // Reload Page
      location.reload();
      (event.target as HTMLIonRefresherElement).complete();
    }, 2000);
  }

  goBack() {
    this.router.navigateByUrl('/tabs/home');
  }
}
