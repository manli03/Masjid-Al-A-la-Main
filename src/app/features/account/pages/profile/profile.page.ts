import { Component, OnInit } from '@angular/core';
// Import IonViewWillEnter
import {
  AlertController,
  ModalController,
  ViewWillEnter,
  ToastController,
} from '@ionic/angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { Router } from '@angular/router';
import { EditProfileModalComponent } from '../../components/edit-profile-modal/edit-profile-modal.component';
import { StorageService } from '../../../../core/storage/storage.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { NotificationSettingsComponent } from '../../../prayer/components/notification-settings/notification-settings.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
// Implement IonViewWillEnter
export class ProfilePage implements OnInit, ViewWillEnter {
  private apiUrl = environment.apiUrl;
  userProfile: any = {};
  isAdminValue: boolean = false;
  isLoading: boolean = false;
  isProfileComplete: boolean = false;
  membershipNumber: string = '';
  newAdminEmail: string = '';
  accountCreated: string = '';
  prayerNotifications: string[] = [];


  constructor(
    private alertController: AlertController,
    private authService: AuthService,
    private router: Router,
    private modalController: ModalController,
    private storageService: StorageService,
    private http: HttpClient,
    private toastController: ToastController,
  ) {}

  ngOnInit() {
    // ngOnInit still runs once on component creation.
    // You can keep it for one-time setup if needed, or leave it empty.
    console.log('ProfilePage ngOnInit');
  }

  // This method will run every time the page is about to be entered/viewed
  ionViewWillEnter() {
    console.log('ProfilePage ionViewWillEnter - Loading data...');
    this.loadUserProfileData(); // Load data every time the view enters
  }

  async loadUserProfileData() {
    this.isLoading = true; // Start loading
    try {
      // Fetch admin status, profile completion and user data concurrently
      const [isAdmin, userData, isProfileComplete] = await Promise.all([
        this.authService.isAdmin(),
        this.storageService.get('user'), // Get basic user data
        this.authService.isProfileComplete(),
      ]);

      this.isAdminValue = isAdmin;
      this.isProfileComplete = isProfileComplete;
      console.log('User data from storage:', userData);

      if (userData) {
        // Assign data, ensuring defaults for potentially missing fields
        this.userProfile = {
          name: userData.name
            ? userData.name.charAt(0).toUpperCase() + userData.name.slice(1)
            : 'N/A',
          email: userData.email || 'N/A',
          phone: userData.phone || '',
          birthdate: userData.birthdate || '',

          // Use a default/placeholder image if imageUrl is missing or invalid
          imageUrl: userData.imageUrl || 'assets/icon/default-avatar.png', // Adjust path as needed
        };



        this.membershipNumber = userData.membershipNumber || 'Not assigned';

        // Fetch account creation date from backend
        try {
          const headers = await this.authService.getAuthHeaders();
          const response: any = await firstValueFrom(
            this.http.post(`${this.apiUrl}/auth.php`, 
              { action: 'get_user_details' },
              { headers, observe: 'body' as 'body' }
            ),
          );

          if (response.success && response.user) {
            // Format the created_at date
            const createdAt = new Date(response.user.created_at);
            this.accountCreated = createdAt.toLocaleDateString('ms-MY');
          } else {
            this.accountCreated = 'Tidak diketahui';
          }
        } catch (error) {
          console.error('Error fetching user details:', error);
          this.accountCreated = 'Tidak diketahui';
        }

        // Load prayer notification settings
        try {
          // Get notification settings from the PrayerNotificationsService
          const settings = await this.getNotificationSettings();

          if (
            settings &&
            settings.enabledPrayers &&
            settings.enabledPrayers.length > 0
          ) {
            this.prayerNotifications = settings.enabledPrayers;
          } else {
            this.prayerNotifications = ['Tiada'];
          }
        } catch (error) {
          console.error('Error loading prayer notification settings:', error);
          this.prayerNotifications = ['Tiada'];
        }

        // Check if user needs to complete profile
        if (!this.isProfileComplete) {
          this.presentProfileCompletion();
        }
      } else {
        console.warn(
          'No user data found in storage. User might be logged out.',
        );
        // Optionally clear profile or set default values for logged-out state
        this.userProfile = {
          name: 'Sila Log Masuk',
          email: '',
          phone: '',
          birthdate: '',
          imageUrl: 'assets/icon/default-avatar.png', // Default placeholder
        };
        this.isProfileComplete = false;
        this.membershipNumber = '';
        this.accountCreated = '';
        this.prayerNotifications = [''];
        // Maybe redirect to login if no user data is expected here
        // this.router.navigate(['/tabs/authentication']);
      }
    } catch (error) {
      console.error('Error loading user profile data:', error);
      // Handle error appropriately, maybe show a toast message
    } finally {
      this.isLoading = false; // Stop loading regardless of success or error
    }
  }

  async handleRefresh(event: CustomEvent) {
    console.log('Refreshing profile data...');
    // Call the same data loading function used in ionViewWillEnter
    await this.loadUserProfileData();
    // Complete the refresher animation
    (event.target as HTMLIonRefresherElement).complete();
    // Removed the arbitrary setTimeout, await handles the timing.
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
            // Clear local profile state immediately for responsiveness
            this.userProfile = {};
            this.isAdminValue = false;
            this.router.navigate(['/tabs/authentication']);
          },
        },
      ],
    });

    await alert.present();
  }

  // This method might be redundant if only used internally, as isAdminValue is set directly.
  // Keep it if it's used by the template or other parts not shown.
  // isAdmin(): Promise<boolean> {
  //   return this.storageService.isAdmin();
  // }

  async openEditProfileModal() {
    const modal = await this.modalController.create({
      component: EditProfileModalComponent,
      componentProps: {
        // Pass a copy to avoid direct modification before saving
        profile: { ...this.userProfile },
      },
      backdropDismiss: !this.isProfileComplete, // Prevent dismiss by backdrop if profile not complete
    });

    modal.onDidDismiss().then(async (result) => {
      // Check if data was returned (i.e., user saved, didn't cancel)
      if (result && result.data) {
        console.log('Profile modal dismissed with data:', result.data);

        try {
          // Send updated profile to server
          const updatedProfile = await this.authService.updateProfile({
            name: result.data.name,
            phone: result.data.phone,
            birthdate: result.data.birthdate,
          });

          // Update the local profile with server response
          this.userProfile = {
            ...this.userProfile,
            ...updatedProfile,
          };

          // Check profile completion status again
          this.isProfileComplete = await this.authService.isProfileComplete();
          this.membershipNumber = updatedProfile.membershipNumber;

          this.presentToast('Profil berjaya dikemaskini', 'success');

          // Redirect to home if profile is now complete
          if (this.isProfileComplete && !result.data.isProfileCompleteOnStart) {
            this.presentToast(
              'Terima kasih kerana melengkapkan profil anda',
              'success',
            );

            // Check if there's a pending announcement to view
            const pendingAnnouncementId = sessionStorage.getItem(
              'pendingAnnouncementId',
            );
            if (pendingAnnouncementId) {
              // Clear the pending ID
              sessionStorage.removeItem('pendingAnnouncementId');

              // Navigate to the specific announcement
              this.router.navigate([
                '/tabs/announcement',
                pendingAnnouncementId,
              ]);
            }
          }
        } catch (error) {
          console.error('Failed to save updated profile:', error);
          this.presentToast('Gagal mengemaskini profil', 'danger');
        }
      } else if (!this.isProfileComplete) {
        // If user tried to dismiss without completing profile
        this.presentProfileCompletion();
      }
    });

    return await modal.present();
  }

  // Method to present profile completion alert
  async presentProfileCompletion() {
    const alert = await this.alertController.create({
      header: 'Lengkapkan Profil',
      message:
        'Anda perlu melengkapkan profil untuk mengakses semua ciri aplikasi.',
      backdropDismiss: false,
      buttons: [
        {
          text: 'Lengkapkan Sekarang',
          handler: () => {
            this.openEditProfileModal();
          },
        },
      ],
    });

    await alert.present();
  }

  // Method to open the add admin dialog
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
              // Show confirmation dialog first
              this.confirmAddAdmin(data.email);
            } else {
              this.presentToast('Sila masukkan alamat e-mel', 'warning');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  // Method to confirm adding a new admin
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

  // Method to promote a user to admin
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

  // Helper method to show toast notifications
  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'top',
      color: color,
    });
    await toast.present();
  }

  /**
   * Get notification settings from Preferences storage
   */
  private async getNotificationSettings(): Promise<{
    enabledPrayers: string[];
    lastScheduled: string | null;
  }> {
    // Read from the new prayer_notifications key
    const { value } = await Preferences.get({ key: 'prayer_notifications' });

    if (!value) {
      // Try to read from the old key for backward compatibility
      const { value: oldValue } = await Preferences.get({
        key: 'prayerNotification',
      });

      if (oldValue) {
        // Convert old format to new format
        const oldSettings = JSON.parse(oldValue);
        const enabledPrayers = Object.keys(oldSettings)
          .filter((key) => oldSettings[key])
          .map((key) => {
            // Map prayer name to display name
            const displayNames: { [key: string]: string } = {
              subuh: 'Subuh',
              dhuhr: 'Zuhur',
              asr: 'Asar',
              maghrib: 'Maghrib',
              isha: 'Isyak',
            };
            return displayNames[key] || key;
          });

        return {
          enabledPrayers,
          lastScheduled: null,
        };
      }

      // If neither format exists, return default
      return {
        enabledPrayers: [],
        lastScheduled: null,
      };
    }

    return JSON.parse(value);
  }

  /**
   * Open settings page
   */
  openSettings() {
    this.router.navigate(['/settings']);
  }
}
