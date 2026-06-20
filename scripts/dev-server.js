/**
 * Serveur local pour le prototype VigIA
 * Usage: npm run dev
 * Ouvre http://localhost:3000 dans Chrome
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Route / → landing page
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/prototype/landing.html';

  // Gérer le nom de fichier avec espaces
  const decoded = decodeURIComponent(urlPath);
  let filePath = path.join(ROOT, decoded);

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
  console.log(`  Landing page  →  ${url}`);
  console.log(`  Prototype     →  ${url}/prototype/VigIA%20-%20Prototype%20extension.dc.html`);
  console.log('\n  Ctrl+C pour arrêter\n');

  // Ouvrir automatiquement dans le navigateur (Windows)
  exec(`start "" "${url}"`);
});
