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

// Charger .env sans dépendance externe
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

// Mailer SMTP (nodemailer optionnel)
let mailer = null;
try {
  const nodemailer = require('nodemailer');
  mailer = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'mx-dc03.ewodi.net',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'infos@trugroup.cm',
      pass: process.env.SMTP_PASS || '',
    },
    tls: { rejectUnauthorized: false },
  });
  console.log('  Mail SMTP    →  ' + (process.env.SMTP_HOST || 'mx-dc03.ewodi.net'));
} catch (_) {
  console.warn('  ⚠ nodemailer absent — npm install nodemailer (pour l\'envoi de rapports)');
}

function buildEmailHtml(to, url, date, results) {
  const LEVEL_COLOR = { red: '#C8102E', orange: '#E07B00', green: '#0A5C42', error: '#83837b' };
  const LEVEL_ICON  = { red: '⚠️', orange: '⚠️', green: '✅', error: '❓' };
  const MOD_LABELS  = { media: 'Vérif-Média', info: 'Vérif-Info', link: 'Vérif-Lien', account: 'Vérif-Compte' };

  const rows = Object.entries(results).map(([mod, r]) => {
    if (!r) return '';
    const color = LEVEL_COLOR[r.level] || '#83837b';
    const icon  = LEVEL_ICON[r.level]  || '❓';
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;font-weight:700;color:#0A5C42">${MOD_LABELS[mod] || mod}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;font-weight:700;color:${color}">${icon} ${r.badge || ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#444;font-size:13px">${r.label || ''}</td>
      </tr>`;
  }).join('');

  const dateStr = new Date(date).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Rapport VigIA</title></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:Arial,sans-serif">
  <table width="600" cellpadding="0" cellspacing="0" style="margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <tr>
      <td style="background:#0A5C42;padding:24px 28px">
        <span style="color:#fff;font-size:22px;font-weight:900">Vig<span style="color:#F2B705">IA</span></span>
        <span style="color:rgba(255,255,255,.7);font-size:13px;margin-left:12px">Rapport d'analyse</span>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px 0">
        <p style="margin:0 0 4px;font-size:12px;color:#888">Page analysée</p>
        <p style="margin:0 0 16px;font-size:13px;color:#0A5C42;word-break:break-all"><a href="${url}" style="color:#0A5C42">${url}</a></p>
        <p style="margin:0 0 4px;font-size:12px;color:#888">Date d'analyse</p>
        <p style="margin:0 0 20px;font-size:13px;color:#333">${dateStr}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 24px">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
          <tr style="background:#f7f6f2">
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#666">Module</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#666">Résultat</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#666">Détail</th>
          </tr>
          ${rows}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#f7f6f2;border-top:1px solid #eee;font-size:11px;color:#888;text-align:center">
        Rapport généré par VigIA · CM TRU GROUP · <a href="https://vigia.cm" style="color:#0A5C42">vigia.cm</a>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function handleSendReport(body) {
  const { to, url, date, results } = body;
  if (!to || !to.includes('@')) throw new Error('Email destinataire invalide');
  if (!mailer) throw new Error('Mailer non configuré — npm install nodemailer');

  const html = buildEmailHtml(to, url || '', date || new Date().toISOString(), results || {});

  await mailer.sendMail({
    from:    `"${process.env.SMTP_NAME || 'CM TRU GROUP'}" <${process.env.SMTP_USER || 'infos@trugroup.cm'}>`,
    to,
    subject: 'VigIA — Rapport d\'analyse',
    html,
  });
}
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

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // Route envoi de rapport par email
  if (urlPath === '/api/send-report' && req.method === 'POST') {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(raw); } catch { body = {}; }
      handleSendReport(body)
        .then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true }));
        })
        .catch(err => {
          console.error('[Mail] Erreur :', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        });
    });
    return;
  }

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
