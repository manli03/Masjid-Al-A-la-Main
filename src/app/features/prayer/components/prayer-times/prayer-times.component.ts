import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { PrayerTimesService, Prayer } from '../../services/prayer-times.service';
import { ModalController } from '@ionic/angular';
import * as htmlToImage from 'html-to-image';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-prayer-times',
  templateUrl: './prayer-times.component.html',
  styleUrls: ['./prayer-times.component.scss'],
})
export class PrayerTimesComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Input() showBackButton = true;

  @ViewChild('yearlyTable', { static: false }) yearlyTable!: ElementRef;
  // Add ViewChild for the shareable content div to ensure it exists before trying to access it
  @ViewChild('prayerTimesToShareContainer', { static: false })
  prayerTimesToShareContainer!: ElementRef<HTMLDivElement>;
  loaded: boolean = false;
  isDarkMode: boolean = false;
  prayers: Prayer[] = [];
  clickedRow: any = null;
  closestPrayer: string | null = null;
  currentPrayer: string | null = null;
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
  closestPrayerTime: any;
  sameData: boolean = false;
  private darkModeObserver?: MutationObserver;

  constructor(
    private hostElement: ElementRef<HTMLElement>,
    private prayerTimesService: PrayerTimesService,
    private modalController: ModalController,
  ) {}

  async ngOnInit() {
    // Load the schedule when the prayer tab opens.
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
      this.updateCurrentPrayer();
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
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);
    if (this.currentDate < today) {
      this.currentDate = currentTime;
      this.fetchTodayPrayerTimes();
    }

    this.updateCurrentPrayer();

    let closestPrayerTime: Prayer | null = null;
    let minTimeDiff = Infinity;

    // Iterate through the list of prayers and find the closest one by both date and time
    const findNextPrayer = (prayers: Prayer[], date: Date) => {
      for (const prayer of prayers) {
        const [hours, minutes] = prayer.time
          .split(':')
          .map((num) => parseInt(num, 10));
        const prayerDateTime = new Date(date);
        prayerDateTime.setHours(hours, minutes, 0, 0);
        const timeDiff = prayerDateTime.getTime() - currentTime.getTime();

        if (timeDiff > 0 && timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestPrayerTime = prayer;
        }
      }
    };
    findNextPrayer(this.prayers, this.currentDate);

    // Use tomorrow's times for the countdown without changing the displayed schedule.
    if (!closestPrayerTime) {
      const nextDay = new Date(this.currentDate);
      nextDay.setDate(this.currentDate.getDate() + 1);
      const nextDayPrayers = this.prayerTimesService.getTodayPrayerTimes(
        this.yearlyPrayers,
        nextDay,
      );
      if (nextDayPrayers) {
        findNextPrayer(nextDayPrayers.prayers, nextDay);
      }
    }

    // Calculate the remaining time to the next prayer.
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
      this.closestPrayer = null;
      this.closestPrayerTime = null;
      this.remainingTime = 'Tiada solat terdekat pada masa ini';
    }
    this.loaded = true;
  }

  private updateCurrentPrayer() {
    const today = new Date();
    if (
      this.prayerTimesService.formatDate(this.currentDate) !==
      this.prayerTimesService.formatDate(today)
    ) {
      this.currentPrayer = null;
      return;
    }

    const currentMinutes = today.getHours() * 60 + today.getMinutes();
    const dailyPrayers = new Set(['Subuh', 'Zuhur', 'Asar', 'Maghrib', 'Isyak']);
    let activePrayer: string | null = null;
    let latestPrayerMinutes = -1;

    for (const prayer of this.prayers) {
      if (!dailyPrayers.has(prayer.name)) {
        continue;
      }

      const [hours, minutes] = prayer.time.split(':').map(Number);
      const prayerMinutes = hours * 60 + minutes;
      if (
        Number.isFinite(prayerMinutes) &&
        prayerMinutes <= currentMinutes &&
        prayerMinutes > latestPrayerMinutes
      ) {
        activePrayer = prayer.name;
        latestPrayerMinutes = prayerMinutes;
      }
    }

    // Isyak continues across midnight until today's Subuh begins.
    if (!activePrayer && this.prayers.some((prayer) => prayer.name === 'Isyak')) {
      const subuh = this.prayers.find((prayer) => prayer.name === 'Subuh');
      if (subuh) {
        const [hours, minutes] = subuh.time.split(':').map(Number);
        if (currentMinutes < hours * 60 + minutes) {
          activePrayer = 'Isyak';
        }
      }
    }

    this.currentPrayer = activePrayer;
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

  async sharePrayerTimes() {
    if (this.isLoading) return;

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
        style: Capacitor.isNativePlatform() ? {} : { borderRadius: '0' },
        // Ensure styles are applied by the browser before capture
        // Explicitly set background if needed, though defined in the div's style
        // backgroundColor: '#ffffff',
      });

      const filename = `waktu_solat_${Date.now()}.png`;
      const title = `Waktu Solat ${formattedCurrentDate}`;
      if (Capacitor.isNativePlatform()) {
        tempFileName = filename;
        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: dataUrl,
          directory: Directory.Cache,
        });

        await Share.share({
          title,
          text: `Berikut adalah waktu solat untuk ${this.location} pada ${formattedCurrentDate} (${this.currentHijriDate}).`,
          files: [savedFile.uri],
          dialogTitle: 'Kongsi Waktu Solat',
        });
      } else {
        await this.sharePrayerTimesOnWeb(dataUrl, filename, title);
      }
    } catch (error) {
      console.error('Error sharing prayer times:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (/cancel|dismiss|abort/i.test(message)) {
        await this.prayerTimesService.presentToast(
          'Perkongsian dibatalkan.',
          'medium',
        );
      } else if (/activity not found/i.test(message)) {
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

  private async sharePrayerTimesOnWeb(dataUrl: string, filename: string, title: string) {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title, files: [file] });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        // Image generation can outlast browser share permission; download instead.
      }
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
