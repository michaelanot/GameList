// app.routes.ts
import { Routes } from '@angular/router';
import { GameTableComponent } from './vue/game-table.component';

export const routes: Routes = [
  { path: '', redirectTo: 'games', pathMatch: 'full' },
  { path: 'games', component: GameTableComponent },
  { path: 'games/new', loadComponent: () => import('./vue/game-upsert.component').then(m => m.GameUpsertComponent) },
  { path: 'games/:id', loadComponent: () => import('./vue/game-upsert.component').then(m => m.GameUpsertComponent) },
];
