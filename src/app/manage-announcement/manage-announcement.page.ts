import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AddAnnouncementModalComponent } from '../add-announcement-modal/add-announcement-modal.component';
import { EditAnnouncementModalComponent } from '../edit-announcement-modal/edit-announcement-modal.component';

@Component({
  selector: 'app-manage-announcement',
  templateUrl: './manage-announcement.page.html',
  styleUrls: ['./manage-announcement.page.scss'],
})
export class ManageAnnouncementPage {
  isAddModalOpen = false;
  isEditModalOpen = false;
  newsItems = [
    {
      title: 'Masjid Al-A\'la: Menjadi Pusat Keagamaan Utama di Wilayah',
      author: 'Imam Ahmad Al-Farisi',
      date: '12 SEP 2023',
      imageUrl: 'https://picsum.photos/600/400?random=1',
      content: `Masjid Al-A'la yang terletak di tengah kota adalah pusat ibadah...`,
      commentsCount: 3,
      likes: 78,
    },
    {
      title: 'Peranan Masjid Al-A\'la dalam Meningkatkan Kehidupan Komuniti',
      author: 'Ustazah Zainab Salim',
      date: '15 SEP 2023',
      imageUrl: 'https://picsum.photos/600/400?random=2',
      content: `Masjid Al-A'la bukan hanya tempat untuk ibadah...`,
      commentsCount: 24,
      likes: 59,
    },
    {
      title: 'Masjid Al-A\'la: Memupuk Keharmonian dan Toleransi Agama',
      author: 'Dr. Harun Abdullah',
      date: '18 SEP 2023',
      imageUrl: 'https://picsum.photos/600/400?random=3',
      content: `Masjid Al-A'la telah memainkan peranan penting dalam memupuk keharmonian...`,
      commentsCount: 35,
      likes: 82,
    },
    {
      title: 'Seni Bina Masjid Al-A\'la: Gabungan Tradisi dan Inovasi Moden',
      author: 'Arsitek Mustafa Azzam',
      date: '20 SEP 2023',
      imageUrl: 'https://picsum.photos/600/400?random=4',
      content: `Masjid Al-A'la adalah contoh sempurna gabungan seni bina tradisional dan moden...`,
      commentsCount: 50,
      likes: 95,
    }
  ];

  newAnnouncement = {
    title: '',
    author: '',
    date: '',
    content: '',
  };

  editAnnouncement = {
    title: '',
    author: '',
    date: '',
    content: '',
  };

  constructor(private modalController: ModalController) { }

  async openModal(modalId: string, news: any = null) {
    if (modalId === 'addAnnouncementModal') {
      const modal = await this.modalController.create({
        component: AddAnnouncementModalComponent,
      });
      modal.onDidDismiss().then((data) => {
        if (data.data) {
          this.newsItems.push(data.data); // Handle adding new announcement
        }
      });
      return await modal.present();
    } else if (modalId === 'editAnnouncementModal' && news) {
      const modal = await this.modalController.create({
        component: EditAnnouncementModalComponent,
        componentProps: { news },
      });
      modal.onDidDismiss().then((data) => {
        if (data.data) {
          // Update the existing news item with the new data
          const index = this.newsItems.findIndex((item) => item.title === data.data.title);
          this.newsItems[index] = data.data;
        }
      });
      return await modal.present();
    }
  }


  closeModal(modalId: string) {
    if (modalId === 'addAnnouncementModal') {
      this.isAddModalOpen = false;
    } else if (modalId === 'editAnnouncementModal') {
      this.isEditModalOpen = false;
    }
  }

  addAnnouncement() {
    // Logic to add an announcement
    alert('Pengumuman ditambahkan');
    this.closeModal('addAnnouncementModal');
  }

  saveAnnouncement() {
    // Logic to save the edited announcement
    alert('Pengumuman diperbarui');
    this.closeModal('editAnnouncementModal');
  }

  deleteAnnouncement(news: any) {
    const index = this.newsItems.findIndex((item) => item.title === news.title);
    if (index > -1) {
      this.newsItems.splice(index, 1);
      alert(`Pengumuman "${news.title}" dihapus`);
    }
  }
}
