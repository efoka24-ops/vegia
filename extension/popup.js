const PLATFORMS = {
  'facebook.com': 'Facebook', 'twitter.com': 'Twitter',
  'x.com': 'X', 'whatsapp.com': 'WhatsApp', 'linkedin.com': 'LinkedIn',
};

const MOD_RESULTS = { media: null, info: null, link: null, account: null };

// Fallback mock (utilisé uniquement si le content script est absent)
const MOCK_RESULTS = {
  media:   { level: 'red',   badge: '⚠ 82%',         label: 'Vidéo probablement manipulée par IA.' },
  info:    { level: 'green', badge: '✓ RAS',          label: 'Aucun indicateur de désinformation.' },
  link:    { level: 'red',   badge: '⚠ arnaque',      label: 'Arnaque connue — phishing Mobile Money.' },
  account: { level: 'red',   badge: '⚠ non vérifié', label: 'Aucun compte officiel correspondant.' },
};

const MOCK_DELAYS = { media: 1800, info: 1400, link: 1000, account: 1600 };

// popup mod → content script context
const MOD_TO_CTX = { media: 'video', info: 'text', link: 'link', account: 'account' };

const SUPPORTED_HOSTS = ['facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'web.whatsapp.com'];

const SEVERITY = { red: 3, orange: 2, green: 1, error: 0 };

// ── Init ──────────────────────────────────────────────────────

async function init() {
  const { enabled = true } = await chrome.storage.local.get('enabled');

  document.getElementById('toggleEnabled').checked = enabled;
  updateDisabledBanner(enabled);

  ['media', 'info', 'link', 'account'].forEach(m => setModuleState(m, 'idle'));

  document.getElementById('toggleEnabled').addEventListener('change', onToggle);
  document.getElementById('btnScanAll').addEventListener('click', scanAll);
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
    sp.className   = result.level === 'green' ? 'badge-green' : 'badge-red';
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
    if (!tab?.id) { pending.forEach(runMock); return; }

    chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE' }, page => {
      if (chrome.runtime.lastError || !page?.ok) {
        pending.forEach(runMock);
        return;
      }

      if (pending.includes('info')) {
        page.text?.length > 15
          ? analyzeAndUpdate('text', { text: page.text }, 'info', tab.id)
          : runMock('info');
      }

      if (pending.includes('media')) {
        page.hasMedia
          ? analyzeAndUpdate('image', { image_url: tab.url || '' }, 'media', tab.id)
          : runMock('media');
      }

      if (pending.includes('link')) {
        page.hasSuspLinks && page.firstSuspLink
          ? analyzeAndUpdate('url', { url: page.firstSuspLink }, 'link', tab.id)
          : runMock('link');
      }

      if (pending.includes('account')) {
        page.profileName
          ? analyzeAndUpdate('account', { profile_name: page.profileName, profile_image_url: '' }, 'account', tab.id)
          : runMock('account');
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

    applyResult(mod, { level: result.level, badge, label });
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

// ── Mock fallback ─────────────────────────────────────────────

function runMock(mod) {
  setTimeout(() => {
    if (MOD_RESULTS[mod] !== null) return;
    applyResult(mod, MOCK_RESULTS[mod]);
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

init();
