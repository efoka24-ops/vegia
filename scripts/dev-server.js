/**
 * Serveur local VigIA
 * Usage: npm run dev
 */
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const { exec, execSync } = require('child_process');

const PORT = 3000;
const ROOT = path.resolve(__dirname, '..');
const ZIP  = path.join(ROOT, 'vigia-extension.zip');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.zip':  'application/zip',
  '.ico':  'image/x-icon',
};

// Génère le ZIP si absent
function ensureZip() {
  if (fs.existsSync(ZIP)) return;
  console.log('  Génération de vigia-extension.zip…');
  const EXT = path.join(ROOT, 'extension');
  const TMP = path.join(os.tmpdir(), 'vigia_dist_' + Date.now());
  const INCLUDE = [
    'manifest.json','background.js','content.js','badge.css',
    'popup.html','popup.js',
    'icons/vigia.svg','icons/vigia-16.png','icons/vigia-48.png','icons/vigia-128.png',
  ];
  fs.mkdirSync(path.join(TMP, 'icons'), { recursive: true });
  for (const f of INCLUDE) {
    const src = path.join(EXT, f);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(TMP, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  const ps1 = path.join(os.tmpdir(), 'vigia_zip.ps1');
  fs.writeFileSync(ps1, `Compress-Archive -Path "${TMP}\\*" -DestinationPath "${ZIP}" -Force\n`);
  execSync(`powershell -NoProfile -NonInteractive -File "${ps1}"`, { stdio: 'pipe' });
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.unlinkSync(ps1);
  const kb = (fs.statSync(ZIP).size / 1024).toFixed(1);
  console.log(`  vigia-extension.zip prêt (${kb} KB)\n`);
}

ensureZip();

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // Route racine → redirect vers landing page (302 pour que les URLs relatives fonctionnent)
  if (urlPath === '/') {
    res.writeHead(302, { Location: '/prototype/landing.html' });
    res.end();
    return;
  }

  // Route téléchargement ZIP
  if (urlPath === '/vigia-extension.zip') {
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="vigia-extension.zip"',
      'Content-Length': fs.statSync(ZIP).size,
    });
    fs.createReadStream(ZIP).pipe(res);
    return;
  }

  const decoded  = decodeURIComponent(urlPath);
  const filePath = path.join(ROOT, decoded);

  // Sécurité : pas de sortie du ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 — ${decoded}`);
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log('\n  VigIA dev server\n');
  console.log(`  ○  Landing page   →  ${url}`);
  console.log(`  ○  Prototype      →  ${url}/prototype/index.html`);
  console.log(`  ○  Téléchargement →  ${url}/vigia-extension.zip`);
  console.log('\n  Ctrl+C pour arrêter\n');
  exec(`start "" "${url}"`);
});
