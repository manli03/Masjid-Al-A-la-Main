import { Component, Input } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-viewer-modal',
  standalone: true,
  imports: [IonicModule, CommonModule],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="end">
          <ion-button (click)="dismissModal()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Lihat Imej</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="image-container">
        <img
          [src]="imageUrl"
          (error)="handleImageError($event)"
          alt="Full Image"
        />
      </div>

      <div class="ion-padding ion-text-center">
        <ion-button expand="block" (click)="dismissModal()">Tutup</ion-button>
      </div>
    </ion-content>

    <style>
      .image-container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: calc(100% - 60px);
        overflow: auto;
      }

      img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
    </style>
  `,
})
export class ImageViewerModalComponent {
  @Input() imageUrl: string = '';

  constructor(private modalController: ModalController) {}

  dismissModal() {
    this.modalController.dismiss();
  }

  handleImageError(event: Event) {
    // Replace with fallback image if the image fails to load
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/icon/broken-image.svg';
  }
}
