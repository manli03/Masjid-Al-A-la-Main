import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { QiblaCompassComponent } from '../../components/qibla-compass/qibla-compass.component';
import { PrayerTimesComponent } from '../../components/prayer-times/prayer-times.component';
import { PrayerPageRoutingModule } from './prayer-routing.module';
import { PrayerPage } from './prayer.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PrayerPageRoutingModule],
  declarations: [PrayerPage, PrayerTimesComponent, QiblaCompassComponent],
})
export class PrayerPageModule {}
