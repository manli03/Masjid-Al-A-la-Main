import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';

// Define an interface for the Hadith data structure (optional, but good practice)
interface Hadith {
  id: number;
  hadith_number: string;
  status: string;
  nama_buku: string;
  penulis_buku: string;
  tajuk_hadith: string;
  perawi_melayu: string;
  english_text: string;
  malay_translation: string;
  arabic_text: string;
}

interface Chapter {
  id: number;
  chapterNumber: string;
  chapterEnglish: string;
  chapterUrdu: string;
  chapterArabic: string;
  bookSlug: string;
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
  selectedHadith: any = null;
  hadiths: Hadith[] = []; // Use the Hadith interface
  chapters: Chapter[] = [];
  selectedBook: string = 'Sahih Bukhari'; // Default book
  selectedChapter: string = '1'; // Default chapter
  hadithBookSlug: string = 'sahih-bukhari';

  BOOKS: BookDictionary = {
    'Sahih Bukhari': 'sahih-bukhari',
    'Sahih Muslim': 'sahih-muslim',
    "Jami' Al-Tirmidhi": 'al-tirmidhi',
    'Sunan Abu Dawood': 'abu-dawood',
    'Sunan Ibn-e-Majah': 'ibn-e-majah',
    'Sunan An-Nasa`i': 'sunan-nasai',
    'Mishkat Al-Masabih': 'mishkat',
    'Musnad Ahmad': 'musnad-ahmad',
    'Al-Silsila Sahiha': 'al-silsila-sahiha',
  };

  //Dua Properties
  duas: Dua[] = [];

  //Segment Properties
  selectedSegment: string = 'hadith';

  @ViewChild('hadithContent', { static: false }) hadithContent!: ElementRef;

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    this.loadChapters();
    this.loadHadiths(); // Load initial Hadiths on page load
    await this.loadCachedDuas(); // Load from cache first
    this.loadDuas(); // Load duas on page load/refresh
  }

  // Load chapters for the selected book
  loadChapters() {
    const chapterUrl = `https://raw.githubusercontent.com/manli03/hadith/refs/heads/main/chapter/${
      this.BOOKS[this.selectedBook]
    }.json`; // Dynamically create URL
    this.http.get<any>(chapterUrl).subscribe(
      (data) => {
        if (data.status === 200) {
          this.chapters = data.chapters;
        } else {
          console.error('Error loading chapters:', data.message);
          // Optionally display an error message to the user
        }
      },
      (error) => {
        console.error('Error loading chapters:', error);
        // Optionally display an error message to the user
      }
    );
  }

  // Load Hadiths based on the selected book and chapter
  loadHadiths() {
    this.isLoading = true; // Set loading to true when fetching data
    const bookSlug = this.BOOKS[this.selectedBook].replace('-', '_');

    const hadithUrl = `https://raw.githubusercontent.com/manli03/hadith/refs/heads/main/${bookSlug}/chapter_${this.selectedChapter}.json`; // Dynamically create URL
    this.http.get<any>(hadithUrl).subscribe(
      (data) => {
        if (data.status === 200) {
          this.hadiths = data.hadiths.data; // Access the 'data' array within 'hadiths'
          this.isLoading = false; // Set loading to false when data is loaded
        } else {
          this.isLoading = false; // Set loading to false when data is loaded
          console.error('Error loading hadiths:', data.message);
          this.hadiths = []; // Clear existing hadiths to avoid displaying old data
        }
      },
      (error) => {
        console.error('Error loading hadiths:', error);
        this.hadiths = []; // Clear existing hadiths
        this.isLoading = false; // Set loading to false on error
      }
    );
  }

  //Load Duas from API and save to storage
  async loadDuas() {
    try {
      const response = await this.http
        .get<Dua[]>(
          'https://cors-anywhere.herokuapp.com/https://doa-doa-api-ahmadramadhan.fly.dev/api'
        )
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
    this.selectedBook = event.target.value;
    this.loadChapters();
    this.loadHadiths();
  }

  // Update Hadiths when chapter selection changes
  onChapterChange(event: any) {
    this.selectedChapter = event.target.value;
    this.loadHadiths();
  }

  filteredHadiths() {
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
          .includes(this.searchText.toLowerCase())
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
    const currentIndex = this.hadiths.indexOf(this.selectedHadith);
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
