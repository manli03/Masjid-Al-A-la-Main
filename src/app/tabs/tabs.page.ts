import { Component, OnInit, OnDestroy } from '@angular/core';
import { Platform } from '@ionic/angular';
import { StatusBar } from '@capacitor/status-bar';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
})
export class TabsPage implements OnInit, OnDestroy {
  private backButtonSubscription: any;
  private darkModeMediaQuery: MediaQueryList;
  private darkModeListener: () => void;

  constructor(
    private platform: Platform,
    public router: Router,
  ) {
    this.darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.darkModeListener = () => {
      this.updateStatusBarColor();
    };
  }

  async ngOnInit() {
    this.platform.ready().then(() => {
      // Back button logic
      this.backButtonSubscription =
        this.platform.backButton.subscribeWithPriority(10, () => {
          if (this.router.url !== '/tabs/home') {
            // Check the current URL
            this.router.navigate(['/tabs/home']);
          } else {
            // Optionally, exit the app if on the home page
            // App.exitApp(); //Requires import { App } from '@capacitor/app';
          }
        });

      // Status bar logic
      this.darkModeMediaQuery.addEventListener('change', this.darkModeListener);
      this.updateStatusBarColor();
    });
  }

  ngOnDestroy() {
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
    this.darkModeMediaQuery.removeEventListener(
      'change',
      this.darkModeListener
    );
  }

  isAdmin() {
    return localStorage.getItem('userToken') === 'adminadmin';
  }

  async updateStatusBarColor() {
    // return if not device (e.g. web)
    if (!this.platform.is('cordova')) {
      return;
    }

    try {
      const darkMode = this.darkModeMediaQuery.matches;

      if (darkMode) {
        // Set status bar to dark background with light text for dark mode
        await StatusBar.setBackgroundColor({ color: '#121212' }); // Dark background color for dark mode
      } else {
        await StatusBar.setBackgroundColor({ color: '#FFFFFF' }); // Light background color for light mode
      }
    } catch (error) {
      console.error('Error updating status bar color:', error);
    }
  }
}
