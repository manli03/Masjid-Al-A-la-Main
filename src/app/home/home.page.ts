import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage {

  constructor(
    private router: Router
  ) { }

  currentTime = "17:21"; // For the prayer time display
  prayerTimes: { [key: string]: string } = {
    subuh: '03:53',
    dzuhur: '11:20',
    ashar: '14:21',
    maghrib: '17:26',
    isya: '18:34',
  };
  prayerTracker: { [key: string]: boolean } = {
    subuh: true,
    dzuhur: true,
    ashar: true,
    maghrib: false,
    isya: false,
  };

  navigateToPrayerTimes() {
    // Navigate to the prayer times page
    this.router.navigate(['/tabs/prayerTimes']);
  }
  
  checked: boolean[] = [true, true, true, false, false];
  toggleChecked(number: number) {
    // Toggle the checkmark for a prayer(change the value of the checked array)
    this.checked[number] = !this.checked[number];
  }

  handleRefresh(event: CustomEvent) {
    setTimeout(() => {
      // Reload Page
      location.reload();
      (event.target as HTMLIonRefresherElement).complete();
    }, 2000);
  }
}
