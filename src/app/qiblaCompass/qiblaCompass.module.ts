import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { qiblaCompassPage } from './qiblaCompass.page';

import { qiblaCompassPageRoutingModule } from './qiblaCompass-routing.module';


@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    qiblaCompassPageRoutingModule,
  ],
  declarations: [qiblaCompassPage]
})
export class qiblaCompassPageModule { }
