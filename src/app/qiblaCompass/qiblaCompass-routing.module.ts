import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { qiblaCompassPage } from './qiblaCompass.page';

const routes: Routes = [
  {
    path: '',
    component: qiblaCompassPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class qiblaCompassPageRoutingModule { }
