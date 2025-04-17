import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AnnouncementLoadingPageRoutingModule } from './announcement-loading-routing.module';

import { AnnouncementLoadingPage } from './announcement-loading.page';
import { LoadingSplashModule } from '../component/loading-splash/loading-splash.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AnnouncementLoadingPageRoutingModule,
    LoadingSplashModule,
  ],
  declarations: [AnnouncementLoadingPage],
})
export class AnnouncementLoadingPageModule {}
