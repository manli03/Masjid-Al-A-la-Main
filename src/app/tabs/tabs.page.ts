import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
})
export class TabsPage implements OnInit {
  private backButtonSubscription: any;

  constructor(private platform: Platform, public router: Router) {}

  ngOnInit() {
    this.backButtonSubscription =
      this.platform.backButton.subscribeWithPriority(10, async () => {
        if (window.location.pathname !== '/tabs/home') {
          // If not on home page, navigate back to home page using NavController
          this.router.navigate(['/tabs/home']);
        }
      });
  }

  ngOnDestroy() {
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
  }

  isAdmin() {
    return localStorage.getItem('userToken') === 'adminadmin';
  }
}
