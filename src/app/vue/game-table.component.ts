// src/app/games/game-table.component.ts
import { Component, ViewChild, inject, signal, computed } from '@angular/core';
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

@Component({
    selector: 'app-game-table',
    standalone: true,
    imports: [
        CommonModule,
        MatTableModule, MatSortModule, MatPaginatorModule,
        MatFormFieldModule, MatInputModule, MatSelectModule,
        MatButtonModule, MatIconModule, MatSnackBarModule,   // 👈
        CurrencyPipe, MatDialogModule
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

</div>

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
    <td mat-cell *matCellDef="let row">{{row.name}}</td>
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
    <th mat-header-cell *matHeaderCellDef>Actions</th>
    <td mat-cell *matCellDef="let row">
      <button mat-icon-button color="warn" (click)="onDelete(row)" aria-label="Supprimer">
        <mat-icon>delete</mat-icon>
      </button>
    </td>
  </ng-container>

  <tr mat-header-row *matHeaderRowDef="cols"></tr>
  <tr mat-row *matRowDef="let row; columns: cols;" (click)="preview(row)" (dblclick)="edit(row)"></tr>
</table>

<mat-paginator [length]="filtered().length" [pageSize]="10" [pageSizeOptions]="[5,10,20]" showFirstLastButtons></mat-paginator>
  `,
    styles: [`.toolbar{display:flex;gap:12px;align-items:center;margin:8px 0} table{width:100%}`]
})
export class GameTableComponent {
    private repo = inject(GameRepo);
    private router = inject(Router);
    private snack = inject(MatSnackBar); // 👈
    private dialog = inject(MatDialog);
    
    consoles = CONSOLES;
    cols = ['jacket', 'name', 'console', 'priceBuy', 'priceSell', 'actions']; // 👈

    globalFilter = signal('');
    consoleFilter = signal<string>('');
    sort = signal<Sort | null>(null);
    // ✅ Cache pour les URLs blob
    private blobUrlCache = new Map<string, string>();

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    pageIndex = signal(0);
    pageSize = signal(10);
    
    constructor() {
        this.repo.refresh();
    }

    filtered = computed(() => {
        const q = this.globalFilter().toLowerCase().trim();
        const c = this.consoleFilter();
        return this.repo.list().filter(g => {
            const matchQ = !q || [g.name, g.console].some(x => x?.toLowerCase().includes(q));
            const matchC = !c || g.console === c;
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
        const list = this.sorted(); // ou ta data source triée
        const start = this.pageIndex() * this.pageSize();
        return list.slice(start, start + this.pageSize());
    });

    onSort(s: Sort) { this.sort.set(s); }
    edit(row: Game) { this.router.navigate(['/games', row.id]); }

    ngAfterViewInit() {
        this.paginator.page.subscribe(e => {
            this.pageIndex.set(e.pageIndex);
            this.pageSize.set(e.pageSize);
        });
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
    async onDelete(row: Game) {
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