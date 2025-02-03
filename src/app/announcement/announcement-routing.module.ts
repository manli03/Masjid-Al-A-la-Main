import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { announcementPage } from './announcement.page';

const routes: Routes = [
  {
    path: '',
    component: announcementPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class announcementPageRoutingModule { }
