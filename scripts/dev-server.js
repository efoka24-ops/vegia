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
    host:   process.env.SMTP_HOST || 'smtp.example.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'user@example.com',
      pass: process.env.SMTP_PASS || '',
    },
    tls: { rejectUnauthorized: false },
  });
  console.log('  Mail SMTP    →  ' + (process.env.SMTP_HOST || 'smtp.example.com'));
} catch (_) {
  console.warn('  ⚠ nodemailer absent — npm install nodemailer (pour l\'envoi de rapports)');
}

const MOD_META = {
  media:   { title: 'Vérif-Média',   subtitle: 'Manipulation IA',      icon: '🎥' },
  info:    { title: 'Vérif-Info',    subtitle: 'Fact-checking &amp; IA', icon: '📰' },
  link:    { title: 'Vérif-Lien',   subtitle: 'Phishing / arnaque',    icon: '🔗' },
  account: { title: 'Vérif-Compte', subtitle: 'Compte officiel',       icon: '👤' },
};

const LEVEL_BG    = { red: '#FCEBEC', orange: '#FFF8EC', green: '#EEF3F0', error: '#f3f4f6' };
const LEVEL_BORDER= { red: '#C8102E', orange: '#d97706', green: '#0A5C42', error: '#9ca3af' };
const LEVEL_COLOR = { red: '#C8102E', orange: '#b45309', green: '#0A5C42', error: '#6b7280' };
const LEVEL_ICON  = { red: '⚠️',    orange: '⚠️',    green: '✅',      error: '❓' };

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function buildModuleBlock(mod, r, c) {
  const meta   = MOD_META[mod] || { title: mod, subtitle: '', icon: '🔍' };
  const level  = r?.level || 'error';
  const bg     = LEVEL_BG[level];
  const border = LEVEL_BORDER[level];
  const color  = LEVEL_COLOR[level];
  const icon   = LEVEL_ICON[level] || '❓';
  const badge  = esc(r?.badge || '—');
  const label  = esc(r?.label || '—');
  const expl   = esc(r?.explanation || '');
  const score  = r?.score != null ? `<span style="float:right;font-size:22px;font-weight:900;color:${color};line-height:1">${r.score}%</span>` : '';

  // Bloc contenu analysé
  let contentBlock = '';
  if (c) {
    if (c.excerpt) {
      const preview = esc(c.excerpt.slice(0, 400));
      contentBlock = `
        <div style="margin:10px 0 0;padding:10px 12px;background:#f7f6f2;border-radius:8px;border-left:3px solid #ccc">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:4px">Texte analysé</div>
          <div style="font-size:12px;color:#444;line-height:1.5;white-space:pre-wrap">${preview}${c.excerpt.length > 400 ? '…' : ''}</div>
        </div>`;
    } else if (c.url) {
      const dispUrl = esc(c.url.length > 80 ? c.url.slice(0, 80) + '…' : c.url);
      contentBlock = `
        <div style="margin:10px 0 0;padding:10px 12px;background:#fff5f5;border-radius:8px;border-left:3px solid #fca5a5">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:4px">Lien vérifié</div>
          <div style="font-size:12px;font-family:monospace;color:#C8102E;word-break:break-all">
            <a href="${esc(c.url)}" style="color:#C8102E">${dispUrl}</a>
          </div>
        </div>`;
    } else if (c.name) {
      contentBlock = `
        <div style="margin:10px 0 0;padding:10px 12px;background:#f7f6f2;border-radius:8px;border-left:3px solid #ccc">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:4px">Profil vérifié</div>
          <div style="font-size:13px;font-weight:700;color:#11201A">${esc(c.name)}</div>
          ${c.pageUrl ? `<div style="font-size:11px;color:#888;margin-top:2px;word-break:break-all"><a href="${esc(c.pageUrl)}" style="color:#0A5C42">${esc(c.pageUrl.slice(0,70))}</a></div>` : ''}
        </div>`;
    } else if (c.source) {
      contentBlock = `
        <div style="margin:10px 0 0;padding:10px 12px;background:#f7f6f2;border-radius:8px;border-left:3px solid #ccc">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:4px">Média vérifié</div>
          <div style="font-size:11px;color:#0A5C42;word-break:break-all"><a href="${esc(c.source)}" style="color:#0A5C42">${esc(c.source.slice(0,80))}</a></div>
        </div>`;
    }
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;border:1px solid ${border};border-radius:10px;overflow:hidden;background:${bg}">
      <tr>
        <td style="padding:14px 16px;border-bottom:1px solid ${border}22">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-size:16px">${meta.icon}</span>
                <strong style="font-size:14px;color:#0A5C42;margin-left:6px">${meta.title}</strong>
                <span style="font-size:11px;color:#83837b;margin-left:6px">· ${meta.subtitle}</span>
              </td>
              <td style="text-align:right;white-space:nowrap">
                <span style="font-size:13px;font-weight:800;color:${color}">${icon} ${badge}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px">
          ${score}
          <div style="font-size:13px;font-weight:700;color:#11201A;margin-bottom:${expl ? '6px' : '0'}">${label}</div>
          ${expl ? `<div style="font-size:12px;color:#555;line-height:1.5">${expl}</div>` : ''}
          ${contentBlock}
        </td>
      </tr>
    </table>`;
}

function buildEmailHtml(to, url, date, results, content) {
  const dateStr  = new Date(date).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
  const alerts   = Object.values(results).filter(r => r?.level === 'red').length;
  const warnings = Object.values(results).filter(r => r?.level === 'orange').length;

  const summaryColor = alerts > 0 ? '#C8102E' : warnings > 0 ? '#d97706' : '#0A5C42';
  const summaryText  = alerts > 0
    ? `⚠ ${alerts} alerte${alerts > 1 ? 's' : ''} critique${alerts > 1 ? 's' : ''} détectée${alerts > 1 ? 's' : ''}`
    : warnings > 0
    ? `⚠ ${warnings} point${warnings > 1 ? 's' : ''} de vigilance`
    : '✅ Aucune alerte — contenu sûr';

  const modules = ['media', 'info', 'link', 'account']
    .map(mod => buildModuleBlock(mod, results[mod], content?.[mod]))
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Rapport VigIA</title>
</head>
<body style="margin:0;padding:0;background:#f0efe9;font-family:Arial,'Helvetica Neue',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0efe9;padding:24px 0">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 3px 20px rgba(0,0,0,.10)">

        <!-- HEADER -->
        <tr>
          <td style="background:#0A5C42;padding:22px 28px 20px">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-.5px">
                  Vig<span style="color:#F2B705">IA</span>
                </div>
                <div style="font-size:12px;color:rgba(255,255,255,.65);margin-top:2px">Rapport d'analyse de sécurité numérique</div>
              </td>
              <td align="right">
                <div style="font-size:11px;color:rgba(255,255,255,.5)">CM TRU GROUP</div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- META PAGE -->
        <tr>
          <td style="padding:20px 28px 0;border-bottom:1px solid #eee">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:12px;width:50%">
                  <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-bottom:3px">Page analysée</div>
                  <div style="font-size:12px;word-break:break-all">
                    <a href="${esc(url)}" style="color:#0A5C42;text-decoration:none">${esc(url.length>70 ? url.slice(0,70)+'…' : url)}</a>
                  </div>
                </td>
                <td style="padding-bottom:12px;width:50%;text-align:right;vertical-align:top">
                  <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-bottom:3px">Date d'analyse</div>
                  <div style="font-size:12px;color:#444">${dateStr}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- RÉSUMÉ -->
        <tr>
          <td style="padding:16px 28px;background:#fafaf8;border-bottom:2px solid ${summaryColor}22">
            <div style="font-size:16px;font-weight:800;color:${summaryColor}">${summaryText}</div>
          </td>
        </tr>

        <!-- MODULES -->
        <tr>
          <td style="padding:20px 28px 24px">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#999;margin-bottom:14px">Résultats par module</div>
            ${modules}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:14px 28px;background:#f7f6f2;border-top:1px solid #e8e6df;text-align:center;font-size:10px;color:#aaa">
            Rapport généré automatiquement par VigIA · CM TRU GROUP ·
            <a href="https://vigia.cm" style="color:#0A5C42;text-decoration:none">vigia.cm</a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function handleSendReport(body) {
  const { to, url, date, results, content } = body;
  if (!to || !to.includes('@')) throw new Error('Email destinataire invalide');
  if (!mailer) throw new Error('Mailer non configuré — npm install nodemailer');

  const html = buildEmailHtml(to, url || '', date || new Date().toISOString(), results || {}, content || {});

  await mailer.sendMail({
    from:    `"${process.env.SMTP_NAME || 'CM TRU GROUP'}" <${process.env.SMTP_USER || 'user@example.com'}>`,
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

  // Route racine → prototype interactif (la landing est désormais l'app React dans landing/)
  if (urlPath === '/') {
    res.writeHead(302, { Location: '/prototype/prototype-embed.html' });
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
  console.log(`  ○  Prototype      →  ${url}/prototype/prototype-embed.html`);
  console.log(`  ○  Téléchargement →  ${url}/vigia-extension.zip`);
  console.log('\n  Ctrl+C pour arrêter\n');
  exec(`start "" "${url}"`);
});
