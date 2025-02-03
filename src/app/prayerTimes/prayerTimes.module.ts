import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { prayerTimesPage } from './prayerTimes.page';

import { prayerTimesPageRoutingModule } from './prayerTimes-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    prayerTimesPageRoutingModule
  ],
  declarations: [prayerTimesPage]
})
export class prayerTimesPageModule { }
