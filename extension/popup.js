const PLATFORMS = {
  'facebook.com': 'Facebook', 'twitter.com': 'Twitter',
  'x.com': 'X', 'whatsapp.com': 'WhatsApp', 'linkedin.com': 'LinkedIn',
};

const MOD_RESULTS = { media: null, info: null, link: null, account: null };

// Résultats mock (fallback si pas d'éléments détectés sur la page)
const MOCK_RESULTS = {
  media:   { level: 'red',   badge: '⚠ 82%',         label: 'Vidéo probablement manipulée par IA.' },
  info:    { level: 'green', badge: '✓ RAS',          label: 'Aucun indicateur de désinformation.' },
  link:    { level: 'red',   badge: '⚠ arnaque',      label: 'Arnaque connue — phishing Mobile Money.' },
  account: { level: 'red',   badge: '⚠ non vérifié', label: 'Aucun compte officiel correspondant.' },
};

const DELAYS = { media: 1800, info: 1400, link: 1000, account: 1600 };

// popup mod → content script context
const MOD_TO_CTX = { media: 'images', info: 'posts', link: 'links', account: 'profiles' };

// Niveau de sévérité pour garder le pire résultat si plusieurs éléments scannés
const SEVERITY = { red: 3, orange: 2, green: 1, error: 0 };

// ── Init ──────────────────────────────────────────────────────

async function init() {
  const data    = await chrome.storage.local.get(['enabled']);
  const enabled = data.enabled !== false;

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

// ── Scan d'un module (via content script → fallback mock) ─────

function scanModule(mod) {
  if (MOD_RESULTS[mod] !== null) return;
  setModuleState(mod, 'scanning');
  updateHeader();

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) { runMockForMod(mod); return; }

    chrome.tabs.sendMessage(tab.id, { type: 'SCAN_MODULE', context: MOD_TO_CTX[mod] }, (resp) => {
      if (chrome.runtime.lastError || !resp?.found) {
        // Pas de content script ou aucun élément trouvé → simulation
        runMockForMod(mod);
      }
      // Si found > 0, on attend les messages SCAN_RESULT du content script
    });
  });
}

// ── Tout vérifier (via content script → fallback mock) ────────

function scanAll() {
  const pending = ['media', 'info', 'link', 'account'].filter(m => MOD_RESULTS[m] === null);
  if (!pending.length) return;

  pending.forEach(m => setModuleState(m, 'scanning'));
  updateHeader();

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) { pending.forEach(runMockForMod); return; }

    chrome.tabs.sendMessage(tab.id, { type: 'SCAN_ALL' }, (resp) => {
      if (chrome.runtime.lastError || !resp?.found) {
        // Pas de content script ou page sans éléments → simulation
        pending.forEach(runMockForMod);
      }
      // Si found > 0, les SCAN_RESULT arrivent via onMessage
    });
  });
}

// ── Mock simulation (fallback) ────────────────────────────────

function runMockForMod(mod) {
  setTimeout(() => {
    if (MOD_RESULTS[mod] !== null) return; // résultat réel déjà arrivé
    const r = MOCK_RESULTS[mod];
    MOD_RESULTS[mod] = r;
    setModuleState(mod, 'done', r);
    updateHeader();
  }, DELAYS[mod]);
}

// ── Réception des résultats du content script ─────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'SCAN_RESULT') return;
  const { mod, result } = msg;
  if (!mod || !result) return;

  const current = MOD_RESULTS[mod];
  // Garder le résultat le plus sévère si plusieurs éléments scannés
  const newSev = SEVERITY[result.level] || 0;
  const curSev = current ? (SEVERITY[current.level] || 0) : -1;
  if (newSev > curSev) {
    MOD_RESULTS[mod] = result;
    setModuleState(mod, 'done', result);
    updateHeader();
  }
});

// ── Header état ───────────────────────────────────────────────

function updateHeader() {
  const mods    = ['media', 'info', 'link', 'account'];
  const done    = mods.filter(m => MOD_RESULTS[m] !== null);
  const alerts  = done.filter(m => MOD_RESULTS[m].level === 'red').length;
  const scanning = mods.some(m => {
    const act = document.getElementById(`act-${m}`);
    return act && act.querySelector('.spin-sm');
  });

  const elIdle     = document.getElementById('stateIdle');
  const elScanning = document.getElementById('stateScanning');
  const elDone     = document.getElementById('stateDone');

  elIdle.style.display     = (!scanning && done.length === 0) ? 'block' : 'none';
  elScanning.style.display = scanning ? 'flex' : 'none';
  elDone.style.display     = (!scanning && done.length > 0)  ? 'flex'  : 'none';

  if (!scanning && done.length > 0) {
    document.getElementById('alertCount').textContent = alerts;
    document.getElementById('alertWord').textContent  =
      alerts <= 1 ? 'alerte détectée' : 'alertes détectées';
  }
}

init();
