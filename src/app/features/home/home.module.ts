import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { HomePageRoutingModule } from './home-routing.module';

import { HomePage } from './home.page';
import { PrayerZoneSelectorComponent } from '../prayer/components/prayer-zone-selector/prayer-zone-selector.component';

@NgModule({
  imports: [CommonModule, IonicModule, HomePageRoutingModule],
  declarations: [HomePage, PrayerZoneSelectorComponent],
})
export class HomePageModule {}
