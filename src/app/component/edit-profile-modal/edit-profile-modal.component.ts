import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-edit-profile-modal',
  styleUrls: ['edit-profile-modal.component.scss'],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Edit Profil</ion-title>
        <ion-buttons slot="end">
          <ion-button
            (click)="dismiss()"
            [disabled]="!isProfileCompleteOnStart && !isProfileComplete()"
          >
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-item>
        <ion-label position="stacked"
          >Nama Penuh <ion-text color="danger">*</ion-text></ion-label
        >
        <ion-input
          [(ngModel)]="profile.name"
          placeholder="Nama Penuh"
        ></ion-input>
      </ion-item>
      <ion-item>
        <ion-label position="stacked"
          >Tarikh Lahir <ion-text color="danger">*</ion-text></ion-label
        >
        <ion-datetime
          presentation="date"
          [preferWheel]="true"
          locale="ms-MY"
          [(ngModel)]="profile.birthdate"
          placeholder="Tarikh Lahir"
        ></ion-datetime>
      </ion-item>
      <ion-item>
        <ion-label position="stacked"
          >Nombor Telefon <ion-text color="danger">*</ion-text></ion-label
        >
        <ion-input
          [(ngModel)]="profile.phone"
          placeholder="Nombor Telefon"
          type="tel"
          (keypress)="numberOnly($event)"
          (input)="filterNonNumeric($event)"
        ></ion-input>
      </ion-item>

      <div *ngIf="membershipNumber" class="ion-padding ion-text-center">
        <ion-text color="medium">
          <h5>Nombor Keahlian</h5>
          <p>{{ membershipNumber }}</p>
        </ion-text>
      </div>

      <div class="ion-padding" *ngIf="!isProfileCompleteOnStart">
        <ion-note color="danger">
          * Anda perlu melengkapkan semua maklumat profil untuk mengakses semua
          ciri aplikasi
        </ion-note>
      </div>

      <div class="ion-text-end ion-padding">
        <ion-button
          (click)="dismiss()"
          color="light"
          [disabled]="!isProfileCompleteOnStart && !isProfileComplete()"
          >Batal</ion-button
        >
        <ion-button
          (click)="save()"
          color="primary"
          [disabled]="!isProfileComplete()"
          >Simpan</ion-button
        >
      </div>
    </ion-content>
  `,
})
export class EditProfileModalComponent implements OnInit {
  @Input() profile: any; // This will receive the profile data from parent
  isProfileCompleteOnStart: boolean = false;
  membershipNumber: string = '';

  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
  ) {}

  ngOnInit() {
    // Store initial profile completion state
    this.isProfileCompleteOnStart = this.isProfileComplete();
    this.membershipNumber = this.profile.membershipNumber;
  }

  dismiss() {
    // Only allow dismissal if the profile was complete on start
    if (this.isProfileCompleteOnStart || this.isProfileComplete()) {
      this.modalController.dismiss();
    } else {
      this.presentToast('Anda perlu melengkapkan profil anda dahulu');
    }
  }

  save() {
    if (this.isProfileComplete()) {
      // Add the flag to track if profile was complete on start
      this.profile.isProfileCompleteOnStart = this.isProfileCompleteOnStart;
      this.modalController.dismiss(this.profile); // Return updated profile data
    } else {
      this.presentToast('Sila lengkapkan semua maklumat yang diperlukan');
    }
  }

  // Check if all required fields are filled
  isProfileComplete(): boolean {
    return !!(
      this.profile.name &&
      this.profile.name.trim() &&
      this.profile.birthdate &&
      this.profile.phone &&
      this.profile.phone.trim()
    );
  }

  // Prevent non-numeric key presses
  numberOnly(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false;
    }
    return true;
  }

  // Filter out any non-numeric characters that might have been pasted
  filterNonNumeric(event: any) {
    this.profile.phone = this.profile.phone.replace(/[^0-9]/g, '');
  }

  // Display toast message
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: 'warning',
    });
    toast.present();
  }
}
