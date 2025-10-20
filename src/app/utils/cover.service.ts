// src/app/games/cover.service.ts
import { inject, Injectable } from '@angular/core';
import { GameRepo } from '../persistance/game.repo';


@Injectable({ providedIn: 'root' })
export class CoverService {
  private repo = inject(GameRepo);

  async fetchWikipediaThumb(title: string, lang: 'fr'|'en'): Promise<string | null> {
    const enc = encodeURIComponent(title.trim());
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${enc}`;
    const r = await fetch(url, { headers: { 'accept': 'application/json' } });
    if (!r.ok) return null;
    const json = await r.json();
    // json.thumbnail?.source est souvent un JPG/PNG CORS-friendly
    return json?.thumbnail?.source ?? null;
  }

  async fetchBestCoverUrl(gameName: string): Promise<string | null> {
    // Essais heuristiques : brut, sans accents, variantes simples
    const trials = [gameName];
    for (const name of trials) {
      const fr = await this.fetchWikipediaThumb(name, 'fr');
      if (fr) return fr;
      const en = await this.fetchWikipediaThumb(name, 'en');
      if (en) return en;
    }
    return null;
  }

  async downloadAsBlob(url: string): Promise<Blob> {
    // Wikipedia accepte CORS -> fetch direct OK
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.blob();
  }

  /** Parcourt les jeux sans jacket et tente de remplir jacket (Blob) depuis Wikipedia */
  async fillMissingCovers(): Promise<{done:number, miss:number, fail:number}> {
    const list = this.repo.list();
    let done = 0, miss = 0, fail = 0;
    for (const g of list) {
      if (g.jacket) continue; // déjà en local
      const url = g.jacketUrl || await this.fetchBestCoverUrl(g.name);
      if (!url) { miss++; continue; }
      try {
        const blob = await this.downloadAsBlob(url);
        await this.repo.update(g.id, { jacket: blob, jacketUrl: null });
        done++;
      } catch {
        fail++;
      }
    }
    return { done, miss, fail };
  }
}
