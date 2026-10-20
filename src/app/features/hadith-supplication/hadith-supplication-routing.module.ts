import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { HadithSupplicationPage } from './hadith-supplication.page';

const routes: Routes = [
  {
    path: '',
    component: HadithSupplicationPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HadithSupplicationPageRoutingModule {}
