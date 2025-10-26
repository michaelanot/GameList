// src/app/games/game-table.component.ts
import { Component, ViewChild, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';        // 👈
import { MatIconModule } from '@angular/material/icon';            // 👈
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; // 👈
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { GameRepo } from '../persistance/game.repo';
import { CONSOLES, Game } from '../model/game.model';
import { GamePreviewDialog } from './game-preview.dialog';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-game-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule, MatSortModule, MatPaginatorModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatSnackBarModule,   // 👈
    CurrencyPipe, MatDialogModule, MatProgressSpinnerModule
  ],
  template: `
<div class="toolbar">
  <!-- filtres existants -->
  <mat-form-field appearance="outline">
    <mat-label>Recherche</mat-label>
    <input matInput (input)="globalFilter.set($any($event.target).value)" placeholder="Nom, console...">
  </mat-form-field>

  <mat-form-field appearance="outline">
    <mat-label>Console</mat-label>
    <mat-select [value]="consoleFilter()" (selectionChange)="consoleFilter.set($event.value)">
      <mat-option [value]="''">Toutes</mat-option>
      <mat-option *ngFor="let c of consoles" [value]="c">{{c}}</mat-option>
    </mat-select>
  </mat-form-field>


  <!-- ✅ nouveaux boutons -->
  <button mat-stroked-button color="primary" (click)="exportJson()">
    <mat-icon>download</mat-icon> Exporter
  </button>

  <button mat-stroked-button color="accent" (click)="fileInput.click()">
    <mat-icon>upload</mat-icon> Importer
  </button>
  <input #fileInput type="file" accept=".json" hidden (change)="importJson($event)">

  <!-- ✅ bouton chargement depuis Git -->
  <button mat-stroked-button color="warn" (click)="loadFromGit()">
    <mat-icon>cloud_download</mat-icon> Chargement depuis Git
  </button>

</div>

<div class="table-meta">
  <span>Affichés {{paged().length}} / {{filtered().length}} jeux</span>
  <mat-progress-spinner *ngIf="isLoading()" diameter="20" strokeWidth="3" mode="indeterminate"></mat-progress-spinner>
</div>

<div class="table-scroll" (scroll)="onTableScroll($event)" style="max-height:60vh;overflow:auto">
<table mat-table [dataSource]="paged()" matSort (matSortChange)="onSort($event)" class="mat-elevation-z1">
    <ng-container matColumnDef="jacket">
    <th mat-header-cell *matHeaderCellDef>Jaquette</th>
    <td mat-cell *matCellDef="let row">
        <img
        *ngIf="row.jacket || row.jacketUrl"
        [attr.src]="getJacketSrc(row)"
        alt=""
        style="height:40px;border-radius:4px"
        />
    </td>
    </ng-container>

  <ng-container matColumnDef="name">
  <th mat-header-cell *matHeaderCellDef mat-sort-header>Nom</th>
  <td mat-cell *matCellDef="let row">{{ capitalize(row.name) }}</td>
  </ng-container>

  <ng-container matColumnDef="console">
    <th mat-header-cell *matHeaderCellDef mat-sort-header>Console</th>
    <td mat-cell *matCellDef="let row">{{row.console}}</td>
  </ng-container>

  <ng-container matColumnDef="priceBuy">
    <th mat-header-cell *matHeaderCellDef> Achat </th>
    <td mat-cell *matCellDef="let row">{{row.priceBuy ?? 0 | currency:'EUR'}}</td>
  </ng-container>

  <ng-container matColumnDef="priceSell">
    <th mat-header-cell *matHeaderCellDef> Vente </th>
    <td mat-cell *matCellDef="let row">{{row.priceSell ?? 0 | currency:'EUR'}}</td>
  </ng-container>

  <!-- ✅ Colonne Actions -->
  <ng-container matColumnDef="actions">
    <th mat-header-cell *matHeaderCellDef>Supp</th>
    <td mat-cell *matCellDef="let row">
      <button mat-icon-button color="warn" (click)="onDelete(row, $event)" aria-label="Supprimer">
        <mat-icon>delete</mat-icon>
      </button>
    </td>
  </ng-container>
  <ng-container matColumnDef="edit">
    <th mat-header-cell *matHeaderCellDef>Edit</th>
    <td mat-cell *matCellDef="let row">
      <button mat-icon-button color="warn" (click)="onEdit(row, $event)" aria-label="Modifier">
        <mat-icon>edit</mat-icon>
      </button>
    </td>
  </ng-container>

  <tr mat-header-row *matHeaderRowDef="cols"></tr>
  <tr mat-row *matRowDef="let row; columns: cols;" (click)="preview(row)"></tr>
</table>


</div>
  `,
  styles: [`.toolbar{display:flex;gap:12px;align-items:center;margin:8px 0} .table-meta{display:flex;align-items:center;gap:12px;margin-bottom:8px;color:#555} table{width:100%}`]
})
export class GameTableComponent {
  capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  private repo = inject(GameRepo);
  private router = inject(Router);
  private snack = inject(MatSnackBar); // 👈
  private dialog = inject(MatDialog);

  consoles = CONSOLES;
  cols = ['jacket', 'name', 'console', 'priceBuy', 'priceSell', 'actions', 'edit']; // 👈

  globalFilter = signal('');
  consoleFilter = signal<string>('');
  sort = signal<Sort | null>(null);
  // ✅ Cache pour les URLs blob
  private blobUrlCache = new Map<string, string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  pageIndex = signal(0);
  pageSize = signal(20); // lot plus grand pour infinite scroll
  visibleCount = signal(20);
  isLoading = computed(() => this.repo.loading());

  constructor() {
    this.repo.refresh()
      .then(() => this.resetVisibleCount())
      .catch(() => {
        this.snack.open('Impossible de charger les jeux.', 'OK', { duration: 2500 });
      });

    // Reinitialise la liste affichee a chaque changement de filtre ou tri
    let lastFilter = this.globalFilter();
    let lastConsole = this.consoleFilter();
    let lastSort = this.sort();
    effect(() => {
      const curFilter = this.globalFilter();
      const curConsole = this.consoleFilter();
      const curSort = this.sort();
      if (curFilter !== lastFilter || curConsole !== lastConsole || curSort !== lastSort) {
        lastFilter = curFilter;
        lastConsole = curConsole;
        lastSort = curSort;
        this.resetVisibleCount();
      }
    });

    effect(() => {
      const games = this.repo.list();
      void games;
      if (!this.isLoading()) {
        this.resetVisibleCount();
      }
    });
  }

  resetVisibleCount() {
    this.visibleCount.set(this.pageSize());
  }
  filtered = computed(() => {
    const q = this.globalFilter().toLowerCase().trim();
    const c = this.consoleFilter();
    return this.repo.list().filter(g => {
      const matchQ = !q || [g.name, g.console].some(x => x?.toLowerCase().includes(q));
      const matchC = !c || g.console.toLowerCase() === c.toLowerCase();
      return matchQ && matchC;
    });
  });

  sorted = computed(() => {
    const s = this.sort();
    const data = [...this.filtered()];
    if (!s || !s.active || !s.direction) return data;
    const dir = s.direction === 'asc' ? 1 : -1;
    return data.sort((a, b) => {
      const av = (a as any)[s.active], bv = (b as any)[s.active];
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
    });
  });

  paged = computed(() => {
    const all = this.sorted();
    const count = Math.min(this.visibleCount(), all.length);
    return all.slice(0, count);
  });
  onSort(s: Sort) { this.sort.set(s); }
  onEdit(row: Game, event?: Event) {
    event?.stopPropagation();
    this.router.navigate(['/games', row.id]);
  }

  ngAfterViewInit() {
    // plus de paginator
  }

  /**
   * Gestion du scroll pour infinite scroll
   */
  onTableScroll(event: Event) {
    const target = event.target as HTMLElement;
    if (this.isLoading()) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 40) {
      this.loadMoreRows();
    }
  }

  /**
   * Charge le prochain lot de jeux
   */
  loadMoreRows() {
    if (this.isLoading()) return;
    const allRows = this.sorted();
    const current = this.visibleCount();
    const nextCount = Math.min(allRows.length, current + this.pageSize());
    if (nextCount > current) {
      this.visibleCount.set(nextCount);
    }
  }
  /** Retourne une URL stable (cached) pour chaque jaquette */
  getJacketSrc(row: Game): string | null {
    // Si c’est une URL simple
    if (row.jacketUrl) return row.jacketUrl;

    // Si c’est un Blob
    if (row.jacket) {
      const cached = this.blobUrlCache.get(row.id);
      if (cached) return cached;

      // Crée une fois seulement
      const url = URL.createObjectURL(row.jacket);
      this.blobUrlCache.set(row.id, url);
      return url;
    }

    return null;
  }

  preview(row: Game) {
    this.dialog.open(GamePreviewDialog, {
      data: {
        name: row.name,
        console: row.console,
        jacket: row.jacket ?? null,
        jacketUrl: row.jacketUrl ?? null
      },
      maxWidth: '90vw',
      panelClass: 'preview-dialog'
    });
  }
  /**
   * Charge un fichier JSON du projet (ex: public/games.json) et l'importe comme data
   */
  async loadFromGit() {
    try {
      // Chemin du fichier à charger (adapter si besoin)
      const response = await fetch('assets/games-export.json');
      if (!response.ok) throw new Error('Fichier introuvable');
      const json = await response.json();
      // On suppose que repo.importFromObject accepte un tableau d'objets
      const result = await this.repo.importFromObject(json);
      this.snack.open(`Chargement terminé : ${result.ok} jeux importés, ${result.fail} erreurs.`, 'OK', { duration: 2500 });
    } catch (e: any) {
      this.snack.open('Erreur lors du chargement Git : ' + e.message, 'OK', { duration: 2500 });
    }
  }

  async onDelete(row: Game, event?: Event) {
    event?.stopPropagation();
    const ok = confirm(`Supprimer "${row.name}" ?`);
    if (!ok) return;
    await this.repo.remove(row.id);
    this.snack.open('Jeu supprimé', 'OK', { duration: 1800 });
    // pas besoin d'appeler refresh ici si remove() le fait déjà
  }

  // ----- EXPORT / IMPORT JSON -----
  async exportJson() {
    const blob = await this.repo.exportAll();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'games-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async importJson(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const result = await this.repo.importJson(file);
    alert(`Import terminé : ${result.ok} jeux importés, ${result.fail} erreurs.`);
  }
}




