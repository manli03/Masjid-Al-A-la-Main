import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BridgeLoginPageRoutingModule } from './bridge-login-routing.module';

import { BridgeLoginPage } from './bridge-login.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BridgeLoginPageRoutingModule
  ],
  declarations: [BridgeLoginPage]
})
export class BridgeLoginPageModule {}
