import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-add-announcement-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Tambah Pengumuman</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-item>
        <ion-label position="stacked">Tajuk</ion-label>
        <ion-input [(ngModel)]="newAnnouncement.title" placeholder="Masukkan Tajuk"></ion-input>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Penulis</ion-label>
        <ion-input [(ngModel)]="newAnnouncement.author" placeholder="Masukkan Penulis"></ion-input>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Tarikh</ion-label>
        <ion-datetime [(ngModel)]="newAnnouncement.date"></ion-datetime>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Konten</ion-label>
        <ion-textarea [(ngModel)]="newAnnouncement.content" placeholder="Masukkan Konten"></ion-textarea>
      </ion-item>
      <div class="ion-text-end">
        <ion-button (click)="dismiss()" color="light">Batal</ion-button>
        <ion-button (click)="save()" color="primary">Tambah</ion-button>
      </div>
    </ion-content>
  `,
})
export class AddAnnouncementModalComponent {
  newAnnouncement = {
    title: '',
    author: '',
    date: '',
    content: '',
  };

  constructor(private modalController: ModalController) { }

  dismiss() {
    this.modalController.dismiss();
  }

  save() {
    this.modalController.dismiss(this.newAnnouncement);
  }
}
