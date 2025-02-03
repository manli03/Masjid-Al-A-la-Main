import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { announcementPage } from './announcement.page';

import { announcementPageRoutingModule } from './announcement-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    announcementPageRoutingModule
  ],
  declarations: [announcementPage]
})
export class announcementPageModule { }
