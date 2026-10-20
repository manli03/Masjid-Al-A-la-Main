import { Component, OnInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { toPng } from 'html-to-image';
import { AlertController, IonContent, IonSearchbar, Platform } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
// Import Capacitor Haptics
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Define all interfaces used in the component
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

interface Zikir {
  id: number;
  arabic: string;
  latin: string;
  translation: string;
}

const DUA_STORAGE_KEY = 'my_duas'; // Key to store the duas in Preferences
const ZIKIR_LIST_STORAGE_KEY = 'zikir_list';
const SELECTED_ZIKIR_ID_KEY = 'selected_zikir_id';
const API_BASE_URL = 'https://oc-manli.duckdns.org/amalan';

@Component({
  selector: 'app-hadith-supplication',
  templateUrl: './hadith-supplication.page.html',
  styleUrls: ['./hadith-supplication.page.scss'],
})
export class HadithSupplicationPage implements OnInit {
  isHadithDetailLoading: boolean = false; // For the single hadith view loader
  isListLoading: boolean = false; // For the skeleton loaders on Hadith and Doa lists

  //Hadith Properties
  searchText: string = '';
  doaSearchText = '';
  selectedHadith: Hadith | null = null;
  arabicFontSize = 20;
  hadithCopied = false;
  private copyResetTimer?: ReturnType<typeof setTimeout>;
  isSharingImage = false;

  private resetCopyState() {
    clearTimeout(this.copyResetTimer);
    this.hadithCopied = false;
  }
  readonly arabicPreviewHeight = 220;
  arabicTextHeight = 220;
  arabicOverflows = false;
  arabicExpanded = false;
  showHadithHeaderTitle = false;
  private arabicResizeObserver?: ResizeObserver;
  @ViewChild(IonContent) pageContent?: IonContent;
  @ViewChild('detailTitle') detailTitle?: ElementRef<HTMLElement>;
  @ViewChild('arabicText') set arabicTextElement(element: ElementRef<HTMLElement> | undefined) {
    this.arabicResizeObserver?.disconnect();
    if (!element) return;
    this.arabicResizeObserver = new ResizeObserver(() => {
      this.zone.run(() => {
        this.arabicTextHeight = element.nativeElement.scrollHeight;
        this.arabicOverflows = this.arabicTextHeight > this.arabicPreviewHeight + 1;
      });
    });
    this.arabicResizeObserver.observe(element.nativeElement);
  }

  onDetailScroll(event: CustomEvent<{ scrollTop: number }>) {
    if (!this.selectedHadith || !this.detailTitle) return;
    const title = this.detailTitle.nativeElement;
    const threshold = title.offsetTop + title.offsetHeight;
    const position = event.detail.scrollTop;
    if (position > threshold) this.showHadithHeaderTitle = true;
    else if (position <= Math.max(8, threshold - 24)) this.showHadithHeaderTitle = false;
  }

  adjustArabicFontSize(change: number) {
    this.arabicFontSize = Math.max(16, Math.min(36, this.arabicFontSize + change));
  }

  private get hadithShareText(): string {
    const hadith = this.selectedHadith;
    if (!hadith) return '';
    return `${this.selectedBook} · Hadis ${hadith.hadith_number}\n${hadith.tajuk_hadith}\n\n${hadith.arabic_text}\n\n${hadith.perawi_melayu}\n\n${hadith.malay_translation}`;
  }

  async copyHadith() {
    if (!this.selectedHadith) return;
    const copiedHadith = this.selectedHadith;
    try {
      await Clipboard.write({ string: this.hadithShareText });
      if (this.selectedHadith !== copiedHadith) return;
      this.resetCopyState();
      this.hadithCopied = true;
      this.copyResetTimer = setTimeout(() => this.hadithCopied = false, 2000);
    } catch {
      const alert = await this.alertController.create({
        header: 'Tidak dapat menyalin hadis',
        message: 'Sila cuba lagi.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  async shareHadith() {
    if (!this.selectedHadith) return;
    const hadith = this.selectedHadith;
    await this.shareAsImage(hadith.tajuk_hadith, `${this.selectedBook} · Hadis ${hadith.hadith_number}`,
      hadith.arabic_text, [hadith.perawi_melayu, hadith.malay_translation], 'Hadis');
  }

  async shareDoa(doa: Dua) {
    await this.shareAsImage(doa.doa, 'Doa', doa.ayat, [doa.latin, doa.artinya], 'Doa');
  }

  private async shareAsImage(title: string, source: string, arabic: string, paragraphs: string[], category: 'Hadis' | 'Doa') {
    if (this.isSharingImage) return;
    // Resolve the active page palette before rendering outside the component.
    const pageStyles = getComputedStyle(this.hostElement.nativeElement);
    const palette = {
      background: pageStyles.getPropertyValue('--amalan-background').trim(),
      text: pageStyles.getPropertyValue('--amalan-ink').trim(),
      muted: pageStyles.getPropertyValue('--amalan-muted').trim(),
      border: pageStyles.getPropertyValue('--amalan-border').trim(),
    };
    this.isSharingImage = true;
    const card = document.createElement('article');
    // Render the full text separately so collapsed Arabic and screen controls never appear in the image.
    card.style.cssText = `position:fixed;left:-10000px;top:0;width:720px;box-sizing:border-box;padding:44px;background:${palette.background};color:${palette.text};font-family:Arial,sans-serif;`;
    const addText = (tag: string, value: string, styles: string, language = 'ms') => {
      const element = document.createElement(tag);
      element.textContent = value;
      element.lang = language;
      element.style.cssText = `margin:0;color:${palette.text};overflow-wrap:anywhere;white-space:pre-wrap;${styles}`;
      card.appendChild(element);
      return element;
    };
    if (category === 'Hadis') {
      addText('p', source, `font-size:20px;line-height:1.5;color:${palette.muted};margin-bottom:12px;`);
    }
    addText('h1', title, 'font-size:32px;line-height:1.35;font-weight:700;margin-bottom:32px;');
    const arabicElement = addText('p', arabic, 'font-size:30px;line-height:1.9;text-align:right;margin-bottom:30px;', 'ar');
    arabicElement.dir = 'rtl';
    paragraphs.filter(Boolean).forEach(paragraph =>
      addText('p', paragraph, 'font-size:23px;line-height:1.65;margin-bottom:22px;'),
    );
    addText('p', `${category} · Masjid Al-A’la`, `font-size:18px;line-height:1.5;color:${palette.muted};border-top:1px solid ${palette.border};padding-top:22px;margin-top:12px;`);
    document.body.appendChild(card);
    try {
      await document.fonts.ready;
      const dataUrl = await toPng(card, { pixelRatio: 2, backgroundColor: palette.background,
        style: { position: 'static', left: 'auto', top: 'auto' } });
      const filename = `${category.toLowerCase()}-${Date.now()}.png`;
      if (Capacitor.isNativePlatform()) {
        const saved = await Filesystem.writeFile({ path: filename, data: dataUrl, directory: Directory.Cache });
        await Share.share({ title, files: [saved.uri], dialogTitle: 'Kongsi imej' });
      } else {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ title, files: [file] });
            return;
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') return;
            // Browsers may lose share permission while generating the image. Offer the PNG download.
          }
        }
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/cancel|dismiss|abort/i.test(message)) {
        const alert = await this.alertController.create({
          header: 'Tidak dapat berkongsi imej', message: 'Sila cuba lagi.', buttons: ['OK'],
        });
        await alert.present();
      }
    } finally {
      card.remove();
      this.isSharingImage = false;
    }
  }
  hadiths: Hadith[] = []; // Use the Hadith interface
  chapters: Chapter[] = [];
  selectedBook: string = 'Sahih Bukhari'; // Default book
  selectedChapter: string = '1'; // Default chapter
  hadithBookSlug: string = 'bukhari';
  bookAuthor: string = '';

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
  isAtTop = true;
  showTabs = true;
  showSearch = false;
  private sectionScrollPositions: Record<string, number> = {};
  private scrollDirection = 0;
  private scrollDistance = 0;
  @ViewChild('amalanSearch') amalanSearch?: IonSearchbar;

  get activeSearchText(): string {
    return this.selectedSegment === 'doa' ? this.doaSearchText : this.searchText;
  }

  set activeSearchText(value: string) {
    if (this.selectedSegment === 'doa') this.doaSearchText = value;
    else this.searchText = value;
  }

  get currentPageTitle(): string {
    return this.selectedSegment === 'hadith' ? 'Hadis' :
      this.selectedSegment === 'doa' ? 'Doa' : 'Tasbih';
  }

  onSectionScroll(event: Event, section: string) {
    const scroller = event.target as HTMLElement;
    // Clamp elastic overscroll so bouncing at either edge cannot reveal the tabs.
    const position = Math.max(0, Math.min(scroller.scrollTop, scroller.scrollHeight - scroller.clientHeight));
    const previous = this.sectionScrollPositions[section] ?? 0;
    this.sectionScrollPositions[section] = position;
    if (section !== this.selectedSegment) return;

    this.isAtTop = position <= 8;
    if (this.isAtTop) {
      this.showTabs = true;
      this.scrollDistance = 0;
      this.scrollDirection = 0;
      return;
    }

    const delta = position - previous;
    if (Math.abs(delta) < 1) return;
    const direction = Math.sign(delta);
    if (direction !== this.scrollDirection) {
      this.scrollDirection = direction;
      this.scrollDistance = 0;
    }
    this.scrollDistance += Math.abs(delta);
    if (direction > 0 && this.scrollDistance >= 12) this.showTabs = false;
    if (direction < 0 && this.scrollDistance >= 48) this.showTabs = true;
  }

  toggleSearch() {
    if (this.showSearch) {
      this.closeSearch();
      return;
    }
    this.showSearch = true;
    setTimeout(() => {
      if (this.showSearch) this.amalanSearch?.setFocus();
    });
  }

  closeSearch() {
    this.amalanSearch?.getInputElement().then(input => input.blur());
    this.showSearch = false;
    this.searchText = '';
    this.doaSearchText = '';
  }

  // Tasbih Properties
  tasbihCount: number = 0;
  totalTasbihCount: number = 0;
  tasbihLimit: number = 33;
  allZikirs: Zikir[] = [];
  selectedZikir: Zikir | null = null;
  zikirRounds: number = 0; // Track how many rounds completed for current zikir

  get currentZikir(): string {
    return this.selectedZikir?.arabic || 'Pilih Zikir';
  }

  @ViewChild('hadithContent', { static: false }) hadithContent!: ElementRef;
  connected: boolean = false;
  backButtonSubscription: any;
  justDeselected: any;

  constructor(
    private http: HttpClient,
    private alertController: AlertController,
    private platform: Platform,
    private router: Router,
    private route: ActivatedRoute,
    private zone: NgZone,
    private hostElement: ElementRef<HTMLElement>,
  ) {}

  async ngOnInit() {
    await this.checkNetworkConnection(); // Check network status on component initialization

    Network.addListener('networkStatusChange', (status) => {
      console.log('Network status changed', status);
      if (status.connected && !this.connected) {
        this.loadChapters();
        this.loadHadiths();
        this.loadCachedDuas();
        this.loadZikirs();
      }
    });

    this.loadChapters();
    this.loadHadiths(); // Load initial Hadiths on page load
    await this.loadCachedDuas(); // Load from cache first
    await this.loadZikirs(); // Load Zikirs from cache or API
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

  ionViewDidEnter() {
    window.dispatchEvent(
      new CustomEvent('pageLoaded', {
        detail: { loaded: true },
        bubbles: true,
        composed: true,
      }),
    );
  }

  ionViewWillLeave() {
    // Unsubscribe to avoid multiple subscriptions when entering the announcement page
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
      this.backButtonSubscription = null;
    }
  }

  ngOnDestroy() {
    this.resetCopyState();
    this.arabicResizeObserver?.disconnect();
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
    const chapterUrl = `${API_BASE_URL}/hadiths/${bookSlug}/chapter_names.json`; // Dynamically create URL

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
    this.isListLoading = true;
    const bookSlug = this.BOOKS[this.selectedBook];
    const hadithUrl = `${API_BASE_URL}/hadiths/${bookSlug}/chapter_${this.selectedChapter}.json`; // Dynamically create URL

    this.http.get<Hadith[]>(hadithUrl).subscribe(
      (data) => {
        if (data) {
          this.hadiths = data;
        } else {
          console.error('Error loading hadiths: Invalid data format');
          this.hadiths = [];
        }
        this.isListLoading = false;
      },
      (error) => {
        console.error('Error loading hadiths:', error);
        this.hadiths = [];
        this.isListLoading = false;
      },
    );
  }

  //Load Duas from API and save to storage
  async loadDuas() {
    try {
      // 1. Check network status
      const status = await Network.getStatus();
      let fetched = false;
      if (status.connected) {
        // 2. Try to fetch from API if online
        const doaUrl = `${API_BASE_URL}/doa.json`;
        try {
          const response = await this.http.get<Dua[]>(doaUrl).toPromise();
          if (response) {
            this.duas = response;
            // Always update the cache with latest from API
            await Preferences.set({
              key: DUA_STORAGE_KEY,
              value: JSON.stringify(response),
            });
            console.log('Duas fetched from API and cached.');
            fetched = true;
          }
        } catch (apiError) {
          console.error('Error fetching duas from API:', apiError);
        }
      }
      if (!fetched) {
        // 3. Fallback: Try to load from cache
        const cached = await Preferences.get({ key: DUA_STORAGE_KEY });
        if (cached.value) {
          this.duas = JSON.parse(cached.value);
          console.log('Duas loaded from cache.');
        } else {
          this.duas = [];
          console.warn('No duas found in cache.');
        }
      }
    } catch (error) {
      console.error('Error loading duas:', error);
      this.duas = [];
    }
  }

  // Load Duas from Capacitor Preferences (local storage)
  async loadCachedDuas() {
    await this.loadDuas();
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

  filteredDuas(): Dua[] {
    const query = this.doaSearchText.trim().toLocaleLowerCase();
    if (!query) return this.duas;
    return this.duas.filter(doa =>
      [doa.doa, doa.ayat, doa.latin, doa.artinya].some(text =>
        (text || '').toLocaleLowerCase().includes(query),
      ),
    );
  }

  selectHadith(hadith: Hadith) {
    this.arabicExpanded = false;
    this.showHadithHeaderTitle = false;
    this.resetCopyState();
    // Use the Hadith interface
    this.selectedHadith = hadith;

    // Add query param to indicate detail view
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { detail: 'true' },
      queryParamsHandling: 'merge',
    });

    if (this.hadithContent) {
      this.hadithContent.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }

  deselectHadith() {
    this.resetCopyState();
    this.showHadithHeaderTitle = false;
    this.arabicExpanded = false;
    this.selectedHadith = null;
    // The segment view is recreated when leaving a detail, starting at the top.
    this.sectionScrollPositions = {};
    this.isAtTop = true;
    this.showTabs = true;
    this.scrollDirection = 0;
    this.scrollDistance = 0;
    // Remove query param when deselecting
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { detail: null },
      queryParamsHandling: 'merge',
    });
  }

  navigateHadith(direction: string) {
    this.arabicExpanded = false;
    this.showHadithHeaderTitle = false;
    this.resetCopyState();
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

    // Reset before the next title can be promoted into the header.
    void this.pageContent?.scrollToTop(0);
  }

  segmentChanged(ev: any) {
    if (ev.detail.value !== this.selectedSegment) this.closeSearch();
    this.selectedSegment = ev.detail.value;
    this.isAtTop = (this.sectionScrollPositions[this.selectedSegment] ?? 0) <= 8;
    this.showTabs = true;
    this.scrollDirection = 0;
    this.scrollDistance = 0;
    // If we switch to 'doa' and the list is empty, trigger a load
    if (this.selectedSegment === 'doa' && this.duas.length === 0) {
      this.loadCachedDuas();
    }
    // If we switch to 'hadith' and list is empty, trigger load
    if (this.selectedSegment === 'hadith' && this.hadiths.length === 0) {
      this.loadHadiths();
    }
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

  // Method to load Zikirs (from cache or API)
  async loadZikirs() {
    try {
      // 1. Check network status
      const status = await Network.getStatus();
      let fetched = false;
      if (status.connected) {
        // 2. Try to fetch from API if online
        const zikirUrl =
          `${API_BASE_URL}/zikir.json`;
        try {
          const response = await this.http.get<Zikir[]>(zikirUrl).toPromise();
          if (response) {
            this.allZikirs = response;
            // Always update the cache with latest from API
            await Preferences.set({
              key: ZIKIR_LIST_STORAGE_KEY,
              value: JSON.stringify(response),
            });
            console.log('Zikirs fetched from API and cached.');
            fetched = true;
          }
        } catch (apiError) {
          console.error('Error fetching zikirs from API:', apiError);
        }
      }
      if (!fetched) {
        // 3. Fallback: Try to load from cache
        const cached = await Preferences.get({ key: ZIKIR_LIST_STORAGE_KEY });
        if (cached.value) {
          this.allZikirs = JSON.parse(cached.value);
          console.log('Zikirs loaded from cache.');
        } else {
          this.allZikirs = [];
          console.warn('No zikirs found in cache.');
        }
      }
      // 4. Set the selected Zikir
      await this.loadSelectedZikirPreference();
    } catch (error) {
      console.error('Error loading zikirs:', error);
      this.allZikirs = []; // Ensure it's an empty array on error
    }
  }

  // Method to load the user's last selected Zikir from Preferences
  async loadSelectedZikirPreference() {
    const { value } = await Preferences.get({ key: SELECTED_ZIKIR_ID_KEY });
    const selectedId = value ? parseInt(value, 10) : null;

    if (selectedId) {
      this.selectedZikir =
        this.allZikirs.find((z) => z.id === selectedId) || null;
    }

    // If no preference is found or the saved one is invalid, default to the first zikir in the list
    if (!this.selectedZikir && this.allZikirs.length > 0) {
      this.selectedZikir = this.allZikirs[0];
    }
  }

  // Method to handle when the user selects a new Zikir
  async onZikirChange(event: any) {
    const newZikirId = event.detail.value;
    const newZikir = this.allZikirs.find((z) => z.id === newZikirId);

    if (newZikir) {
      this.selectedZikir = newZikir;
      this.tasbihCount = 0; // Reset counter when zikir changes
      this.zikirRounds = 0; // Reset rounds when zikir changes
      // Save the user's choice to preferences
      await Preferences.set({
        key: SELECTED_ZIKIR_ID_KEY,
        value: newZikirId.toString(),
      });
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  }

  // --- Tasbih Methods ---
  async incrementTasbih() {
    if (!this.tasbihLimit || this.tasbihLimit <= 0 || !this.selectedZikir) {
      return;
    }

    this.tasbihCount++;
    this.totalTasbihCount++;

    if (this.tasbihCount >= this.tasbihLimit) {
      await Haptics.vibrate(); // Vibrate heavily to signify round completion
      this.tasbihCount = 0;
      this.zikirRounds++; // Increment round count
    } else {
      await Haptics.impact({ style: ImpactStyle.Light }); // Light vibration for a regular tap
    }
  }

  async resetTasbih() {
    // Heavy vibrate for a reset action
    await Haptics.vibrate();
    this.tasbihCount = 0;
    this.totalTasbihCount = 0;
    this.zikirRounds = 0; // Reset rounds on reset
  }

  // Method to increment the zikir limit
  async incrementLimit() {
    await Haptics.impact({ style: ImpactStyle.Light }); // Simple vibration for spinner controls
    this.tasbihLimit++;
  }

  // Method to decrement the zikir limit, with a minimum of 1
  async decrementLimit() {
    if (this.tasbihLimit > 1) {
      await Haptics.impact({ style: ImpactStyle.Light }); // Simple vibration for spinner controls
      this.tasbihLimit--;
    }
  }
}
