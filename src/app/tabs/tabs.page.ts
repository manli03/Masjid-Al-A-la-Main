import { Component, OnInit, OnDestroy } from '@angular/core';
import { Platform } from '@ionic/angular';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Router, NavigationExtras, NavigationEnd } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PrayerCoordinatorService } from '../services/prayer-coordinator.service';
import { Subscription } from 'rxjs';
import { LoadingComponent } from '../component/loading/loading.component';
import { NavigationBar } from '@hugotomazi/capacitor-navigation-bar';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
})
export class TabsPage implements OnInit, OnDestroy {
  private backButtonSubscription: any;
  private routerEventsSubscription!: Subscription;
  private darkModeObserver!: MutationObserver;
  isAdminValue: boolean = false;
  private isDarkMode: boolean = false;

  constructor(
    private platform: Platform,
    public router: Router,
    private authService: AuthService,
    private prayerCoordinatorService: PrayerCoordinatorService,
  ) {}

  ngOnInit() {
    console.log('TabsPage ngOnInit: Initializing...');
    this.platform.ready().then(async () => {
      // Back button logic
      this.backButtonSubscription =
        this.platform.backButton.subscribeWithPriority(10, () => {
          const homeTabRoute = '/tabs/home';
          const profileTabRoute = '/tabs/profile';
          const manageAnnouncementRoute = '/tabs/manage-announcement';
          const currentRoute = this.router.url;
          if (
            currentRoute === profileTabRoute ||
            currentRoute === manageAnnouncementRoute
          ) {
            this.router.navigateByUrl(homeTabRoute);
          }
        });

      // Initialize dark mode detection
      this.checkDarkMode();

      // Initialize prayer notifications
      try {
        await this.prayerCoordinatorService.initialize();
        console.log('Prayer notifications initialized');
      } catch (error) {
        console.error('Error initializing prayer notifications:', error);
      }
    });

    this.routerEventsSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects;

        const isHome = url.startsWith('/tabs/home');
        const isAuth = url.startsWith('/tabs/authentication');
        const isSettings = url.startsWith('/settings');
        this.handleStatusBarAndClass(isHome, isAuth, isSettings);
      }
    });
  }

  ngOnDestroy() {
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
    if (this.routerEventsSubscription) {
      this.routerEventsSubscription.unsubscribe();
    }
    if (this.darkModeObserver) {
      this.darkModeObserver.disconnect();
    }
  }

  async isAdmin(): Promise<boolean> {
    return await this.authService.isAdmin();
  }

  private checkDarkMode() {
    // Initial check
    this.isDarkMode =
      document.documentElement.classList.contains('ion-palette-dark');

    // Observe changes
    this.darkModeObserver = new MutationObserver(() => {
      this.isDarkMode =
        document.documentElement.classList.contains('ion-palette-dark');

      // Update status bar immediately if route is home/auth
      const isHome = this.router.url.startsWith('/tabs/home');
      const isAuth = this.router.url.startsWith('/tabs/authentication');
      const isSettings = this.router.url.startsWith('/settings');
      this.handleStatusBarAndClass(isHome, isAuth, isSettings);
    });

    this.darkModeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  private async handleStatusBarAndClass(
    isHome: boolean,
    isAuth: boolean,
    isSettings: boolean,
  ) {
    const checkLoadingStatus = async (): Promise<void> => {
      const isLoaded = !LoadingComponent.isLoaded;

      if (!isLoaded) {
        NavigationBar.setTransparency({ isTransparent: false });

        if (this.platform.is('hybrid')) {
          StatusBar.setStyle({ style: Style.Default });
          try {
            let color: string;
            if (isHome) {
              color =
                getComputedStyle(document.documentElement).getPropertyValue(
                  '--ion-toolbar-background',
                ) || (this.isDarkMode ? '#121212' : '#f5f5f5');
            } else if (isAuth) {
              color = this.isDarkMode ? '#1f1f1f' : '#ffffff';
            } else {
              color = this.isDarkMode ? '#121212' : '#f5f5f5';
            }

            await StatusBar.setBackgroundColor({ color: color.trim() });
            if (isSettings) {
              NavigationBar.setColor({
                color: color.trim(),
                darkButtons: !this.isDarkMode,
              });
            } else {
              NavigationBar.setColor({
                color: getComputedStyle(
                  document.documentElement,
                ).getPropertyValue('--ion-toolbar-background'),
                darkButtons: !this.isDarkMode,
              });
            }
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
        if (this.platform.is('hybrid')) {
          setTimeout(() => checkLoadingStatus(), 100);
        }
      }
    };

    await checkLoadingStatus();
  }

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
