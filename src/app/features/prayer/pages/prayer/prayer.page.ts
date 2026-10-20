import { Component, ViewChild } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';
import { QiblaCompassComponent } from '../../components/qibla-compass/qibla-compass.component';

@Component({
  selector: 'app-prayer-page',
  templateUrl: './prayer.page.html',
  styleUrls: ['./prayer.page.scss'],
})
export class PrayerPage {
  @ViewChild(QiblaCompassComponent) compass?: QiblaCompassComponent;
  private backButtonSubscription: any;

  constructor(
    private platform: Platform,
    private router: Router,
  ) {}

  ionViewWillEnter(): void {
    if (this.compass && !this.compass.locationLoading) {
      void this.compass.loadCompassResources();
    }
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
    this.compass?.resetCompassState();
    this.backButtonSubscription?.unsubscribe();
    this.backButtonSubscription = null;
  }
}
