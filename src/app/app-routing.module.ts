import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./layout/tabs/tabs.module').then((m) => m.TabsPageModule),
  },
  // Send old announcement and account links to the active home screen.
  { path: 'prayertimes', redirectTo: '/tabs/prayer', pathMatch: 'full' },
  { path: 'announcement', redirectTo: '/tabs/home' },
  { path: 'settings', redirectTo: '/tabs/home' },
  { path: '**', redirectTo: '/tabs/home' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
