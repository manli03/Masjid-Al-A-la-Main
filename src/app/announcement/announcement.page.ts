/**
 * announcement.page.ts
 *
 * This component manages the display of announcements, handling both a list view
 * and a detailed article view. It includes features for user interaction such as
 * comments, replies, likes, and sharing. The comment system uses a flat-reply
 * structure with relative date formatting for a modern user experience.
 */

import { Component, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import {
  ToastController,
  AlertController,
  ModalController,
  Platform,
  PopoverController,
  IonTextarea,
  LoadingController,
} from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';

// Services
import { StorageService } from '../services/storage.service';
import { AnnouncementService } from '../services/announcement.service';
import { AuthService } from '../services/auth.service';
import { UnreadAnnouncementsService } from '../services/unread-announcements.service';

// Custom Components
import { ImageViewerModalComponent } from '../component/image-viewer-modal/image-viewer-modal.component';
import { CommentOptionsPopoverComponent } from '../component/comment-options-popover/comment-options-popover.component';

// --- Interfaces for Data Structuring ---

interface Announcement {
  id: number;
  title: string;
  author: string;
  content: string;
  imageUrls?: string[];
  date: string;
  commentsCount: number;
  likes: number;
  userLiked?: boolean;
  isRead?: boolean;
}

interface Comment {
  id: number;
  user: string;
  email: string;
  text: string;
  imageUrl?: string;
  created_at?: string;
  parent_comment_id: number | null;
  is_edited?: boolean;
  isAdmin?: boolean;
  replies: Comment[];
  totalReplies?: number;
  hasMoreReplies?: boolean;
}

interface AnnouncementDetail extends Announcement {
  comments: Comment[];
}

@Component({
  selector: 'app-announcement',
  templateUrl: 'announcement.page.html',
  styleUrls: ['announcement.page.scss'],
})
export class announcementPage {
  // --- Component Properties ---

  // DOM Element Reference for auto-focus
  @ViewChild('replyTextarea', { static: false }) replyTextarea:
    | IonTextarea
    | undefined;

  // State & Data
  newsItems: Announcement[] = [];
  displayedNewsItems: Announcement[] = [];
  selectedArticle: AnnouncementDetail | null = null;
  currentUser: any = null;

  // UI Control
  isLoading = false;
  isInitialLoad = true;
  isCheckingAdmin = true;
  currentSegment: string = 'all';
  isAdmin = false;
  allRead = true;

  // Pagination
  currentPage = 1;
  isLoadingMore = false;
  hasMoreData = true;
  pageSize = 10;

  // Comment Pagination
  commentsCurrentPage = 1;
  isLoadingMoreComments = false;
  hasMoreComments = true;
  commentsPageSize = 10;

  // Form Models
  newComment: string = '';
  newReply: string = '';
  editCommentText: string = '';

  // Interaction State
  replyingToCommentId: number | null = null;
  editingCommentId: number | null = null;

  // Image Gallery
  imagesForGrid: string[] = [];
  remainingImageCount = 0;

  // Subscriptions
  private userChangeSubscription: Subscription | null = null;
  private backButtonSubscription: any;
  private loading: HTMLIonLoadingElement | null = null;

  private iconColorInterval: any;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private storageService: StorageService,
    private toastController: ToastController,
    private alertController: AlertController,
    private announcementService: AnnouncementService,
    private authService: AuthService,
    private modalController: ModalController,
    private platform: Platform,
    private popoverController: PopoverController,
    private loadingController: LoadingController,
    private unreadAnnouncementsService: UnreadAnnouncementsService,
  ) {}

  // --- 1. Lifecycle Hooks ---

  /**
   * Initializes the component on first load.
   */
  async ngOnInit() {
    await this.loadUserData();
    this.userChangeSubscription = this.storageService
      .getUserChangeObservable()
      .subscribe(async () => {
        this.resetPageState();
        await this.loadUserData();
        if (!this.selectedArticle) {
          await this.loadAnnouncements();
        }
      });
  }

  /**
   * Runs when the page is about to enter and become the active page.
   * Handles main loading logic, routing, and data fetching.
   */
  async ionViewWillEnter() {
    this.isCheckingAdmin = true;
    this.isLoading = true;
    try {
      if (
        !(await this.authService.isAuthenticated()) ||
        !(await this.authService.isProfileComplete())
      ) {
        this.handleAuthenticationRedirect();
        return;
      }

      this.isAdmin = await this.authService.isAdmin();
      const announcementId = this.route.snapshot.paramMap.get('id');

      if (this.isAdmin && !announcementId) {
        this.router.navigateByUrl('/tabs/manage-announcement', {
          replaceUrl: true,
        });
        return;
      }

      await this.loadAnnouncements();
      if (announcementId) {
        await this.loadAnnouncementDetailsById(parseInt(announcementId, 10));
      }

      // Change mail-unread icon svg path color to red
      // Start an interval to run our function every 50ms
      const iconColorInterval = setInterval(this.colorUnreadIcon, 50);

      // Set a timeout to stop the interval after 2 seconds to prevent it from running forever
      setTimeout(() => {
        clearInterval(iconColorInterval);
      }, 2000);
    } catch (error) {
      this.presentToast('Gagal memuatkan halaman. Sila cuba lagi.');
    } finally {
      this.isInitialLoad = false;
      this.isCheckingAdmin = false;
      this.isLoading = false;
      this.setupBackButtonHandler();
    }
  }

  /**
   * Runs when the page is about to leave. Cleans up the back button subscription.
   */
  ionViewWillLeave() {
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
      this.backButtonSubscription = null;
    }
  }

  /**
   * Cleans up subscriptions when the component is destroyed.
   */
  ngOnDestroy() {
    if (this.userChangeSubscription) {
      this.userChangeSubscription.unsubscribe();
    }
  }

  colorUnreadIcon() {
    const iconElement = document
      .querySelectorAll('ion-segment-button')[1]
      ?.querySelector('ion-icon');

    // First, check if the icon exists at all
    if (!iconElement) return;

    // === NEW PART ===
    // Only proceed if it's the correct icon
    if (iconElement.getAttribute('name') === 'mail-unread') {
      if (iconElement.shadowRoot) {
        const firstPath = iconElement.shadowRoot.querySelector(
          'svg path:first-of-type',
        ) as SVGPathElement;

        if (firstPath) {
          firstPath.style.fill = 'red';
          // Once we succeed, we can stop the interval
          clearInterval(this.iconColorInterval);
        }
      }
    } else {
      // If the icon is 'mail', we should ensure the color is reset
      if (iconElement.shadowRoot) {
        const firstPath = iconElement.shadowRoot.querySelector(
          'svg path:first-of-type',
        ) as SVGPathElement;
        if (firstPath) {
          firstPath.style.fill = ''; // Resets the color to the default
        }
      }
    }
  }

  // --- 2. Data Loading & Page Setup ---

  /**
   * Loads user data from storage.
   */
  async loadUserData() {
    this.currentUser = await this.storageService.get('user');
  }

  /**
   * Fetches the list of announcements from the service with pagination.
   */
  async loadAnnouncements(reset: boolean = true) {
    try {
      if (reset) {
        this.currentPage = 1;
        this.hasMoreData = true;
        this.newsItems = [];
      }

      const result = await this.announcementService.getAnnouncements(
        this.currentPage,
        this.pageSize,
      );

      if (result.announcements && result.announcements.length > 0) {
        if (reset) {
          this.newsItems = result.announcements;
        } else {
          this.newsItems = [...this.newsItems, ...result.announcements];
        }
        this.hasMoreData = result.hasMore;
      } else {
        this.hasMoreData = false;
      }

      this.filterAnnouncementsBySegment();
    } catch (error) {
      console.error('Error loading announcements:', error);
      this.presentToast('Gagal memuat senarai pengumuman.');
    }
  }

  /**
   * Loads more announcements for infinite scroll.
   */
  async loadMoreAnnouncements(event: any) {
    if (this.isLoadingMore || !this.hasMoreData) {
      event.target.complete();
      return;
    }

    this.isLoadingMore = true;
    this.currentPage++;

    try {
      await this.loadAnnouncements(false);
    } catch (error) {
      this.presentToast('Gagal memuat lebih banyak pengumuman.');
    } finally {
      this.isLoadingMore = false;
      event.target.complete();
    }
  }

  /**
   * Loads the full details of a specific announcement by its ID.
   */
  async loadAnnouncementDetailsById(
    announcementId: number,
    resetComments: boolean = true,
  ) {
    try {
      if (resetComments) {
        this.commentsCurrentPage = 1;
        this.hasMoreComments = true;
      }

      const fullAnnouncement =
        await this.announcementService.getAnnouncementById(
          announcementId,
          this.commentsCurrentPage,
          this.commentsPageSize,
        );
      if (fullAnnouncement) {
        if (resetComments) {
          this.selectedArticle = fullAnnouncement;
        } else {
          // Append new comments to existing ones
          if (
            fullAnnouncement.comments &&
            fullAnnouncement.comments.length > 0
          ) {
            this.selectedArticle!.comments = [
              ...this.selectedArticle!.comments,
              ...fullAnnouncement.comments,
            ];
          }
          // Update pagination state
          this.hasMoreComments = fullAnnouncement.hasMoreComments || false;
        }
        this.prepareImageGrid();
        if (!fullAnnouncement.isRead) {
          this.announcementService.markAsRead(announcementId).catch();
          // Update the unread count in the service
          this.unreadAnnouncementsService.decrementUnreadCount();
        }
      } else {
        // this.presentToast('Pengumuman tidak dijumpai.');
        this.router.navigateByUrl('/tabs/announcement', { replaceUrl: true });
      }
    } catch (error) {
      this.presentToast('Gagal memuat detail pengumuman.');
    }
  }

  /**
   * Loads more comments for infinite scroll.
   */
  async loadMoreComments(event: any) {
    if (
      this.isLoadingMoreComments ||
      !this.hasMoreComments ||
      !this.selectedArticle
    ) {
      event.target.complete();
      return;
    }

    this.isLoadingMoreComments = true;
    this.commentsCurrentPage++;

    try {
      await this.loadAnnouncementDetailsById(this.selectedArticle.id, false);
    } catch (error) {
      this.presentToast('Gagal memuat lebih banyak komen.');
    } finally {
      this.isLoadingMoreComments = false;
      event.target.complete();
    }
  }

  /**
   * Loads more replies for a specific comment.
   */
  async loadMoreReplies(comment: Comment) {
    if (!comment.hasMoreReplies || !this.selectedArticle) return;

    const currentReplyCount = comment.replies.length;
    const offset = currentReplyCount; // Start after current replies

    try {
      const response = await this.announcementService.loadMoreReplies(
        comment.id,
        offset,
      );

      if (response.success && response.replies) {
        // Add new replies to the existing replies array
        comment.replies = [...comment.replies, ...response.replies];

        // Update pagination state
        comment.hasMoreReplies = response.hasMore;
        comment.totalReplies = response.total;
      }
    } catch (error) {
      this.presentToast('Gagal memuat lebih banyak balasan.');
    }
  }

  /**
   * Resets the component's state, typically used when deselecting an article.
   */
  resetPageState() {
    this.selectedArticle = null;
    this.newComment = '';
    this.newReply = '';
    this.replyingToCommentId = null;
    this.editingCommentId = null;
    this.editCommentText = '';
  }

  // --- 3. UI Interaction & View Logic ---

  /**
   * Navigates to the detail view for a selected article.
   */
  selectArticle(item: Announcement) {
    this.router.navigate(['/tabs/announcement', item.id]);
  }

  /**
   * Deselects the current article, returning to the list view.
   */
  deselectArticle() {
    this.router.navigateByUrl('/tabs/announcement', { replaceUrl: true });
    this.resetPageState();

    // Refresh unread count when returning to list view from detail view
    setTimeout(async () => {
      try {
        await this.unreadAnnouncementsService.refreshUnreadCount();
      } catch (error) {
        console.error(
          'Error refreshing unread count when returning to list:',
          error,
        );
      }
    }, 100); // Small delay to ensure navigation completes
  }

  /**
   * Handles the segment change event (All/Unread).
   */
  segmentChanged(event: any) {
    this.currentSegment = event.detail.value;
    this.filterAnnouncementsBySegment();
  }

  /**
   * Filters the announcement list based on the current segment.
   */
  filterAnnouncementsBySegment() {
    if (this.currentSegment === 'all') {
      this.displayedNewsItems = [...this.newsItems];
    } else {
      this.displayedNewsItems = this.newsItems.filter((item) => !item.isRead);
    }
    this.allRead = !this.newsItems.some((item) => !item.isRead);
  }

  /**
   * Prepares the image grid for the detail view, showing up to 4 images.
   */
  prepareImageGrid() {
    if (this.selectedArticle?.imageUrls?.length) {
      this.imagesForGrid = this.selectedArticle.imageUrls.slice(0, 4);
      this.remainingImageCount =
        this.selectedArticle.imageUrls.length - this.imagesForGrid.length;
    }
  }

  /**
   * Opens the image viewer modal.
   */
  async openImageViewer(startIndex: number) {
    if (!this.selectedArticle?.imageUrls?.length) return;
    const modal = await this.modalController.create({
      component: ImageViewerModalComponent,
      componentProps: {
        imageUrls: this.selectedArticle.imageUrls,
        initialIndex: startIndex,
      },
      cssClass: 'fullscreen-modal',
    });
    await modal.present();
  }

  // --- 4. Date Formatting Helpers ---

  /**
   * Formats the date for the main announcement (absolute format).
   */
  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const monthNames = [
        'Jan',
        'Feb',
        'Mac',
        'Apr',
        'Mei',
        'Jun',
        'Jul',
        'Ogo',
        'Sep',
        'Okt',
        'Nov',
        'Dis',
      ];
      return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}, ${this._formatTime(date)}`;
    } catch {
      return '';
    }
  }

  /**
   * Formats the date for comments with user-friendly relative time rules.
   */
  formatCommentDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const commentDate = new Date(dateStr);
      const now = new Date();
      const diffInSeconds = Math.round(
        (now.getTime() - commentDate.getTime()) / 1000,
      );

      if (diffInSeconds < 60) return 'sebentar tadi';
      if (diffInSeconds < 3600)
        return `${Math.floor(diffInSeconds / 60)} minit yang lalu`;
      if (diffInSeconds < 21600)
        return `${Math.floor(diffInSeconds / 3600)} jam yang lalu`;

      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const yesterdayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
      );
      const sevenDaysAgo = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 7,
      );

      if (commentDate >= todayStart)
        return `Hari ini, ${this._formatTime(commentDate)}`;
      if (commentDate >= yesterdayStart)
        return `Semalam, ${this._formatTime(commentDate)}`;
      if (commentDate >= sevenDaysAgo) {
        const dayNames = [
          'Ahad',
          'Isnin',
          'Selasa',
          'Rabu',
          'Khamis',
          'Jumaat',
          'Sabtu',
        ];
        return `${dayNames[commentDate.getDay()]}, ${this._formatTime(commentDate)}`;
      }

      const monthNames = [
        'Jan',
        'Feb',
        'Mac',
        'Apr',
        'Mei',
        'Jun',
        'Jul',
        'Ogo',
        'Sep',
        'Okt',
        'Nov',
        'Dis',
      ];
      if (commentDate.getFullYear() === now.getFullYear()) {
        return `${commentDate.getDate()} ${monthNames[commentDate.getMonth()]}`;
      }

      return `${commentDate.getDate()} ${monthNames[commentDate.getMonth()]} ${commentDate.getFullYear()}`;
    } catch {
      return '';
    }
  }

  /**
   * Private helper to format time in "H:MM am/pm" format.
   */
  private _formatTime(date: Date): string {
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'ptg' : 'pg';
    hours = hours % 12 || 12; // Converts 0 to 12
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} ${ampm}`;
  }

  // --- 5. Comment & Reply Logic ---

  /**
   * Adds a new top-level comment.
   */
  async addComment() {
    if (!this.newComment.trim() || !this.selectedArticle) return;
    await this.showLoading('Menambah komen...');
    try {
      const response = await this.announcementService.addComment(
        this.selectedArticle.id,
        this.newComment.trim(),
      );
      if (response.success && response.comment) {
        this.selectedArticle.comments.push(response.comment);
        this.selectedArticle.commentsCount++;
        this.newComment = '';
        this.presentToast('Komen berjaya ditambah', 'success');
      }
    } catch {
      this.presentToast('Gagal menambah komen.');
    } finally {
      await this.hideLoading();
    }
  }

  /**
   * Adds a reply to a comment or another reply.
   */
  async addReply(parentCommentId: number) {
    if (!this.newReply.trim() || !this.selectedArticle) return;
    await this.showLoading('Menambah balasan...');
    try {
      const response = await this.announcementService.addComment(
        this.selectedArticle.id,
        this.newReply.trim(),
        parentCommentId,
      );
      if (response.success && response.comment) {
        const parentInfo = this.findCommentAndParent(parentCommentId);
        if (parentInfo) {
          parentInfo.topLevelParent.replies.push(response.comment);
          this.selectedArticle.commentsCount++;
          this.presentToast('Balasan berjaya ditambah', 'success');
          this.replyingToCommentId = null;
          this.newReply = '';
        }
      }
    } catch {
      this.presentToast('Gagal menambah balasan.');
    } finally {
      await this.hideLoading();
    }
  }

  /**
   * Toggles the visibility of the reply input box, focuses it, and scrolls it into view.
   */
  toggleReplyInput(commentId: number) {
    const isOpening = this.replyingToCommentId !== commentId;
    this.replyingToCommentId = isOpening ? commentId : null;
    this.newReply = '';

    if (isOpening) {
      setTimeout(() => {
        const inputContainer = document.querySelector('.reply-input-container');
        inputContainer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.replyTextarea?.setFocus();
      }, 150);
    }
  }

  /**
   * Determines if the reply input should be shown for a given top-level comment thread.
   */
  isReplyingInThisThread(topLevelComment: Comment): boolean {
    if (this.replyingToCommentId === null) return false;
    if (this.replyingToCommentId === topLevelComment.id) return true;
    return topLevelComment.replies.some(
      (reply) => reply.id === this.replyingToCommentId,
    );
  }

  /**
   * Gets the name of the user being replied to, but only for a reply-to-a-reply.
   */
  getReplyingToName(reply: Comment, topLevelComment: Comment): string | null {
    if (reply.parent_comment_id === topLevelComment.id) return null;
    const parentReply = topLevelComment.replies.find(
      (r) => r.id === reply.parent_comment_id,
    );
    return parentReply ? parentReply.user : null;
  }

  /**
   * Presents a popover with "Edit" and "Delete" options for a comment.
   */
  async presentCommentPopover(event: Event, comment: Comment) {
    const isOwner = this.currentUser?.email === comment.email;
    const popover = await this.popoverController.create({
      component: CommentOptionsPopoverComponent,
      componentProps: { isOwner, isAdmin: this.isAdmin },
      event,
      translucent: true,
      showBackdrop: false,
    });
    await popover.present();
    const { data } = await popover.onDidDismiss();
    if (data?.action === 'edit') this.editComment(comment);
    if (data?.action === 'delete') this.confirmDeleteComment(comment.id);
  }

  /**
   * Enters "edit mode" for a specific comment.
   */
  editComment(comment: Comment) {
    this.editingCommentId = comment.id;
    this.editCommentText = comment.text;
  }

  /**
   * Exits "edit mode" without saving.
   */
  cancelEditComment() {
    this.editingCommentId = null;
    this.editCommentText = '';
  }

  /**
   * Saves an edited comment.
   */
  async saveEditedComment(comment: Comment) {
    if (!this.editCommentText.trim()) return;
    await this.showLoading('Menyimpan komen...');
    try {
      const response = await this.announcementService.updateComment(
        comment.id,
        this.editCommentText.trim(),
      );
      if (response.success) {
        comment.text = this.editCommentText.trim();
        comment.is_edited = true;
        this.cancelEditComment();
        this.presentToast('Komen berjaya dikemaskini', 'success');
      }
    } catch {
      this.presentToast('Gagal mengemaskini komen.');
    } finally {
      await this.hideLoading();
    }
  }

  /**
   * Shows a confirmation alert before deleting a comment.
   */
  async confirmDeleteComment(commentId: number) {
    const alert = await this.alertController.create({
      header: 'Sahkan Padam',
      message: 'Adakah anda pasti mahu memadamkan komen ini?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { text: 'Padam', role: 'confirm' },
      ],
    });
    await alert.present();

    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') {
      await this.showLoading('Memadam komen...');
      await this.deleteComment(commentId);
    }
  }

  /**
   * Deletes a comment after confirmation.
   */
  private async deleteComment(commentId: number) {
    if (!this.selectedArticle) return;
    try {
      const response = await this.announcementService.deleteComment(commentId);
      if (response.success) {
        const info = this.findCommentAndParent(commentId);
        if (info) {
          if (info.topLevelParent.id === commentId) {
            this.selectedArticle.comments =
              this.selectedArticle.comments.filter((c) => c.id !== commentId);
          } else {
            info.topLevelParent.replies = info.topLevelParent.replies.filter(
              (r) => r.id !== commentId,
            );
          }
          this.selectedArticle.commentsCount--;
          this.presentToast('Komen berjaya dipadam', 'success');
        }
      }
    } catch {
      this.presentToast('Gagal memadam komen.');
    } finally {
      await this.hideLoading();
    }
  }

  // --- 6. Engagement & Sharing ---

  /**
   * Toggles the like status of the current article.
   */
  async toggleLike(event: Event) {
    event.stopPropagation();
    if (!this.selectedArticle) return;
    try {
      this.selectedArticle.userLiked = !this.selectedArticle.userLiked;
      this.selectedArticle.likes += this.selectedArticle.userLiked ? 1 : -1;
      const response = await this.announcementService.toggleLike(
        this.selectedArticle.id,
      );
      if (response.success) {
        this.selectedArticle.likes = response.likesCount;
      }
    } catch {
      this.presentToast('Gagal mengemaskini status suka.');
    }
  }

  /**
   * Uses the Capacitor Share plugin to share the announcement.
   * It will attempt to share the first image along with the text and a link.
   * If the image is base64, it's saved as a temporary file to be shared.
   */
  async shareAnnouncement(event: Event) {
    event.stopPropagation();

    if (!this.selectedArticle) {
      this.presentToast('Tiada artikel dipilih untuk dikongsi');
      return;
    }

    try {
      const shareUrl = `https://masjidala.web.app/announcement/${this.selectedArticle.id}`;
      const title = this.selectedArticle.title;
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.selectedArticle.content;
      const plainContent =
        tempDiv.textContent || tempDiv.innerText || 'Sila lihat imej';
      const shareText = `*${title}*\n\n${plainContent}\n\nBaca pengumuman penuh di aplikasi Masjid Al-A'la:`;

      const shareOptions: any = {
        title: "Pengumuman Masjid Al-A'la",
        text: shareText,
        url: shareUrl,
        dialogTitle: 'Kongsi Pengumuman',
      };

      const firstImageUrl = this.selectedArticle.imageUrls?.[0];

      if (firstImageUrl) {
        try {
          const fileName = `announcement_${this.selectedArticle.id}_${Date.now()}.jpeg`;

          // Use the native-layer downloader for mobile, which bypasses webview CORS issues.
          if (this.platform.is('capacitor')) {
            // Step 1: Download the file to the device's cache directory.
            await Filesystem.downloadFile({
              url: firstImageUrl,
              path: fileName,
              directory: Directory.Cache,
            });

            // Step 2: Get the correct, shareable URI for the downloaded file.
            const { uri } = await Filesystem.getUri({
              path: fileName,
              directory: Directory.Cache,
            });

            if (uri) {
              shareOptions.files = [uri];
            }
          } else {
            // For web (PWA), use the fetch method, which now works due to server CORS headers.
            const response = await fetch(firstImageUrl);
            const blob = await response.blob();
            const base64Data = await this.blobToBase64(blob);

            const savedFile = await Filesystem.writeFile({
              path: fileName,
              data: base64Data,
              directory: Directory.Cache,
            });
            // The '.uri' property is what's needed for web-based sharing.
            shareOptions.files = [savedFile.uri];
          }
        } catch (err) {
          console.error('Gagal memproses imej untuk dikongsi:', err);
          this.presentToast('Gagal memuat-turun imej untuk dikongsi.');
        }
      }

      await Share.share(shareOptions);
    } catch (error: any) {
      if (error.message !== 'Share canceled') {
        console.error('Ralat semasa berkongsi:', error);
        this.presentToast('Ralat berkongsi pengumuman. Sila cuba lagi.');
      }
    }
  }

  // --- 7. Utility & Private Helpers ---

  private async showLoading(message: string) {
    if (this.loading) {
      await this.hideLoading();
    }
    this.loading = await this.loadingController.create({
      message,
    });
    await this.loading.present();
  }

  private async hideLoading() {
    if (this.loading) {
      await this.loading.dismiss();
      this.loading = null;
    }
  }

  /**
   * Converts a Blob object to a Base64 string (data part only).
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        // The result includes the full data URL prefix (e.g., "data:image/png;base64,").
        // We only need the data part after the comma.
        const dataUrl = reader.result as string;
        const base64Data = dataUrl.split(',', 2)[1];
        resolve(base64Data);
      };
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Handles the pull-to-refresh action.
   */
  async handleRefresh(event: CustomEvent) {
    await this.loadAnnouncements();
    (event.target as HTMLIonRefresherElement).complete();
  }

  /**
   * Refreshes the details of the currently selected article.
   */
  async refreshArticleDetails(event: any) {
    if (!this.selectedArticle) {
      event.target.complete();
      return;
    }
    await this.loadAnnouncementDetailsById(this.selectedArticle.id);
    event.target.complete();
  }

  /**
   * Handles user authentication and profile completion checks and redirects.
   */
  private async handleAuthenticationRedirect() {
    const isAuthenticated = await this.authService.isAuthenticated();
    if (!isAuthenticated) {
      this.router.navigateByUrl('/tabs/authentication', { replaceUrl: true });
      return;
    }
    if (!(await this.authService.isProfileComplete())) {
      const alert = await this.alertController.create({
        header: 'Lengkapkan Profil',
        message: 'Anda perlu melengkapkan profil untuk mengakses pengumuman.',
        buttons: [
          {
            text: 'OK',
            handler: () =>
              this.router.navigateByUrl('/tabs/profile', { replaceUrl: true }),
          },
        ],
        backdropDismiss: false,
      });
      await alert.present();
    }
  }

  /**
   * Sets up the hardware back button handler.
   */
  private setupBackButtonHandler() {
    this.backButtonSubscription =
      this.platform.backButton.subscribeWithPriority(10, () => {
        if (this.selectedArticle) {
          this.deselectArticle();
        } else {
          this.router.navigateByUrl('/tabs/home');
        }
      });
  }

  /**
   * Finds a comment (top-level or reply) by its ID and returns it along with its top-level parent.
   */
  private findCommentAndParent(
    commentId: number,
  ): { topLevelParent: Comment; targetComment: Comment } | null {
    if (!this.selectedArticle) return null;
    for (const topLevelComment of this.selectedArticle.comments) {
      if (topLevelComment.id === commentId)
        return {
          topLevelParent: topLevelComment,
          targetComment: topLevelComment,
        };
      const reply = topLevelComment.replies.find((r) => r.id === commentId);
      if (reply)
        return { topLevelParent: topLevelComment, targetComment: reply };
    }
    return null;
  }

  /**
   * Handles announcement image loading errors by replacing the broken image with a placeholder.
   */
  handleImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    // Prevent an infinite loop if the placeholder also fails to load
    if (imgElement.classList.contains('fallback-image')) return;

    imgElement.classList.add('fallback-image');
    // A simple, generic placeholder SVG
    imgElement.src =
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSAzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
    imgElement.style.objectFit = 'contain';
    imgElement.style.padding = '10%'; // Add some padding to the placeholder
  }

  /**
   * Handles user avatar image loading errors by showing a default person icon.
   * This prevents the ugly "broken image" icon from showing.
   */
  handleUserImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    // Hide the broken image element. The placeholder is already present behind it via CSS.
    imgElement.style.display = 'none';
  }

  /**
   * Displays a toast notification.
   */
  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color,
    });
    await toast.present();
  }

  /**
   * TrackBy function for ngFor performance optimization.
   */
  trackByAnnouncementId(index: number, item: Announcement): number {
    return item.id;
  }

  /**
   * TrackBy function for comments ngFor performance optimization.
   */
  trackByCommentId(index: number, item: Comment): number {
    return item.id;
  }
}
