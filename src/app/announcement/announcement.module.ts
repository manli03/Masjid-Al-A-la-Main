import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { announcementPageRoutingModule } from './announcement-routing.module';
import { announcementPage } from './announcement.page';
import { ImageViewerModalComponent } from '../component/image-viewer-modal/image-viewer-modal.component';
import { CommentOptionsPopoverComponent } from '../component/comment-options-popover/comment-options-popover.component';
import { LinkifyPipe } from '../services/linkify.pipe';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    announcementPageRoutingModule,
    ImageViewerModalComponent,
  ],
  declarations: [announcementPage, LinkifyPipe, CommentOptionsPopoverComponent],
})
export class announcementPageModule {}
