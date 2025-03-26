import { Component, Input } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-edit-announcement-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Edit Pengumuman</ion-title>
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
          [(ngModel)]="editAnnouncement.title"
          placeholder="Masukkan Tajuk"
          [autoGrow]="true"
          (ngModelChange)="checkFormValidity()"
        ></ion-textarea>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Penulis</ion-label>
        <ion-input
          [(ngModel)]="editAnnouncement.author"
          placeholder="Masukkan Penulis"
          (ngModelChange)="checkFormValidity()"
        ></ion-input>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Pengumuman</ion-label>
        <ion-textarea
          [(ngModel)]="editAnnouncement.content"
          placeholder="Masukkan Pengumuman"
          [autoGrow]="true"
          (ngModelChange)="checkFormValidity()"
        ></ion-textarea>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Gambar</ion-label>
        <img
          *ngIf="editAnnouncement.imageUrl"
          [src]="editAnnouncement.imageUrl"
          alt="Gambar"
          style="max-width: 100%; margin: 10px 0; border-radius: 5px;"
        />
        <ion-button
          expand="block"
          color="light"
          (click)="fileInput.click()"
          style="margin: 20px 0;"
        >
          <span [style.text-transform]="imageName ? 'none' : null">
            {{ imageName ? imageName : 'Tukar Gambar' }}
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
          (click)="confirmSave()"
          color="primary"
          [disabled]="!formIsValid || !isContentChanged()"
          >Simpan</ion-button
        >
      </div>
    </ion-content>
  `,
})
export class EditAnnouncementModalComponent {
  @Input() news: any;
  editAnnouncement: any;
  originalAnnouncement: any;
  formIsValid = false;

  imageName: string = '';

  constructor(
    private modalController: ModalController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.editAnnouncement = { ...this.news };
    this.originalAnnouncement = { ...this.news };
  }

  dismiss() {
    this.modalController.dismiss();
  }

  async confirmSave() {
    const alert = await this.alertController.create({
      header: 'Simpan perubahan?',
      message: 'Pastikan data yang dimasukkan adalah betul.',
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
          cssClass: 'secondary',
        },
        {
          text: 'Simpan',
          handler: () => {
            this.save();
          },
        },
      ],
    });

    await alert.present();
  }

  save() {
    this.modalController.dismiss(this.editAnnouncement);
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    this.imageName = file ? file.name : '';
    const reader = new FileReader();
    reader.onload = () => {
      this.editAnnouncement.imageUrl = reader.result as string;
      this.checkFormValidity();
    };
    reader.readAsDataURL(file);
  }

  checkFormValidity() {
    this.formIsValid =
      this.editAnnouncement.title &&
      this.editAnnouncement.author &&
      this.editAnnouncement.content;
  }

  isContentChanged() {
    return (
      JSON.stringify(this.editAnnouncement) !==
      JSON.stringify(this.originalAnnouncement)
    );
  }
}

