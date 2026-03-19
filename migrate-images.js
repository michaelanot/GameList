// migrate-images.js
// Ce script extrait les images base64 du fichier games-export.json
// et les sauvegarde comme fichiers séparés dans public/assets/covers/

const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = './public/assets/games-export.json';
const OUTPUT_FILE = './public/assets/games-migrated.json';
const COVERS_DIR = './public/assets/covers';

// Créer le dossier covers s'il n'existe pas
if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
  console.log(`✅ Dossier créé: ${COVERS_DIR}`);
}

console.log('📖 Lecture du fichier JSON...');
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

console.log(`📊 Nombre de jeux trouvés: ${data.length}`);

let imagesExtracted = 0;
let imagesSkipped = 0;

// Traiter chaque jeu
const migratedGames = data.map((game, index) => {
  if (index % 100 === 0) {
    console.log(`⏳ Progression: ${index}/${data.length}`);
  }

  // Si le jeu a une image en base64
  if (game.jacket && typeof game.jacket === 'string' && game.jacket.startsWith('data:')) {
    try {
      // Extraire le mime type et les données
      const matches = game.jacket.match(/^data:(.+?);base64,(.+)$/);
      if (!matches) {
        console.warn(`⚠️  Format base64 invalide pour le jeu: ${game.name}`);
        imagesSkipped++;
        return game;
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      
      // Déterminer l'extension du fichier
      const extension = mimeType.split('/')[1] || 'png';
      
      // Créer un nom de fichier sécurisé basé sur l'ID du jeu
      const fileName = `cover-${game.id}.${extension}`;
      const filePath = path.join(COVERS_DIR, fileName);
      
      // Sauvegarder l'image
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);
      
      imagesExtracted++;
      
      // Retourner le jeu avec jacketUrl au lieu de jacket
      return {
        ...game,
        jacket: null,
        jacketUrl: `assets/covers/${fileName}`
      };
    } catch (error) {
      console.error(`❌ Erreur pour le jeu ${game.name}:`, error.message);
      imagesSkipped++;
      return game;
    }
  } else if (game.jacketUrl) {
    // Le jeu a déjà une URL, on le garde tel quel
    return game;
  } else {
    // Pas d'image
    return {
      ...game,
      jacket: null,
      jacketUrl: null
    };
  }
});

console.log('💾 Sauvegarde du nouveau fichier JSON...');
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(migratedGames, null, 2));

console.log('\n✅ Migration terminée !');
console.log(`📸 Images extraites: ${imagesExtracted}`);
console.log(`⏭️  Images ignorées: ${imagesSkipped}`);
console.log(`💽 Nouveau fichier: ${OUTPUT_FILE}`);
console.log(`\n🔄 Pour utiliser le nouveau fichier, remplacez games-export.json par games-migrated.json`);
