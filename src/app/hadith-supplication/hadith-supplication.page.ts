import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

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

@Component({
  selector: 'app-hadith-supplication',
  templateUrl: './hadith-supplication.page.html',
  styleUrls: ['./hadith-supplication.page.scss'],
})
export class HadithSupplicationPage implements OnInit {
  isLoading: boolean = false; // Added loading state

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

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadChapters();
    this.loadHadiths(); // Load initial Hadiths on page load
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
  }

  deselectHadith() {
    this.selectedHadith = null;
  }

  navigateHadith(direction: string) {
    const currentIndex = this.hadiths.indexOf(this.selectedHadith);
    if (direction === 'previous' && currentIndex > 0) {
      this.selectedHadith = this.hadiths[currentIndex - 1];
    } else if (direction === 'next' && currentIndex < this.hadiths.length - 1) {
      this.selectedHadith = this.hadiths[currentIndex + 1];
    }
  }

  handleRefresh(event: CustomEvent) {
    this.loadHadiths(); // Reload Hadiths from the API
    setTimeout(() => {
      (event.target as HTMLIonRefresherElement).complete();
    }, 1000);
  }
}
