import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { AlertController, Platform } from '@ionic/angular'; // Import AlertController
import { Router } from '@angular/router';

// Define an interface for the Hadith data structure (optional, but good practice)
interface Hadith {
  id: number;
  hadith_number: string;
  tajuk_hadith: string;
  perawi_melayu: string;
  english_text: string;
  arabic_text: string;
  malay_translation: string;
}

interface Chapter {
  id: number;
  english: string;
  malay: string;
}

interface BookMetadata {
  id: number;
  length: number;
  arabic: {
    title: string;
    author: string;
    introduction: string;
  };
  english: {
    title: string;
    author: string;
    introduction: string;
  };
  malay: {
    title: string;
    author: string;
    introduction: string;
  };
}

interface ChapterNamesResponse {
  id: number;
  metadata: BookMetadata;
  chapters: Chapter[];
}

interface BookDictionary {
  [key: string]: string;
}

interface Dua {
  id: string;
  doa: string;
  ayat: string;
  latin: string;
  artinya: string;
}

const DUA_STORAGE_KEY = 'my_duas'; // Key to store the duas in Preferences

@Component({
  selector: 'app-hadith-supplication',
  templateUrl: './hadith-supplication.page.html',
  styleUrls: ['./hadith-supplication.page.scss'],
})
export class HadithSupplicationPage implements OnInit {
  isLoading: boolean = false; // Added loading state

  //Hadith Properties
  searchText: string = '';
  selectedHadith: Hadith | null = null;
  hadiths: Hadith[] = []; // Use the Hadith interface
  chapters: Chapter[] = [];
  selectedBook: string = 'Sahih Bukhari'; // Default book
  selectedChapter: string = '1'; // Default chapter
  hadithBookSlug: string = 'bukhari';

  bookAuthor: string = ''; // Add this line

  BOOKS: BookDictionary = {
    'Sahih Bukhari': 'bukhari',
    'Sahih Muslim': 'muslim',
    "Jami' Al-Tirmidhi": 'tirmidhi',
    'Sunan Abu Dawood': 'abudawud',
    'Sunan Ibn-e-Majah': 'ibnmajah',
    'Sunan An-Nasa`i': 'nasai',
    'Muwatta Malik': 'malik',
    'Musnad Ahmad': 'ahmed',
    'Sunan ad-Darimi': 'darimi',
  };

  //Dua Properties
  duas: Dua[] = [];

  //Segment Properties
  selectedSegment: string = 'hadith';

  @ViewChild('hadithContent', { static: false }) hadithContent!: ElementRef;
  connected: boolean = false;
  backButtonSubscription: any;
  justDeselected: any;

  constructor(
    private http: HttpClient,
    private alertController: AlertController,
    private platform: Platform,
    private router: Router,
  ) {} //Inject AlertController

  async ngOnInit() {
    await this.checkNetworkConnection(); // Check network status on component initialization

    Network.addListener('networkStatusChange', (status) => {
      console.log('Network status changed', status);
      if (status.connected && !this.connected) {
        this.loadChapters();
        this.loadHadiths();
        this.loadCachedDuas();
      }
    });

    this.loadChapters();
    this.loadHadiths(); // Load initial Hadiths on page load
    await this.loadCachedDuas(); // Load from cache first
  }

  ionViewWillEnter() {
    // Back button logic
    this.backButtonSubscription =
      this.platform.backButton.subscribeWithPriority(10, () => {
        if (this.justDeselected) {
          // If we just deselected, consume this back press and reset the flag
          console.log('Consumed back press after deselection.');
          this.justDeselected = false;
          return; // Stop further processing in this handler
        }
        if (this.selectedHadith) {
          this.deselectHadith(); // Deselect the Hadith if it's selected
          this.justDeselected = true; // Set the flag
        } else {
          this.router.navigateByUrl('/tabs/home');
        }
      });
  }

  ionViewWillLeave() {
    // Unsubscribe to avoid multiple subscriptions when entering the announcement page
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
      this.backButtonSubscription = null;
    }
  }

  ngOnDestroy() {
    // Clean up subscription to prevent memory leaks
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
  }

  //Check Network Connection
  async checkNetworkConnection() {
    const status = await Network.getStatus();
    if (!status.connected) {
      this.connected = false;
      this.showNetworkAlert();
    } else {
      this.connected = true;
    }
  }

  // Show Alert
  async showNetworkAlert() {
    const alert = await this.alertController.create({
      header: 'Tiada Sambungan Internet',
      message:
        'Sila hidupkan sambungan internet anda untuk menggunakan aplikasi ini sepenuhnya.',
      buttons: ['OK'],
    });

    await alert.present();
  }

  // Load chapters for the selected book
  loadChapters() {
    const bookSlug = this.BOOKS[this.selectedBook];
    const chapterUrl = `https://raw.githubusercontent.com/manli03/hadith/refs/heads/main/hadiths/${bookSlug}/chapter_names.json`; // Dynamically create URL

    this.http.get<ChapterNamesResponse>(chapterUrl).subscribe(
      (data) => {
        if (data) {
          this.chapters = data.chapters;
          this.bookAuthor = data.metadata.english.author; //Get Author
        } else {
          console.error('Error loading chapters: Invalid data format');
          this.chapters = [];
          this.bookAuthor = '';
        }
      },
      (error) => {
        console.error('Error loading chapters:', error);
        this.chapters = []; // Clear existing chapters
        this.bookAuthor = '';
      },
    );
  }

  // Load Hadiths based on the selected book and chapter
  loadHadiths() {
    this.isLoading = true; // Set loading to true when fetching data
    const bookSlug = this.BOOKS[this.selectedBook];
    const hadithUrl = `https://raw.githubusercontent.com/manli03/hadith/refs/heads/main/hadiths/${bookSlug}/chapter_${this.selectedChapter}.json`; // Dynamically create URL

    this.http.get<Hadith[]>(hadithUrl).subscribe(
      (data) => {
        if (data) {
          this.hadiths = data; // Assign the data directly as it's already an array of Hadith
          this.isLoading = false; // Set loading to false when data is loaded
        } else {
          this.isLoading = false; // Set loading to false when data is loaded
          console.error('Error loading hadiths: Invalid data format');
          this.hadiths = []; // Clear existing hadiths to avoid displaying old data
        }
      },
      (error) => {
        console.error('Error loading hadiths:', error);
        this.hadiths = []; // Clear existing hadiths
        this.isLoading = false; // Set loading to false on error
      },
    );
  }

  //Load Duas from API and save to storage
  async loadDuas() {
    try {
      const response = await this.http
        .get<
          Dua[]
        >('https://raw.githubusercontent.com/manli03/hadith/refs/heads/main/doa.json')
        .toPromise();

      if (response) {
        this.duas = response;
        await this.cacheDuas(response); // Save to Preferences
      } else {
        console.error('No duas received from API.');
      }
    } catch (error) {
      console.error('Error loading duas:', error);
      // Optionally, display a user-friendly error message
    }
  }

  // Load Duas from Capacitor Preferences (local storage)
  async loadCachedDuas() {
    try {
      const ret = await Preferences.get({ key: DUA_STORAGE_KEY });
      const storedDuas = ret.value;

      if (storedDuas) {
        this.duas = JSON.parse(storedDuas);
        console.log('Duas loaded from cache.');
      } else {
        this.loadDuas(); // Load duas from the API if not found in cache
        console.log('No duas found in cache.');
      }
    } catch (error) {
      console.error('Error loading duas from cache:', error);
    }
  }

  // Save Duas to Capacitor Preferences
  async cacheDuas(duas: Dua[]) {
    try {
      await Preferences.set({
        key: DUA_STORAGE_KEY,
        value: JSON.stringify(duas),
      });
      console.log('Duas cached successfully.');
    } catch (error) {
      console.error('Error caching duas:', error);
    }
  }

  getBookKeys(): string[] {
    return Object.keys(this.BOOKS);
  }

  // Update Hadiths when book selection changes
  onBookChange(event: any) {
    this.checkNetworkConnection(); // Check network status when book changes
    this.selectedBook = event.target.value;
    this.selectedChapter = '1'; // Reset chapter to default when book changes
    this.loadChapters();
    this.loadHadiths();
  }

  // Update Hadiths when chapter selection changes
  onChapterChange(event: any) {
    this.checkNetworkConnection(); // Check network status when chapter changes
    this.selectedChapter = event.target.value;
    this.loadHadiths();
  }

  filteredHadiths(): Hadith[] {
    if (!this.searchText) {
      return this.hadiths;
    }
    return this.hadiths.filter(
      (hadith) =>
        hadith.tajuk_hadith
          .toLowerCase()
          .includes(this.searchText.toLowerCase()) ||
        hadith.malay_translation
          .toLowerCase()
          .includes(this.searchText.toLowerCase()),
    );
  }

  selectHadith(hadith: Hadith) {
    // Use the Hadith interface
    this.selectedHadith = hadith;

    if (this.hadithContent) {
      this.hadithContent.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }

  deselectHadith() {
    this.selectedHadith = null;
  }

  navigateHadith(direction: string) {
    const currentIndex = this.hadiths.indexOf(this.selectedHadith!);
    let newIndex: number;

    if (direction === 'previous') {
      newIndex = currentIndex - 1;
      if (newIndex >= 0) {
        this.selectedHadith = this.hadiths[newIndex];
      }
    } else if (direction === 'next') {
      newIndex = currentIndex + 1;
      if (newIndex < this.hadiths.length) {
        this.selectedHadith = this.hadiths[newIndex];
      }
    }

    // Reset scroll position after navigating to a new Hadith
    if (this.hadithContent) {
      this.hadithContent.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }

  async handleRefresh(event: CustomEvent) {
    if (this.selectedSegment === 'hadith') {
      this.loadHadiths(); // Reload Hadiths from the API
    } else if (this.selectedSegment === 'doa') {
      await this.loadDuas(); // Reload Duas from the API and refresh cache
    }
    setTimeout(() => {
      (event.target as HTMLIonRefresherElement).complete();
    }, 1000);
  }

  segmentChanged(ev: any) {
    // console.log('Segment changed', ev);
    this.selectedSegment = ev.detail.value;
  }

  hasPreviousHadith(): boolean {
    if (!this.selectedHadith) {
      return false;
    }
    const currentIndex = this.hadiths.indexOf(this.selectedHadith);
    return currentIndex > 0;
  }

  hasNextHadith(): boolean {
    if (!this.selectedHadith) {
      return false;
    }
    const currentIndex = this.hadiths.indexOf(this.selectedHadith);
    return currentIndex < this.hadiths.length - 1;
  }
}
