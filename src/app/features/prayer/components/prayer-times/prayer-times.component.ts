import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';
import { PrayerTimesService, Prayer } from '../../services/prayer-times.service';
import { ModalController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { PrayerNotificationsService } from '../../services/prayer-notifications.service';
import { NotificationSettingsComponent } from '../notification-settings/notification-settings.component';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import * as htmlToImage from 'html-to-image';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

@Component({
  selector: 'app-prayer-times',
  templateUrl: './prayer-times.component.html',
  styleUrls: ['./prayer-times.component.scss'],
})
export class PrayerTimesComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();

  @ViewChild('yearlyTable', { static: false }) yearlyTable!: ElementRef;
  // Add ViewChild for the shareable content div to ensure it exists before trying to access it
  @ViewChild('prayerTimesToShareContainer', { static: false })
  prayerTimesToShareContainer!: ElementRef<HTMLDivElement>;
  loaded: boolean = false;
  isDarkMode: boolean = false;
  prayers: Prayer[] = [];
  clickedRow: any = null;
  closestPrayer: string | null = null;
  remainingTime: string = '';
  location: string = 'Zon tidak dikenali';
  currentDate: Date = new Date();
  currentHijriDate: string = '';
  zone: string = 'KDH01'; // Default zone code for Kubang Pasu
  showYearlyPrayerTimes: boolean = false;
  yearlyPrayers: any[] = [];
  userLocation: string = '';
  lastUpdated: string = '';
  private intervalId: any;
  isLoading: boolean = false;
  isDetectingLocation: boolean = false;
  closestPrayerTime: any;
  sameData: boolean = false;
  notificationsEnabled: boolean = false;
  isProcessingNotifications: boolean = false;
  disabledPrayers: Set<string> = new Set();
  processingSubscription: any;
  disabledPrayersSubscription: any;
  private darkModeObserver?: MutationObserver;

  constructor(
    private hostElement: ElementRef<HTMLElement>,
    private prayerTimesService: PrayerTimesService,
    private prayerNotificationsService: PrayerNotificationsService,
    private modalController: ModalController,
  ) {}

  async ngOnInit() {
    // First initialize notifications service
    this.notificationsEnabled =
      await this.prayerNotificationsService.initializeNotifications();

    // Subscribe to processing state
    this.processingSubscription =
      this.prayerNotificationsService.isProcessing$.subscribe(
        (isProcessing) => {
          this.isProcessingNotifications = isProcessing;
        },
      );

    // Subscribe to disabled prayers
    this.disabledPrayersSubscription =
      this.prayerNotificationsService.disabledPrayers$.subscribe(
      (disabledPrayers) => {
        this.disabledPrayers = disabledPrayers;
      },
      );

    // Then initialize prayer times which will trigger notification status update
    await this.initializePrayerTimes();

    this.checkDarkMode();
  }

  ngOnDestroy() {
    this.setParentContentScrolling(true);

    // Stop the interval when the component is destroyed to prevent memory leaks
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('Interval cleared');
    }
    if (this.processingSubscription) {
      this.processingSubscription.unsubscribe();
    }
    if (this.disabledPrayersSubscription) {
      this.disabledPrayersSubscription.unsubscribe();
    }
    this.darkModeObserver?.disconnect();
  }

  private checkDarkMode() {
    // Check if the document element has the ion-palette-dark class
    this.isDarkMode =
      document.documentElement.classList.contains('ion-palette-dark');

    // Create a MutationObserver to watch for changes to the ion-palette-dark class
    this.darkModeObserver = new MutationObserver(() => {
      this.isDarkMode =
        document.documentElement.classList.contains('ion-palette-dark');
    });

    // Observe changes to the document element class list
    this.darkModeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  async initializePrayerTimes() {
    try {
      // Get the saved data from localStorage (already fetched by service on app start)
      const savedData =
        await this.prayerTimesService.getSavedYearlyPrayerTimes();

      if (savedData) {
        // Load saved yearly prayers from localStorage
        this.yearlyPrayers = savedData.prayers;
        this.zone = savedData.zone;

        // Fetch the full zone name from the mapping object
        const fullZoneName =
          this.prayerTimesService.zoneNames[this.zone] ||
          'KDH01 - Kota Setar, Kubang Pasu, Pokok Sena (Daerah Kecil)';

        // Update the location to display the full zone name
        this.location = fullZoneName;

        // Get the last updated timestamp from localStorage
        this.lastUpdated = this.prayerTimesService.formatTimestamp(
          savedData.timestamp,
        );

        // Load today's prayer times into UI variables
        await this.fetchTodayPrayerTimes();
        this.startUpdatingRemainingTime();
      } else {
        console.warn('No prayer data available');
        await this.showError('Tiada data waktu solat tersedia');
      }
    } catch (error) {
      console.error('Error initializing prayer times:', error);
      await this.showError('Error loading prayer times');
    }
  }

  // Fetch new data from API with location detection
  async refreshData() {
    try {
      // Step 1: Show GPS dialog once (if GPS is disabled)
      await this.prayerTimesService.checkGpsStatus();

      // Step 2: Smart retry mechanism - check GPS status up to 10 times with 500ms intervals
      let gpsEnabled = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        if (await this.prayerTimesService.isGpsEnabled()) {
          gpsEnabled = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms between checks
      }

      if (!gpsEnabled) {
        this.prayerTimesService.presentToast(
          '❌ GPS tidak diaktifkan. Sila aktifkan GPS dan cuba lagi.',
          'danger',
        );
        return;
      }

      // Step 3: GPS is enabled! Show loading spinner and proceed with location detection
      this.isDetectingLocation = true;

      // Step 4: Get current location and zone using the service
      const detectedZone = await this.prayerTimesService.getCurrentLocation();

      if (detectedZone) {
        // Step 5: Update prayer times with the detected zone
        await this.prayerTimesService.refreshDataWithLocation(detectedZone);

        // Step 6: Update the current location display
        this.location =
          this.prayerTimesService.zoneNames[detectedZone] ||
          this.prayerTimesService.zoneNames['kdh01'];

        // Step 7: Reload prayer data to reflect the new zone
        await this.initializePrayerTimes();
      } else {
        this.prayerTimesService.presentToast(
          '❌ Gagal mengesan lokasi. Sila cuba lagi.',
          'danger',
        );
      }
    } catch (error: any) {
      console.error('Error refreshing data:', error);

      if (error === 'Kebenaran lokasi ditolak') {
        // Show alert dialog to open app settings
        this.prayerTimesService.showOpenSettingsDialog();
        return; // Don't show additional error toast
      }
      
      this.prayerTimesService.presentToast(`❌ ${error}`, 'danger');
    } finally {
      this.isDetectingLocation = false;
    }
  }

  // Method to fetch prayer times for the updated date
  async fetchTodayPrayerTimes() {
    const todayPrayerData = this.prayerTimesService.getTodayPrayerTimes(
      this.yearlyPrayers,
      this.currentDate,
    );

    if (todayPrayerData) {
      this.prayers = todayPrayerData.prayers;
      this.currentHijriDate = todayPrayerData.hijriDate;
      this.currentDate = todayPrayerData.currentDate;

      // Always update notification status after prayer times are set
      if (this.notificationsEnabled) {
        await this.updatePrayerNotificationStatus();
      }
    } else {
      await this.showError('Tiada waktu solat untuk hari ini.');
    }
  }

  // Handle errors
  async showError(message: string) {
    await this.prayerTimesService.presentToast(message, 'danger');
  }

  // Calculate remaining time for the closest prayer
  calculateRemainingTime() {
    const currentTime = new Date();
    let closestPrayerTime: Prayer | null = null;
    let minTimeDiff = Infinity;
    let prayerDate = '';

    // Iterate through the list of prayers and find the closest one by both date and time
    this.prayers.forEach((prayer) => {
      const [hours, minutes] = prayer.time
        .split(':')
        .map((num) => parseInt(num, 10));
      const prayerTime = new Date();
      prayerTime.setHours(hours);
      prayerTime.setMinutes(minutes);
      prayerTime.setSeconds(0);

      // Compare both date and time
      const prayerDateTime = new Date(this.currentDate);
      prayerDateTime.setHours(hours);
      prayerDateTime.setMinutes(minutes);
      prayerDateTime.setSeconds(0);
      const timeDiff = prayerDateTime.getTime() - currentTime.getTime();

      // If the prayer time is in the future and closer than the current closest prayer time
      if (timeDiff > 0 && timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestPrayerTime = prayer;
        prayerDate = prayer.date;
      }
    });

    // If no prayer times are found for the current date, fetch prayer times for the next day
    if (!closestPrayerTime || minTimeDiff < 0) {
      // Check for tomorrow's prayer times
      const nextDay = new Date(this.currentDate);
      nextDay.setDate(this.currentDate.getDate() + 1);
      this.currentDate = nextDay;

      // Fetch next day's prayer times
      this.fetchTodayPrayerTimes();
      return; // Exit the function as we're moving to the next day's prayer times
    }

    // If a closest prayer time is found for today, calculate the remaining time
    if (closestPrayerTime) {
      this.closestPrayer = (closestPrayerTime as Prayer).name;
      this.closestPrayerTime = this.convertTimeToDate(
        (closestPrayerTime as Prayer).time,
      ).toLocaleTimeString('ms-MY', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      });
      const adjustedMinTimeDiff = minTimeDiff + 1000 * 60; // Adjust by adding one minute
      const hoursRemaining = Math.floor(adjustedMinTimeDiff / (1000 * 3600));
      const minutesRemaining = Math.floor(
        (adjustedMinTimeDiff % (1000 * 3600)) / (1000 * 60),
      );
      if (minTimeDiff === 0) {
        this.remainingTime = 'sekarang';
      } else if (hoursRemaining > 0 || minutesRemaining > 0) {
        this.remainingTime = `${this.closestPrayer} akan bermula dalam ${
          hoursRemaining > 0 ? hoursRemaining + ' jam ' : ''
        }${minutesRemaining} minit`;
      } else {
        this.remainingTime = 'sekarang';
      }
    } else {
      this.remainingTime = 'Tiada solat terdekat pada masa ini';
    }
    this.loaded = true;
  }

  // Toggle the visibility of the yearly prayer times table
  viewYearlyPrayerTimes() {
    this.showYearlyPrayerTimes = true;
    this.setParentContentScrolling(false);
    setTimeout(() => {
      if (this.yearlyTable) {
        // Scroll to the current day row when the view is shown
        const currentDayRow =
          this.yearlyTable.nativeElement.querySelector('.current-day');
        if (currentDayRow) {
          const tableContainer = currentDayRow.closest(
            '.yearly-table-container',
          ) as HTMLElement | null;

          if (tableContainer) {
            const targetTop =
              currentDayRow.offsetTop -
              tableContainer.clientHeight / 2 +
              currentDayRow.offsetHeight / 2;

            tableContainer.scrollTo({
              top: Math.max(0, targetTop),
              behavior: 'smooth',
            });
          }
        }
      }
    }, 100);
  }

  // Check if the given prayer's date is today's date
  isToday(prayerTime: string): boolean {
    return prayerTime === this.prayerTimesService.formatDate(new Date());
  }

  formatApiDateForDisplay(date: string): string {
    return this.prayerTimesService.formatApiDateForDisplay(date);
  }

  setClickedRow(prayer: any) {
    this.clickedRow = prayer;
    // set the current clicked row to use class clicked-row
    // console.log('Clicked row:', this.clickedRow);
  }

  // Convert a time string (HH:mm:ss) into a Date object
  convertTimeToDate(time: string): Date {
    const date = new Date();
    const [hours, minutes, seconds] = time
      .split(':')
      .map((num) => parseInt(num, 10));
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(seconds);
    return date;
  }

  // Navigate back to the main prayer times
  backToMainPrayerTimes() {
    this.showYearlyPrayerTimes = false;
    this.setParentContentScrolling(true);
  }

  private setParentContentScrolling(enabled: boolean) {
    const content = this.hostElement.nativeElement.closest('ion-content') as
      | HTMLIonContentElement
      | null;

    if (content) {
      content.scrollY = enabled;
    }
  }

  // Go to the previous day
  goToPreviousDay() {
    this.currentDate.setDate(this.currentDate.getDate() - 1);
    this.fetchTodayPrayerTimes(); // Fetch prayer times for the new date
  }

  // Go to the next day
  goToNextDay() {
    this.currentDate.setDate(this.currentDate.getDate() + 1);
    this.fetchTodayPrayerTimes(); // Fetch prayer times for the new date
  }

  // Check if there is data for the previous day and return false if previous day is day before current day
  canNavigatePrevious(): boolean {
    const previousDate = new Date(this.currentDate);
    previousDate.setDate(previousDate.getDate() - 1);

    // Return false if the previous date is less than today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    previousDate.setHours(0, 0, 0, 0);

    if (previousDate < today) {
      return false;
    }

    return this.isDataAvailableForDate(previousDate);
  }

  // Check if there is data for the next day
  canNavigateNext(): boolean {
    const nextDate = new Date(this.currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return this.isDataAvailableForDate(nextDate);
  }

  // Helper function to check if data exists for a specific date
  isDataAvailableForDate(date: Date): boolean {
    const formattedDate = this.prayerTimesService.formatDate(date);
    return this.yearlyPrayers.some((prayer) => prayer.date === formattedDate);
  }

  /**
   * Toggle notification for a specific prayer
   */
  async setReminder(prayerName: string): Promise<void> {
    // Find the prayer index first
    const index = this.prayers.findIndex((p) => p.name === prayerName);
    if (index === -1) return;

    try {
      // Provide haptic feedback
      if (
        Capacitor.getPlatform() === 'android' ||
        Capacitor.getPlatform() === 'ios'
      ) {
        await Haptics.impact({ style: ImpactStyle.Light });
      }

      // Check if notifications are enabled
      if (!this.notificationsEnabled) {
        // Request permission
        this.notificationsEnabled =
          await this.prayerNotificationsService.initializeNotifications();
        if (!this.notificationsEnabled) {
          return;
        }
      }

      // Toggle the notification state optimistically in UI
      this.prayers[index].notificationEnabled =
        !this.prayers[index].notificationEnabled;

      // Toggle notification in service (non-blocking)
      this.prayerNotificationsService
        .togglePrayerNotification(prayerName)
        .then((success) => {
          // Only handle failure - revert UI if toggle failed
          if (!success) {
            this.prayers[index].notificationEnabled =
              !this.prayers[index].notificationEnabled;
            this.prayerTimesService.presentToast(
              'Ralat mengemas kini notifikasi. Sila cuba lagi.',
              'danger',
            );
          }
        })
        .catch((error) => {
          console.error('Error setting reminder:', error);
          // On error, refresh actual state from service
          this.updatePrayerNotificationStatus();
          this.prayerTimesService.presentToast(
            'Ralat mengaktifkan notifikasi',
            'danger',
          );
        });
    } catch (error) {
      console.error('Error in setReminder:', error);
    }
  }

  /**
   * Check if a specific prayer is currently disabled
   */
  isPrayerDisabled(prayerName: string): boolean {
    return this.disabledPrayers.has(prayerName);
  }

  /**
   * Update UI to reflect which prayers have notifications enabled
   */
  async updatePrayerNotificationStatus() {
    if (!this.notificationsEnabled || !this.prayers.length) return;

    // For each prayer, check if notification is enabled
    for (const prayer of this.prayers) {
      prayer.notificationEnabled =
        await this.prayerNotificationsService.isPrayerNotificationEnabled(
          prayer.name,
        );
    }
  }

  startUpdatingRemainingTime() {
    // Clear any existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    // Set up a periodic update to check for the remaining time every second
    this.intervalId = setInterval(() => {
      this.calculateRemainingTime();
    }, 1000); // Update every second
  }

  handleRefresh(event: CustomEvent) {
    setTimeout(() => {
      this.loaded = false;
      (event.target as HTMLIonRefresherElement).complete();
      this.initializePrayerTimes();
    }, 1000);
  }

  // Method to open the notification settings modal
  async openNotificationSettings() {
    try {
      const modal = await this.modalController.create({
        component: NotificationSettingsComponent,
        cssClass: 'notification-settings-modal',
      });

      await modal.present();

      const { data } = await modal.onDidDismiss();
      if (data?.saved) {
        await this.prayerTimesService.presentToast(
          'Tetapan notifikasi telah disimpan',
          'success',
        );
        await this.updatePrayerNotificationStatus();
      }
    } catch (error) {
      console.error('Error opening notification settings:', error);
      await this.prayerTimesService.presentToast(
        'Ralat membuka tetapan notifikasi',
        'danger',
      );
    }
  }

  async sharePrayerTimes() {
    if (!this.loaded || this.prayers.length === 0) {
      await this.prayerTimesService.presentToast(
        'Data waktu solat belum dimuatkan atau tiada.',
        'warning',
      );
      return;
    }

    // Ensure the container div is available
    if (
      !this.prayerTimesToShareContainer ||
      !this.prayerTimesToShareContainer.nativeElement
    ) {
      console.error('Shareable container element not found');
      await this.prayerTimesService.presentToast(
        'Ralat: Elemen untuk dikongsi tidak ditemui.',
        'danger',
      );
      return;
    }
    const shareContainerElement =
      this.prayerTimesToShareContainer.nativeElement;
    const shareContentElement = document.getElementById(
      'prayerTimesToShareContent',
    );

    if (!shareContentElement) {
      console.error('Shareable content element not found');
      await this.prayerTimesService.presentToast(
        'Ralat: Elemen kandungan untuk dikongsi tidak ditemui.',
        'danger',
      );
      return;
    }

    // 1. Populate the shareable element
    const shareTitleEl = document.getElementById('shareTitle');
    const shareLocationEl = document.getElementById('shareLocation');
    const shareHijriDateEl = document.getElementById('shareHijriDate');
    const sharePrayerTableBodyEl = document.getElementById(
      'sharePrayerTableBody',
    );

    if (
      !shareTitleEl ||
      !shareLocationEl ||
      !shareHijriDateEl ||
      !sharePrayerTableBodyEl
    ) {
      console.error('Required elements within shareable div not found');
      await this.prayerTimesService.presentToast(
        'Ralat: Struktur untuk dikongsi tidak lengkap.',
        'danger',
      );
      return;
    }

    const formattedCurrentDate = this.currentDate.toLocaleDateString('ms-MY', {
      day: 'numeric', // '2-digit' can cause issues on some browsers/OS with long, use numeric.
      month: 'long',
      year: 'numeric',
    });
    shareTitleEl.innerText = `Waktu Solat - ${formattedCurrentDate}`;
    shareLocationEl.innerText = this.location;
    shareHijriDateEl.innerText = this.currentHijriDate;

    // Clear previous table rows
    sharePrayerTableBodyEl.innerHTML = '';

    // Populate new table rows
    // Iterate through each prayer to populate the prayer times table for sharing
    this.prayers.forEach((prayer) => {
      // Get the table body element where new rows will be inserted
      const sharePrayerTableBodyEl = document.getElementById(
        'sharePrayerTableBody',
      ) as HTMLTableSectionElement;

      // Create a new table row
      const row = sharePrayerTableBodyEl.insertRow();

      // Create cells for the prayer name and time
      const cell1 = row.insertCell();
      const cell2 = row.insertCell();

      // Style the cells
      cell1.style.padding = '10px';
      cell1.style.border = '1px solid #ccc';
      cell1.style.fontSize = '1em';
      cell1.style.display = 'flex';
      cell1.style.alignItems = 'center';

      cell2.style.padding = '10px';
      cell2.style.border = '1px solid #ccc';
      cell2.style.fontSize = '1em';

      // Create and style the prayer icon
      const icon = document.createElement('img');
      icon.src = `assets/icon/${prayer.name.toLowerCase()}-white.svg`;
      icon.alt = `${prayer.name} icon`;
      icon.style.width = '20px';
      icon.style.height = '20px';
      icon.style.marginRight = '5px';

      // Append the icon and prayer name to the first cell
      cell1.appendChild(icon);
      cell1.appendChild(document.createTextNode(prayer.name));

      // Format and set the prayer time in the second cell
      cell2.innerText = this.convertTimeToDate(prayer.time).toLocaleTimeString(
        'ms-MY',
        {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        },
      );
    });

    // Make the container temporarily visible for rendering, but off-screen
    shareContainerElement.style.display = 'block'; // This will make children like prayerTimesToShareContent visible too.

    let tempFileName = '';

    try {
      this.isLoading = true;

      // Wait a brief moment for DOM updates
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataUrl = await htmlToImage.toPng(shareContentElement, {
        pixelRatio: 2, // For better quality on high DPI screens
        // Ensure styles are applied by the browser before capture
        // Explicitly set background if needed, though defined in the div's style
        // backgroundColor: '#ffffff',
      });

      tempFileName = `waktu_solat_${new Date().getTime()}.png`;
      const savedFile = await Filesystem.writeFile({
        path: tempFileName,
        data: dataUrl, // dataUrl is already base64
        directory: Directory.Cache,
      });

      await Share.share({
        title: `Waktu Solat ${formattedCurrentDate}`,
        text: `Berikut adalah waktu solat untuk ${this.location} pada ${formattedCurrentDate} (${this.currentHijriDate}).`,
        url: savedFile.uri,
        dialogTitle: 'Kongsi Waktu Solat',
      });
    } catch (error: any) {
      console.error('Error sharing prayer times:', error);
      if (
        (error &&
          error.message &&
          error.message.toLowerCase().includes('share canceled')) ||
        error.message.toLowerCase().includes('share dismissed')
      ) {
        await this.prayerTimesService.presentToast(
          'Perkongsian dibatalkan.',
          'medium',
        );
      } else if (
        error &&
        error.message &&
        error.message.toLowerCase().includes('activity not found')
      ) {
        await this.prayerTimesService.presentToast(
          'Tiada aplikasi untuk berkongsi ditemui.',
          'warning',
        );
      } else {
        await this.prayerTimesService.presentToast(
          'Ralat semasa cuba berkongsi waktu solat.',
          'danger',
        );
      }
    } finally {
      // Hide the element again
      shareContainerElement.style.display = 'none';
      this.isLoading = false;

      // Clean up the temporary file
      if (tempFileName) {
        try {
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache,
          });
        } catch (cleanupError) {
          console.warn('Error cleaning up temporary share file:', cleanupError);
        }
      }
    }
  }
}
