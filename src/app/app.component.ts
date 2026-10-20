import { Component, OnDestroy, OnInit } from '@angular/core';
import '@angular/common/locales/global/ms';
import { App } from '@capacitor/app';
import { Router, NavigationEnd } from '@angular/router';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { filter } from 'rxjs/operators';
import { StatusBar } from '@capacitor/status-bar';
import { CheckUpdateService } from './core/startup/check-update.service';
import { SafeArea } from 'capacitor-plugin-safe-area';
import { NavigationBar } from '@hugotomazi/capacitor-navigation-bar';
import { Device } from '@capacitor/device';
import { PushNotifications } from '@capacitor/push-notifications';
import { PrayerNotificationsService } from './features/prayer/services/prayer-notifications.service';
import { DarkModeHandlerService } from './core/appearance/dark-mode-handler.service';
import { SplashService } from './core/startup/splash.service';

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
    private splashService: SplashService,
  ) {
    (window as any).handleDeepLink = (path: string) => {
      console.log('Native deep link received from constructor:', path);
      this.navigateToDeepLink(path);
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
    // Listen for page loaded events (components should dispatch 'pageLoaded' or 'homePageLoaded')
    const handlePageLoaded = (event: Event) => {
      console.log('Page loaded event received');
      const customEvent = event as CustomEvent;
      if (customEvent?.detail?.loaded) {
        // Simply mark app loaded; the LoadingComponent will enforce minimum display time
        this.isAppLoaded = true;
      }
    };

    window.addEventListener(
      'homePageLoaded',
      handlePageLoaded as EventListener,
    );
    window.addEventListener('pageLoaded', handlePageLoaded as EventListener);

    // Listen for route changes
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
      )
      .subscribe((event) => {
        // Show loading overlay until pageLoaded event sets `isAppLoaded`.
        this.isAppLoaded = false;
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

        // Now hide the native splash so the custom loading overlay can take over
        // Note: SplashService.init() is called by LoadingComponent, not here
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
        this.navigateToDeepLink(route, event.url);
      });
    }
  }

  private navigateToDeepLink(path: string, originalUrl?: string) {
    const normalizedPath = path.replace(/\/+$/, '').toLowerCase();

    if (normalizedPath === '/prayertimes') {
      // Prayer times now live inside the home page, so preserve the legacy
      // notification/deep-link path while opening that component directly.
      return this.router.navigate(['/tabs/home'], {
        queryParams: { openPrayerTimes: 'true' },
      });
    }

    if (originalUrl) {
      this.handleOpenUrl(originalUrl);
      return;
    }

    return this.router.navigateByUrl(path);
  }

  private handleOpenUrl(url: string) {
    const path = new URL(url).pathname.toLowerCase();
    if (path === '/announcement' || path.startsWith('/announcement/')) {
      this.router.navigateByUrl('/tabs/home');
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

          this.router.navigateByUrl('/tabs/home');
        },
      );
    }
  }

  private setupAppResumeListener() {
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', async (state) => {
        if (state.isActive) {
          // App has resumed, check if we previously opened notification settings
          const settingsOpened = localStorage.getItem(
            'notificationSettingsOpened',
          );
          if (settingsOpened === 'true') {
            console.log(
              'App resumed after opening notification settings, checking permission...',
            );
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
