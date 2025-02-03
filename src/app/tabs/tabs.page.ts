import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Location } from '@angular/common';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss']
})
export class TabsPage implements OnInit {

  constructor(private platform: Platform, private location: Location) {}

  ngOnInit() {
    this.platform.backButton.subscribeWithPriority(10, () => {
      // Custom back button behavior
      if (window.location.pathname === '/tabs') {
        // Exit the app if back is pressed on the root tab page
        (navigator as any)['app'].exitApp();
      } else {
        // Otherwise, navigate back in the stack
        this.location.back();
      }
    });
  }

  isAdmin() {
    if (localStorage.getItem('userToken') === 'adminadmin') {
      return true;
    }
    return false;
  }
}
