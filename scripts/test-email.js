/**
 * Test envoi email VigIA
 * Usage: node scripts/test-email.js <destinataire>
 */
const fs   = require('fs');
const path = require('path');

// Charger .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const TO = process.argv[2] || 'emm.foka@gmail.com';

// ── Fonctions email (copie de dev-server.js) ──────────────────

const MOD_META = {
  media:   { title: 'Vérif-Média',   subtitle: 'Manipulation IA',       icon: '🎥' },
  info:    { title: 'Vérif-Info',    subtitle: 'Fact-checking & IA',    icon: '📰' },
  link:    { title: 'Vérif-Lien',   subtitle: 'Phishing / arnaque',    icon: '🔗' },
  account: { title: 'Vérif-Compte', subtitle: 'Compte officiel',       icon: '👤' },
};
const LEVEL_BG    = { red:'#FCEBEC', orange:'#FFF8EC', green:'#EEF3F0', error:'#f3f4f6' };
const LEVEL_BORDER= { red:'#C8102E', orange:'#d97706', green:'#0A5C42', error:'#9ca3af' };
const LEVEL_COLOR = { red:'#C8102E', orange:'#b45309', green:'#0A5C42', error:'#6b7280' };
const LEVEL_ICON  = { red:'⚠️',    orange:'⚠️',    green:'✅',      error:'❓' };

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildModuleBlock(mod, r, c) {
  const meta   = MOD_META[mod] || { title:mod, subtitle:'', icon:'🔍' };
  const level  = r?.level || 'error';
  const bg     = LEVEL_BG[level];
  const border = LEVEL_BORDER[level];
  const color  = LEVEL_COLOR[level];
  const icon   = LEVEL_ICON[level] || '❓';
  const badge  = esc(r?.badge || '—');
  const label  = esc(r?.label || '—');
  const expl   = esc(r?.explanation || '');
  const score  = r?.score != null ? `<span style="float:right;font-size:22px;font-weight:900;color:${color};line-height:1">${r.score}%</span>` : '';

  let contentBlock = '';
  if (c) {
    if (c.excerpt) {
      const preview = esc(c.excerpt.slice(0,400));
      contentBlock = `
        <div style="margin:10px 0 0;padding:10px 12px;background:#f7f6f2;border-radius:8px;border-left:3px solid #ccc">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:4px">Texte analysé</div>
          <div style="font-size:12px;color:#444;line-height:1.5;white-space:pre-wrap">${preview}${c.excerpt.length>400?'…':''}</div>
        </div>`;
    } else if (c.url) {
      const dispUrl = esc(c.url.length>80 ? c.url.slice(0,80)+'…' : c.url);
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
          ${c.pageUrl?`<div style="font-size:11px;color:#888;margin-top:2px"><a href="${esc(c.pageUrl)}" style="color:#0A5C42">${esc(c.pageUrl.slice(0,70))}</a></div>`:''}
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
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <span style="font-size:16px">${meta.icon}</span>
            <strong style="font-size:14px;color:#0A5C42;margin-left:6px">${meta.title}</strong>
            <span style="font-size:11px;color:#83837b;margin-left:6px">· ${meta.subtitle}</span>
          </td>
          <td style="text-align:right;white-space:nowrap">
            <span style="font-size:13px;font-weight:800;color:${color}">${icon} ${badge}</span>
          </td>
        </tr></table>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 16px">
        ${score}
        <div style="font-size:13px;font-weight:700;color:#11201A;margin-bottom:${expl?'6px':'0'}">${label}</div>
        ${expl?`<div style="font-size:12px;color:#555;line-height:1.5">${expl}</div>`:''}
        ${contentBlock}
      </td>
    </tr>
  </table>`;
}

function buildEmailHtml(to, url, date, results, content) {
  const dateStr  = new Date(date).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
  const alerts   = Object.values(results).filter(r => r?.level==='red').length;
  const warnings = Object.values(results).filter(r => r?.level==='orange').length;
  const summaryColor = alerts>0?'#C8102E':warnings>0?'#d97706':'#0A5C42';
  const summaryText  = alerts>0
    ? `⚠ ${alerts} alerte${alerts>1?'s':''} critique${alerts>1?'s':''} détectée${alerts>1?'s':''}`
    : warnings>0 ? `⚠ ${warnings} point${warnings>1?'s':''} de vigilance` : '✅ Aucune alerte — contenu sûr';

  const modules = ['media','info','link','account']
    .map(mod => buildModuleBlock(mod, results[mod], content?.[mod])).join('');

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport VigIA</title></head>
<body style="margin:0;padding:0;background:#f0efe9;font-family:Arial,'Helvetica Neue',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0efe9;padding:24px 0">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 3px 20px rgba(0,0,0,.10)">
  <tr><td style="background:#0A5C42;padding:22px 28px 20px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><div style="font-size:24px;font-weight:900;color:#fff">Vig<span style="color:#F2B705">IA</span></div>
          <div style="font-size:12px;color:rgba(255,255,255,.65);margin-top:2px">Rapport d'analyse de sécurité numérique</div></td>
      <td align="right"><div style="font-size:11px;color:rgba(255,255,255,.5)">CM TRU GROUP</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:20px 28px 0;border-bottom:1px solid #eee">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-bottom:12px;width:55%">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-bottom:3px">Page analysée</div>
        <div style="font-size:12px;word-break:break-all"><a href="${esc(url)}" style="color:#0A5C42;text-decoration:none">${esc(url.length>70?url.slice(0,70)+'…':url)}</a></div>
      </td>
      <td style="padding-bottom:12px;text-align:right;vertical-align:top">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-bottom:3px">Date d'analyse</div>
        <div style="font-size:12px;color:#444">${dateStr}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:16px 28px;background:#fafaf8;border-bottom:2px solid ${summaryColor}22">
    <div style="font-size:16px;font-weight:800;color:${summaryColor}">${summaryText}</div>
  </td></tr>
  <tr><td style="padding:20px 28px 24px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#999;margin-bottom:14px">Résultats par module</div>
    ${modules}
  </td></tr>
  <tr><td style="padding:14px 28px;background:#f7f6f2;border-top:1px solid #e8e6df;text-align:center;font-size:10px;color:#aaa">
    Rapport généré automatiquement par VigIA · CM TRU GROUP · <a href="https://vigia.cm" style="color:#0A5C42;text-decoration:none">vigia.cm</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ── Données de test ────────────────────────────────────────────

const testPayload = {
  to:   TO,
  url:  'https://web.facebook.com/iamZIEFE',
  date: new Date().toISOString(),
  results: {
    media:   { level:'orange', badge:'⚠ 61%', label:'Contenu douteux — vérification manuelle conseillée.',  score:61, explanation:'Quelques incohérences visuelles détectées dans la vidéo. Croiser avec une source officielle avant de partager.' },
    info:    { level:'green',  badge:'✓ RAS',  label:'Aucun indicateur de désinformation ou IA détecté.',   score:12, explanation:'' },
    link:    { level:'red',    badge:'⚠ 92%', label:'Arnaque connue — phishing ou escroquerie.',             score:92, explanation:'Ce lien est présent dans notre base de données de scams Mobile Money Cameroun. Ne saisissez aucune information personnelle ou bancaire.' },
    account: { level:'green',  badge:'✓ RAS',  label:'Aucune usurpation d\'identité institutionnelle.',     score:15, explanation:'' },
  },
  content: {
    media:   { source:'https://web.facebook.com/iamZIEFE', hasVideo:true },
    info:    { excerpt:'Emmanuel Foka partage une réflexion sur le développement économique du Cameroun et les opportunités numériques pour les jeunes entrepreneurs de la région. Le texte aborde les défis du secteur fintech en Afrique centrale et les solutions innovantes portées par la diaspora.' },
    link:    { url:'https://bit.ly/mtn-momo-verify-cmr-2025' },
    account: { name:'Emmanuel Foka', pageUrl:'https://web.facebook.com/iamZIEFE' },
  },
};

// ── Envoi ──────────────────────────────────────────────────────

async function main() {
  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'mx-dc03.ewodi.net',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'infos@trugroup.cm',
      pass: process.env.SMTP_PASS || '',
    },
    tls: { rejectUnauthorized: false },
  });

  const html = buildEmailHtml(
    testPayload.to, testPayload.url, testPayload.date,
    testPayload.results, testPayload.content
  );

  console.log('\nEnvoi vers :', testPayload.to);
  console.log('Depuis     :', process.env.SMTP_USER);
  console.log('SMTP       :', process.env.SMTP_HOST + ':' + (process.env.SMTP_PORT||'587'));

  try {
    const info = await transporter.sendMail({
      from:    `"${process.env.SMTP_NAME||'CM TRU GROUP'}" <${process.env.SMTP_USER||'infos@trugroup.cm'}>`,
      to:      testPayload.to,
      subject: 'VigIA — Rapport d\'analyse · Test',
      html,
    });
    console.log('\n✓ Email envoyé !');
    console.log('  Message ID :', info.messageId);
    console.log('  Réponse    :', info.response);
  } catch (err) {
    console.error('\n✗ Échec :', err.message);
    process.exit(1);
  }
}

main();
