// tab.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Platform } from '@ionic/angular';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Router, NavigationExtras } from '@angular/router';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service';
import { PrayerNotificationsService } from '../services/prayer-notifications.service';
import { FcmService } from '../services/fcm.service';
import { SplashScreen } from '@capacitor/splash-screen';
import { Subscription } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { LoadingComponent } from '../component/loading/loading.component';
import { NavigationBar } from '@hugotomazi/capacitor-navigation-bar';

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
  private routerEventsSubscription!: Subscription;
  isAdminValue: boolean = false;

  constructor(
    private platform: Platform,
    public router: Router,
    private storageService: StorageService,
    private authService: AuthService, // Added AuthService
    private prayerNotificationsService: PrayerNotificationsService,
    private fcmService: FcmService, // Called in constructor,
  ) {
    this.darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.darkModeListener = () => {
      const isHome = this.router.url === '/tabs/home';
      const isAuth = this.router.url === '/tabs/authentication';
      this.handleStatusBarAndClass(isHome, isAuth);
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
          const profileTabRoute = '/tabs/profile';
          const ManageAnnouncementPageRoute = '/tabs/manage-announcement';
          const currentRoute = this.router.url;
          if (
            currentRoute === profileTabRoute ||
            currentRoute === ManageAnnouncementPageRoute
          ) {
            // If on prayer times or profile tab or manage-announcement tab, navigate to home tab
            this.router.navigateByUrl(homeTabRoute);
          }
        });

      // Status bar logic
      this.darkModeMediaQuery.addEventListener('change', this.darkModeListener);

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

    this.routerEventsSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const isHome = event.urlAfterRedirects === '/tabs/home';
        const isAuth = event.urlAfterRedirects === '/tabs/authentication';
        this.handleStatusBarAndClass(isHome, isAuth);
      }
    });
  }

  ngOnDestroy() {
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
    this.darkModeMediaQuery.removeEventListener(
      'change',
      this.darkModeListener,
    );
    if (this.routerEventsSubscription) {
      this.routerEventsSubscription.unsubscribe();
    }
  }

  // Keep the isAdmin utility function
  async isAdmin(): Promise<boolean> {
    // Check admin status directly from database
    const isAdmin = await this.authService.isAdmin();
    return isAdmin;
  }

  private async handleStatusBarAndClass(isHome: boolean, isAuth: boolean) {
    // Function to check loading status
    const checkLoadingStatus = async (): Promise<void> => {
      const isLoaded = !LoadingComponent.isLoaded;
      console.log('Checking loading status:', isLoaded);

      if (!isLoaded) {
        NavigationBar.setTransparency({ isTransparent: false });
        // Set status bar color
        if (this.platform.is('hybrid')) {
          StatusBar.setStyle({ style: Style.Default });
          try {
            const isDarkMode = this.darkModeMediaQuery.matches;
            let color: string;
            if (isHome) {
              color = isDarkMode ? '#121212' : '#f5f5f5';
            } else if(isAuth) {
              // Use a different color for authentication page
              color = isDarkMode ? '#333333' : '#ffffff';
            } else {
              // Use a different color for non-home pages
              color =
                getComputedStyle(document.documentElement).getPropertyValue(
                  '--ion-toolbar-background',
                ) || (isDarkMode ? '#222428' : '#ffffff');
            }
            await StatusBar.setBackgroundColor({ color: color.trim() });
            NavigationBar.setColor({
              color: getComputedStyle(
                document.documentElement,
              ).getPropertyValue('--ion-toolbar-background'),
              darkButtons: !isDarkMode,
            });
          } catch (error) {
            console.error('Error updating status bar color:', error);
          }
        }

        // Toggle .non-home-screen class on <ion-app>
        const ionApp = document.querySelector('ion-app');
        if (ionApp) {
          if (!isHome) {
            ionApp.classList.add('non-home-screen');
          } else {
            ionApp.classList.remove('non-home-screen');
          }
        }
      } else {
        // If still loading, set the loading color and check again after delay
        if (this.platform.is('hybrid')) {
          // Check again after 100ms
          setTimeout(() => checkLoadingStatus(), 100);
        }
      }
    };

    // Start the initial check
    await checkLoadingStatus();
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
