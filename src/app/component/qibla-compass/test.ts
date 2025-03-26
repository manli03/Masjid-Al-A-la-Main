import { Component, OnDestroy, OnInit, NgZone } from '@angular/core';
import { AlertController, Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { PrayerTimesService } from 'src/app/services/PrayerTimes/prayerTimes.service';

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
const CALIBRATION_YAW_THRESHOLD = 120; // Min degrees change required for yaw
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
    // Don't start compass immediately, wait for button press
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
    // Consider unsubscribing from platform.resume if component is destroyed frequently
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

    // Try to load cached image (optional, based on your service)
    const cachedImage = await this.prayerTimesService.getCachedQiblaImage();
    if (cachedImage) {
      this.qiblaImageUrl = cachedImage;
      console.log('Loaded cached image');
    } else {
      // Use default local asset
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

  // --- Sensor Handling and Calibration ---

  async checkSupportAndStartDetection() {
    // Check if the sensor API exists
    if (!('AbsoluteOrientationSensor' in window)) {
      this.ngZone.run(() => {
        this.errorMessageCompass =
          'Peranti tidak menyokong kompas (AbsoluteOrientationSensor).';
        this.uiState = 'unsupported';
      });
      console.error('AbsoluteOrientationSensor not supported.');
      return;
    }

    // Check permissions
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
        // Proceed even if 'prompt', the sensor instantiation will trigger it
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
        console.error('Sensor error:', event.error.name, event.error.message);
        this.ngZone.run(() => {
          if (event.error.name === 'NotReadableError') {
            this.errorMessageCompass =
              'Sensor tidak tersedia atau tidak dapat dibaca. Cuba mulakan semula.';
            this.uiState = 'error';
          } else if (event.error.name === 'SecurityError') {
            this.errorMessageCompass =
              'Akses sensor disekat atas sebab keselamatan (mungkin bukan HTTPS atau iframe?).';
            this.uiState = 'error';
          } else if (event.error.name === 'NotAllowedError') {
            this.errorMessageCompass =
              'Kebenaran untuk mengakses sensor tidak diberikan.';
            this.uiState = 'error'; // Go back to initial or show specific permission error
          } else {
            this.errorMessageCompass = `Ralat sensor: ${event.error.name}`;
            this.uiState = 'error';
          }
          this.stopSensor(); // Stop on error
        });
      });

      this.sensor.start();
      this.isSensorActive = true;
      this.calibrationStartTime = Date.now(); // Start timeout timer
      console.log('Sensor started for calibration detection.');
    } catch (error: any) {
      this.ngZone.run(() => {
        // This catch block handles errors during sensor *construction* (e.g., if API exists but fails to init)
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

  handleCalibrationReading() {
    if (this.uiState !== 'calibrating' || !this.sensor?.quaternion) {
      return; // Only process during calibration state and if data is valid
    }

    // Check for calibration timeout
    if (
      this.calibrationStartTime &&
      Date.now() - this.calibrationStartTime > this.CALIBRATION_TIMEOUT
    ) {
      this.ngZone.run(() => {
        this.errorMessageCompass =
          'Gagal mengesan pergerakan kalibrasi. Sila cuba lagi dengan menggerakkan peranti dalam corak angka 8.';
        // Optional: Reset to initial or keep showing calibration? Let's reset.
        // this.uiState = 'initial';
        // this.stopSensor();
        // Alternatively, just show the message and let them keep trying
        console.warn('Calibration detection timed out.');
        this.calibrationStartTime = null; // Prevent repeated timeout messages
      });
      // Don't return here, let user keep trying if they want
    }

    const [x, y, z, w] = this.sensor.quaternion;
    const { pitch, roll, yaw } = this.getEulerAngles(x, y, z, w);

    // Add data to window
    this.calibrationData.pitch.push(pitch);
    this.calibrationData.roll.push(roll);
    this.calibrationData.yaw.push(yaw);

    // Keep window size fixed
    if (this.calibrationData.pitch.length > CALIBRATION_WINDOW_SIZE) {
      this.calibrationData.pitch.shift();
      this.calibrationData.roll.shift();
      this.calibrationData.yaw.shift();
    }

    // Check if enough data has been collected
    if (this.calibrationData.pitch.length < CALIBRATION_WINDOW_SIZE) {
      return; // Wait for more data
    }

    // Calculate ranges
    const pitchRange =
      Math.max(...this.calibrationData.pitch) -
      Math.min(...this.calibrationData.pitch);
    const rollRange =
      Math.max(...this.calibrationData.roll) -
      Math.min(...this.calibrationData.roll);
    // Yaw range needs careful handling due to wrap-around (0/360)
    const yawRange = this.calculateYawRange(this.calibrationData.yaw);

    // console.log(`Ranges (P, R, Y): ${pitchRange.toFixed(1)}, ${rollRange.toFixed(1)}, ${yawRange.toFixed(1)}`); // Debugging

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
    this.errorMessageCompass = null; // Clear any previous messages (like timeout)
    console.log('Calibration complete, starting compass display.');
    this.startCompassDisplay(); // Start sensor again for actual compass heading
  }

  // --- Compass Display Logic ---

  startCompassDisplay() {
    try {
      this.stopSensor(); // Ensure any previous sensor is stopped

      // Re-initialize the sensor specifically for compass readings
      this.sensor = new AbsoluteOrientationSensor({
        frequency: 60,
        referenceFrame: 'device',
      });

      this.sensorSubscription = () => this.handleCompassReading();
      this.sensor.addEventListener('reading', this.sensorSubscription);

      this.sensor.addEventListener('error', (event: any) => {
        // Handle errors similar to calibration phase, maybe revert state
        console.error(
          'Compass display sensor error:',
          event.error.name,
          event.error.message
        );
        this.ngZone.run(() => {
          this.errorMessageCompass = `Ralat sensor kompas: ${event.error.name}. Sila cuba kalibrasi semula.`;
          this.uiState = 'error'; // Or 'initial' to force recalibration
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

  handleCompassReading() {
    if (this.uiState !== 'calibrated' || !this.sensor?.quaternion) {
      return; // Only process when calibrated
    }

    const [x, y, z, w] = this.sensor.quaternion;

    let yaw =
      Math.atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z)) *
      (180 / Math.PI);
    yaw = -yaw; // Invert for correct compass rotation
    if (yaw < 0) yaw += 360; // Normalize to 0-360

    // Use NgZone.run to ensure Angular updates the UI
    this.ngZone.run(() => {
      this.compassHeading = yaw;

      if (this.previousHeading === null) {
        this.accumulatedRotation = yaw; // Initialize
      } else {
        let difference = yaw - this.previousHeading;
        if (difference > 180) difference -= 360;
        if (difference < -180) difference += 360;

        this.accumulatedRotation += difference;

        // Basic magnetic distortion check (optional)
        if (Math.abs(difference) > 45) {
          // Increased threshold
          console.warn(
            'Large jump detected, potentially resetting accumulation.'
          );
          // Simple reset: this.accumulatedRotation = yaw;
          // Smoother approach might be needed if this happens often
        }
      }

      this.previousHeading = yaw;
      this.displayHeading = this.compassHeading; // Update display value
      this.checkQiblaAlignment();
    });
  }

  checkQiblaAlignment() {
    const tolerance = 1; // Slightly increased tolerance
    // Calculate the shortest angle difference (handles wrap around 360/0)
    const diff = Math.abs(this.compassHeading - this.qiblaHeading);
    const shortestAngle = Math.min(diff, 360 - diff);
    this.isQiblaAligned = shortestAngle <= tolerance;
  }

  // --- Sensor Stop ---

  stopSensor() {
    if (this.sensor) {
      if (this.sensorSubscription) {
        try {
          this.sensor.removeEventListener('reading', this.sensorSubscription);
          this.sensorSubscription = null;
        } catch (e) {
          console.warn('Error removing reading listener:', e);
        }
      }
      // Attempt to remove error listener - less critical if it fails silently
      // try { this.sensor.removeEventListener('error', ...); } catch(e) {}

      if (this.isSensorActive) {
        try {
          this.sensor.stop();
          this.isSensorActive = false;
          console.log('Sensor stopped.');
        } catch (e) {
          console.warn('Error stopping sensor:', e);
          // If sensor fails to stop, setting isSensorActive false might prevent further issues
          this.isSensorActive = false;
        }
      }
      this.sensor = null; // Release reference
    }
  }

  // --- Utility Functions ---

  getEulerAngles(
    x: number,
    y: number,
    z: number,
    w: number
  ): { pitch: number; roll: number; yaw: number } {
    // Roll (x-axis rotation)
    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    // Pitch (y-axis rotation)
    const sinp = 2 * (w * y - z * x);
    let pitch;
    if (Math.abs(sinp) >= 1)
      pitch = Math.sign(sinp) * (Math.PI / 2); // Use 90 degrees if out of range
    else pitch = Math.asin(sinp);

    // Yaw (z-axis rotation)
    const siny_cosp = 2 * (w * z + x * y);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    // Convert radians to degrees
    return {
      pitch: pitch * (180 / Math.PI),
      roll: roll * (180 / Math.PI),
      yaw: yaw * (180 / Math.PI), // Note: this yaw is often different from compass heading yaw
    };
  }

  calculateYawRange(yawData: number[]): number {
    if (yawData.length < 2) return 0;

    // Normalize all angles relative to the first angle to handle wrap-around
    const firstYaw = yawData[0];
    const normalizedYaws = yawData.map((yaw) => {
      let diff = yaw - firstYaw;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      return diff;
    });

    // Calculate range of normalized values
    const minNormalized = Math.min(...normalizedYaws);
    const maxNormalized = Math.max(...normalizedYaws);

    return maxNormalized - minNormalized;
  }

  // --- Alert ---
  async presentAlert(
    header: string,
    message: string,
    btnText: string,
    anyFunction: () => void
  ) {
    // ... (keep existing alert function)
  }
}
