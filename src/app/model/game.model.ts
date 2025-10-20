// game.model.ts
export const CONSOLES = [
  'NES', 'SNES', 'N64', 'GameCube', 'MégaDrive'
] as const;
export type ConsoleType = typeof CONSOLES[number];

export interface Game {
  id: string;           // uuid
  name: string;         // required
  console: ConsoleType; // required
  jacket?: Blob | null;     // image locale
  jacketUrl?: string | null; // lien image
  priceBuy?: number | null;
  priceSell?: number | null;
  createdAt: number;
  updatedAt: number;
}
