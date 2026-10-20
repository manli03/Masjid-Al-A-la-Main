import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { PrayerTimesService } from '../../services/prayer-times.service';

interface PrayerZone {
  code: string;
  name: string;
}

interface PrayerZoneGroup {
  state: string;
  zones: PrayerZone[];
}

@Component({
  selector: 'app-prayer-zone-selector',
  templateUrl: './prayer-zone-selector.component.html',
  styleUrls: ['./prayer-zone-selector.component.scss'],
})
export class PrayerZoneSelectorComponent implements OnInit {
  @Input() currentZoneCode = '';

  searchTerm = '';
  expandedState: string | null = null;
  zoneGroups: PrayerZoneGroup[] = [];

  private readonly stateZoneCodes: Record<string, string[]> = {
    Johor: ['jhr01', 'jhr02', 'jhr03', 'jhr04'],
    Kedah: ['kdh01', 'kdh02', 'kdh03', 'kdh04', 'kdh05', 'kdh06', 'kdh07'],
    Kelantan: ['ktn01', 'ktn03'],
    Melaka: ['mlk01'],
    'Negeri Sembilan': ['ngs01', 'ngs02'],
    Pahang: ['phg01', 'phg02', 'phg03', 'phg04', 'phg05', 'phg06'],
    Perlis: ['pls01'],
    'Pulau Pinang': ['png01'],
    Perak: ['prk01', 'prk02', 'prk03', 'prk04', 'prk05', 'prk06', 'prk07'],
    Sabah: ['sbh01', 'sbh02', 'sbh03', 'sbh04', 'sbh05', 'sbh06', 'sbh07', 'sbh08', 'sbh09'],
    Sarawak: ['swk01', 'swk02', 'swk03', 'swk04', 'swk05', 'swk06', 'swk07', 'swk08', 'swk09'],
    Selangor: ['sgr01', 'sgr02', 'sgr03'],
    Terengganu: ['trg01', 'trg02', 'trg03', 'trg04'],
    'Wilayah Persekutuan': ['wly01', 'wly02'],
  };

  constructor(
    private modalController: ModalController,
    private prayerTimesService: PrayerTimesService,
  ) {}

  ngOnInit(): void {
    this.currentZoneCode = this.currentZoneCode.toLowerCase();
    this.zoneGroups = Object.entries(this.stateZoneCodes).map(
      ([state, codes]) => ({
        state,
        zones: codes.map((code) => ({
          code,
          name: this.prayerTimesService.zoneNames[code],
        })),
      }),
    );
    this.expandedState =
      this.zoneGroups.find((group) =>
        group.zones.some((zone) => zone.code === this.currentZoneCode),
      )?.state ?? null;
  }

  get filteredGroups(): PrayerZoneGroup[] {
    const query = this.searchTerm.trim().toLocaleLowerCase('ms-MY');
    if (!query) return this.zoneGroups;

    return this.zoneGroups
      .map((group) => {
        const stateMatches = group.state.toLocaleLowerCase('ms-MY').includes(query);
        const zones = stateMatches
          ? group.zones
          : group.zones.filter((zone) =>
              zone.name.toLocaleLowerCase('ms-MY').includes(query),
            );
        return { ...group, zones };
      })
      .filter((group) => group.zones.length > 0);
  }

  get currentZoneName(): string {
    return this.prayerTimesService.zoneNames[this.currentZoneCode] ?? '';
  }

  onSearchInput(event: CustomEvent<{ value?: string | null }>): void {
    this.searchTerm = event.detail.value ?? '';
    const groups = this.filteredGroups;
    this.expandedState = groups.length === 1 ? groups[0].state : null;
  }

  toggleState(state: string): void {
    this.expandedState = this.expandedState === state ? null : state;
  }

  async chooseZone(zone: PrayerZone): Promise<void> {
    await this.modalController.dismiss({ zone }, 'selected');
  }

  async useCurrentLocation(): Promise<void> {
    await this.modalController.dismiss(undefined, 'current-location');
  }

  async close(): Promise<void> {
    await this.modalController.dismiss(undefined, 'cancel');
  }
}
