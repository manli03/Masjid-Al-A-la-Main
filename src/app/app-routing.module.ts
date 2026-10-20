import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./layout/tabs/tabs.module').then((m) => m.TabsPageModule),
  },
  {
    path: 'announcement',
    loadChildren: () =>
      import('./features/announcements/pages/announcement/announcement.module').then(
        (m) => m.announcementPageModule,
      ),
  },
  {
    path: 'settings',
    loadChildren: () =>
      import('./features/account/pages/settings/settings.module').then((m) => m.SettingsPageModule),
    canActivate: [authGuard],
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
