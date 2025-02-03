import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ManageAnnouncementPage } from './manage-announcement.page';

const routes: Routes = [
  {
    path: '',
    component: ManageAnnouncementPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ManageAnnouncementPageRoutingModule {}
