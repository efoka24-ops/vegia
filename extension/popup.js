const PLATFORMS = {
  'facebook.com': 'Facebook', 'twitter.com': 'Twitter',
  'x.com': 'X', 'whatsapp.com': 'WhatsApp', 'linkedin.com': 'LinkedIn'
};

const MOD_RESULTS = {
  media:   null,
  info:    null,
  link:    null,
  account: null,
};

// ── Init ──────────────────────────────────────────────────────

async function init() {
  const data = await chrome.storage.local.get(['enabled', 'history']);

  const enabled = data.enabled !== false;
  document.getElementById('toggleEnabled').checked = enabled;
  updateStatusUI(enabled);
  detectPlatform();
  renderHistory(data.history || []);
  updateResultHeader();
}

// ── Statut actif/désactivé ────────────────────────────────────

function updateStatusUI(enabled) {
  const dot    = document.getElementById('statusDot');
  const text   = document.getElementById('statusText');
  const banner = document.getElementById('disabledBanner');
  if (enabled) {
    dot.className = 'status-dot dot-on';
    text.textContent = 'Actif';
    banner.classList.remove('visible');
  } else {
    dot.className = 'status-dot dot-off';
    text.textContent = 'Désactivé';
    banner.classList.add('visible');
  }
}

document.getElementById('toggleEnabled').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ enabled: e.target.checked });
  updateStatusUI(e.target.checked);
});

// ── Plateforme ────────────────────────────────────────────────

function detectPlatform() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url   = tabs[0]?.url || '';
    const label = document.getElementById('platformLabel');
    for (const [host, name] of Object.entries(PLATFORMS)) {
      if (url.includes(host)) { label.textContent = name; return; }
    }
    label.textContent = 'Hors périmètre';
    label.style.background = 'rgba(0,0,0,0.06)';
    label.style.color = '#9ca3af';
  });
}

// ── Scan d'un module individuel ───────────────────────────────

function scanModule(mod) {
  setModuleState(mod, 'scanning');
  updateResultHeader();

  const delays = { media: 1800, info: 1400, link: 1000, account: 1600 };
  const results = {
    media:   { level: 'red',   badge: '⚠ 82%',         label: 'Vidéo probablement manipulée par IA.' },
    info:    { level: 'green', badge: '✓ RAS',          label: 'Aucun indicateur de désinformation.' },
    link:    { level: 'red',   badge: '⚠ arnaque',      label: 'Arnaque connue — phishing Mobile Money.' },
    account: { level: 'red',   badge: '⚠ non vérifié', label: 'Aucun compte officiel correspondant.' },
  };

  setTimeout(() => {
    const r = results[mod];
    MOD_RESULTS[mod] = r;
    setModuleState(mod, 'done', r);
    updateResultHeader();
    saveHistoryEntry(r.level, mod, r.label);
  }, delays[mod]);
}

function setModuleState(mod, state, result) {
  const act = document.getElementById(`act-${mod}`);
  if (!act) return;

  if (state === 'scanning') {
    act.innerHTML = `<span class="spinner"></span>`;
    return;
  }
  if (state === 'done' && result) {
    const cls = result.level === 'green' ? 'mod-badge-green' : 'mod-badge-red';
    act.innerHTML = `<span class="${cls}">${result.badge}</span>`;
    return;
  }
  // idle
  act.innerHTML = `<button class="btn-verify" onclick="scanModule('${mod}')">Vérifier</button>`;
}

// ── Tout vérifier ─────────────────────────────────────────────

function scanAll() {
  ['media', 'info', 'link', 'account'].forEach(m => {
    if (!MOD_RESULTS[m]) scanModule(m);
  });
}

// ── Header résultat ───────────────────────────────────────────

function updateResultHeader() {
  const mods    = Object.keys(MOD_RESULTS);
  const done    = mods.filter(m => MOD_RESULTS[m] !== null);
  const alerts  = done.filter(m => MOD_RESULTS[m]?.level === 'red').length;
  const scanning = mods.some(m => {
    const act = document.getElementById(`act-${m}`);
    return act && act.querySelector('.spinner');
  });

  document.getElementById('stateIdle').style.display     = (!scanning && done.length === 0) ? '' : 'none';
  document.getElementById('stateScanning').style.display = scanning ? '' : 'none';
  document.getElementById('stateDone').style.display     = (!scanning && done.length > 0) ? '' : 'none';

  if (!scanning && done.length > 0) {
    document.getElementById('alertCount').textContent = alerts;
    document.getElementById('alertWord').textContent  = alerts === 1 ? 'alerte détectée' : 'alertes détectées';
  }
}

// ── Historique ────────────────────────────────────────────────

const MOD_LABELS = { media: '🎬 Média', info: '📰 Info', link: '🔗 Lien', account: '👤 Compte' };

async function saveHistoryEntry(level, type, label) {
  const { history = [] } = await chrome.storage.local.get('history');
  history.push({ level, type, label, ts: Date.now() });
  if (history.length > 50) history.splice(0, history.length - 50);
  await chrome.storage.local.set({ history });
  renderHistory(history);
}

function renderHistory(history) {
  const container = document.getElementById('historyContainer');
  const empty     = document.getElementById('historyEmpty');
  const recent    = history.slice(-5).reverse();

  if (!recent.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  // Supprimer les anciens items
  container.querySelectorAll('.history-item').forEach(el => el.remove());

  recent.forEach(item => {
    const el  = document.createElement('div');
    el.className = 'history-item';
    const cls = item.level === 'green' ? 'hdot-green' : item.level === 'orange' ? 'hdot-orange' : 'hdot-red';
    el.innerHTML = `
      <span class="hdot ${cls}"></span>
      <div class="h-info">
        <div class="h-type">${MOD_LABELS[item.type] || item.type}</div>
        <div class="h-label">${escHtml(item.label || '—')}</div>
      </div>
      <span class="h-time">${timeAgo(item.ts)}</span>
    `;
    container.appendChild(el);
  });
}

// ── Signaler / Effacer ────────────────────────────────────────

function report() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.runtime.sendMessage({ type: 'REPORT', payload: { url: tabs[0]?.url } });
    showToast('Signalement envoyé — merci !');
  });
}

async function resetStats() {
  Object.keys(MOD_RESULTS).forEach(k => { MOD_RESULTS[k] = null; });
  ['media','info','link','account'].forEach(m => setModuleState(m, 'idle'));
  await chrome.storage.local.set({ history: [] });
  document.querySelectorAll('.history-item').forEach(el => el.remove());
  document.getElementById('historyEmpty').style.display = 'block';
  updateResultHeader();
  showToast('Réinitialisé');
}

// ── Utilitaires ───────────────────────────────────────────────

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'min';
  return Math.floor(s / 3600) + 'h';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

init();
