import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { prayerTimesPage } from './prayerTimes.page';
import { prayerTimesPageRoutingModule } from './prayerTimes-routing.module';
import { NotificationSettingsComponent } from './notification-settings/notification-settings.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    prayerTimesPageRoutingModule,
    NotificationSettingsComponent,
  ],
  declarations: [prayerTimesPage],
})
export class prayerTimesPageModule {}
