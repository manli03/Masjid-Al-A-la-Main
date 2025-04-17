import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { StorageService } from '../services/storage.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  LoadingController,
  ToastController,
  AlertController,
  ModalController,
} from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AnnouncementService } from '../services/announcement.service';
import { AuthService } from '../services/auth.service';
import { Share } from '@capacitor/share';
import { ImageViewerModalComponent } from '../component/image-viewer-modal/image-viewer-modal.component';

// Define interface for the announcement item
interface Announcement {
  id: number;
  title: string;
  author: string;
  authorId?: number;
  content: string;
  imageUrl?: string;
  date: string;
  commentsCount: number;
  likes: number;
  userLiked?: boolean;
  isRead?: boolean;
}

// Define interface for comment
interface Comment {
  id: number;
  user: string;
  userId?: number;
  email: string;
  text: string;
  imageUrl?: string;
  created_at?: string;
  is_edited?: boolean;
  replies: Reply[];
}

// Define interface for reply
interface Reply {
  id: number;
  user: string;
  userId?: number;
  email: string;
  text: string;
  imageUrl?: string;
  created_at?: string;
  is_edited?: boolean;
}

// Define full announcement with comments
interface AnnouncementDetail extends Announcement {
  comments: Comment[];
}

@Component({
  selector: 'app-announcement',
  templateUrl: 'announcement.page.html',
  styleUrls: ['announcement.page.scss'],
})
export class announcementPage implements OnInit, OnDestroy {
  private apiUrl = environment.apiUrl;
  newsItems: Announcement[] = [];
  displayedNewsItems: Announcement[] = [];
  currentSegment: string = 'all';
  isLoading = false;
  selectedArticle: AnnouncementDetail | null = null;
  newComment: string = '';
  newReply: string = '';
  selectedCommentIndex: number | null = null;
  currentUser: any = null;
  isAdmin: boolean = false;
  editingCommentId: number | null = null;
  editCommentText: string = '';
  allRead: boolean = true;
  private userChangeSubscription: Subscription | null = null;
  isCheckingAdmin: boolean = true;
  isInitialLoad: boolean = true;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private storageService: StorageService,
    private http: HttpClient,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController,
    private announcementService: AnnouncementService,
    private authService: AuthService,
    private modalController: ModalController,
  ) {}

  async ngOnInit() {
    // Load current user and initialize basic stuff
    await this.loadUserData();

    // Subscribe to user changes
    this.userChangeSubscription = this.storageService
      .getUserChangeObservable()
      .subscribe(async () => {
        this.resetPageState();
        await this.loadUserData();
      });
  }

  async ionViewWillEnter() {
    // Show page immediately
    this.isCheckingAdmin = true;
    this.isLoading = true;

    try {
      // Check for route parameters (id)
      const announcementId = this.route.snapshot.paramMap.get('id');

      // Check for local storage data
      const userData = await this.storageService.get('user');
      if (!userData) {
        this.router.navigateByUrl('/tabs/authentication', { replaceUrl: true });
        return;
      }

      // Get admin status and profile completion
      this.isAdmin = await this.authService.isAdmin();
      const isProfileComplete = await this.authService.isProfileComplete();

      if (!isProfileComplete) {
        const alert = await this.alertController.create({
          header: 'Lengkapkan Profil',
          message: 'Anda perlu melengkapkan profil untuk mengakses pengumuman.',
          buttons: [
            {
              text: 'OK',
              handler: () => {
                this.router.navigateByUrl('/tabs/profile', {
                  replaceUrl: true,
                });
              },
            },
          ],
        });
        await alert.present();
        return;
      }

      // Handle admin cases
      if (this.isAdmin && !announcementId) {
        // Admin without specific announcement - redirect to management
        await this.router.navigateByUrl('/tabs/manage-announcement', {
          replaceUrl: true,
        });
        return;
      }

      // Load announcements for the list view
      await this.loadAnnouncements();

      // If there's an announcement ID, load its details
      if (announcementId) {
        const announcementIdNum = parseInt(announcementId, 10);
        const announcement = this.newsItems.find(
          (item) => item.id === announcementIdNum,
        );

        if (announcement) {
          await this.loadAnnouncementDetails(announcement);
        } else {
          // If announcement wasn't in the initial list, try to fetch it directly
          try {
            const fullAnnouncement =
              await this.announcementService.getAnnouncementById(
                announcementIdNum,
              );
            if (fullAnnouncement) {
              this.selectedArticle = fullAnnouncement;
            } else {
              this.presentToast('Pengumuman tidak dijumpai.');
            }
          } catch (error) {
            console.error('Error loading announcement:', error);
            this.presentToast('Ralat memuat pengumuman. Sila cuba lagi.');
          }
        }
      }
    } catch (error) {
      console.error('Error during initialization:', error);
      this.presentToast('Error loading page. Please try again.');
    } finally {
      this.isCheckingAdmin = false;
      this.isLoading = false;
      this.isInitialLoad = false;
    }
  }

  ngOnDestroy() {
    // Clean up subscription to prevent memory leaks
    if (this.userChangeSubscription) {
      this.userChangeSubscription.unsubscribe();
    }
  }

  // Reset page state when user changes
  resetPageState() {
    this.selectedArticle = null;
    this.newComment = '';
    this.newReply = '';
    this.selectedCommentIndex = null;
    this.editingCommentId = null;
    this.editCommentText = '';
  }

  // Load user data from storage
  async loadUserData() {
    try {
      this.currentUser = await this.storageService.get('user');
      // Check admin status directly from database
      this.isAdmin = await this.authService.isAdmin();
    } catch (error) {
      console.error('Error loading user data:', error);
      this.currentUser = null;
      this.isAdmin = false;
    }
  }

  async loadAnnouncements() {
    this.isLoading = true;
    try {
      const announcements = await this.announcementService.getAnnouncements();
      this.newsItems = announcements;
      this.filterAnnouncementsBySegment();
    } catch (error) {
      console.error('Error loading announcements:', error);
      this.presentToast('Tidak dapat memuat pengumuman. Sila cuba lagi.');
    } finally {
      this.isLoading = false;
    }
  }

  // Function to filter announcements based on selected segment
  filterAnnouncementsBySegment() {
    if (this.currentSegment === 'all') {
      this.displayedNewsItems = [...this.newsItems];
    } else if (this.currentSegment === 'unread') {
      this.displayedNewsItems = this.newsItems.filter((item) => !item.isRead);
    }
    // Update allRead status
    this.allRead = this.newsItems.every((item) => item.isRead === true);
  }

  // Handle segment change
  segmentChanged(event: any) {
    this.currentSegment = event.detail.value;
    this.filterAnnouncementsBySegment();
  }

  // Function to select an article and load its full content with comments
  async selectArticle(item: Announcement) {
    // Navigate to the announcement detail route
    await this.router.navigate(['/tabs/announcement', item.id]);
  }

  // New method to load announcement details
  private async loadAnnouncementDetails(announcement: Announcement) {
    this.isLoading = true;
    try {
      const fullAnnouncement =
        await this.announcementService.getAnnouncementById(announcement.id);
      if (fullAnnouncement) {
        this.selectedArticle = fullAnnouncement;

        // Mark as read if user is logged in
        if (this.currentUser) {
          await this.announcementService.markAsRead(announcement.id);
          const index = this.newsItems.findIndex(
            (a) => a.id === announcement.id,
          );
          if (index !== -1) {
            this.newsItems[index].isRead = true;
            const displayIndex = this.displayedNewsItems.findIndex(
              (a) => a.id === announcement.id,
            );
            if (displayIndex !== -1) {
              this.displayedNewsItems[displayIndex].isRead = true;
            }
            this.allRead = this.newsItems.every((item) => item.isRead === true);
          }
          if (this.currentSegment === 'unread') {
            this.filterAnnouncementsBySegment();
          }
        }
      }
    } catch (error) {
      console.error('Error loading announcement details:', error);
      this.presentToast('Error loading announcement details');
    } finally {
      this.isLoading = false;
    }
  }

  // Function for liking/unliking an announcement
  async toggleLike(event: Event) {
    event.stopPropagation(); // Prevent event bubbling

    if (!this.currentUser) {
      this.presentToast('Sila log masuk untuk menyukai pengumuman');
      return;
    }

    if (!this.selectedArticle) {
      return;
    }

    try {
      const response = await this.announcementService.toggleLike(
        this.selectedArticle.id,
      );
      if (response.success) {
        // Update UI
        this.selectedArticle.userLiked = !this.selectedArticle.userLiked;
        this.selectedArticle.likes = response.likesCount;
      } else {
        this.presentToast('Gagal mengemas kini status suka');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      this.presentToast('Ralat mengemas kini status suka. Sila cuba lagi.');
    }
  }

  // Function to deselect an article and return to the news list
  deselectArticle() {
    this.selectedArticle = null;

    // Update URL without reloading page (removes the announcement ID)
    this.router.navigate(['/tabs/announcement'], {
      replaceUrl: true,
      skipLocationChange: false,
    });

    // Reload the announcements list to ensure it's current
    this.loadAnnouncements().then(() => {
      this.filterAnnouncementsBySegment();
    });
  }

  // Add a new comment to the article
  async addComment() {
    if (!this.newComment.trim()) return;
    if (!this.currentUser) {
      this.presentToast('Sila log masuk untuk menambah komen');
      return;
    }
    if (!this.selectedArticle) {
      this.presentToast('Tiada artikel dipilih');
      return;
    }

    this.isLoading = true;
    try {
      const response = await this.announcementService.addComment(
        this.selectedArticle.id,
        this.newComment,
      );

      if (response.success) {
        // Add the new comment to our list
        this.selectedArticle.comments.push(response.comment);
        this.selectedArticle.commentsCount++;
        this.newComment = '';
      } else {
        this.presentToast('Gagal menambah komen');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      this.presentToast('Ralat menambah komen. Sila cuba lagi.');
    } finally {
      this.isLoading = false;
    }
  }

  // Start editing a comment
  editComment(comment: Comment | Reply) {
    if (!this.currentUser || this.currentUser.email !== comment.email) {
      this.presentToast('Anda hanya boleh edit komen anda sahaja');
      return;
    }

    this.editingCommentId = comment.id;
    this.editCommentText = comment.text;
  }

  // Cancel editing a comment
  cancelEditComment() {
    this.editingCommentId = null;
    this.editCommentText = '';
  }

  // Save edited comment
  async saveEditedComment(comment: Comment | Reply) {
    if (!this.editCommentText.trim()) {
      this.presentToast('Komen tidak boleh kosong');
      return;
    }

    this.isLoading = true;
    try {
      const response = await this.announcementService.updateComment(
        comment.id,
        this.editCommentText,
      );

      if (response.success) {
        // Update the comment text in the UI
        if (this.selectedArticle) {
          // Check if it's a top-level comment
          const topLevelComment = this.selectedArticle.comments.find(
            (c) => c.id === comment.id,
          );
          if (topLevelComment) {
            topLevelComment.text = this.editCommentText;
            topLevelComment.is_edited = response.edited;
          } else {
            // Check if it's a reply
            for (const c of this.selectedArticle.comments) {
              const reply = c.replies.find((r) => r.id === comment.id);
              if (reply) {
                reply.text = this.editCommentText;
                reply.is_edited = response.edited;
                break;
              }
            }
          }
        }
        this.presentToast('Komen berjaya dikemaskini', 'success');
      } else {
        this.presentToast('Gagal mengemaskini komen');
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      this.presentToast('Ralat mengemaskini komen. Sila cuba lagi.');
    } finally {
      this.editingCommentId = null;
      this.editCommentText = '';
      this.isLoading = false;
    }
  }

  // Delete a comment
  async deleteComment(commentId: number) {
    if (!this.currentUser) {
      this.presentToast('Sila log masuk untuk memadamkan komen');
      return;
    }

    // Confirm delete
    const alert = await this.alertController.create({
      header: 'Sahkan Padam',
      message: 'Adakah anda pasti mahu memadamkan komen ini?',
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
        },
        {
          text: 'Padam',
          handler: async () => {
            try {
              const response =
                await this.announcementService.deleteComment(commentId);
              if (response.success) {
                // Remove the comment from the UI
                if (this.selectedArticle) {
                  // Check if it's a top-level comment
                  const commentIndex = this.selectedArticle.comments.findIndex(
                    (c) => c.id === commentId,
                  );
                  if (commentIndex >= 0) {
                    this.selectedArticle.comments.splice(commentIndex, 1);
                    this.selectedArticle.commentsCount = Math.max(
                      0,
                      this.selectedArticle.commentsCount - 1,
                    );
                  } else {
                    // It might be a reply, check in all comments
                    for (const comment of this.selectedArticle.comments) {
                      const replyIndex = comment.replies.findIndex(
                        (r) => r.id === commentId,
                      );
                      if (replyIndex >= 0) {
                        comment.replies.splice(replyIndex, 1);
                        this.selectedArticle.commentsCount = Math.max(
                          0,
                          this.selectedArticle.commentsCount - 1,
                        );
                        break;
                      }
                    }
                  }
                  this.presentToast('Komen berjaya dipadam', 'success');
                }
              } else {
                this.presentToast('Gagal memadam komen');
              }
            } catch (error) {
              console.error('Error deleting comment:', error);
              this.presentToast('Ralat memadam komen. Sila cuba lagi.');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  // Add a reply to a specific comment
  async addReply(commentIndex: number) {
    if (!this.newReply.trim()) return;
    if (!this.currentUser) {
      this.presentToast('Sila log masuk untuk menambah balasan');
      return;
    }
    if (!this.selectedArticle) {
      this.presentToast('Tiada artikel dipilih');
      return;
    }

    this.isLoading = true;
    try {
      const parentCommentId = this.selectedArticle.comments[commentIndex].id;
      const response = await this.announcementService.addComment(
        this.selectedArticle.id,
        this.newReply,
        parentCommentId,
      );

      if (response.success) {
        // Add the new reply to our comment
        if (!this.selectedArticle.comments[commentIndex].replies) {
          this.selectedArticle.comments[commentIndex].replies = [];
        }
        this.selectedArticle.comments[commentIndex].replies.push(
          response.comment,
        );
        this.selectedArticle.commentsCount++;
        this.newReply = '';
        this.selectedCommentIndex = null;
      } else {
        this.presentToast('Gagal menambah balasan');
      }
    } catch (error) {
      console.error('Error adding reply:', error);
      this.presentToast('Ralat menambah balasan. Sila cuba lagi.');
    } finally {
      this.isLoading = false;
    }
  }

  // Show reply input field for a comment
  showReplyInput(commentIndex: number) {
    this.selectedCommentIndex = commentIndex;
  }

  // Helper method to show toast notifications
  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color,
    });
    await toast.present();
  }

  handleRefresh(event: CustomEvent) {
    // Reload announcements
    this.loadAnnouncements().then(() => {
      (event.target as HTMLIonRefresherElement).complete();
    });
  }

  /**
   * Handles image loading errors by showing a placeholder
   */
  handleImageError(event: Event, news: any) {
    const imgElement = event.target as HTMLImageElement;

    // Check if it's a base64 image that might be too large or corrupt
    if (news.imageUrl && news.imageUrl.startsWith('data:image/')) {
      console.warn('Base64 image failed to load:', news.title);

      // Replace with a placeholder icon (as a data URI to avoid additional requests)
      imgElement.src =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0iZmVhdGhlciBmZWF0aGVyLWltYWdlIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';

      // Set a special class to style the placeholder
      imgElement.classList.add('image-error');
      imgElement.style.padding = '40px';
    } else {
      // For non-base64 images (regular URLs), use a simpler fallback
      imgElement.src = 'assets/placeholder-image.png';

      // If no placeholder image exists, use a generic one
      imgElement.onerror = () => {
        imgElement.src =
          'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0iZmVhdGhlciBmZWF0aGVyLWltYWdlIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';
        imgElement.style.padding = '40px';
      };
    }
  }

  /**
   * Handles user avatar image loading errors
   */
  handleUserImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.style.display = 'none';

    // Find the parent element and add an icon
    const parent = imgElement.parentElement;
    if (parent) {
      const icon = document.createElement('ion-icon');
      icon.setAttribute('name', 'person-circle');
      icon.classList.add('avatar-icon');
      parent.appendChild(icon);
    }
  }

  // Generic error handler for API errors
  handleApiError(error: any, defaultMessage: string): string {
    console.error('API Error:', error);

    // Don't show technical HTTP errors to users
    if (
      error &&
      error.error &&
      error.error.message &&
      typeof error.error.message === 'string'
    ) {
      // Only show user-friendly messages, not technical details
      if (
        !error.error.message.includes('HTTP') &&
        !error.error.message.includes('status code') &&
        !error.error.message.toLowerCase().includes('error')
      ) {
        return error.error.message;
      }
    }

    return defaultMessage;
  }

  /**
   * Share announcement with others
   */
  async shareAnnouncement(event: Event) {
    event.stopPropagation();

    if (!this.selectedArticle) {
      this.presentToast('Tiada artikel dipilih untuk dikongsi');
      return;
    }

    try {
      const shareUrl = `https://masjidala.web.app/announcement/${this.selectedArticle.id}`;
      const shareText = `Lihat Pengumuman Penting Dari Masjid Al-A'la!\n\n"${this.selectedArticle.title
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(
          ' ',
        )}"\n\nSila log masuk ke aplikasi untuk melihat pengumuman ini.\n${shareUrl}`;

      const shareOptions = {
        title: "Pengumuman Masjid Al-A'la",
        text: shareText,
        dialogTitle: 'Kongsi Pengumuman',
      };

      await Share.share(shareOptions);
    } catch (error: any) {
      if (error.message !== 'Share canceled') {
        console.error('Error sharing announcement:', error);
        this.presentToast(
          'Ralat berkongsi pengumuman. Sila cuba lagi.',
          'danger',
        );
      }
    }
  }

  // Add this new method to open the image viewer
  async openImageViewer(imageUrl: string) {
    if (!imageUrl) return;

    const modal = await this.modalController.create({
      component: ImageViewerModalComponent,
      componentProps: {
        imageUrl: imageUrl,
      },
      cssClass: 'fullscreen-modal',
    });

    return await modal.present();
  }
}
