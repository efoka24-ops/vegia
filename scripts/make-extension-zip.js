/**
 * Génère vigia-extension.zip — fichier à distribuer aux beta-testeurs
 * Usage: node scripts/make-extension-zip.js
 */
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os   = require('os');

const ROOT = path.resolve(__dirname, '..');
const EXT  = path.join(ROOT, 'extension');
const OUT  = path.join(ROOT, 'vigia-extension.zip');
const TMP  = path.join(os.tmpdir(), 'vigia_dist_' + Date.now());

const INCLUDE = [
  'manifest.json',
  'background.js',
  'content.js',
  'badge.css',
  'popup.html',
  'popup.js',
  'icons/vigia.svg',
  'icons/vigia-16.png',
  'icons/vigia-48.png',
  'icons/vigia-128.png',
];

// Vérifier que tous les fichiers existent
const missing = INCLUDE.filter(f => !fs.existsSync(path.join(EXT, f)));
if (missing.length) {
  console.error('Fichiers manquants :', missing);
  process.exit(1);
}

// Copier les fichiers dans un dossier temporaire
fs.mkdirSync(path.join(TMP, 'icons'), { recursive: true });
for (const f of INCLUDE) {
  const src = path.join(EXT, f);
  const dst = path.join(TMP, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

// Supprimer le ZIP existant
if (fs.existsSync(OUT)) fs.unlinkSync(OUT);

// Créer un fichier PS1 temporaire pour éviter les problèmes d'échappement
const ps1 = path.join(os.tmpdir(), 'vigia_zip.ps1');
fs.writeFileSync(ps1, `Compress-Archive -Path "${TMP}\\*" -DestinationPath "${OUT}" -Force\n`);

try {
  execSync(`powershell -NoProfile -NonInteractive -File "${ps1}"`, { stdio: 'inherit' });
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.unlinkSync(ps1);

  const size = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`\n✓ vigia-extension.zip créé  (${size} KB)`);
  console.log('\nDistribuer aux testeurs :');
  console.log('  1. Envoyer vigia-extension.zip (email, WhatsApp, Drive…)');
  console.log('  2. Décompresser le ZIP dans un dossier');
  console.log('  3. Chrome → chrome://extensions → Mode développeur ON');
  console.log('  4. "Charger l\'extension non empaquetée" → sélectionner le dossier\n');
} catch (e) {
  fs.rmSync(TMP, { recursive: true, force: true });
  console.error('Erreur :', e.message);
  process.exit(1);
}
