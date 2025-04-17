import { Component, OnInit } from '@angular/core';
import '@angular/common/locales/global/ms';
import { App } from '@capacitor/app';
import { Router, NavigationExtras, NavigationEnd } from '@angular/router';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  isAppLoaded: boolean = false;
  isHomePage: boolean = false;
  appInitTime: number = 0;

  constructor(
    private router: Router,
    private platform: Platform,
  ) {
    this.initializeApp();
  }

  ngOnInit() {
    // Record app initialization time
    this.appInitTime = Date.now();

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

  initializeApp() {
    this.platform.ready().then(async () => {
      try {
        // Set loading state to false first
        this.isAppLoaded = false;

        // Hide the splash screen
        await SplashScreen.hide();
        console.log('Splash screen hidden, showing custom loading screen');

        // Set up App URL listener for deep links
        this.setupAppUrlListener();
      } catch (error) {
        console.error('Error during app initialization', error);
        this.isAppLoaded = true; // Ensure loading screen is hidden if there's an error
      }
    });
  }

  private setupAppUrlListener() {
    // Only set up listener on native platforms
    if (Capacitor.isNativePlatform()) {
      App.addListener('appUrlOpen', (event) => {
        console.log('App opened with URL:', event.url);
        this.handleOpenUrl(event.url);
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
}
