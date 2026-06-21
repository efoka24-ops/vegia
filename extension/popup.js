const PLATFORMS = {
  'facebook.com': 'Facebook', 'twitter.com': 'Twitter',
  'x.com': 'X', 'whatsapp.com': 'WhatsApp', 'linkedin.com': 'LinkedIn',
};

const MOD_RESULTS  = { media: null, info: null, link: null, account: null };
const MOD_CONTENT  = { media: null, info: null, link: null, account: null }; // contenu analysé
let   _pageUrl = '';

// Résultats honnêtes quand aucun contenu détectable n'est trouvé sur la page
const MOCK_NOTFOUND = {
  media:   { level: 'green', badge: '✓ RAS', label: 'Aucun média suspect détecté sur cette page.',      score: null, explanation: '' },
  info:    { level: 'green', badge: '✓ RAS', label: 'Aucun texte suspect ou généré par IA détecté.',    score: null, explanation: '' },
  link:    { level: 'green', badge: '✓ RAS', label: 'Aucun lien suspect détecté sur cette page.',       score: null, explanation: '' },
  account: { level: 'green', badge: '✓ RAS', label: 'Aucun profil à identifier sur cette page.',        score: null, explanation: '' },
};

const MOCK_DELAYS = { media: 900, info: 700, link: 500, account: 800 };

// popup mod → content script context
const MOD_TO_CTX = { media: 'video', info: 'text', link: 'link', account: 'account' };

const SUPPORTED_HOSTS = [
  'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'web.whatsapp.com',
  'instagram.com', 'youtube.com', 'tiktok.com', 'reddit.com',
  'web.telegram.org', 'threads.net',
];

const SEVERITY = { red: 3, orange: 2, green: 1, error: 0 };

// ── Init ──────────────────────────────────────────────────────

async function init() {
  const { enabled = true } = await chrome.storage.local.get('enabled');

  document.getElementById('toggleEnabled').checked = enabled;
  updateDisabledBanner(enabled);

  ['media', 'info', 'link', 'account'].forEach(m => setModuleState(m, 'idle'));

  document.getElementById('toggleEnabled').addEventListener('change', onToggle);
  document.getElementById('btnScanAll').addEventListener('click', scanAll);
  document.getElementById('btnSendReport').addEventListener('click', sendReport);
}

// ── Toggle ────────────────────────────────────────────────────

async function onToggle(e) {
  await chrome.storage.local.set({ enabled: e.target.checked });
  updateDisabledBanner(e.target.checked);
}

function updateDisabledBanner(enabled) {
  document.getElementById('disabledBanner').classList.toggle('show', !enabled);
}

// ── Module state ──────────────────────────────────────────────

function setModuleState(mod, state, result) {
  const act = document.getElementById(`act-${mod}`);
  if (!act) return;
  act.innerHTML = '';

  if (state === 'idle') {
    const btn = document.createElement('button');
    btn.className   = 'btn-verify';
    btn.textContent = 'Vérifier';
    btn.addEventListener('click', () => scanModule(mod));
    act.appendChild(btn);
    return;
  }
  if (state === 'scanning') {
    const sp = document.createElement('span');
    sp.className = 'spin-sm';
    act.appendChild(sp);
    return;
  }
  if (state === 'done' && result) {
    const sp = document.createElement('span');
    sp.className   = result.level === 'green' ? 'badge-green'
                   : result.level === 'orange' ? 'badge-orange'
                   : 'badge-red';
    sp.textContent = result.badge;
    act.appendChild(sp);
  }
}

// ── Trouver l'onglet social actif ─────────────────────────────

function findSocialTab(callback) {
  // D'abord chercher l'onglet actif non-extension
  chrome.tabs.query({ active: true, currentWindow: true }, ([active]) => {
    const isReal = active?.url && SUPPORTED_HOSTS.some(h => active.url.includes(h));
    if (isReal) { callback(active); return; }

    // Si l'onglet actif est le popup lui-même → chercher dans tous les onglets
    chrome.tabs.query({}, (allTabs) => {
      const social = allTabs.find(t => t.url && SUPPORTED_HOSTS.some(h => t.url.includes(h)));
      callback(social || null);
    });
  });
}

// ── Scan d'un module individuel ───────────────────────────────

function scanModule(mod) {
  if (MOD_RESULTS[mod] !== null) return;
  setModuleState(mod, 'scanning');
  updateHeader();

  findSocialTab(tab => {
    if (!tab?.id) { runMock(mod); return; }
    chrome.tabs.sendMessage(tab.id, { type: 'SCAN_MODULE', context: MOD_TO_CTX[mod] }, resp => {
      if (chrome.runtime.lastError || !resp?.found) runMock(mod);
    });
  });
}

// ── Tout vérifier (analyse la page réelle) ────────────────────

function scanAll() {
  const pending = ['media', 'info', 'link', 'account'].filter(m => MOD_RESULTS[m] === null);
  if (!pending.length) return;

  pending.forEach(m => setModuleState(m, 'scanning'));
  updateHeader();

  findSocialTab(tab => {
    _pageUrl = tab?.url || '';
    if (!tab?.id) { pending.forEach(runMock); return; }

    chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE' }, page => {
      if (chrome.runtime.lastError || !page?.ok) {
        pending.forEach(runMock);
        return;
      }

      if (pending.includes('info')) {
        if (page.text?.length > 15) {
          MOD_CONTENT.info = { excerpt: page.text.slice(0, 800) };
          analyzeAndUpdate('text', { text: page.text }, 'info', tab.id);
        } else runMock('info');
      }

      if (pending.includes('media')) {
        if (page.hasMedia) {
          MOD_CONTENT.media = { source: tab.url || '', hasVideo: document !== undefined };
          analyzeAndUpdate('image', { image_url: tab.url || '' }, 'media', tab.id);
        } else runMock('media');
      }

      if (pending.includes('link')) {
        if (page.hasSuspLinks && page.firstSuspLink) {
          MOD_CONTENT.link = { url: page.firstSuspLink };
          analyzeAndUpdate('url', { url: page.firstSuspLink }, 'link', tab.id);
        } else runMock('link');
      }

      if (pending.includes('account')) {
        if (page.profileName) {
          MOD_CONTENT.account = { name: page.profileName, pageUrl: tab.url || '' };
          analyzeAndUpdate('account', { profile_name: page.profileName, profile_image_url: '' }, 'account', tab.id);
        } else runMock('account');
      }
    });
  });
}

// ── Envoi de la vérification à background.js ──────────────────

function analyzeAndUpdate(type, content, mod, tabId) {
  chrome.runtime.sendMessage({
    type: 'VERIFY',
    payload: { type, content, source: 'page', cacheKey: `${mod}:${tabId}:${Date.now()}` },
  }, result => {
    if (!result || result.level === 'error') { runMock(mod); return; }

    const mods    = result.modules || {};
    const modData = Object.values(mods)[0];
    const score   = modData?.score != null ? Math.round(modData.score * 100) : null;
    const label   = modData?.label || result.explanation || '—';
    const badge   = result.level === 'red'    ? (score != null ? `⚠ ${score}%` : '⚠ alerte')
                  : result.level === 'orange' ? (score != null ? `⚠ ${score}%` : '⚠ douteux')
                  : '✓ RAS';

    applyResult(mod, { level: result.level, badge, label, score, explanation: result.explanation || '' });
  });
}

function applyResult(mod, result) {
  const cur = MOD_RESULTS[mod];
  const newSev = SEVERITY[result.level] || 0;
  const curSev = cur ? (SEVERITY[cur.level] || 0) : -1;
  if (newSev > curSev) {
    MOD_RESULTS[mod] = result;
    setModuleState(mod, 'done', result);
    updateHeader();
  }
}

// ── Fallback "aucun contenu détecté" ─────────────────────────

function runMock(mod) {
  setTimeout(() => {
    if (MOD_RESULTS[mod] !== null) return;
    applyResult(mod, MOCK_NOTFOUND[mod]);
  }, MOCK_DELAYS[mod]);
}

// ── Réception résultats du content script (boutons inline) ────

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type !== 'SCAN_RESULT') return;
  const { mod, result } = msg;
  if (mod && result) applyResult(mod, result);
});

// ── Header état ───────────────────────────────────────────────

function updateHeader() {
  const mods     = ['media', 'info', 'link', 'account'];
  const done     = mods.filter(m => MOD_RESULTS[m] !== null);
  const alerts   = done.filter(m => MOD_RESULTS[m].level === 'red').length;
  const scanning = mods.some(m => {
    const act = document.getElementById(`act-${m}`);
    return act && act.querySelector('.spin-sm');
  });

  document.getElementById('stateIdle').style.display     = (!scanning && done.length === 0) ? 'block' : 'none';
  document.getElementById('stateScanning').style.display = scanning ? 'flex' : 'none';
  document.getElementById('stateDone').style.display     = (!scanning && done.length > 0)  ? 'flex'  : 'none';

  if (!scanning && done.length > 0) {
    document.getElementById('alertCount').textContent = alerts;
    document.getElementById('alertWord').textContent  = alerts <= 1 ? 'alerte détectée' : 'alertes détectées';
  }
}

// ── Envoi rapport par email ───────────────────────────────────

function sendReport() {
  const emailInput = document.getElementById('emailInput');
  const status     = document.getElementById('emailStatus');
  const btn        = document.getElementById('btnSendReport');

  const email = emailInput.value.trim();
  if (!email || !email.includes('@') || !email.includes('.')) {
    status.textContent = 'Adresse email invalide.';
    status.className   = 'email-status err';
    return;
  }

  const hasResults = Object.values(MOD_RESULTS).some(r => r !== null);
  if (!hasResults) {
    status.textContent = 'Lancez d\'abord une analyse.';
    status.className   = 'email-status err';
    return;
  }

  btn.disabled       = true;
  status.textContent = 'Envoi en cours…';
  status.className   = 'email-status';

  findSocialTab(tab => {
    const report = {
      to:      email,
      url:     tab?.url || _pageUrl || '',
      date:    new Date().toISOString(),
      results: MOD_RESULTS,
      content: MOD_CONTENT,
    };

    chrome.runtime.sendMessage({ type: 'SEND_REPORT', payload: report }, resp => {
      btn.disabled = false;
      if (resp?.ok) {
        status.textContent = `Rapport envoyé à ${email} ✓`;
        status.className   = 'email-status';
        emailInput.value   = '';
      } else {
        status.textContent = resp?.error || 'Erreur d\'envoi. Réessayez.';
        status.className   = 'email-status err';
      }
    });
  });
}

init();
