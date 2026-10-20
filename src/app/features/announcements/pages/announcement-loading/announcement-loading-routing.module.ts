import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AnnouncementLoadingPage } from './announcement-loading.page';

const routes: Routes = [
  {
    path: '',
    component: AnnouncementLoadingPage,
  },
  {
    path: ':id',
    component: AnnouncementLoadingPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AnnouncementLoadingPageRoutingModule {}
