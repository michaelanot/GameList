// game.repo.ts
import { Injectable, signal } from '@angular/core';
import { db } from './game.db';
import { Game } from '../model/game.model';
import { v4 as uuid } from 'uuid';

@Injectable({ providedIn: 'root' }) // ✅ important pour l'injection
export class GameRepo {
  list = signal<Game[]>([]);
  loading = signal(false);

  async refresh() {
    this.loading.set(true);
    try { this.list.set(await db.games.orderBy('createdAt').reverse().toArray()); }
    finally { this.loading.set(false); }
  }

  async create(partial: Omit<Game,'id'|'createdAt'|'updatedAt'>) {
    const now = Date.now();
    const game: Game = { id: uuid(), createdAt: now, updatedAt: now, ...partial };
    await db.games.add(game);
    await this.refresh();
    return game.id;
  }

  async update(id: string, patch: Partial<Game>) {
    await db.games.update(id, { ...patch, updatedAt: Date.now() });
    await this.refresh();
  }

  get(id: string) { return db.games.get(id); }

  async remove(id: string) {
    await db.games.delete(id);
    await this.refresh();
    }
    
  // ------------------------------------------------------------------------------------
  // 🔹 EXPORT : convertit les Blobs en Base64 pour que le JSON soit complet et portable
  // ------------------------------------------------------------------------------------
  async exportAll(): Promise<Blob> {
    const games = await db.games.toArray();
    const serialized = await Promise.all(
      games.map(async g => ({
        ...g,
        jacket: g.jacket ? await this.blobToBase64(g.jacket) : null,
      }))
    );
    const json = JSON.stringify(serialized, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ------------------------------------------------------------------------------------
  // 🔹 IMPORT : convertit les chaînes Base64 en Blobs avant insertion
  // ------------------------------------------------------------------------------------
  async importJson(file: File): Promise<{ ok: number; fail: number }> {
    const text = await file.text();
    const arr = JSON.parse(text);
    let ok = 0, fail = 0;

    for (const g of arr) {
      try {
        let jacket: Blob | null = null;
        if (typeof g.jacket === 'string' && g.jacket.startsWith('data:')) {
          jacket = this.base64ToBlob(g.jacket);
        }
        await db.games.put({
          ...g,
          jacket,
          jacketUrl: g.jacketUrl ?? null,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    return { ok, fail };
  }

  private base64ToBlob(base64: string): Blob {
    const parts = base64.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] ?? 'image/png';
    const bin = atob(parts[1]);
    const len = bin.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }
}
