import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BridgeLoginPage } from './bridge-login.page';

const routes: Routes = [
  {
    path: '',
    component: BridgeLoginPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BridgeLoginPageRoutingModule {}
