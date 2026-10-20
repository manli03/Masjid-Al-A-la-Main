import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () =>
          import('../../features/home/home.module').then((m) => m.HomePageModule),
      },
      {
        path: 'prayer',
        loadChildren: () =>
          import('../../features/prayer/pages/prayer/prayer.module').then(
            (m) => m.PrayerPageModule,
          ),
      },
      {
        path: 'hadithSupplication',
        loadChildren: () =>
          import('../../features/hadith-supplication/hadith-supplication.module').then(
            (m) => m.HadithSupplicationPageModule,
          ),
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full',
      },
      { path: '**', redirectTo: '/tabs/home' },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
