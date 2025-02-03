import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TabsPageRoutingModule } from './tabs-routing.module';

import { TabsPage } from './tabs.page';

import { AddAnnouncementModalComponent } from '../add-announcement-modal/add-announcement-modal.component';
import { EditAnnouncementModalComponent } from '../edit-announcement-modal/edit-announcement-modal.component';
import { EditProfileModalComponent } from '../component/edit-profile-modal/edit-profile-modal.component';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    TabsPageRoutingModule
  ],
  declarations: [
    TabsPage,
    AddAnnouncementModalComponent,
    EditAnnouncementModalComponent,
    EditProfileModalComponent
  ]
})
export class TabsPageModule {}
