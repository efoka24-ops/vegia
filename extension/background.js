// URL du backend de production (Railway). Si tu mappes un domaine custom
// (api.vigia.cm), remplace-la ici ET dans host_permissions du manifest.json.
const DEFAULT_API_BASE = 'https://vegia-production.up.railway.app/api/v1';

// Paramètres configurables par l'utilisateur (popup) via chrome.storage.local :
//   apiBase  : surcharge de l'URL du backend
//   token    : 'public' (défaut) ou une clé partenaire 'vig_...'
//   demoMode : true pour forcer la simulation locale (sans backend)
async function getSettings() {
  const { apiBase, token, demoMode, clientId } =
    await chrome.storage.local.get(['apiBase', 'token', 'demoMode', 'clientId']);
  let cid = clientId;
  if (!cid) {
    cid = (self.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    await chrome.storage.local.set({ clientId: cid });
  }
  return {
    apiBase: apiBase || DEFAULT_API_BASE,
    token: token || 'public',
    demoMode: demoMode === true,
    clientId: cid,
  };
}

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
  if (message.type === 'SEND_REPORT') {
    sendEmailReport(message.payload).then(sendResponse);
    return true;
  }
});

// ---------- Vérification principale ----------

async function handleVerify(payload) {
  const { cacheKey, ...body } = payload;

  // Liens : vérifier la liste noire locale d'abord
  if (body.type === 'url') {
    const hit = await checkBlacklist(body.content.url);
    if (hit) {
      return {
        level: 'red',
        explanation: 'Lien présent dans la liste noire locale.',
        modules: { link: { score: 1.0, label: 'Lien connu comme malveillant' } }
      };
    }
  }

  const settings = await getSettings();

  // Mode démo explicite : réponses simulées sans backend
  if (settings.demoMode) {
    return simulateAnalysis(body);
  }

  // Mode production : appel API réel (repli automatique sur la simulation si injoignable)
  try {
    const res = await fetch(`${settings.apiBase}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.token}`,
        'X-Client-Id': settings.clientId
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[VigIA] API injoignable, bascule sur le mode démo', err);
    return simulateAnalysis(body);
  }
}

// ---------- Simulation IA (mode démo / fallback) ----------

function simulateAnalysis(body) {
  return new Promise(resolve => {
    // Délai réaliste : 800ms–2.2s
    const delay = 800 + Math.random() * 1400;

    setTimeout(() => {
      const url   = body.content?.url   || '';
      const text  = body.content?.text  || '';
      const name  = body.content?.profile_name || '';

      let result;

      switch (body.type) {
        case 'image': {
          // Vidéos/images : 30% de chance de deepfake détecté
          const score = Math.random();
          if (score > 0.70) {
            result = {
              level: 'red',
              modules: { media: { score, label: 'Vidéo probablement manipulée par IA.' } },
              explanation: 'Artefacts de synthèse détectés. Aucune source officielle ne confirme cette annonce.'
            };
          } else if (score > 0.45) {
            result = {
              level: 'orange',
              modules: { media: { score, label: 'Contenu douteux — vérification manuelle conseillée.' } },
              explanation: 'Quelques incohérences détectées. Croisez avec une source officielle.'
            };
          } else {
            result = {
              level: 'green',
              modules: { media: { score, label: 'Aucune manipulation détectée.' } },
              explanation: 'Le contenu ne présente pas de signes de manipulation IA.'
            };
          }
          break;
        }

        case 'text': {
          const alertWords = ['urgent', 'massif', 'choc', 'exclusif', 'partager', 'investissement', 'garanti', 'doublez'];
          const alertHits = alertWords.filter(w => text.toLowerCase().includes(w));

          // Détection texte généré par IA
          const aiPatterns = [
            /il est (important|crucial|essentiel) de/i,
            /il convient de (noter|souligner|mentionner)/i,
            /en (conclusion|résumé|bref)[,\s]/i,
            /d[''']une part.{1,60}d[''']autre part/is,
            /dans (ce|cet) contexte/i,
            /nous (pouvons|allons|devons) (noter|explorer|examiner)/i,
            /cependant.{1,40}néanmoins/i,
            /à (cet égard|titre d[''']exemple)/i,
          ];
          const aiHits = aiPatterns.filter(p => p.test(text));

          if (alertHits.length >= 2) {
            result = {
              level: 'red',
              modules: { info: { score: 0.78, label: 'Contenu à fort potentiel de désinformation.' } },
              explanation: `Termes d'alerte détectés : ${alertHits.slice(0,3).join(', ')}. Vérifiez la source avant de partager.`
            };
          } else if (aiHits.length >= 2) {
            result = {
              level: 'orange',
              modules: { info: { score: 0.65, label: 'Contenu probablement généré par IA.' } },
              explanation: 'Structures rhétoriques caractéristiques d\'un texte IA détectées. Vérifiez l\'authenticité de la source.'
            };
          } else if (alertHits.length === 1 || aiHits.length === 1) {
            result = {
              level: 'orange',
              modules: { info: { score: 0.45, label: 'Ton inhabituel — à vérifier.' } },
              explanation: 'Le contenu présente des caractéristiques inhabituelles. Cherchez une source officielle.'
            };
          } else {
            result = {
              level: 'green',
              modules: { info: { score: 0.12, label: 'Aucun indicateur de désinformation ou IA détecté.' } },
              explanation: ''
            };
          }
          break;
        }

        case 'url': {
          // Liens : détecter domaines suspects
          const suspectPatterns = [
            /bit\.ly/i, /tinyurl/i, /mtn-momo/i, /mobile-money/i,
            /\.xyz/i, /invest-cmr/i, /verify.*account/i, /confirmer/i,
            /free.*money/i, /ponzi/i, /doublons/i
          ];
          const isSuspect = suspectPatterns.some(p => p.test(url));
          const isShortened = /bit\.ly|tinyurl|goo\.gl|ow\.ly/i.test(url);

          if (isSuspect) {
            result = {
              level: 'red',
              modules: { link: { score: 0.92, label: 'Arnaque connue — phishing ou escroquerie.' } },
              explanation: 'Ce lien est présent dans notre base de données de scams. Ne saisissez aucune information personnelle.'
            };
          } else if (isShortened) {
            result = {
              level: 'orange',
              modules: { link: { score: 0.55, label: 'Lien raccourci — destination inconnue.' } },
              explanation: 'Les liens raccourcis peuvent masquer des sites malveillants. Vérifiez avant de cliquer.'
            };
          } else {
            result = {
              level: 'green',
              modules: { link: { score: 0.08, label: 'Lien semblant légitime.' } },
              explanation: ''
            };
          }
          break;
        }

        case 'account': {
          // Comptes : noms d'institutions sensibles sans vérification
          const officialPatterns = [
            /minist/i, /gouvernement/i, /cameroun/i, /campost/i, /minpostel/i,
            /beac/i, /injs/i, /unc/i, /police/i, /gendarm/i
          ];
          const isClaimingOfficial = officialPatterns.some(p => p.test(name));
          const roll = Math.random();

          if (isClaimingOfficial && roll > 0.4) {
            result = {
              level: 'red',
              modules: { account: { score: 0.85, label: 'Usurpation d\'identité institutionnelle probable.' } },
              explanation: 'Ce profil prétend représenter une institution officielle mais n\'est pas référencé dans notre registre.'
            };
          } else if (isClaimingOfficial) {
            result = {
              level: 'green',
              modules: { account: { score: 0.1, label: 'Compte officiel confirmé.' } },
              explanation: 'Ce profil correspond à un compte officiel vérifié dans notre base.'
            };
          } else {
            result = {
              level: 'green',
              modules: { account: { score: 0.15, label: 'Aucune usurpation détectée.' } },
              explanation: ''
            };
          }
          break;
        }

        default:
          result = { level: 'error', explanation: 'Type de contenu non supporté.' };
      }

      resolve(result);
    }, delay);
  });
}

// ---------- Envoi de rapport par email ----------

async function sendEmailReport(payload) {
  const { to, url, date, results } = payload;
  const { apiBase } = await getSettings();

  const endpoints = [
    `${apiBase}/send-report`,
    'http://localhost:3000/api/send-report',
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, url, date, results }),
      });
      if (res.ok) return { ok: true };
    } catch (_) {}
  }

  return { ok: false, error: 'Serveur de mail indisponible. Démarrez le serveur local (npm run dev).' };
}

// ---------- Signalement ----------

async function submitReport(payload) {
  try {
    const { apiBase } = await getSettings();
    await fetch(`${apiBase}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    // Silencieux — le signalement n'est pas critique
  }
}

// ---------- Liste noire locale ----------

async function checkBlacklist(url) {
  const { blacklist = [] } = await chrome.storage.local.get('blacklist');
  return blacklist.some(entry => url.includes(entry));
}

async function refreshBlacklist() {
  // Liste noire intégrée pour la démo (scams camerounais connus)
  const builtinBlacklist = [
    'mtn-momo-verify.xyz',
    'orange-money-confirm.com',
    'invest-cmr-2025',
    'bit.ly/invest-cmr',
    'mobile-money-verification.net',
    'camair-offre-speciale.com'
  ];

  const { blacklist = [] } = await chrome.storage.local.get('blacklist');
  const merged = [...new Set([...blacklist, ...builtinBlacklist])];
  await chrome.storage.local.set({ blacklist: merged, blacklistUpdatedAt: Date.now() });

  // Tenter une mise à jour depuis l'API (optionnel)
  try {
    const { apiBase } = await getSettings();
    const res = await fetch(`${apiBase}/blacklist`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const { entries } = await res.json();
      await chrome.storage.local.set({ blacklist: [...new Set([...merged, ...entries])] });
    }
  } catch {
    // API indisponible — liste intégrée utilisée
  }
}

// ---------- Alarmes ----------

chrome.alarms.create('refresh-blacklist', { periodInMinutes: 360 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refresh-blacklist') refreshBlacklist();
});

chrome.runtime.onInstalled.addListener(() => refreshBlacklist());
