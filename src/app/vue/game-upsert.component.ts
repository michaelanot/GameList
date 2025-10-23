// src/app/games/game-upsert.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CONSOLES, Game } from '../model/game.model';
import { GameRepo } from '../persistance/game.repo';

@Component({
  selector: 'app-game-upsert',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatRadioModule, MatSnackBarModule
  ],
  template: `
<div class="wrapper" *ngIf="loaded(); else loadingTpl">
  <h2>{{ isEdit() ? 'Modifier un jeu' : 'Nouveau jeu' }}</h2>

  <form class="form" [formGroup]="form" (ngSubmit)="onSubmit()">
    <mat-form-field appearance="outline">
      <mat-label>Nom *</mat-label>
      <input matInput formControlName="name" required>
    </mat-form-field>

    <mat-form-field appearance="outline">
      <mat-label>Console *</mat-label>
      <mat-select formControlName="console" required>
        <mat-option *ngFor="let c of consoles" [value]="c">{{ c }}</mat-option>
      </mat-select>
    </mat-form-field>

    <div class="row">
      <mat-form-field appearance="outline">
        <mat-label>Prix acheté</mat-label>
        <input matInput type="number" min="0" step="0.01" formControlName="priceBuy">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Prix de vente</mat-label>
        <input matInput type="number" min="0" step="0.01" formControlName="priceSell">
      </mat-form-field>
    </div>

    <mat-label>Type de jaquette :</mat-label>
    <mat-radio-group [value]="jacketType()" (change)="onJacketTypeChange($event.value)">
      <mat-radio-button value="image">Image</mat-radio-button>
      <mat-radio-button value="url">Lien</mat-radio-button>
    </mat-radio-group>

    <div class="jacket" tabindex="0" (paste)="onPaste($event)">
        <div class="preview">
            <img *ngIf="previewUrl()" [attr.src]="previewUrl()" alt="Jaquette" />
            <div *ngIf="!previewUrl()" class="placeholder">
            Cliquez ici puis collez (Ctrl + V)
            </div>
        </div>

      <div class="buttons" *ngIf="jacketType() === 'image'">
        <button type="button" mat-stroked-button (click)="fileInput.click()">
          <mat-icon>upload</mat-icon>&nbsp;Choisir une image
        </button>
        <button type="button" mat-stroked-button color="warn" (click)="clearImage()" [disabled]="!previewUrl()">
          <mat-icon>delete</mat-icon>&nbsp;Supprimer l'image
        </button>
        <input #fileInput type="file" accept="image/*" hidden (change)="onFile($event)">
      </div>

      <mat-form-field *ngIf="jacketType() === 'url'" appearance="outline" style="flex:1">
        <mat-label>Lien de jaquette</mat-label>
        <input matInput placeholder="https://..." formControlName="jacketUrl" (input)="setPreviewFromUrl(form.value.jacketUrl ?? null)">
      </mat-form-field>
    </div>

    <div class="actions">
      <button mat-raised-button color="primary" [disabled]="form.invalid">
        {{ isEdit() ? 'Enregistrer' : 'Créer' }}
      </button>
      <button type="button" mat-button (click)="cancel()">Annuler</button>
      <span class="spacer"></span>
      <button *ngIf="isEdit()" type="button" mat-raised-button color="warn" (click)="remove()">Supprimer</button>
    </div>
  </form>
</div>

<ng-template #loadingTpl><div class="loading">Chargement…</div></ng-template>
  `,
  styles: [`
.wrapper{max-width:720px;margin:16px auto;padding:8px}
.form{display:grid;gap:12px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.jacket{display:flex;gap:16px;align-items:flex-start;margin-top:8px}
.preview img{max-height:140px;border-radius:8px;display:block}
.placeholder{height:140px;width:110px;border-radius:8px;border:1px dashed #bbb;display:flex;align-items:center;justify-content:center;color:#666}
.buttons{display:flex;flex-direction:column;gap:8px}
.actions{display:flex;align-items:center;gap:8px;margin-top:8px}
.spacer{flex:1}
.loading{padding:24px;text-align:center}
.jacket {
  border: 2px dashed transparent;
  transition: border-color 0.3s ease;
}
.jacket:focus-within {
  border-color: #1976d2;
}
.placeholder {
  color: #999;
  font-size: 0.9rem;
  text-align: center;
  margin-top: 8px;
}
  `]
})
export class GameUpsertComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private repo = inject(GameRepo);
  private snack = inject(MatSnackBar);

  consoles = CONSOLES;
  loaded = signal(false);
  isEdit = signal(false);
  gameId: string | null = null;

  // Jacket state
  private currentObjectUrl: string | null = null;
  private newJacket: Blob | null = null;
  private removeJacket = false;
  jacketType = signal<'image' | 'url'>('image');
  previewUrl = signal<string | null>(null);

  form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    console: new FormControl<typeof this.consoles[number] | null>(null, { validators: [Validators.required] }),
    priceBuy: new FormControl<number | null>(null),
    priceSell: new FormControl<number | null>(null),
    jacketUrl: new FormControl<string | null>(null),
  });

  constructor() { this.init(); }

  private async init() {
    this.gameId = this.route.snapshot.paramMap.get('id');
    this.isEdit.set(!!this.gameId);

    if (!this.isEdit()) {
      // mode création
      this.loaded.set(true);
      return;
    }

    // mode édition
    const g = await this.repo.get(this.gameId!);
    if (!g) {
      this.snack.open('Jeu introuvable', 'Fermer', { duration: 2000 });
      this.router.navigate(['/games']);
      return;
    }

    this.form.reset({
      name: g.name,
      console: g.console,
      priceBuy: g.priceBuy ?? null,
      priceSell: g.priceSell ?? null,
      jacketUrl: g.jacketUrl ?? null,
    });

    const type = g.jacket ? 'image' : (g.jacketUrl ? 'url' : 'image');
    this.jacketType.set(type);
    if (type === 'image') this.setPreviewFromBlob(g.jacket ?? null);
    else this.setPreviewFromUrl(g.jacketUrl ?? null);

    this.loaded.set(true);
  }

  // ----- Jacket helpers -----
  onJacketTypeChange(type: 'image' | 'url') {
    this.jacketType.set(type);
    if (type === 'image') {
      this.setPreviewFromBlob(this.newJacket ?? null);
    } else {
      this.newJacket = null;
      this.removeJacket = false;
      this.setPreviewFromUrl(this.form.value.jacketUrl ?? null);
    }
  }

  onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.newJacket = file;
    this.removeJacket = false;
    this.setPreviewFromBlob(file);
  }

  clearImage() {
    this.newJacket = null;
    this.removeJacket = true;
    if (this.jacketType() === 'image') this.setPreviewFromBlob(null);
    else {
      this.form.patchValue({ jacketUrl: null });
      this.setPreviewFromUrl(null);
    }
  }

  private setPreviewFromBlob(blob: Blob | null) {
    if (this.currentObjectUrl) { URL.revokeObjectURL(this.currentObjectUrl); this.currentObjectUrl = null; }
    if (blob) {
      const url = URL.createObjectURL(blob);
      this.currentObjectUrl = url;
      this.previewUrl.set(url);
    } else {
      this.previewUrl.set(null);
    }
  }

  protected setPreviewFromUrl(url: string | null) {
    if (this.currentObjectUrl) { URL.revokeObjectURL(this.currentObjectUrl); this.currentObjectUrl = null; }
    this.previewUrl.set(url || null);
  }

  // ----- Submit / Remove / Cancel -----
  async onSubmit() {
    if (this.form.invalid) return;

    if (!this.isEdit()) {
      await this.repo.create({
        name: this.form.value.name!,
        console: this.form.value.console!,
        priceBuy: this.form.value.priceBuy ?? null,
        priceSell: this.form.value.priceSell ?? null,
        jacket: this.jacketType() === 'image' ? this.newJacket ?? null : null,
        jacketUrl: this.jacketType() === 'url' ? this.form.value.jacketUrl ?? null : null,
      });
      this.snack.open('Jeu créé avec succès 🎉', 'OK', { duration: 2000 });
      this.router.navigate(['/games']);
      return;
    }

    const patch: Partial<Game> = {
      name: this.form.value.name!,
      console: this.form.value.console!,
      priceBuy: this.form.value.priceBuy ?? null,
      priceSell: this.form.value.priceSell ?? null,
    };

    if (this.jacketType() === 'image') {
      if (this.removeJacket) { patch.jacket = null; patch.jacketUrl = null; }
      else if (this.newJacket) { patch.jacket = this.newJacket; patch.jacketUrl = null; }
    } else { // url
      patch.jacket = null;
      patch.jacketUrl = this.form.value.jacketUrl ?? null;
    }

    await this.repo.update(this.gameId!, patch);
    this.snack.open('Modifications enregistrées ✅', 'OK', { duration: 1800 });
    this.router.navigate(['/games']);
  }

  async remove() {
    if (!this.isEdit()) return;
    const ok = confirm('Supprimer ce jeu définitivement ?');
    if (!ok) return;
    await this.repo.remove(this.gameId!);
    this.snack.open('Jeu supprimé', 'OK', { duration: 1800 });
    this.router.navigate(['/games']);
  }

  onPaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          this.newJacket = blob;
          this.removeJacket = false;
          this.jacketType.set('image');
          this.setPreviewFromBlob(blob);
          this.form.patchValue({ jacketUrl: null });
          event.preventDefault();
          this.snack.open('Image collée avec succès 🎨', 'OK', { duration: 2000 });
          break;
        }
      }
    }
  }

  cancel() { this.location.back(); }
}
