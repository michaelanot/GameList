import { Component, Inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export type GamePreviewData = {
  name: string;
  console: string;
  jacket?: Blob | null;
  jacketUrl?: string | null;
};

@Component({
  standalone: true,
  selector: 'app-game-preview-dialog',
  imports: [CommonModule, MatDialogModule],
  template: `
  <div class="wrap">
    <h3 class="title">{{ data.name }} <small>({{ data.console }})</small></h3>
    <div class="imgbox">
      <img *ngIf="src" [attr.src]="src" alt="{{ data.name }}" />
      <div *ngIf="!src" class="placeholder">Aucune image</div>
    </div>
  </div>
  `,
  styles: [`
    .wrap { margin:12px; max-width: 90vw; max-height: 90vh; }
    .title { margin: 0 0 12px 0; font-weight: 600;text-align: center; }
    .title small { font-weight: 400; color: #666; }
    .imgbox { display:flex; align-items:center; justify-content:center; }
    .imgbox img {  max-width: 85vw; max-height: 80vh; object-fit: contain; border-radius: 8px; }
    .placeholder { padding: 32px; color:#999 }
  `]
})
export class GamePreviewDialog implements OnDestroy {
  src: string | null = null;
  private objectUrl: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: GamePreviewData,
    private ref: MatDialogRef<GamePreviewDialog>,
  ) {
    // Crée l'URL une seule fois (évite NG0100)
    if (data.jacket) {
      this.objectUrl = URL.createObjectURL(data.jacket);
      this.src = this.objectUrl;
    } else if (data.jacketUrl) {
      this.src = data.jacketUrl;
    } else {
      this.src = null;
    }
  }

  ngOnDestroy(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }
}
