import { Component } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-add-announcement-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Tambah Pengumuman</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-item>
        <ion-label position="stacked">Tajuk</ion-label>
        <ion-textarea
          [(ngModel)]="newAnnouncement.title"
          placeholder="Masukkan Tajuk"
          [autoGrow]="true"
          (ngModelChange)="validateFields()"
        ></ion-textarea>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Penulis</ion-label>
        <ion-textarea
          [(ngModel)]="newAnnouncement.author"
          placeholder="Masukkan Penulis"
          [autoGrow]="true"
          (ngModelChange)="validateFields()"
        ></ion-textarea>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Pengumuman</ion-label>
        <ion-textarea
          [(ngModel)]="newAnnouncement.content"
          placeholder="Masukkan Pengumuman"
          [autoGrow]="true"
          (ngModelChange)="validateFields()"
        ></ion-textarea>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Gambar</ion-label>
        <img
          *ngIf="newAnnouncement.imageUrl"
          [src]="newAnnouncement.imageUrl"
          alt="Selected Image"
          style="width: 100%; margin: 10px 0; border-radius: 5px;"
        />
        <ion-button
          expand="block"
          color="light"
          (click)="fileInput.click()"
          style="margin: 20px 0;"
        >
          <span [style.text-transform]="imageName ? 'none' : null">
            {{ imageName ? imageName : 'Pilih Gambar' }}
          </span>
        </ion-button>
        <input
          type="file"
          (change)="onImageSelected($event)"
          accept="image/*"
          id="choose-file"
          #fileInput
          style="display: none;"
        />
      </ion-item>
      <div class="ion-text-end">
        <ion-button (click)="dismiss()" color="light">Batal</ion-button>
        <ion-button
          (click)="confirmAdd()"
          color="primary"
          [disabled]="!allFieldsFilled()"
        >
          Tambah
        </ion-button>
      </div>
    </ion-content>
  `,
})
export class AddAnnouncementModalComponent {
  newAnnouncement = {
    title: '',
    author: '',
    date: new Date().toLocaleString(),
    content: '',
    imageUrl: '',
    commentsCount: 0,
    likes: 0,
  };

  imageName: string = '';

  constructor(
    private modalController: ModalController,
    private alertController: AlertController
  ) {}

  dismiss() {
    this.modalController.dismiss();
  }

  async confirmAdd() {
    const alert = await this.alertController.create({
      header: 'Sahkan Tambah Pengumuman',
      message: 'Anda pasti untuk menambah pengumuman ini?',
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
            console.log('Confirm cancelled');
          },
        },
        {
          text: 'Tambah',
          handler: () => {
            this.save();
          },
        },
      ],
    });

    await alert.present();
  }

  save() {
    this.modalController.dismiss(this.newAnnouncement);
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    this.imageName = file ? file.name : '';
    const reader = new FileReader();
    reader.onload = () => {
      this.newAnnouncement.imageUrl = reader.result as string;
      this.validateFields();
    };
    reader.readAsDataURL(file);
  }

  validateFields() {
    this.allFieldsFilled();
  }

  allFieldsFilled() {
    return (
      this.newAnnouncement.title &&
      this.newAnnouncement.author &&
      this.newAnnouncement.content &&
      this.newAnnouncement.imageUrl
    );
  }
}

