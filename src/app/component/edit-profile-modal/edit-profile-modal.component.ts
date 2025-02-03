import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-edit-profile-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Edit Profil</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-item>
        <ion-label position="stacked">Nama Penuh</ion-label>
        <ion-input [(ngModel)]="profile.name" placeholder="Nama Penuh"></ion-input>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Tarikh Lahir</ion-label>
        <ion-datetime [(ngModel)]="profile.birthdate" placeholder="Tarikh Lahir"></ion-datetime>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Nombor Telefon</ion-label>
        <ion-input [(ngModel)]="profile.phone" placeholder="Nombor Telefon"></ion-input>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Alamat</ion-label>
        <ion-input [(ngModel)]="profile.address" placeholder="Alamat"></ion-input>
      </ion-item>
      
      <div class="ion-text-end">
        <ion-button (click)="dismiss()" color="light">Batal</ion-button>
        <ion-button (click)="save()" color="primary">Simpan</ion-button>
      </div>
    </ion-content>
  `,
})
export class EditProfileModalComponent {
  @Input() profile: any; // This will receive the profile data from parent

  constructor(private modalController: ModalController) { }

  dismiss() {
    this.modalController.dismiss();
  }

  save() {
    this.modalController.dismiss(this.profile); // Return updated profile data
  }
}
