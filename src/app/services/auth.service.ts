import { Injectable } from '@angular/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Platform, ToastController } from '@ionic/angular';
import { StorageService } from './storage.service';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { FcmService } from './fcm.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  // Set to true to display detailed error messages during development
  private devMode = false;
  private adminStatusCache: { isAdmin: boolean; timestamp: number } | null =
    null;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
  private profileCompletionCache: boolean | null = null;

  constructor(
    private platform: Platform,
    private storageService: StorageService,
    private http: HttpClient,
    private toastController: ToastController,
    private fcmService: FcmService,
  ) {
    this.initializeAuth();
  }

  private async initializeAuth() {
    await this.platform.ready();
    try {
      console.log('Initializing Google Auth...');
      await GoogleAuth.initialize();

      // Initialize profile completion status
      const user = await this.storageService.get('user');
      if (user && user.email) {
        try {
          const response = await firstValueFrom(
            this.http.post<any>(`${this.apiUrl}/auth.php`, {
              action: 'verify_token',
              email: user.email,
            }),
          );

          this.profileCompletionCache =
            response.success &&
            response.user &&
            !!response.user.phone &&
            !!response.user.birthdate &&
            !!user.name;

          console.log(
            'Profile completion status cached:',
            this.profileCompletionCache,
          );
        } catch (error) {
          console.error('Error initializing profile completion status:', error);
          this.profileCompletionCache = null;
        }
      }
    } catch (error) {
      console.error('Error during Google Auth initialization:', error);
    }
  }

  /**
   * Sign in the user using GoogleAuth
   */
  async signIn() {
    try {
      const googleUser = await GoogleAuth.signIn();

      if (googleUser) {
        console.log('User signed in with Google, sending to backend...');

        // Send Google user data to backend for validation and DB storage
        const userData = {
          action: 'signin',
          name: googleUser.name,
          email: googleUser.email,
          imageUrl: googleUser.imageUrl,
          googleIdToken: googleUser.authentication.idToken,
        };

        try {
          // Send data to PHP backend
          const response = await firstValueFrom(
            this.http.post<any>(`${this.apiUrl}/auth.php`, userData),
          );

          if (response.success) {
            console.log('Backend authentication successful');

            // Store user profile (non-sensitive data)
            await this.storageService.set('user', {
              name: googleUser.name,
              email: googleUser.email,
              imageUrl: response.user.profileImage || googleUser.imageUrl, // Use server's profile image or fallback to Google
              phone: response.user.phone,
              birthdate: response.user.birthdate,
              membershipNumber: response.user.membershipNumber,
              // Don't store admin status or profile completion status locally
            });

            // Store authentication tokens (secure storage)
            await this.storageService.setSecure(
              'accessToken',
              googleUser.authentication.accessToken,
            );
            await this.storageService.setSecure(
              'idToken',
              googleUser.authentication.idToken,
            );

            // Set profile completion status
            this.profileCompletionCache =
              response.user &&
              response.user.name &&
              response.user.phone &&
              response.user.birthdate;
            console.log(
              'Profile completion status set:',
              this.profileCompletionCache,
            );

            // Set fcm token
            try {
              await this.fcmService.setFcmToken();
            } catch (error) {
              console.warn('Failed to initialize FCM:', error);
            }

            return googleUser;
          } else {
            console.error('Backend authentication failed', response.error);
            if (this.devMode && response.dev_message) {
              await this.showDevelopmentErrorToast(response);
            }
            return null;
          }
        } catch (error) {
          console.error('Error communicating with backend:', error);
          await this.handleHttpError(error);
          return null;
        }
      } else {
        return null;
      }
    } catch (error: any) {
      this.handleAuthError(error);
      return null;
    }
  }

  /**
   * Get a valid access token (refresh if needed)
   */
  async getAccessToken(): Promise<string | null> {
    let accessToken = await this.storageService.getSecure('accessToken');

    if (!accessToken || this.isTokenExpired(accessToken)) {
      console.log('Access token expired, refreshing...');
      accessToken = await this.refreshToken();
    }

    return accessToken;
  }

  /**
   * Refresh the access token
   */
  async refreshToken(): Promise<string | null> {
    try {
      const refreshedUser = await GoogleAuth.refresh(); // Refreshes the Google token

      if (refreshedUser.accessToken) {
        console.log('Token refreshed successfully');

        // Store new access token securely
        await this.storageService.setSecure(
          'accessToken',
          refreshedUser.accessToken,
        );

        return refreshedUser.accessToken;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      await this.signOut(); // Force sign-out if refresh fails
    }
    return null;
  }

  /**
   * Check if the token is expired
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1])); // Decode JWT token
      const expiry = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= expiry;
    } catch (error) {
      console.warn('Error decoding token:', error);
      return true; // Assume expired if decoding fails
    }
  }

  /**
   * Sign out the user and clear all stored data
   */
  async signOut(): Promise<void> {
    try {
      // Get user email before clearing storage
      const userData = await this.storageService.get('user');
      const userEmail = userData ? userData.email : null;

      // Sign out from Google Auth
      await GoogleAuth.signOut();
      console.log('User signed out from Google successfully.');

      // Clear FCM token on logout if possible
      if (userEmail) {
        try {
          await firstValueFrom(
            this.http.post(`${this.apiUrl}/auth.php`, {
              action: 'logout_clear_token',
              email: userEmail,
            }),
          );
        } catch (error) {
          console.warn('Error clearing FCM token on logout:', error);
          // Continue logout process even if token clear fails
        }
      }

      // Clear all caches
      this.adminStatusCache = null;
      this.profileCompletionCache = false;

      // Clear all stored data
      await this.storageService.clearAllStorage();

      // Explicitly notify about user change
      this.storageService.notifyUserChanged();
    } catch (error) {
      console.error('Error during sign-out:', error);
    }
  }

  /**
   * Handle sign-in errors
   */
  private handleAuthError(error: any) {
    if (error?.error === 'popup_closed_by_user') {
      console.warn('User cancelled sign-in');
    } else if (error?.error === 'network_error') {
      console.error('Network issue. Please check your connection.');
    } else if (error?.error === 'idpiframe_initialization_failed') {
      console.error(
        'Google Auth initialization failed. Check your configuration.',
      );
    } else {
      console.error('Unexpected error during Google Sign-In:', error);
    }
  }

  /**
   * Handle HTTP errors and show development details if available
   */
  private async handleHttpError(error: any) {
    if (error instanceof HttpErrorResponse) {
      console.error('HTTP error:', error.status, error.message);

      // In production mode, show a generic error message
      if (!this.devMode || !error.error) {
        await this.presentToast(
          'Ralat rangkaian berlaku. Sila cuba lagi.',
          'danger',
        );
        return;
      }

      // In development mode, only show detailed errors to developers
      if (error.error.dev_message) {
        await this.showDevelopmentErrorToast(error.error);
      } else {
        // Don't show HTTP status codes to users
        await this.presentToast('Ralat berlaku. Sila cuba lagi.', 'danger');
      }
    } else {
      // await this.presentToast('Ralat berlaku. Sila cuba lagi.', 'danger');
    }
  }

  /**
   * Show development-only error toast
   */
  private async showDevelopmentErrorToast(errorResponse: any) {
    let message = 'Development Error:';
    if (errorResponse.dev_message) {
      message += `\n${errorResponse.dev_message}`;
    }
    if (errorResponse.error_code) {
      message += `\nCode: ${errorResponse.error_code}`;
    }
    if (errorResponse.sql_state) {
      message += `\nSQL: ${errorResponse.sql_state}`;
    }
    await this.presentToast(message, 'warning');
  }

  /**
   * Show a toast message
   */
  private async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color,
    });
    await toast.present();
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData: any): Promise<any> {
    try {
      const user = await this.storageService.get('user');
      if (!user || !user.email) {
        throw new Error('User not authenticated');
      }

      // Add action and email to the data
      const data = {
        ...profileData,
        action: 'update_profile',
        email: user.email,
      };

      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/auth.php`, data),
      );

      if (response.success) {
        // Update stored user data
        await this.storageService.set('user', {
          ...user,
          name: response.user.name,
          phone: response.user.phone,
          birthdate: response.user.birthdate,
          membershipNumber: response.user.membershipNumber,
          // Don't store status properties locally
        });

        // Reset profile completion cache since profile was updated
        this.profileCompletionCache = null;

        return response.user;
      } else {
        throw new Error(response.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      await this.handleHttpError(error);
      throw error;
    }
  }

  /**
   * Check if the user's profile is complete - uses cached value from app initialization
   */
  async isProfileComplete(): Promise<boolean> {
    const user = await this.storageService.get('user');
    if (!user || !user.email) {
      this.profileCompletionCache = false;
      return false;
    }

    // Return cached value if available
    if (typeof this.profileCompletionCache === 'boolean') {
      console.log(
        'Using cached profile completion status:',
        this.profileCompletionCache,
      );
      return this.profileCompletionCache;
    }

    // If cache is null (not yet initialized), check from database
    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/auth.php`, {
          action: 'verify_token',
          email: user.email,
        }),
      );

      const isComplete = !!(
        response.success &&
        response.user &&
        response.user.phone &&
        response.user.birthdate &&
        user.name
      );

      this.profileCompletionCache = isComplete;
      return isComplete;
    } catch (error) {
      console.error('Error checking profile completion:', error);
      this.profileCompletionCache = true; // Assume complete if there's a network error
      return true;
    }
  }

  /**
   * Check if user is admin - cached for 30 minutes
   */
  async isAdmin(): Promise<boolean> {
    const user = await this.storageService.get('user');
    if (!user || !user.email) {
      this.adminStatusCache = null;
      return false;
    }

    // Check if we have a valid cache
    if (
      this.adminStatusCache &&
      Date.now() - this.adminStatusCache.timestamp < this.CACHE_DURATION
    ) {
      console.log('Using cached admin status');
      return this.adminStatusCache.isAdmin;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/auth.php`, {
          action: 'verify_token',
          email: user.email,
        }),
      );

      const isAdmin =
        response.success && response.user && response.user.isAdmin === true;

      // Cache the result
      this.adminStatusCache = {
        isAdmin,
        timestamp: Date.now(),
      };

      return isAdmin;
    } catch (error) {
      console.error('Error checking admin status:', error);
      this.adminStatusCache = null;
      return false;
    }
  }

  /**
   * Promote a user to admin
   */
  async promoteToAdmin(userEmail: string): Promise<any> {
    try {
      const user = await this.storageService.get('user');
      if (!user || !user.email) {
        throw new Error('User not authenticated');
      }

      // We need to check admin status from the database before allowing this action
      const isAdminResult = await this.isAdmin();
      if (!isAdminResult) {
        throw new Error('Only admins can promote other users');
      }

      const data = {
        action: 'promote_admin',
        adminEmail: user.email,
        userEmail: userEmail,
      };

      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/auth.php`, data),
      );

      if (response.success) {
        return response;
      } else {
        throw new Error(response.error || 'Failed to promote user to admin');
      }
    } catch (error) {
      console.error('Error promoting user to admin:', error);
      await this.handleHttpError(error);
      throw error;
    }
  }
}
