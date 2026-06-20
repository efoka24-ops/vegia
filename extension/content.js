// ── Détection du site ──────────────────────────────────────────

const SITE = (() => {
  const h = location.hostname;
  if (h.includes('facebook'))  return 'facebook';
  if (h.includes('twitter') || h.includes('x.com')) return 'twitter';
  if (h.includes('whatsapp'))  return 'whatsapp';
  if (h.includes('linkedin'))  return 'linkedin';
  return null;
})();

if (!SITE) { /* site non supporté - arrêt silencieux */ }

// ── Sélecteurs par site ────────────────────────────────────────

const SELECTORS = {
  facebook: {
    // Posts : fallbacks pour www + web.facebook.com
    posts: [
      'div[data-pagelet^="FeedUnit"]',   // www.facebook.com
      'div[role="article"]',             // www.facebook.com
      'div[aria-posinset]',              // www.facebook.com
      'div.userContentWrapper',          // web.facebook.com
      'div._5pcr',                       // web.facebook.com (classique)
      'div[data-testid="fbfeed_story"]', // web.facebook.com
    ],
    videos:   ['video'],
    links:    ['a[href*="l.facebook.com/l.php"]', 'a[href*="bit.ly"]', 'a[href*=".xyz"]'],
    profiles: [
      'a[href*="profile.php"] img',
      'h2 a[href*="facebook.com"]',
      'h1',  // page de profil : le h1 est le nom du compte
    ],
    // Sélecteur text pour SCAN_PAGE
    textNodes: [
      'div[dir="auto"]',       // www.facebook.com
      'div[data-ad-comet-preview="message"]',
      'span._5yl5',            // web.facebook.com
      'div.userContent p',     // web.facebook.com
      'p',                     // fallback générique
    ],
  },
  twitter: {
    posts:     ['article[data-testid="tweet"]', 'article'],
    videos:    ['video'],
    links:     ['a[href*="t.co"]'],
    profiles:  ['a[href$="/photo"] img'],
    textNodes: ['[data-testid="tweetText"]'],
  },
  whatsapp: {
    posts:     ['div.message-in', 'div.message-out', 'div[data-pre-plain-text]'],
    videos:    ['video'],
    links:     ['a[href*="http"]'],
    profiles:  ['img[src*="pps.whatsapp"]'],
    textNodes: ['span.selectable-text'],
  },
  linkedin: {
    posts:     ['div.feed-shared-update-v2', 'div.occludable-update', 'div[data-urn]'],
    videos:    ['video'],
    links:     ['a.feed-shared-article__title', 'a[href*="/pulse/"]'],
    profiles:  ['img.EntityPhoto-circle-3', 'img.presence-entity__image'],
    textNodes: ['.feed-shared-text .break-words', 'span.break-words'],
  },
};

const CTX_LABELS = {
  posts:    'Vérifier ce texte avec VigIA',
  videos:   'Vérifier cette vidéo avec VigIA',
  links:    'Vérifier ce lien avec VigIA',
  profiles: 'Vérifier ce compte avec VigIA',
};

const CTX_MODULE = {
  posts:    'VÉRIF-INFO',
  videos:   'VÉRIF-MÉDIA',
  links:    'VÉRIF-LIEN',
  profiles: 'VÉRIF-COMPTE',
};

const CTX_TO_MOD = {
  posts: 'info', videos: 'media', links: 'link', profiles: 'account',
};

const SHIELD_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;display:block"><path d="M12 2L21 6V12C21 17 17 21 12 22C7 21 3 17 3 12V6Z" fill="#0A5C42"/><path d="M8 12l3 3 5-6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ── Lecture de la page (fiable, sans sélecteurs complexes) ─────

function getPageSummary() {
  const cfg = SELECTORS[SITE] || {};

  // Texte : prendre les premiers nœuds texte significatifs
  const textEls = queryAny(cfg.textNodes || []);
  const text = textEls
    .map(el => el.innerText?.trim())
    .filter(t => t && t.length > 20)
    .slice(0, 6)
    .join('\n\n')
    .slice(0, 2000);

  // Vidéos / images media
  const videos   = document.querySelectorAll('video').length;
  const feedImgs = document.querySelectorAll(
    'img[src*="fbcdn"], img[src*="scontent"], img[src*="licdn"], img[src*="twimg"]'
  ).length;
  const hasMedia = videos > 0 || feedImgs > 3;

  // Liens suspects
  const suspLinks     = queryAny(cfg.links || []);
  const firstSuspLink = suspLinks[0]?.href || '';

  // Nom de profil — essayer plusieurs sources
  const profileName = [
    document.querySelector('h1'),
    document.querySelector('[data-pagelet="ProfileTilesFeed"] h2'),
    document.querySelector('h2'),
    document.querySelector('#fb-timeline-cover-name'),       // web.facebook.com
    document.querySelector('[id="pageTitle"]'),              // web.facebook.com
    document.querySelector('._2yap, ._19bm, .actor-name'),  // web.facebook.com classique
  ]
    .map(el => el?.innerText?.trim())
    .find(t => t && t.length > 1) || '';

  // URL de profil : si c'est une page utilisateur, extraire le slug
  const slug = location.pathname.replace(/^\//, '').split('?')[0] || '';

  return {
    text,
    hasMedia,
    hasSuspLinks: suspLinks.length > 0,
    firstSuspLink,
    profileName: profileName || slug,  // fallback sur le slug URL
  };
}

// ── Injection des boutons contextuels ─────────────────────────

function queryAny(selectors) {
  for (const sel of selectors) {
    try {
      const els = Array.from(document.querySelectorAll(sel));
      if (els.length) return els;
    } catch (_) {}
  }
  return [];
}

function injectButtons() {
  if (!SITE) return;
  const cfg = SELECTORS[SITE];

  // Posts / articles
  const postEls = queryAny(cfg.posts || []);
  postEls.slice(0, 10).forEach(el => attachButton(el, 'posts'));

  // Vidéos
  document.querySelectorAll('video').forEach(el => attachButton(el, 'videos'));

  // Liens
  queryAny(cfg.links || []).slice(0, 5).forEach(el => attachButton(el, 'links'));

  // Profils
  queryAny(cfg.profiles || []).slice(0, 3).forEach(el => attachButton(el, 'profiles'));
}

function attachButton(element, context) {
  if (!element || element.dataset.vigiaOk) return;
  element.dataset.vigiaOk = '1';

  const cta = document.createElement('div');
  cta.className = 'vigia-cta';
  cta.dataset.vigiaContext = context;

  const btn = document.createElement('button');
  btn.className = 'vigia-btn';
  btn.innerHTML = `${SHIELD_SVG}${CTX_LABELS[context] || 'Vérifier avec VigIA'}`;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    triggerAnalysis(element, context, cta);
  });

  cta.appendChild(btn);

  // Toujours insérer APRÈS l'élément (pas dedans) pour éviter que React le retire
  try { element.insertAdjacentElement('afterend', cta); } catch (_) {}
}

// ── Analyse d'un élément individuel ───────────────────────────

function triggerAnalysis(element, context, cta) {
  const payload = buildPayload(element, context);
  if (!payload) { setCtaError(cta, 'Contenu non lisible.'); return; }

  setCtaLoading(cta);

  chrome.runtime.sendMessage({ type: 'VERIFY', payload }, result => {
    if (chrome.runtime.lastError || !result) { setCtaError(cta, 'Erreur d\'analyse.'); return; }
    renderResult(cta, result, context);
    notifyPopup(context, result);
  });
}

function buildPayload(element, context) {
  const tag = element.tagName;

  if (context === 'posts') {
    const textEl = element.querySelector('div[dir="auto"], p, span') || element;
    const text   = textEl.innerText?.trim() || element.innerText?.trim();
    if (!text || text.length < 15) return null;
    return { type: 'text', content: { text: text.slice(0, 1000) }, source: SITE, cacheKey: `txt:${simpleHash(text)}` };
  }

  if (context === 'videos') {
    const src = element.src || element.querySelector('source')?.src || location.href;
    return { type: 'image', content: { image_url: src }, source: SITE, cacheKey: `vid:${simpleHash(src)}` };
  }

  if (context === 'links' && tag === 'A') {
    return { type: 'url', content: { url: element.href }, source: SITE, cacheKey: `url:${element.href}` };
  }

  if (context === 'profiles') {
    const name = tag === 'IMG'
      ? (element.closest('a')?.getAttribute('aria-label') || element.alt || '')
      : (element.innerText?.trim() || '');
    const imgUrl = tag === 'IMG' ? element.src : '';
    return { type: 'account', content: { profile_name: name, profile_image_url: imgUrl }, source: SITE, cacheKey: `acc:${simpleHash(name)}` };
  }

  return null;
}

// ── Notification popup ─────────────────────────────────────────

function notifyPopup(context, result) {
  const mod   = CTX_TO_MOD[context];
  const level = result.level || 'error';
  if (!mod || level === 'error') return;

  const mods    = result.modules || {};
  const modData = Object.values(mods)[0];
  const score   = modData?.score != null ? Math.round(modData.score * 100) : null;
  const label   = modData?.label || result.explanation || '—';
  const badge   = level === 'red'    ? (score != null ? `⚠ ${score}%` : '⚠ alerte')
                : level === 'orange' ? (score != null ? `⚠ ${score}%` : '⚠ douteux')
                : '✓ RAS';

  try { chrome.runtime.sendMessage({ type: 'SCAN_RESULT', mod, result: { level, badge, label } }); } catch (_) {}
}

// ── États CTA ─────────────────────────────────────────────────

function setCtaLoading(cta) {
  cta.innerHTML = `
    <div class="vigia-loading"><span class="vigia-spinner"></span>Analyse en cours…</div>
    <div class="vigia-scan-bar"><div class="vigia-scan-progress"></div></div>`;
}

function setCtaError(cta, msg) {
  cta.innerHTML = `<div class="vigia-error">${msg || 'Erreur.'}</div>`;
}

function renderResult(cta, result, context) {
  const level  = result.level || 'error';
  const module = CTX_MODULE[context] || 'VÉRIF';
  const mods   = result.modules || {};
  const mod    = Object.values(mods)[0];
  const score  = mod?.score != null ? Math.round(mod.score * 100) : null;
  const label  = mod?.label || result.explanation || '—';
  const detail = (result.explanation && result.explanation !== mod?.label) ? result.explanation : '';
  const icons  = { red: '⚠️', orange: '⚠️', green: '✅', error: '❓' };

  cta.innerHTML = `
    <div class="vigia-result vigia-result--${level}">
      <div class="vigia-result-header">
        <span class="vigia-result-icon">${icons[level] || '❓'}</span>
        <span class="vigia-result-module">${module}</span>
        ${score !== null ? `<span class="vigia-result-score">${score}%</span>` : ''}
      </div>
      <div class="vigia-result-label">${escHtml(label)}</div>
      ${detail ? `<div class="vigia-result-detail">${escHtml(detail)}</div>` : ''}
      <button class="vigia-result-report">Signaler</button>
    </div>`;

  cta.querySelector('.vigia-result-report')?.addEventListener('click', e => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'REPORT', payload: { result, url: location.href } });
    e.target.textContent = 'Signalé ✓';
    e.target.disabled = true;
  });
}

// ── Listener messages du popup ─────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {

  // SCAN_PAGE : lire la page sans dépendre des sélecteurs d'injection
  if (msg.type === 'SCAN_PAGE') {
    try {
      sendResponse({ ok: true, site: SITE, ...getPageSummary() });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return false;
  }

  // SCAN_ALL : injecter les boutons puis les cliquer
  if (msg.type === 'SCAN_ALL') {
    try { injectButtons(); } catch (_) {}
    setTimeout(() => {
      const btns = Array.from(document.querySelectorAll('.vigia-btn'));
      btns.forEach(btn => { try { btn.click(); } catch (_) {} });
      sendResponse({ ok: true, found: btns.length });
    }, 400);
    return true;
  }

  // SCAN_MODULE : cliquer les boutons d'un type précis
  if (msg.type === 'SCAN_MODULE') {
    const { context } = msg;
    try {
      const cfg = SELECTORS[SITE] || {};
      queryAny(cfg[context] || []).forEach(el => {
        if (!el.dataset.vigiaOk) attachButton(el, context);
      });
    } catch (_) {}
    setTimeout(() => {
      const ctas = document.querySelectorAll(`.vigia-cta[data-vigia-context="${context}"]`);
      let found  = 0;
      ctas.forEach(cta => {
        const btn = cta.querySelector('.vigia-btn');
        if (btn) { btn.click(); found++; }
      });
      sendResponse({ ok: true, found });
    }, 400);
    return true;
  }
});

// ── MutationObserver pour scroll infini ───────────────────────

if (SITE) {
  const mo = new MutationObserver(() => {
    try { injectButtons(); } catch (_) {}
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // Premier scan après chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { try { injectButtons(); } catch (_) {} });
  } else {
    try { injectButtons(); } catch (_) {}
  }
}

// ── Utilitaires ───────────────────────────────────────────────

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < Math.min(str.length, 200); i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
