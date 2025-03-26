import { Component } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { AuthService } from '../services/Auth/auth.service';
import { Router } from '@angular/router';
import { EditProfileModalComponent } from '../component/edit-profile-modal/edit-profile-modal.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage {

  constructor(
    private alertController: AlertController,
    private authService: AuthService,
    private router: Router,
    private modalController: ModalController,
  ) { }

  userProfile = {
    name: 'Muhammad Aiman bin Norazli',
    birthdate: '2003-01-02',
    phone: '017-409-2591',
    address: '123 Jalan Masjid, Taman Masjid, 83000, Malang, Johor, Malaysia',
  };

  handleRefresh(event: CustomEvent) {
    setTimeout(() => {
      // Reload Page
      location.reload();
      (event.target as HTMLIonRefresherElement).complete();
    }, 2000);
  }
  
  async handleLogout() {
    const alert = await this.alertController.create({
      header: 'Log Keluar',
      message: 'Adakah anda pasti ingin log keluar?',
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {}
        }, {
          text: 'Log Keluar',
          handler: () => {
            this.authService.logout();  // Remove the token from localStorage
            this.router.navigate(['/tabs/authentication']);  // Redirect to the login page
          }
        }
      ]
    });

    await alert.present();
  }

  isAdmin() {
    if (localStorage.getItem('userToken') === 'adminadmin') {
      return true;
    }
    return false;
  }

  // Open Edit Profile Modal
  async openEditProfileModal() {
    const modal = await this.modalController.create({
      component: EditProfileModalComponent,
      componentProps: { profile: { ...this.userProfile } }, // Pass the current profile data to the modal
    });

    modal.onDidDismiss().then((data) => {
      if (data.data) {
        this.userProfile = { ...data.data }; // Update the profile with new data
      }
    });

    return await modal.present();
  }
}

