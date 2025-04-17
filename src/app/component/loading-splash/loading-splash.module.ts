import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { LoadingSplashComponent } from './loading-splash.component';

@NgModule({
  declarations: [LoadingSplashComponent],
  imports: [CommonModule, IonicModule],
  exports: [LoadingSplashComponent],
})
export class LoadingSplashModule {}
