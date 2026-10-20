import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { StorageService } from '../../../core/storage/storage.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AlertController } from '@ionic/angular';

export const announcementRedirectGuard: CanActivateFn = async (
  route,
  state,
) => {
  const router = inject(Router);
  const storageService = inject(StorageService);
  const authService = inject(AuthService);
  const alertController = inject(AlertController);

  try {
    // Check if user data exists in storage
    const userData = await storageService.get('user');

    if (!userData) {
      // Redirect to authentication page if not logged in
      router.navigate(['/tabs/authentication']);
      return false;
    }

    // Check if user is admin
    const isAdmin = await authService.isAdmin();

    // If admin, redirect to manage-announcement
    if (isAdmin) {
      router.navigate(['/tabs/manage-announcement']);
      return false;
    }

    // For regular users, check if profile is complete
    const isProfileComplete = await authService.isProfileComplete();

    if (!isProfileComplete) {
      // Show alert about completing profile
      const alert = await alertController.create({
        header: 'Lengkapkan Profil',
        message: 'Anda perlu melengkapkan profil untuk mengakses pengumuman.',
        buttons: [
          {
            text: 'OK',
            handler: () => {
              router.navigate(['/tabs/profile']);
            },
          },
        ],
      });
      await alert.present();
      return false;
    }

    // Allow access to announcement page if all checks pass
    return true;
  } catch (error) {
    console.error('Error in announcement redirect guard:', error);
    return false;
  }
};
