import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-prayer-page',
  templateUrl: './prayer.page.html',
  styleUrls: ['./prayer.page.scss'],
})
export class PrayerPage {
  private backButtonSubscription: any;

  constructor(
    private platform: Platform,
    private router: Router,
  ) {}

  ionViewWillEnter(): void {
    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(
      10,
      () => this.router.navigateByUrl('/tabs/home'),
    );
  }

  ionViewDidEnter(): void {
    window.dispatchEvent(
      new CustomEvent('pageLoaded', {
        detail: { loaded: true },
        bubbles: true,
        composed: true,
      }),
    );
  }

  ionViewWillLeave(): void {
    this.backButtonSubscription?.unsubscribe();
    this.backButtonSubscription = null;
  }
}
