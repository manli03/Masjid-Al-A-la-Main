import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { announcementPageRoutingModule } from './announcement-routing.module';
import { announcementPage } from './announcement.page';
import { ImageViewerModalComponent } from '../component/image-viewer-modal/image-viewer-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    announcementPageRoutingModule,
    ImageViewerModalComponent,
  ],
  declarations: [announcementPage],
})
export class announcementPageModule {}
