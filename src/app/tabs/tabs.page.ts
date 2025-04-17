// tab.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Platform, AlertController } from '@ionic/angular'; // Added AlertController
import { StatusBar } from '@capacitor/status-bar';
import { Router, NavigationExtras } from '@angular/router';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service'; // Added AuthService
import { PrayerNotificationsService } from '../services/prayer-notifications.service';
import { FcmService } from '../services/fcm.service';
import { SplashScreen } from '@capacitor/splash-screen';
// import { App } from '@capacitor/app'; // If needed for exitApp

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
})
// Remove ViewWillEnter from implements list
export class TabsPage implements OnInit, OnDestroy {
  private backButtonSubscription: any;
  private darkModeMediaQuery: MediaQueryList;
  private darkModeListener: () => void;
  // isAdminValue can still be used if needed elsewhere, but it won't be
  // automatically updated on view enter anymore. It will be updated
  // within goToAnnouncementTab when that specific tab is clicked.
  // Initialize it to a default state.
  isAdminValue: boolean = false;

  constructor(
    private platform: Platform,
    public router: Router,
    private storageService: StorageService,
    private authService: AuthService, // Added AuthService
    private prayerNotificationsService: PrayerNotificationsService,
    private fcmService: FcmService, // Called in constructor
  ) {
    this.darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.darkModeListener = () => {
      this.updateStatusBarColor();
    };
  }

  ngOnInit() {
    // Initial setup when the component is first created
    console.log('TabsPage ngOnInit: Initializing...');
    this.platform.ready().then(async () => {
      // Back button logic
      this.backButtonSubscription =
        this.platform.backButton.subscribeWithPriority(10, () => {
          const homeTabRoute = '/tabs/home';
          if (this.router.url !== homeTabRoute) {
            this.router.navigateByUrl(homeTabRoute);
          } else {
            console.log(
              'Already on home tab, back button press ignored or handle app exit.',
            );
            // App.exitApp();
          }
        });

      // Status bar logic
      this.darkModeMediaQuery.addEventListener('change', this.darkModeListener);
      this.updateStatusBarColor(); // Set initial status bar color

      // Hide Splash Screen
      SplashScreen.hide().catch((error) => {
        console.error('Error hiding splash screen:', error);
      });

      // Initialize prayer notifications and check for scheduled notifications
      try {
        await this.prayerNotificationsService.initialize();
        console.log('Prayer notifications initialized');
      } catch (error) {
        console.error('Error initializing prayer notifications:', error);
      }
    });

    // Optional: You *could* do an initial check here if needed when the app
    // first loads, but it won't re-check on subsequent returns to the tab page.
    // this.storageService.isAdmin().then(isAdmin => this.isAdminValue = isAdmin);
    // For the requirement of checking *only* on click, we leave this out or
    // just rely on the default `isAdminValue = false`.
  }

  // REMOVED ionViewWillEnter() method

  ngOnDestroy() {
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
    this.darkModeMediaQuery.removeEventListener(
      'change',
      this.darkModeListener,
    );
  }

  // Keep the isAdmin utility function
  async isAdmin(): Promise<boolean> {
    // Check admin status directly from database
    const isAdmin = await this.authService.isAdmin();
    return isAdmin;
  }

  async updateStatusBarColor() {
    if (!this.platform.is('hybrid')) {
      return;
    }
    try {
      const isDarkMode = this.darkModeMediaQuery.matches;
      const color = isDarkMode ? '#121212' : '#f5f5f5';
      await StatusBar.setBackgroundColor({ color });
    } catch (error) {
      console.error('Error updating status bar color:', error);
    }
  }

  // --- Modified Method to use loading page and handle announcement IDs ---
  goToAnnouncementTab(announcementId?: number) {
    if (announcementId) {
      // If we have an ID, pass it as a query parameter to the loading page
      const navigationExtras: NavigationExtras = {
        queryParams: { id: announcementId },
      };
      this.router.navigate(['/tabs/announcement-loading'], navigationExtras);
    } else {
      // Otherwise just go to the loading page
      this.router.navigateByUrl('/tabs/announcement-loading');
    }
  }
}
