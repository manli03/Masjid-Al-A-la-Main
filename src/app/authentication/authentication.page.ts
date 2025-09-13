import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';
// Import ToastController
import { LoadingController, ToastController, Platform } from '@ionic/angular';
import { StorageService } from '../services/storage.service';

@Component({
  selector: 'app-authentication',
  templateUrl: './authentication.page.html',
  styleUrls: ['./authentication.page.scss'],
})
export class AuthenticationPage {
  // Removed OnInit as it wasn't used

  isLoading: boolean = false; // Flag for inline loading state
  authTitle: string = 'Log Masuk';
  authSubtitle: string = 'Sila log masuk menggunakan akaun Google anda.';
  returnUrl: string = '';

  private backButtonSubscription: any;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private loadingController: LoadingController,
    private storageService: StorageService,
    private toastController: ToastController, // Inject ToastController
    private platform: Platform,
  ) {}

  ionViewWillEnter() {
    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(10, () => {
      this.router.navigateByUrl('/tabs/home');
    });

    // Read query params to set appropriate messages
    this.route.queryParams.subscribe(params => {
      this.returnUrl = params['returnUrl'] || '';
      if (this.returnUrl.includes('announcement')) {
        this.authTitle = 'Log Masuk';
        this.authSubtitle = 'Sila log masuk untuk mengakses pengumuman.';
      } else if (this.returnUrl.includes('profile')) {
        this.authTitle = 'Log Masuk';
        this.authSubtitle = 'Sila log masuk untuk mengakses profil anda.';
      } else if (this.returnUrl.includes('settings')) {
        this.authTitle = 'Log Masuk';
        this.authSubtitle = 'Sila log masuk untuk mengakses tetapan.';
      } else {
        // Default
        this.authTitle = 'Log Masuk';
        this.authSubtitle = 'Sila log masuk menggunakan akaun Google anda.';
      }
    });
  }

  ionViewWillLeave() {
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
      this.backButtonSubscription = null;
    }
  }

  async signInWithGoogle() {
    // Start both loading states
    this.isLoading = true;

    try {
      const user = await this.authService.signIn();
      if (user) {
        this.isLoading = false; // Stop inline loading here

        // Clear any pending announcement ID
        sessionStorage.removeItem('pendingAnnouncementId');

        // Navigate to the return URL if available, otherwise use default logic
        if (this.returnUrl) {
          this.router.navigateByUrl(this.returnUrl, { replaceUrl: true });
        } else {
          // Default navigation based on role
          if (await this.authService.isAdmin()) {
            this.router.navigate(['/tabs/manage-announcement'], { replaceUrl: true });
          } else {
            this.router.navigate(['/tabs/profile'], { replaceUrl: true });
          }
        }
      } else {
        // Handle case where signIn resolves but returns no user (should ideally not happen with Google Sign-In success)
        console.warn(
          'Sign in process completed but no user object was returned.',
        );
        await this.presentToast('Log masuk tidak berjaya. Sila cuba lagi.');
        this.isLoading = false; // Stop inline loading here if navigation didn't happen
      }
    } catch (error: any) {
      // Handle errors (e.g., user closes popup, network issue)
      console.error('Sign in error:', error);
      let errorMessage = 'Gagal log masuk. Sila cuba lagi.';
      let toastColor = 'danger'; // Default red color for errors
      // Optional: Check for specific error types (e.g., closed popup)
      if (
        error?.message?.includes('canceled') ||
        error?.message?.includes('closed by user') ||
        error?.code === 'auth/popup-closed-by-user'
      ) {
        errorMessage = 'Proses log masuk dibatalkan.';
        toastColor = 'warning'; // Yellow color for warnings
      }
      await this.presentToast(errorMessage, toastColor);
      // Ensure loading states are reset on error
      this.isLoading = false;
    }
  }

  // Helper function to show toast messages
  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000, // 3 seconds
      position: 'bottom', // Or 'top', 'middle'
      color: color,
    });
    await toast.present();
  }
}
