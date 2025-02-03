import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { prayerTimesPage } from './prayerTimes.page';

const routes: Routes = [
  {
    path: '',
    component: prayerTimesPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class prayerTimesPageRoutingModule { }
