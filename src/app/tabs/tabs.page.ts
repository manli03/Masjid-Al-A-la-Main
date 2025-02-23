import { Component, OnInit } from '@angular/core';
import { Platform, NavController } from '@ionic/angular';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
})
export class TabsPage implements OnInit {
  private backButtonSubscription: any;

  constructor(private platform: Platform, private navCtrl: NavController) {}

  ngOnInit() {
    this.backButtonSubscription =
      this.platform.backButton.subscribeWithPriority(10, async () => {
        if (window.location.pathname !== '/tabs/home') {
          // If not on home page, navigate back to home page using NavController
          this.navCtrl.navigateRoot('/tabs/home');
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
