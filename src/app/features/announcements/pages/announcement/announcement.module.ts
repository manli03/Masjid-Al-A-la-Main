import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { announcementPageRoutingModule } from './announcement-routing.module';
import { announcementPage } from './announcement.page';
import { ImageViewerModalComponent } from '../../../../shared/components/image-viewer-modal/image-viewer-modal.component';
import { CommentOptionsPopoverComponent } from '../../components/comment-options-popover/comment-options-popover.component';
import { LinkifyPipe } from '../../../../shared/pipes/linkify.pipe';

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
