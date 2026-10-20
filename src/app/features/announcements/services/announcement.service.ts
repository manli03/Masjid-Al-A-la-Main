import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { StorageService } from '../../../core/storage/storage.service';
import { AuthService } from '../../../core/auth/auth.service';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../../core/feedback/toast.service';
import { PrayerNotificationsService } from '../../prayer/services/prayer-notifications.service';

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
    private authService: AuthService,
    private toastService: ToastService,
    private prayerNotificationsService: PrayerNotificationsService,
  ) {}

  /**
   * Get HTTP headers with Authorization Bearer token
   */
  private async getAuthHeaders(): Promise<HttpHeaders> {
    return this.authService.getAuthHeaders();
  }

  /**
   * Make an authenticated POST request
   * Sends the token both in the Authorization header AND in the request body
   * as _token (for servers/stacks that strip the Authorization header).
   */
  private async authPost(url: string, body: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    // Also include token in body as fallback for Android/CORS issues
    const idToken = await this.authService.getIdToken();
    const augmentedBody = { ...body, _token: idToken };
    const result = await firstValueFrom(
      this.http.post(url, augmentedBody, { headers, observe: 'body' as 'body' })
    );
    return result;
  }

  /**
   * Make an authenticated GET request
   */
  private async authGet(url: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const result = await firstValueFrom(
      this.http.get(url, { headers, observe: 'body' as 'body' })
    );
    return result;
  }

  async getAnnouncements(page: number = 1, limit: number = 10) {
    try {
      // Add user email to get correct read status
      const user = await this.storageService.get('user');
      let url = `${this.apiUrl}/announcements.php?page=${page}&limit=${limit}`;

      // If user is logged in, include email to get read status
      if (user && user.email) {
        url += `&email=${encodeURIComponent(user.email)}`;
      }

      const headers = await this.getAuthHeaders();
      const response: any = await firstValueFrom(
        this.http.get(url, { headers, observe: 'body' as 'body' })
      );
      if (response.success) {
        // Handle both paginated and non-paginated responses
        const announcements = response.announcements || [];
        const hasMore = response.hasMore !== undefined ? response.hasMore : (announcements.length === limit);
        const total = response.total || 0;

        return {
          announcements,
          hasMore,
          total
        };
      } else {
        throw new Error(response.message || 'Failed to load announcements');
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
      await this.handleHttpError(error);
      return { announcements: [], hasMore: false, total: 0 };
    }
  }

  async getAnnouncementById(id: number, commentsPage: number = 1, commentsLimit: number = 10) {
    try {
      let url = `${this.apiUrl}/announcements.php?id=${id}&commentsPage=${commentsPage}&commentsLimit=${commentsLimit}`;
      const user = await this.storageService.get('user');
      if (user && user.email) {
        url += `&email=${encodeURIComponent(user.email)}`;
      }

      const headers = await this.getAuthHeaders();
      const response: any = await firstValueFrom(
        this.http.get(url, { headers, observe: 'body' as 'body' })
      );
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
      const likeData = {
        action: 'like',
        announcementId,
      };

      const response = await this.authPost(
        `${this.apiUrl}/announcements.php`, 
        likeData
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to toggle like');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  }

  async createAnnouncement(data: any) {
    try {
      const headers = await this.getAuthHeaders();
      // FormData needs special handling - headers must not set Content-Type
      // as the browser will set it with the boundary for multipart/form-data
      const httpOptions: any = { headers, observe: 'body' as 'body' };
      
      const response: any = await firstValueFrom(
        this.http.post(`${this.apiUrl}/announcements.php`, data, httpOptions),
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to create announcement');
      }
    } catch (error) {
      console.error('Error creating announcement:', error);
      throw error;
    }
  }

  async updateAnnouncement(id: number, data: any) {
    try {
      // Ensure FormData includes the id
      if (data instanceof FormData) {
        data.set('id', id.toString());
      }
      
      const headers = await this.getAuthHeaders();
      const httpOptions: any = { headers, observe: 'body' as 'body' };
      
      const response: any = await firstValueFrom(
        this.http.post(`${this.apiUrl}/announcements.php`, data, httpOptions),
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to update announcement');
      }
    } catch (error) {
      console.error('Error updating announcement:', error);
      throw error;
    }
  }

  async deleteAnnouncement(id: number) {
    try {
      const response = await this.authPost(
        `${this.apiUrl}/announcements.php`, 
        { action: 'delete', id }
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to delete announcement');
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
      throw error;
    }
  }

  async addComment(
    announcementId: number,
    comment: string,
    parentCommentId?: number,
  ) {
    try {
      const payload: any = {
        announcementId,
        comment,
        action: 'add',
      };

      if (parentCommentId) {
        payload.parentCommentId = parentCommentId;
      }

      const response = await this.authPost(
        `${this.apiUrl}/comments.php`, 
        payload
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  async deleteComment(commentId: number) {
    try {
      const payload = {
        commentId,
        action: 'delete',
      };

      const response = await this.authPost(
        `${this.apiUrl}/comments.php`, 
        payload
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }

  async updateComment(commentId: number, commentText: string) {
    try {
      const payload = {
        commentId,
        comment: commentText,
        action: 'update',
      };

      const response = await this.authPost(
        `${this.apiUrl}/comments.php`, 
        payload
      );
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to update comment');
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  }

  async markAsRead(announcementId: number) {
    try {
      const data = {
        action: 'mark_read',
        announcementId,
      };

      const response = await this.authPost(
        `${this.apiUrl}/announcements.php`, 
        data
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

  async loadMoreReplies(commentId: number, offset: number = 3, limit: number = 10) {
    try {
      const params = new HttpParams()
        .set('action', 'load_more_replies')
        .set('commentId', commentId.toString())
        .set('offset', offset.toString())
        .set('limit', limit.toString());

      const headers = await this.getAuthHeaders();
      const response: any = await firstValueFrom(
        this.http.get(`${this.apiUrl}/announcements.php`, { params, headers, observe: 'body' as 'body' }),
      );

      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to load more replies');
      }
    } catch (error) {
      console.error('Error loading more replies:', error);
      await this.handleHttpError(error);
      return { success: false, replies: [], hasMore: false, total: 0 };
    }
  }

  /**
   * Handle HTTP errors and show development details if available
   */
  private async handleHttpError(error: any) {
    if (error instanceof HttpErrorResponse) {
      console.error('HTTP error:', error.status, error.message);

      // Status 0 can mean different things: offline, CORS/network failure, or server unreachable.
      if (error.status === 0) {
        // If the browser is offline, show offline message
        if (
          typeof window !== 'undefined' &&
          (window as any).navigator &&
          !(window as any).navigator.onLine
        ) {
          await this.presentToast(
            'Anda sedang luar talian. Sila sambung ke Internet dan cuba lagi.',
            'warning',
          );
          return;
        }

        // If the error.error is a ProgressEvent, it's likely a network/CORS failure
        if (error.error instanceof ProgressEvent) {
          await this.presentToast(
            'Gagal berhubung. Sila semak sambungan rangkaian atau tetapan CORS pelayan.',
            'danger',
          );
          return;
        }

        // Otherwise, treat as server unreachable (connection refused / no response)
        await this.presentToast(
          'Tidak dapat menghubungi pelayan. Sila cuba lagi sebentar.',
          'danger',
        );
        return;
      }

      // Payload too large
      if (error.status === 413) {
        const errorBody = error.error || {};
        let message = 'Saiz fail terlalu besar.';
        if (errorBody.message) message = errorBody.message;
        if (errorBody.current_size && errorBody.max_size) {
          const currentMB = (errorBody.current_size / 1048576).toFixed(2);
          const maxMB = (errorBody.max_size / 1048576).toFixed(2);
          message = `Saiz fail ${currentMB}MB melebihi had ${maxMB}MB.`;
        }
        await this.presentToast(message, 'danger', 6000);
        return;
      }

      // Authentication / authorization
      if (error.status === 401 || error.status === 403) {
        await this.presentToast(
          'Aksi tidak dibenarkan. Sila log masuk semula.',
          'warning',
        );
        return;
      }

      // Not found
      if (error.status === 404) {
        await this.presentToast('Sumber tidak ditemui.', 'warning');
        return;
      }

      // Server errors
      if (error.status >= 500) {
        await this.presentToast(
          'Ralat pelayan. Sila cuba semula sebentar lagi.',
          'danger',
        );
        return;
      }

      // Client errors (other 4xx)
      if (error.status >= 400) {
        const msg =
          error.error?.message ||
          error.message ||
          'Permintaan tidak dapat diproses.';
        // In dev mode, show more details if available
        if (this.devMode && error.error) {
          if (error.error.dev_message) {
            await this.showDevelopmentErrorToast(error.error);
            return;
          }
          await this.presentToast(`Ralat ${error.status}: ${msg}`, 'danger');
          return;
        }

        // Production: show concise message
        await this.presentToast(msg, 'warning');
        return;
      }
    } else {
      console.error('Unknown error:', error);
      await this.presentToast('Ralat tidak diketahui. Sila cuba lagi.', 'danger');
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
