import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { HomePageRoutingModule } from './home-routing.module';

import { HomePage } from './home.page';

import { QiblaCompassComponent } from '../prayer/components/qibla-compass/qibla-compass.component';
import { PrayerTimesComponent } from '../prayer/components/prayer-times/prayer-times.component';
// import { LoadingComponent } from '../../layout/loading/loading.component';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, HomePageRoutingModule],
  declarations: [HomePage, QiblaCompassComponent, PrayerTimesComponent],
})
export class HomePageModule {}
