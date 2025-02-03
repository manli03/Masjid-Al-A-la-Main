import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ManageAnnouncementPageRoutingModule } from './manage-announcement-routing.module';

import { ManageAnnouncementPage } from './manage-announcement.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ManageAnnouncementPageRoutingModule
  ],
  declarations: [ManageAnnouncementPage]
})
export class ManageAnnouncementPageModule {}
