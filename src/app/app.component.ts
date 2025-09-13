import { Component, OnDestroy, OnInit } from '@angular/core';
import '@angular/common/locales/global/ms';
import { App } from '@capacitor/app';
import { Router, NavigationExtras, NavigationEnd } from '@angular/router';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { filter } from 'rxjs/operators';
import { StatusBar } from '@capacitor/status-bar';
import { CheckUpdateService } from './services/check-update.service';
import { SafeArea } from 'capacitor-plugin-safe-area';
import { NavigationBar } from '@hugotomazi/capacitor-navigation-bar';
import { Device } from '@capacitor/device';
import { PushNotifications } from '@capacitor/push-notifications';
import { PrayerNotificationsService } from './services/prayer-notifications.service';
import { DarkModeHandlerService } from './services/dark-mode-handler.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  isAppLoaded: boolean = false;
  isHomePage: boolean = false;

  constructor(
    private router: Router,
    private platform: Platform,
    private updateCheck: CheckUpdateService,
    private prayerNotificationsService: PrayerNotificationsService,
    private darkModeService: DarkModeHandlerService,
  ) {
    (window as any).handleDeepLink = (path: string) => {
      console.log('Native deep link received from constructor:', path);
      this.router.navigateByUrl(path);
    };
    this.initializeApp();
  }

  async ngOnInit() {
    // Initialize dark mode for the entire app
    await this.darkModeService.loadDarkModePreference();

    // Check if the app is running on a mobile device
    if (this.platform.is('hybrid')) {
      StatusBar.setBackgroundColor({
        color: '#025a9e',
      });
      NavigationBar.setTransparency({
        isTransparent: true,
      });
      this.updateCheck.checkForUpdate();
      console.log('Checking for updates on mobile device');
    }

    // Listen for homePageLoaded event
    window.addEventListener('homePageLoaded', ((event: Event) => {
      console.log('Home page loaded event received');
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.loaded) {
        console.log('Setting isAppLoaded to true from custom event');
        this.isAppLoaded = true;
      }
    }) as EventListener);

    // Listen for route changes
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
      )
      .subscribe((event) => {
        // Check if we're on the home page
        this.isHomePage = event.url.includes('/tabs/home');
        console.log('Current route is home page:', this.isHomePage);

        if (this.isHomePage) {
          console.log('On home page, setting timeout for loading screen');
          // Wait for home page to signal it's fully loaded
          // We'll use a timeout here as a fallback to ensure loading screen
          // doesn't stay visible indefinitely if something goes wrong
          setTimeout(() => {
            console.log(
              'Fallback timeout reached, forcing isAppLoaded to true',
            );
            this.isAppLoaded = true;
          }, 10000); // 10s fallback timeout (longer than the 5s minimum + buffer)
        } else {
          // For non-home pages, show loading for exactly 3 seconds
          console.log('Not on home page, will show loading for 3 seconds');
          this.isAppLoaded = false;
          setTimeout(() => {
            console.log('2 second timer for non-home page complete');
            this.isAppLoaded = true;
          }, 3000);
        }
      });

    // Force hide the loading screen after 12 seconds as an additional safety measure
    setTimeout(() => {
      if (!this.isAppLoaded) {
        console.log('Safety timeout reached, forcing isAppLoaded to true');
        this.isAppLoaded = true;
      }
    }, 12000);
  }

  ngOnDestroy(): void {
    // Clean up any subscriptions or listeners here if needed
    App.removeAllListeners();
    PushNotifications.removeAllListeners();
    this.darkModeService.destroy();
  }

  initializeApp() {
    this.applySafeAreaIfSDK35Plus();
    this.platform.ready().then(async () => {
      try {
        // Set loading state to false first
        this.isAppLoaded = false;

        // Hide the splash screen
        await SplashScreen.hide();
        console.log('Splash screen hidden, showing custom loading screen');

        // Set up App URL listener for deep links
        this.setupAppUrlListener();
        this.setupPushNotificationListener();
        this.setupAppResumeListener();
      } catch (error) {
        console.error('Error during app initialization', error);
        this.isAppLoaded = true; // Ensure loading screen is hidden if there's an error
      }
    });
  }

  async applySafeAreaIfSDK35Plus() {
    const info = await Device.getInfo();

    if (
      info.platform === 'android' &&
      info.androidSDKVersion &&
      info.androidSDKVersion >= 35
    ) {
      const { insets } = await SafeArea.getSafeAreaInsets();
      document.body.style.setProperty('--ion-safe-area-top', `${insets.top}px`);
      document.body.style.setProperty(
        '--ion-safe-area-right',
        `${insets.right}px`,
      );
      document.body.style.setProperty(
        '--ion-safe-area-bottom',
        `${insets.bottom}px`,
      );
      document.body.style.setProperty(
        '--ion-safe-area-left',
        `${insets.left}px`,
      );
    }
  }

  private setupAppUrlListener() {
    // Only set up listener on native platforms
    if (Capacitor.isNativePlatform()) {
      App.addListener('appUrlOpen', (event) => {
        console.log('App opened with URL:', event.url);
        const route = new URL(event.url).pathname;
        console.log('Parsed route:', route);
        if (route === '/tabs/prayerTimes') {
          this.router.navigateByUrl(route);
        } else {
          this.handleOpenUrl(event.url);
        }
      });
    }
  }

  private handleOpenUrl(url: string) {
    // Parse the URL to extract announcement ID
    console.log('Processing deep link URL:', url);

    // We expect URLs in format: https://masjidala.web.app/announcement/123
    if (url) {
      const parsedUrl = new URL(url);
      const pathSegments = parsedUrl.pathname
        .split('/')
        .filter((segment) => segment);

      console.log('Path segments:', pathSegments);

      // Check if this is an announcement link
      if (pathSegments.length >= 2 && pathSegments[0] === 'announcement') {
        const announcementId = pathSegments[1];
        if (announcementId && !isNaN(parseInt(announcementId, 10))) {
          const navigationExtras: NavigationExtras = {
            queryParams: { id: announcementId },
          };
          this.router.navigate(
            ['/tabs/announcement-loading'],
            navigationExtras,
          );
        } else {
          this.router.navigateByUrl('/tabs/announcement-loading');
        }
      }
    }
  }

  private setupPushNotificationListener() {
    if (Capacitor.isNativePlatform()) {
      // This listener is triggered when a user taps on a notification.
      PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (notification) => {
          console.log(
            'Push notification action performed:',
            JSON.stringify(notification),
          );

          // The data object contains our custom payload, including the announcementId.
          const data = notification.notification.data;

          if (data && data.announcementId) {
            console.log(
              'Navigating to announcement with ID:',
              data.announcementId,
            );
            const navigationExtras: NavigationExtras = {
              queryParams: { id: data.announcementId },
            };
            this.router.navigate(
              ['/tabs/announcement-loading'],
              navigationExtras,
            );
          } else {
            console.log(
              'No announcementId in notification data, navigating to default announcement page.',
            );
            this.router.navigateByUrl('/tabs/announcement-loading');
          }
        },
      );
    }
  }

  private setupAppResumeListener() {
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', async (state) => {
        if (state.isActive) {
          // App has resumed, check if we previously opened notification settings
          const settingsOpened = localStorage.getItem('notificationSettingsOpened');
          if (settingsOpened === 'true') {
            console.log('App resumed after opening notification settings, checking permission...');
            // Clear the flag
            localStorage.removeItem('notificationSettingsOpened');
            // Check permission and schedule notifications if enabled
            await this.prayerNotificationsService.checkPermissionAndSchedule();
          }
        }
      });
    }
  }
}
