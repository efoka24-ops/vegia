const TYPE_LABELS = { image: '🖼 Image', text: '📰 Texte', url: '🔗 Lien', account: '👤 Compte' };
const PLATFORMS   = { 'facebook.com': 'Facebook', 'twitter.com': 'Twitter', 'x.com': 'X', 'whatsapp.com': 'WhatsApp', 'linkedin.com': 'LinkedIn' };

async function init() {
  const data = await chrome.storage.local.get([
    'statsGreen', 'statsOrange', 'statsRed', 'enabled', 'history'
  ]);

  // Stats
  document.getElementById('countGreen').textContent  = data.statsGreen  || 0;
  document.getElementById('countOrange').textContent = data.statsOrange || 0;
  document.getElementById('countRed').textContent    = data.statsRed    || 0;

  // Toggle
  const enabled = data.enabled !== false;
  const toggle  = document.getElementById('toggleEnabled');
  toggle.checked = enabled;
  updateStatusUI(enabled);

  // Plateforme active
  detectPlatform();

  // Historique
  renderHistory(data.history || []);
}

function updateStatusUI(enabled) {
  const dot     = document.getElementById('statusDot');
  const text    = document.getElementById('statusText');
  const banner  = document.getElementById('disabledBanner');

  if (enabled) {
    dot.className  = 'status-dot status-dot--on';
    text.textContent = 'Actif';
    banner.classList.remove('visible');
  } else {
    dot.className  = 'status-dot status-dot--off';
    text.textContent = 'Désactivé';
    banner.classList.add('visible');
  }
}

function detectPlatform() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    const label = document.getElementById('platformLabel');
    for (const [host, name] of Object.entries(PLATFORMS)) {
      if (url.includes(host)) { label.textContent = name; return; }
    }
    label.textContent = 'Hors périmètre';
    label.style.color = '#475569';
  });
}

function renderHistory(history) {
  const container = document.getElementById('history');
  const empty     = document.getElementById('historyEmpty');

  const recent = history.slice(-5).reverse();
  if (!recent.length) { empty.style.display = 'block'; return; }

  empty.style.display = 'none';
  recent.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    const ago = timeAgo(item.ts);
    el.innerHTML = `
      <span class="history-dot history-dot--${item.level}"></span>
      <div class="history-info">
        <div class="history-type">${TYPE_LABELS[item.type] || item.type}</div>
        <div class="history-label">${escHtml(item.label || '—')}</div>
      </div>
      <span class="history-time">${ago}</span>
    `;
    container.appendChild(el);
  });
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)  return diff + 's';
  if (diff < 3600) return Math.floor(diff / 60) + 'min';
  return Math.floor(diff / 3600) + 'h';
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Événements ────────────────────────────────────────────────

document.getElementById('toggleEnabled').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ enabled: e.target.checked });
  updateStatusUI(e.target.checked);
});

document.getElementById('btnClear').addEventListener('click', async () => {
  await chrome.storage.local.set({
    statsGreen: 0, statsOrange: 0, statsRed: 0, history: []
  });
  document.getElementById('countGreen').textContent  = '0';
  document.getElementById('countOrange').textContent = '0';
  document.getElementById('countRed').textContent    = '0';
  const h = document.getElementById('history');
  h.querySelectorAll('.history-item').forEach(el => el.remove());
  document.getElementById('historyEmpty').style.display = 'block';
  showToast('Statistiques effacées');
});

document.getElementById('btnReport').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    chrome.runtime.sendMessage({ type: 'REPORT', payload: { url } });
    showToast('Signalement envoyé — merci !');
  });
});

init();
