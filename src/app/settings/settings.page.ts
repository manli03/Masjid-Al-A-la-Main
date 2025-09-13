import { Component, OnInit } from '@angular/core';
import {
  AlertController,
  ModalController,
  ToastController,
  ViewWillEnter,
  Platform,
} from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { DatePickerModalComponent } from '../component/date-picker-modal/date-picker-modal.component';
import { DarkModeHandlerService } from '../services/dark-mode-handler.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit, ViewWillEnter {
  private apiUrl = environment.apiUrl;
  userProfile: any = {};
  isAdminValue: boolean = false;
  isLoading: boolean = false;
  membershipNumber: string = '';
  accountCreated: string = '';
  private backButtonSubscription: any;

  constructor(
    private alertController: AlertController,
    private authService: AuthService,
    private router: Router,
    private modalController: ModalController,
    private storageService: StorageService,
    private http: HttpClient,
    private toastController: ToastController,
    private platform: Platform,
    private darkModeService: DarkModeHandlerService,
  ) {}

  async ngOnInit() {
    // Initialize dark mode service
    await this.darkModeService.loadDarkModePreference();
  }

  ionViewWillEnter() {
    this.backButtonSubscription =
      this.platform.backButton.subscribeWithPriority(10, () => {
        this.router.navigateByUrl('/tabs/profile');
      });
    this.loadUserProfileData();
  }

  ionViewWillLeave() {
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
      this.backButtonSubscription = null;
    }
  }

  async loadUserProfileData() {
    this.isLoading = true;
    try {
      const [isAdmin, userData] = await Promise.all([
        this.authService.isAdmin(),
        this.storageService.get('user'),
      ]);

      this.isAdminValue = isAdmin;

      if (userData) {
        this.userProfile = {
          name: userData.name
            ? userData.name.charAt(0).toUpperCase() + userData.name.slice(1)
            : 'N/A',
          email: userData.email || 'N/A',
          phone: userData.phone || '',
          birthdate: userData.birthdate || '',

          imageUrl: userData.imageUrl || 'assets/icon/default-avatar.png',
        };

        this.membershipNumber = userData.membershipNumber || 'Not assigned';

        try {
          const response = await firstValueFrom(
            this.http.post<any>(`${this.apiUrl}/auth.php`, {
              action: 'get_user_details',
              email: userData.email,
            }),
          );

          if (response.success && response.user) {
            const createdAt = new Date(response.user.created_at);
            this.accountCreated = createdAt.toLocaleString('ms-MY', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
          } else {
            this.accountCreated = 'Tidak diketahui';
          }
        } catch (error) {
          console.error('Error fetching user details:', error);
          this.accountCreated = 'Tidak diketahui';
        }
      }
    } catch (error) {
      console.error('Error loading user profile data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async handleRefresh(event: CustomEvent) {
    await this.loadUserProfileData();
    (event.target as HTMLIonRefresherElement).complete();
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
        },
        {
          text: 'Log Keluar',
          handler: async () => {
            await this.authService.signOut();
            this.userProfile = {};
            this.isAdminValue = false;
            this.router.navigate(['/tabs/authentication']);
          },
        },
      ],
    });

    await alert.present();
  }

  async openAddAdminDialog() {
    const alert = await this.alertController.create({
      header: 'Tambah Admin Baru',
      message: 'Masukkan alamat e-mel pengguna yang ingin dijadikan admin.',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'E-mel Pengguna',
        },
      ],
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
        },
        {
          text: 'Tambah',
          handler: async (data) => {
            if (data.email) {
              this.confirmAddAdmin(data.email);
            } else {
              this.presentToast('Sila masukkan alamat e-mel', 'warning');
            }
          },
        },
      ],
    });

    await alert.present();

    // Add custom styling for the reminder text after the alert is presented
    setTimeout(() => {
      const alertElement = document.querySelector('ion-alert');
      if (alertElement) {
        const messageElement = alertElement.querySelector('.alert-message');
        if (messageElement) {
          // Create reminder text with yellow color (text only, no background)
          const reminderDiv = document.createElement('div');
          reminderDiv.style.cssText = `
            margin-top: 16px;
            color: #856404;
            font-size: 14px;
            line-height: 1.4;
            font-weight: 500;
          `;
          reminderDiv.innerHTML =
            '<strong>Peringatan:</strong> Pengguna mesti mendaftar sebagai akaun pengguna biasa terlebih dahulu sebelum boleh dijadikan admin.';

          messageElement.appendChild(reminderDiv);
        }
      }
    }, 100);
  }

  async confirmAddAdmin(email: string) {
    const alert = await this.alertController.create({
      header: 'Pengesahan',
      message: `Adakah anda pasti mahu memberikan status admin kepada ${email}?`,
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
        },
        {
          text: 'Sahkan',
          handler: () => {
            this.promoteUserToAdmin(email);
          },
        },
      ],
    });

    await alert.present();
  }

  async promoteUserToAdmin(email: string) {
    if (!email) {
      this.presentToast('Sila masukkan alamat e-mel', 'warning');
      return;
    }

    this.isLoading = true;

    try {
      const response = await this.authService.promoteToAdmin(email);

      if (response.success) {
        this.presentToast(response.message, 'success');
      } else {
        this.presentToast(response.error || 'Failed to promote user', 'danger');
      }
    } catch (error: any) {
      console.error('Error promoting user:', error);
      this.presentToast(
        error.message || 'Error promoting user. Please try again.',
        'danger',
      );
    } finally {
      this.isLoading = false;
    }
  }

  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color,
    });
    await toast.present();
  }

  // Get current dark mode preference for the UI
  getDarkModePreference(): string {
    return this.darkModeService.getPreference();
  }

  // Handle dark mode change from the UI
  async changeDarkMode(event: any) {
    const newPreference = event.detail.value;
    await this.darkModeService.changeDarkMode(newPreference);
  }

  // Check if dark mode is currently active
  isDarkModeActive(): boolean {
    return this.darkModeService.isDarkMode();
  }

  async editField(field: string) {
    let title = '';
    let placeholder = '';
    let currentValue = '';
    let inputType:
      | 'text'
      | 'tel'
      | 'email'
      | 'password'
      | 'number'
      | 'search'
      | 'tel'
      | 'url'
      | 'date'
      | 'datetime-local'
      | 'time'
      | 'week'
      | 'month' = 'text';

    switch (field) {
      case 'name':
        title = 'Kemaskini Nama Penuh';
        placeholder = 'Masukkan nama penuh';
        currentValue = this.userProfile.name;
        break;
      case 'phone':
        title = 'Kemaskini Nombor Telefon';
        placeholder = 'Masukkan nombor telefon';
        currentValue = this.userProfile.phone;
        inputType = 'tel';
        break;
      case 'birthdate':
        this.editBirthdate();
        return;
    }

    const alert = await this.alertController.create({
      header: title,
      inputs: [
        {
          name: 'value',
          type: inputType,
          placeholder: placeholder,
          value: currentValue,
        },
      ],
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
        },
        {
          text: 'Simpan',
          handler: async (data) => {
            if (data.value && data.value.trim()) {
              await this.updateField(field, data.value.trim());
            } else {
              this.presentToast('Sila masukkan nilai yang sah', 'warning');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  private async updateField(field: string, value: string) {
    try {
      this.isLoading = true;

      this.userProfile[field] = value;

      // Include all required fields when updating
      const updateData: any = {
        name: this.userProfile.name,
        phone: this.userProfile.phone,
        birthdate: this.userProfile.birthdate,
      };

      const updatedProfile = await this.authService.updateProfile(updateData);

      this.userProfile = {
        ...this.userProfile,
        ...updatedProfile,
      };

      this.presentToast('Maklumat berjaya dikemaskini', 'success');
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      this.presentToast('Gagal mengemaskini maklumat', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async editBirthdate() {
    // Directly open the wheel date picker
    await this.showDatePicker();
  }

  async showDatePicker() {
    const modal = await this.modalController.create({
      component: DatePickerModalComponent,
      componentProps: {
        selectedDate:
          this.userProfile.birthdate || new Date().toISOString().split('T')[0],
      },
      cssClass: 'date-picker-modal',
      breakpoints: [0, 0.5, 0.75],
      initialBreakpoint: 0.5,
      backdropDismiss: true,
      showBackdrop: true,
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data && result.data.selectedDate) {
        await this.updateField('birthdate', result.data.selectedDate);
      }
    });

    await modal.present();
  }
}
