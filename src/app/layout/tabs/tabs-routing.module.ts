import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { authGuard } from '../../core/auth/auth.guard'; // Import the authGuard function

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
        path: 'announcement-loading',
        loadChildren: () =>
          import('../../features/announcements/pages/announcement-loading/announcement-loading.module').then(
            (m) => m.AnnouncementLoadingPageModule,
          ),
      },
      {
        path: 'announcement',
        loadChildren: () =>
          import('../../features/announcements/pages/announcement/announcement.module').then(
            (m) => m.announcementPageModule,
          ),
        canActivate: [authGuard], // Keep the authGuard for additional protection
      },
      {
        path: 'hadithSupplication',
        loadChildren: () =>
          import('../../features/hadith-supplication/hadith-supplication.module').then(
            (m) => m.HadithSupplicationPageModule,
          ),
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('../../features/account/pages/profile/profile.module').then((m) => m.ProfilePageModule),
        canActivate: [authGuard],
      },
      {
        path: 'authentication',
        loadChildren: () =>
          import('../../features/authentication/authentication.module').then(
            (m) => m.AuthenticationPageModule,
          ),
      },
      {
        path: 'manage-announcement',
        loadChildren: () =>
          import('../../features/announcements/pages/manage-announcement/manage-announcement.module').then(
            (m) => m.ManageAnnouncementPageModule,
          ),
        canActivate: [authGuard],
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full',
      },
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
