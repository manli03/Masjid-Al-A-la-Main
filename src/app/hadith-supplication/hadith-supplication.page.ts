import { Component } from '@angular/core';

@Component({
  selector: 'app-hadith-supplication',
  templateUrl: './hadith-supplication.page.html',
  styleUrls: ['./hadith-supplication.page.scss'],
})
export class HadithSupplicationPage {

  constructor() { }

  searchText: string = '';  // The search text input
  selectedHadith: any = null;  // Store the selected Hadith for detail view

  hadiths = [
    {
      number: 1,
      title: 'Soalan dan Perselisihan',
      arabicText: 'حَدَّثَنَا أَبُو عَبْدِ اللَّهِ... فَإِذَا حَدَّثْتُكُمْ فَخُذُوا عَنِّي...',
      malayText: 'Abu Hurairah meriwayatkan bahawa: "Rasulullah ﷺ berkata: \'Jangan tanya kepada saya perkara-perkara kecil yang saya tinggalkan. Sesungguhnya umat-umat sebelum kamu binasa kerana banyak bertanya dan perselisihan dengan nabi mereka. Jika saya suruh kamu lakukan sesuatu, lakukanlah apa yang kamu mampu, dan jika saya larang sesuatu, jauhilah.\'"',
      tags: '#sahih #al_bukhari',
      narrator: 'Diriwayatkan oleh Bukhari'
    },
    {
      number: 2,
      title: 'Niat dan Amal',
      arabicText: 'حَدَّثَنَا عَمْرُو بْنُ حَرْمَلَةَ... إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
      malayText: 'Umar bin Al-Khattab meriwayatkan bahawa Rasulullah ﷺ bersabda: "Sesungguhnya amal itu bergantung kepada niat, dan setiap orang akan mendapat apa yang dia niatkan."',
      tags: '#sahih #muslim',
      narrator: 'Diriwayatkan oleh Muslim'
    },
    {
      number: 3,
      title: 'Keutamaan Menuntut Ilmu',
      arabicText: 'حَدَّثَنَا يَحْيَىٰ... سَافِرُوا وَيُجَاهِدُوا فِي سَبِيلِ اللَّهِ',
      malayText: 'Rasulullah ﷺ bersabda: "Menuntut ilmu adalah wajib bagi setiap Muslim, baik lelaki atau perempuan."',
      tags: '#sahih #ibn_majah',
      narrator: 'Diriwayatkan oleh Ibn Majah'
    },
    {
      number: 4,
      title: 'Akhlak yang Baik',
      arabicText: 'حَدَّثَنَا أَبُو هُرَيْرَةَ... إِنَّمَا بُعِثْتُ لِأُتَمِّمَ صَالِحَ الْأَخْلَاقِ',
      malayText: 'Abu Hurairah meriwayatkan bahawa Rasulullah ﷺ bersabda: "Sesungguhnya aku diutus untuk menyempurnakan akhlak yang baik."',
      tags: '#sahih #al_bukhari',
      narrator: 'Diriwayatkan oleh Bukhari'
    },
    {
      number: 5,
      title: 'Puasa dan Pahala',
      arabicText: 'حَدَّثَنَا أَبُو هُرَيْرَةَ... لِصَائِمٍ فَرْحَتَانِ',
      malayText: 'Rasulullah ﷺ bersabda: "Bagi orang yang berpuasa ada dua kegembiraan, satu ketika berbuka dan satu lagi ketika bertemu dengan Tuhannya."',
      tags: '#sahih #muslim',
      narrator: 'Diriwayatkan oleh Muslim'
    }
  ];

  // Filter Hadiths based on the search text
  filteredHadiths() {
    if (!this.searchText) {
      return this.hadiths;
    }
    return this.hadiths.filter(hadith => hadith.title.toLowerCase().includes(this.searchText.toLowerCase()));
  }

  // Set the selected Hadith for the detailed view
  selectHadith(hadith: any) {
    this.selectedHadith = hadith;
  }

  // Deselect the selected Hadith and return to the list
  deselectHadith() {
    this.selectedHadith = null;
  }

  // Navigate between Hadiths (Next or Previous)
  navigateHadith(direction: string) {
    const currentIndex = this.hadiths.indexOf(this.selectedHadith);
    if (direction === 'previous' && currentIndex > 0) {
      this.selectedHadith = this.hadiths[currentIndex - 1];
    } else if (direction === 'next' && currentIndex < this.hadiths.length - 1) {
      this.selectedHadith = this.hadiths[currentIndex + 1];
    }
  }

  handleRefresh(event: CustomEvent) {
    setTimeout(() => {
      // Reload Page
      location.reload();
      (event.target as HTMLIonRefresherElement).complete();
    }, 2000);
  }
}
