import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { authGuard } from '../services/auth.guard';  // Import the authGuard function

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () => import('../home/home.module').then(m => m.HomePageModule)
      },
      {
        path: 'prayerTimes',
        loadChildren: () => import('../prayerTimes/prayerTimes.module').then(m => m.prayerTimesPageModule)
      },
      {
        path: 'announcement',
        loadChildren: () => import('../announcement/announcement.module').then(m => m.announcementPageModule),
        canActivate: [authGuard]  // Use the authGuard function to protect this route
      },
      {
        path: 'hadithSupplication',
        loadChildren: () => import('../hadith-supplication/hadith-supplication.module').then(m => m.HadithSupplicationPageModule)
      },
      {
        path: 'profile',
        loadChildren: () => import('../profile/profile.module').then(m => m.ProfilePageModule),
        canActivate: [authGuard]
      },
      {
        path: 'authentication',
        loadChildren: () => import('../authentication/authentication.module').then(m => m.AuthenticationPageModule)
      },
      {
        path: 'forgot-password',
        loadChildren: () => import('../forgot-password/forgot-password.module').then(m => m.ForgotPasswordPageModule)
      },
      {
        path: 'bridge-login',
        loadChildren: () => import('../bridge-login/bridge-login.module').then(m => m.BridgeLoginPageModule)
      },
      {
        path: 'manage-announcement',
        loadChildren: () => import('../manage-announcement/manage-announcement.module').then(m => m.ManageAnnouncementPageModule),
        canActivate: [authGuard]
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule { }
