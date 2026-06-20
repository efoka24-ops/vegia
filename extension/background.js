const API_BASE = 'http://localhost:8000/api/v1';
const BLACKLIST_TTL_MS = 6 * 60 * 60 * 1000; // 6h

// ---------- Messages depuis le content script ----------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VERIFY') {
    handleVerify(message.payload).then(sendResponse);
    return true;
  }
  if (message.type === 'CHECK_BLACKLIST') {
    checkBlacklist(message.url).then(sendResponse);
    return true;
  }
  if (message.type === 'REPORT') {
    submitReport(message.payload).then(sendResponse);
    return true;
  }
});

// ---------- Vérification principale ----------

async function handleVerify(payload) {
  const { cacheKey, ...body } = payload;

  // Vérifie d'abord la liste noire locale (pour les liens)
  if (body.type === 'url') {
    const hit = await checkBlacklist(body.content.url);
    if (hit) {
      return { level: 'red', score: 1.0, explanation: 'Lien présent dans la liste noire locale.', modules: { link: { score: 1.0, label: 'lien connu comme malveillant' } } };
    }
  }

  try {
    const { token } = await chrome.storage.local.get('token');
    const res = await fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || 'public'}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[VigIA] API error:', err);
    return { level: 'error', score: null, explanation: 'Impossible de contacter VigIA.' };
  }
}

// ---------- Liste noire locale ----------

async function checkBlacklist(url) {
  const { blacklist = [] } = await chrome.storage.local.get('blacklist');
  return blacklist.includes(url);
}

async function refreshBlacklist() {
  try {
    const res = await fetch(`${API_BASE}/blacklist`);
    if (!res.ok) return;
    const { entries } = await res.json();
    await chrome.storage.local.set({ blacklist: entries, blacklistUpdatedAt: Date.now() });
    console.log(`[VigIA] Liste noire mise à jour : ${entries.length} entrées`);
  } catch (err) {
    console.warn('[VigIA] Impossible de mettre à jour la liste noire:', err);
  }
}

// ---------- Alarme de mise à jour ----------

chrome.alarms.create('refresh-blacklist', { periodInMinutes: 360 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refresh-blacklist') refreshBlacklist();
});

// Chargement initial au démarrage du service worker
chrome.runtime.onInstalled.addListener(() => refreshBlacklist());
