import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { HadithSupplicationPageRoutingModule } from './hadith-supplication-routing.module';

import { HadithSupplicationPage } from './hadith-supplication.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HadithSupplicationPageRoutingModule
  ],
  declarations: [HadithSupplicationPage]
})
export class HadithSupplicationPageModule {}
