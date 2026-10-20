import { Component, OnDestroy, OnInit, NgZone } from '@angular/core';
import { AlertController, Platform } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { PrayerTimesService } from 'src/app/features/prayer/services/prayer-times.service';

// Declare sensor types to avoid TypeScript errors
declare const AbsoluteOrientationSensor: any;
declare global {
  interface Window {
    AbsoluteOrientationSensor?: any; // Use optional chaining for safety
  }
}

// --- Calibration Detection Parameters ---
const CALIBRATION_WINDOW_SIZE = 180; // Number of samples (~3 seconds at 60Hz)
const CALIBRATION_PITCH_THRESHOLD = 60; // Min degrees change required for pitch
const CALIBRATION_ROLL_THRESHOLD = 60; // Min degrees change required for roll
const CALIBRATION_YAW_THRESHOLD = 120; // Min degrees change required for yaw (using helper function)
// ---------------------------------------

@Component({
  selector: 'app-qibla-compass',
  templateUrl: './qibla-compass.component.html',
  styleUrls: ['./qibla-compass.component.scss'],
})
export class QiblaCompassComponent implements OnInit, OnDestroy {
  // Compass State
  compassHeading: number = 0;
  displayHeading: number = 0;
  qiblaHeading: number = 292; // Default qibla heading
  qiblaImageUrl: string = '../../assets/icon/kompasKiblat2.png';
  isQiblaAligned: boolean = false;
  accumulatedRotation: number = 0;
  previousHeading: number | null = null;

  // UI and Calibration State
  uiState: 'initial' | 'calibrating' | 'calibrated' | 'error' | 'unsupported' =
    'initial';
  errorMessageCompass: string | null = null;
  calibrationGifUrl: string = '../../assets/calibratecompass.gif'; // Ensure this path is correct

  // Sensor Management
  private sensor: any; // Can be used for calibration detection OR compass
  private sensorSubscription: (() => void) | null = null; // For cleanup
  private isSensorActive: boolean = false;

  // Calibration Detection Data
  private calibrationData: { pitch: number[]; roll: number[]; yaw: number[] } =
    { pitch: [], roll: [], yaw: [] };
  private calibrationStartTime: number | null = null;
  private CALIBRATION_TIMEOUT = 30000; // 30 seconds timeout for calibration attempt

  constructor(
    private alertController: AlertController,
    private platform: Platform,
    private prayerTimesService: PrayerTimesService,
    private ngZone: NgZone // Inject NgZone for running updates within Angular's context
  ) {}

  ngOnInit() {
    this.loadCompassResources(); // Load image and Qibla heading early

    // Handle app resume: Reset state and require calibration again
    this.platform.resume.subscribe(() => {
      console.log('App resumed, resetting compass state.');
      this.ngZone.run(() => {
        // Ensure updates run in Angular zone
        this.resetCompassState();
      });
    });

    // Initial state check (useful if component is reused without full reload)
    this.resetCompassState();
  }

  ngOnDestroy() {
    this.stopSensor();
    // Consider unsubscribing from platform.resume if needed
  }

  // --- State Management ---

  resetCompassState() {
    this.stopSensor();
    this.uiState = 'initial';
    this.errorMessageCompass = null;
    this.isQiblaAligned = false;
    this.compassHeading = 0;
    this.displayHeading = 0;
    this.accumulatedRotation = 0;
    this.previousHeading = null;
    this.calibrationData = { pitch: [], roll: [], yaw: [] };
    this.calibrationStartTime = null;
    console.log('Compass state reset to initial.');
  }

  // --- Resource Loading ---

  async loadCompassResources() {
    try {
      this.qiblaHeading = await firstValueFrom(
        this.prayerTimesService.getQiblaDirection()
      );
      console.log('Qibla heading:', this.qiblaHeading);
    } catch (error) {
      console.error('Error getting Qibla direction:', error);
      this.qiblaHeading = 292; // Fallback
    }

    const cachedImage = await this.prayerTimesService.getCachedQiblaImage();
    if (cachedImage) {
      this.qiblaImageUrl = cachedImage;
      console.log('Loaded cached image');
    } else {
      this.qiblaImageUrl = '../../assets/icon/kompasKiblat2.png';
      console.log('Using default compass image.');
    }
  }

  // --- Button Action ---

  async startCalibrationProcess() {
    console.log('Starting calibration process...');
    this.uiState = 'calibrating';
    this.errorMessageCompass = null; // Clear previous errors
    this.checkSupportAndStartDetection();
  }

  // Manual completion of calibration
  manualCompleteCalibration() {
    console.log('Manual calibration completion triggered.');
    this.completeCalibration();
  }

  // --- Sensor Handling and Calibration ---

  async checkSupportAndStartDetection() {
    if (!('AbsoluteOrientationSensor' in window)) {
      this.ngZone.run(() => {
        this.errorMessageCompass =
          'Peranti tidak menyokong kompas (AbsoluteOrientationSensor).';
        this.uiState = 'unsupported';
      });
      console.error('AbsoluteOrientationSensor not supported.');
      return;
    }

    try {
      const results = await Promise.all([
        navigator.permissions.query({ name: 'accelerometer' as any }),
        navigator.permissions.query({ name: 'magnetometer' as any }),
        navigator.permissions.query({ name: 'gyroscope' as any }),
      ]);

      if (
        results.every(
          (result) => result.state === 'granted' || result.state === 'prompt'
        )
      ) {
        console.log('Sensor permissions granted or prompt.');
        this.initializeSensorForCalibration();
      } else {
        throw new Error('Required sensor permissions denied.');
      }
    } catch (error: any) {
      this.ngZone.run(() => {
        this.errorMessageCompass = `Tiada kebenaran sensor (${
          error.message || error
        }). Sila benarkan akses sensor dalam tetapan pelayar/peranti anda.`;
        this.uiState = 'error';
      });
      console.error('Sensor permission error:', error);
    }
  }

  initializeSensorForCalibration() {
    try {
      this.stopSensor(); // Ensure any previous sensor is stopped

      this.sensor = new AbsoluteOrientationSensor({
        frequency: 60,
        referenceFrame: 'device',
      });

      this.sensorSubscription = () => this.handleCalibrationReading(); // Assign the handler
      this.sensor.addEventListener('reading', this.sensorSubscription);

      this.sensor.addEventListener('error', (event: any) => {
        console.error(
          'Sensor error during calibration:',
          event.error.name,
          event.error.message
        );
        this.ngZone.run(() => {
          if (event.error.name === 'NotReadableError') {
            this.errorMessageCompass =
              'Sensor tidak tersedia atau tidak dapat dibaca. Cuba mulakan semula.';
          } else if (event.error.name === 'SecurityError') {
            this.errorMessageCompass =
              'Akses sensor disekat atas sebab keselamatan (mungkin bukan HTTPS?).';
          } else if (event.error.name === 'NotAllowedError') {
            this.errorMessageCompass =
              'Kebenaran untuk mengakses sensor tidak diberikan.';
          } else {
            this.errorMessageCompass = `Ralat sensor: ${event.error.name}`;
          }
          this.uiState = 'error';
          this.stopSensor(); // Stop on error
        });
      });

      this.sensor.start();
      this.isSensorActive = true;
      this.calibrationStartTime = Date.now(); // Start timeout timer
      console.log('Sensor started for calibration detection.');
    } catch (error: any) {
      this.ngZone.run(() => {
        console.error('Error initializing AbsoluteOrientationSensor:', error);
        this.errorMessageCompass = `Tidak dapat memulakan sensor (${
          error.message || 'Ralat tidak diketahui'
        }).`;
        if (error.name === 'SecurityError') {
          this.errorMessageCompass =
            'Akses sensor memerlukan konteks selamat (HTTPS).';
        }
        this.uiState = 'error';
      });
    }
  }

  // *** THIS HANDLER IS FOR CALIBRATION STATE - AUTO DETECTION ***
  handleCalibrationReading() {
    if (this.uiState !== 'calibrating' || !this.sensor?.quaternion) {
      return; // Only process during calibration state and if data is valid
    }

    // Check for calibration timeout
    if (
      this.calibrationStartTime &&
      Date.now() - this.calibrationStartTime > this.CALIBRATION_TIMEOUT
    ) {
      // Only show timeout message once
      if (!this.errorMessageCompass?.includes('Masa tamat')) {
        this.ngZone.run(() => {
          this.errorMessageCompass =
            'Masa tamat kalibrasi. Sila klik butang "Selesai Kalibrasi" untuk meneruskan.';
          console.warn('Calibration timeout reached.');
        });
      }
      // Do not reset state, allow user to continue or manually complete
    }

    const [x, y, z, w] = this.sensor.quaternion;
    const { pitch, roll, yaw } = this.getEulerAngles(x, y, z, w); // Use Euler for detection only

    this.calibrationData.pitch.push(pitch);
    this.calibrationData.roll.push(roll);
    this.calibrationData.yaw.push(yaw); // Store Euler yaw for range calculation

    if (this.calibrationData.pitch.length > CALIBRATION_WINDOW_SIZE) {
      this.calibrationData.pitch.shift();
      this.calibrationData.roll.shift();
      this.calibrationData.yaw.shift();
    }

    if (this.calibrationData.pitch.length < CALIBRATION_WINDOW_SIZE) {
      return; // Wait for more data
    }

    const pitchRange =
      Math.max(...this.calibrationData.pitch) -
      Math.min(...this.calibrationData.pitch);
    const rollRange =
      Math.max(...this.calibrationData.roll) -
      Math.min(...this.calibrationData.roll);
    const yawRange = this.calculateYawRange(this.calibrationData.yaw); // Use helper for yaw range

    // Check if thresholds are met
    if (
      pitchRange >= CALIBRATION_PITCH_THRESHOLD &&
      rollRange >= CALIBRATION_ROLL_THRESHOLD &&
      yawRange >= CALIBRATION_YAW_THRESHOLD
    ) {
      console.log('Calibration movement detected!');
      this.ngZone.run(() => {
        this.completeCalibration();
      });
    }
  }

  completeCalibration() {
    if (this.uiState === 'calibrated') return; // Prevent double execution

    this.stopSensor(); // Stop calibration detection sensor
    this.uiState = 'calibrated';
    this.errorMessageCompass = null; // Clear any previous messages
    console.log('Calibration complete, starting compass display.');
    this.startCompassDisplay(); // Start sensor again for actual compass heading
  }

  // --- Compass Display Logic ---

  startCompassDisplay() {
    try {
      this.stopSensor(); // Ensure any previous sensor is stopped

      this.sensor = new AbsoluteOrientationSensor({
        frequency: 60,
        referenceFrame: 'device',
      });

      // *** Assign the CORRECT handler for compass display ***
      this.sensorSubscription = () => this.handleCompassReading();
      this.sensor.addEventListener('reading', this.sensorSubscription);

      this.sensor.addEventListener('error', (event: any) => {
        console.error(
          'Compass display sensor error:',
          event.error.name,
          event.error.message
        );
        this.ngZone.run(() => {
          this.errorMessageCompass = `Ralat sensor kompas: ${event.error.name}. Sila cuba kalibrasi semula.`;
          this.uiState = 'error'; // Revert to error state to allow retry
          this.stopSensor();
        });
      });

      this.sensor.start();
      this.isSensorActive = true;
      // Reset rotation accumulation for fresh display
      this.accumulatedRotation = 0;
      this.previousHeading = null;
      console.log('Sensor started for compass display.');
    } catch (error: any) {
      this.ngZone.run(() => {
        console.error('Error initializing sensor for compass display:', error);
        this.errorMessageCompass = `Tidak dapat memulakan sensor kompas (${
          error.message || 'Ralat tidak diketahui'
        }).`;
        this.uiState = 'error'; // Revert to error state
      });
    }
  }

  // *** THIS HANDLER IS FOR DISPLAYING THE COMPASS HEADING ***
  // *** It uses the original calculation method ***
  handleCompassReading() {
    if (this.uiState !== 'calibrated' || !this.sensor?.quaternion) {
      return; // Only process when calibrated and data is valid
    }

    const [x, y, z, w] = this.sensor.quaternion;

    // --- Original Compass Heading Calculation START ---
    let yaw =
      Math.atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z)) *
      (180 / Math.PI);
    yaw = -yaw; // Invert for correct compass rotation relative to device top
    if (yaw < 0) yaw += 360; // Normalize to 0-360 degrees
    // --- Original Compass Heading Calculation END ---

    // Use NgZone.run to ensure Angular updates the UI from sensor events
    this.ngZone.run(() => {
      this.compassHeading = yaw; // Assign the calculated heading

      // --- Original Accumulated Rotation Logic START ---
      if (this.previousHeading === null) {
        this.accumulatedRotation = yaw; // Initialize rotation to current heading
      } else {
        // Calculate the shortest difference between current and previous heading
        let difference = yaw - this.previousHeading;
        if (difference > 180) difference -= 360; // Handle wrap around (e.g., 350 -> 10)
        if (difference < -180) difference += 360; // Handle wrap around (e.g., 10 -> 350)

        this.accumulatedRotation += difference; // Add the difference for smooth rotation

        // Optional: Detect large jumps which might indicate magnetic interference
        if (Math.abs(difference) > 45) {
          console.warn(
            'Large heading jump detected (> 45deg), may indicate interference. Current heading:',
            yaw.toFixed(0)
          );
          // Optional: Could reset accumulation here if needed: this.accumulatedRotation = yaw;
        }
      }
      this.previousHeading = yaw; // Store current heading for next calculation
      // --- Original Accumulated Rotation Logic END ---

      this.displayHeading = this.compassHeading; // Update the text display value
      this.checkQiblaAlignment(); // Check if pointing towards Qibla
    });
  }

  checkQiblaAlignment() {
    const tolerance = 1; // Allowable deviation in degrees
    const diff = Math.abs(this.compassHeading - this.qiblaHeading);
    const shortestAngle = Math.min(diff, 360 - diff); // Check shortest angle difference
    this.isQiblaAligned = shortestAngle <= tolerance;
  }

  // --- Sensor Stop ---

  stopSensor() {
    if (this.sensor) {
      if (this.sensorSubscription) {
        try {
          // Use the stored reference to remove the correct listener
          this.sensor.removeEventListener('reading', this.sensorSubscription);
        } catch (e) {
          console.warn('Error removing reading listener:', e);
        }
        this.sensorSubscription = null;
      }
      // Attempt to remove error listener - less critical if it fails silently
      try {
        // We don't store the error listener reference, but common practice is to remove by type/function if needed
      } catch (e) {}

      if (this.isSensorActive) {
        try {
          this.sensor.stop();
          this.isSensorActive = false;
          console.log('Sensor stopped.');
        } catch (e) {
          console.warn('Error stopping sensor:', e);
          this.isSensorActive = false; // Assume stopped even if error occurs
        }
      }
      this.sensor = null; // Release sensor object reference
    }
  }

  // --- Utility Functions ---

  // Calculates Euler angles (used ONLY for calibration detection)
  getEulerAngles(
    x: number,
    y: number,
    z: number,
    w: number
  ): { pitch: number; roll: number; yaw: number } {
    const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))); // Clamp sinp to [-1, 1]
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    return {
      pitch: pitch * (180 / Math.PI),
      roll: roll * (180 / Math.PI),
      yaw: (yaw * (180 / Math.PI) + 360) % 360, // Normalize Euler yaw 0-360 for range calculation
    };
  }

  // Calculates yaw range handling wrap-around (used ONLY for calibration detection)
  calculateYawRange(yawData: number[]): number {
    if (yawData.length < 2) return 0;
    // Sort angles to easily find min/max, but need to handle wrap-around
    const sortedYaw = [...yawData].sort((a, b) => a - b);
    let maxGap = 0;
    for (let i = 1; i < sortedYaw.length; i++) {
      maxGap = Math.max(maxGap, sortedYaw[i] - sortedYaw[i - 1]);
    }
    // Consider the gap between the last and first element (wrap-around gap)
    maxGap = Math.max(
      maxGap,
      360 - sortedYaw[sortedYaw.length - 1] + sortedYaw[0]
    );

    // The range is 360 degrees minus the largest gap found
    return 360 - maxGap;
  }

  // --- Alert --- (Keep existing alert function)
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
