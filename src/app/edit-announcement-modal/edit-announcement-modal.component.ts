import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-edit-announcement-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Edit Pengumuman</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-item>
        <ion-label position="stacked">Tajuk</ion-label>
        <ion-input [(ngModel)]="editAnnouncement.title" placeholder="Masukkan Tajuk"></ion-input>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Penulis</ion-label>
        <ion-input [(ngModel)]="editAnnouncement.author" placeholder="Masukkan Penulis"></ion-input>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Tarikh</ion-label>
        <ion-datetime [(ngModel)]="editAnnouncement.date"></ion-datetime>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Konten</ion-label>
        <ion-textarea [(ngModel)]="editAnnouncement.content" placeholder="Masukkan Konten"></ion-textarea>
      </ion-item>
      <div class="ion-text-end">
        <ion-button (click)="dismiss()" color="light">Batal</ion-button>
        <ion-button (click)="save()" color="primary">Simpan</ion-button>
      </div>
    </ion-content>
  `,
})
export class EditAnnouncementModalComponent {
  @Input() news: any;
  editAnnouncement: any;

  constructor(private modalController: ModalController) { }

  ngOnInit() {
    this.editAnnouncement = { ...this.news };
  }

  dismiss() {
    this.modalController.dismiss();
  }

  save() {
    this.modalController.dismiss(this.editAnnouncement);
  }
}
