import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { StorageService } from './storage.service';
import { firstValueFrom } from 'rxjs';
import { ToastService } from './toast.service';
import { PrayerNotificationsService } from './prayer-notifications.service';

@Injectable({
  providedIn: 'root',
})
export class AnnouncementService {
  private apiUrl = environment.apiUrl;
  // Set to true to display detailed error messages during development
  private devMode = false;

  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private toastService: ToastService,
    private prayerNotificationsService: PrayerNotificationsService,
  ) {}

  async getAnnouncements() {
    try {
      // Add user email to get correct read status
      const user = await this.storageService.get('user');
      let url = `${this.apiUrl}/announcements.php`;

      // If user is logged in, include email to get read status
      if (user && user.email) {
        url += `?email=${encodeURIComponent(user.email)}`;
      }

      const response = await firstValueFrom(this.http.get<any>(url));
      if (response.success) {
        return response.announcements;
      } else {
        throw new Error(response.message || 'Failed to load announcements');
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
      await this.handleHttpError(error);
      return [];
    }
  }

  async getAnnouncementById(id: number) {
    try {
      let url = `${this.apiUrl}/announcements.php?id=${id}`;
      const user = await this.storageService.get('user');
      if (user && user.email) {
        url += `&email=${user.email}`;
      }

      const response = await firstValueFrom(this.http.get<any>(url));
      if (response.success) {
        return response.announcement;
      } else {
        throw new Error(response.message || 'Failed to load announcement');
      }
    } catch (error) {
      console.error('Error fetching announcement details:', error);
      // await this.handleHttpError(error);
      return null;
    }
  }

  async toggleLike(announcementId: number) {
    try {
      const user = await this.storageService.get('user');
      if (!user) {
        throw new Error('User not authenticated');
      }

      const likeData = {
        action: 'like',
        announcementId,
        email: user.email,
      };

      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/announcements.php`, likeData),
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to toggle like');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // await this.handleHttpError(error);
      throw error;
    }
  }

  async createAnnouncement(data: any) {
    try {
      const user = await this.storageService.get('user');
      if (!user) {
        throw new Error('User not authenticated');
      }

      // The data parameter is now expected to be a FormData object.
      // The email should be appended to the FormData in the component.
      // data.email = user.email; // This is now done in the component

      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/announcements.php`, data),
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to create announcement');
      }
    } catch (error) {
      console.error('Error creating announcement:', error);
      // await this.handleHttpError(error);
      throw error;
    }
  }

  async updateAnnouncement(id: number, data: any) {
    try {
      const user = await this.storageService.get('user');
      if (!user) {
        throw new Error('User not authenticated');
      }

      // The data parameter is now expected to be a FormData object.
      // The email and id should be appended to the FormData in the component.
      // data.email = user.email;
      // data.id = id;

      const response = await firstValueFrom(
        // The endpoint for update is now just the base URL, differentiated by POST data.
        this.http.post<any>(`${this.apiUrl}/announcements.php`, data),
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to update announcement');
      }
    } catch (error) {
      console.error('Error updating announcement:', error);
      // await this.handleHttpError(error);
      throw error;
    }
  }

  async deleteAnnouncement(id: number) {
    try {
      const user = await this.storageService.get('user');
      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/announcements.php`, {
          action: 'delete',
          id,
          email: user.email,
        }),
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to delete announcement');
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
      // await this.handleHttpError(error);
      throw error;
    }
  }

  async addComment(
    announcementId: number,
    comment: string,
    parentCommentId?: number,
  ) {
    try {
      const user = await this.storageService.get('user');
      if (!user) {
        throw new Error('User not authenticated');
      }

      const payload: any = {
        announcementId,
        email: user.email,
        comment,
        action: 'add',
      };

      if (parentCommentId) {
        payload.parentCommentId = parentCommentId;
      }

      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/comments.php`, payload),
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      // await this.handleHttpError(error);
      throw error;
    }
  }

  async deleteComment(commentId: number) {
    try {
      const user = await this.storageService.get('user');
      if (!user) {
        throw new Error('User not authenticated');
      }

      const payload = {
        commentId,
        email: user.email,
        action: 'delete',
      };

      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/comments.php`, payload),
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      // await this.handleHttpError(error);
      throw error;
    }
  }

  async updateComment(commentId: number, commentText: string) {
    try {
      const user = await this.storageService.get('user');
      if (!user) {
        throw new Error('User not authenticated');
      }

      const payload = {
        commentId,
        email: user.email,
        comment: commentText,
        action: 'update',
      };

      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/comments.php`, payload),
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to update comment');
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      // await this.handleHttpError(error);
      throw error;
    }
  }

  async markAsRead(announcementId: number) {
    try {
      const user = await this.storageService.get('user');
      if (!user) {
        throw new Error('User not authenticated');
      }

      const data = {
        action: 'mark_read',
        announcementId,
        email: user.email,
      };

      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/announcements.php`, data),
      );

      if (response.success) {
        return response;
      } else {
        throw new Error(
          response.message || 'Failed to mark announcement as read',
        );
      }
    } catch (error) {
      console.error('Error marking announcement as read:', error);
      // Silent fail - don't show error to user since this is a background operation
      return { success: false };
    }
  }

  /**
   * Handle HTTP errors and show development details if available
   */
  private async handleHttpError(error: any) {
    if (error instanceof HttpErrorResponse) {
      console.error('HTTP error:', error.status, error.message);

      // Check for specific error types
      if (error.status === 413) {
        // This is a content size error - show specific message
        const errorBody = error.error;
        let message = 'Saiz kandungan terlalu besar.';

        if (errorBody && errorBody.message) {
          message = errorBody.message;
          if (errorBody.current_size && errorBody.max_size) {
            const currentSizeMB = (errorBody.current_size / 1048576).toFixed(2);
            const maxSizeMB = (errorBody.max_size / 1048576).toFixed(2);
            message += ` (${currentSizeMB}MB melebihi had ${maxSizeMB}MB)`;
          }
        }

        await this.presentToast(message, 'danger', 5000);
        return;
      }

      if (this.devMode && error.error) {
        // For development, show the detailed error
        if (error.error.dev_message) {
          await this.showDevelopmentErrorToast(error.error);
        } else {
          await this.presentToast(
            `Ralat ${error.status}: ${error.message}`,
            'danger',
          );
        }
      } else {
        await this.presentToast(
          'Ralat, sila semak rangkaian anda.',
          'danger',
        );
      }
    } else {
      console.error('Unknown error:', error);
      await this.presentToast('Ralat tidak diketahui telah berlaku.', 'danger');
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
      message += `\nKod: ${errorResponse.error_code}`;
    }
    if (errorResponse.sql_state) {
      message += `\nSQL: ${errorResponse.sql_state}`;
    }
    await this.presentToast(message, 'warning');
  }

  /**
   * Present a toast message
   */
  private async presentToast(
    message: string,
    color: string = 'danger',
    duration: number = 3000,
  ) {
    await this.toastService.presentToast(message, color, duration);
  }
}
