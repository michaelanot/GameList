// game.db.ts
import Dexie, { Table } from 'dexie';
import { Game } from '../model/game.model';

export class GameDB extends Dexie {
  games!: Table<Game, string>;

  constructor() {
    super('games-db');

    // ⚠️ Incrémente la version à 2 (pour appliquer la nouvelle structure)
    this.version(2).stores({
      // id = clé primaire
      // [name+console] = index combiné unique
      games: 'id, [name+console], createdAt'
    }).upgrade(async tx => {
      // Supprimer les doublons éventuels avant d'appliquer l'unicité
      const seen = new Set<string>();
      const toDelete: string[] = [];
      const all = await tx.table('games').toArray();

      for (const g of all) {
        const key = `${g.name?.trim()?.toLowerCase()}|${g.console}`;
        if (seen.has(key)) {
          toDelete.push(g.id);
        } else {
          seen.add(key);
        }
      }

      if (toDelete.length) {
        console.warn(`Suppression de ${toDelete.length} doublon(s) avant migration`);
        await tx.table('games').bulkDelete(toDelete);
      }
    });
  }
}

export const db = new GameDB();
