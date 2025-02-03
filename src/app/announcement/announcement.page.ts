import { Component } from '@angular/core';

@Component({
  selector: 'app-announcement',
  templateUrl: 'announcement.page.html',
  styleUrls: ['announcement.page.scss']
})
export class announcementPage {

  // Mock Data for News Items (Updated to Masjid Al-A'la theme with comments and replies)
  newsItems = [
    {
      title: 'Masjid Al-A\'la: Menjadi Pusat Keagamaan Utama di Wilayah',
      author: 'Imam Ahmad Al-Farisi',
      date: '12 SEP 2023',
      imageUrl: 'https://picsum.photos/600/400?random=1',
      content: `Masjid Al-A'la yang terletak di tengah kota adalah pusat ibadah yang semakin dikenali. Dengan seni bina yang menakjubkan dan pelbagai kemudahan moden, masjid ini menjadi tempat yang penting bagi umat Islam untuk berkumpul dan beribadah. Masjid Al-A'la telah menjadi simbol keagamaan yang bukan sahaja penting di dalam komuniti, tetapi juga di luar negara. Artikel ini akan membincangkan sejarah Masjid Al-A'la, peranan yang dimainkan dalam memajukan agama Islam, serta sumbangannya dalam masyarakat. 
      Sebagai pusat ibadah yang terkenal, Masjid Al-A'la telah berperanan dalam banyak aspek kehidupan umat Islam. Dengan pelbagai program yang ditawarkan, masjid ini tidak hanya menyediakan ruang untuk solat, tetapi juga mengadakan kelas-kelas agama, seminar, dan pelbagai aktiviti sosial. Dalam masa depan, Masjid Al-A'la dijangka akan terus berkembang dan menjadi tempat yang lebih penting dalam memperkukuhkan tali persaudaraan umat Islam.`,
      comments: [
        {
          user: 'Aminah Al-Farisi',
          text: 'Masjid Al-A\'la memang hebat! Semoga terus maju dan memberi manfaat kepada umat Islam.',
          replies: [
            {
              user: 'Hassan Ali',
              text: 'Betul tu, semoga menjadi tempat yang penuh berkat.'
            }
          ]
        },
        {
          user: 'Zainab Syafiq',
          text: 'Saya suka bagaimana masjid ini turut terlibat dalam aktiviti kemasyarakatan.',
          replies: []
        }
      ],
      commentsCount: 3,
      likes: 78,
    },
    {
      title: 'Peranan Masjid Al-A\'la dalam Meningkatkan Kehidupan Komuniti',
      author: 'Ustazah Zainab Salim',
      date: '15 SEP 2023',
      imageUrl: 'https://picsum.photos/600/400?random=2',
      content: `Masjid Al-A'la bukan hanya tempat untuk ibadah, tetapi juga berperanan besar dalam meningkatkan kehidupan sosial dan ekonomi komuniti sekitarnya. Aktiviti yang dijalankan oleh masjid ini termasuklah program pendidikan agama, bantuan kemanusiaan, dan penglibatan dalam projek-projek komuniti yang memberi manfaat kepada semua. Keberkesanan program-program ini membuktikan bahawa masjid tidak hanya memberi tumpuan kepada aspek rohani, tetapi juga kepada kebajikan masyarakat.
      Program-program sosial yang dilaksanakan di Masjid Al-A'la telah memberi impak besar kepada penduduk setempat. Sebagai contoh, program pendidikan untuk kanak-kanak dan orang dewasa telah membantu meningkatkan pengetahuan agama dan sosial mereka. Selain itu, program bantuan kemanusiaan yang dijalankan juga memberi manfaat kepada golongan yang memerlukan, menjadikan masjid ini sebagai pusat komuniti yang penuh berkat.`,
      comments: 24,
      likes: 59,
    },
    {
      title: 'Masjid Al-A\'la: Memupuk Keharmonian dan Toleransi Agama',
      author: 'Dr. Harun Abdullah',
      date: '18 SEP 2023',
      imageUrl: 'https://picsum.photos/600/400?random=3',
      content: `Masjid Al-A'la telah memainkan peranan penting dalam memupuk keharmonian antara umat Islam dan agama-agama lain di kawasan sekitar. Dengan mengadakan pelbagai aktiviti interfaith, masjid ini telah menjadi simbol perpaduan dan toleransi. Aktiviti-aktiviti ini termasuk dialog antara agama, acara kemasyarakatan, dan program kebajikan yang melibatkan pelbagai pihak. Kejayaan ini menunjukkan bahawa masjid tidak hanya menjadi tempat ibadah, tetapi juga tempat untuk memperkukuhkan hubungan antara agama yang berbeza.
      Dalam masa depan, Masjid Al-A'la berhasrat untuk mengembangkan lebih banyak program yang menyokong keharmonian antara umat Islam dan masyarakat berbilang agama. Ini termasuk memperkenalkan lebih banyak inisiatif interfaith dan memperluas peranan masjid dalam membina jalinan persahabatan yang lebih kuat di kalangan komuniti pelbagai agama.`,
      comments: 35,
      likes: 82,
    },
    {
      title: 'Seni Bina Masjid Al-A\'la: Gabungan Tradisi dan Inovasi Moden',
      author: 'Arsitek Mustafa Azzam',
      date: '20 SEP 2023',
      imageUrl: 'https://picsum.photos/600/400?random=4',
      content: `Masjid Al-A'la adalah contoh sempurna gabungan seni bina tradisional dan moden. Rekaan masjid ini mencerminkan elemen-elemen klasik Islam, dengan kubah besar dan ukiran halus pada dinding, tetapi pada masa yang sama, ia juga menggabungkan kemudahan teknologi moden yang meningkatkan pengalaman pengunjung. Artikel ini akan mengupas lebih lanjut mengenai seni bina masjid yang menakjubkan ini, serta bagaimana elemen-elemen tradisional dan moden digabungkan untuk mencipta sebuah masjid yang unik dan ikonik. 
      Seni bina Masjid Al-A'la bukan sahaja memikat mata, tetapi juga memberi keselesaan kepada para pengunjungnya. Penggunaan teknologi dalam pembinaan masjid ini menunjukkan bagaimana inovasi moden boleh digabungkan dengan tradisi Islam untuk mencipta tempat ibadah yang sangat baik. Dengan ciri-ciri seperti pengudaraan yang baik, sistem audio yang canggih, dan ruang solat yang luas, masjid ini telah menjadi contoh terbaik gabungan seni bina Islam klasik dengan teknologi masa kini.`,
      comments: 50,
      likes: 95,
    },
    // Additional articles can follow the same structure
  ];

  selectedArticle: any = null;
  newComment: string = '';
  newReply: string = '';
  selectedCommentIndex: number | null = null;

  constructor() { }

  ngOnInit() { }

  // Function to select an article to display its full content
  selectArticle(item: any) {
    this.selectedArticle = item;
  }

  // Function to deselect an article and return to the news list
  deselectArticle() {
    this.selectedArticle = null;
  }

  // Add a new comment to the article
  addComment() {
    if (this.newComment.trim()) {
      this.selectedArticle.comments.push({
        user: 'Muhd Aiman', // Replace with a real user username
        text: this.newComment,
        imageUrl: 'https://picsum.photos/50/50?random=5' + Math.floor(Math.random() * 100),
        replies: []
      });
      this.selectedArticle.commentsCount++;
      this.newComment = '';
    }
  }

  // Add a reply to a specific comment
  addReply(commentIndex: number) {
    if (this.newReply.trim()) {
      const newReply = {
        user: 'Muhd Aiman', // Replace with a real user username
        text: this.newReply,
        imageUrl: 'https://picsum.photos/50/50?random=5' + Math.floor(Math.random() * 100)
      };
      this.selectedArticle.comments[commentIndex].replies.push(newReply);
      this.newReply = '';
      this.selectedCommentIndex = null;
    }
  }

  // Show reply input field for a comment
  showReplyInput(commentIndex: number) {
    this.selectedCommentIndex = commentIndex;
  }

  handleRefresh(event: CustomEvent) {
    setTimeout(() => {
      // Reload Page
      location.reload();
      (event.target as HTMLIonRefresherElement).complete();
    }, 2000);
  }
}