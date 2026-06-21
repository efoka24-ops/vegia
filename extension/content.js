// ── Détection du site ──────────────────────────────────────────

const SITE = (() => {
  const h = location.hostname;
  if (h.includes('facebook'))  return 'facebook';
  if (h.includes('twitter') || h === 'x.com' || h.endsWith('.x.com')) return 'twitter';
  if (h.includes('whatsapp'))  return 'whatsapp';
  if (h.includes('linkedin'))  return 'linkedin';
  if (h.includes('instagram')) return 'instagram';
  if (h.includes('youtube'))   return 'youtube';
  if (h.includes('tiktok'))    return 'tiktok';
  if (h.includes('reddit'))    return 'reddit';
  if (h.includes('telegram'))  return 'telegram';
  if (h.includes('threads'))   return 'threads';
  return null;
})();

if (!SITE) { /* site non supporté — arrêt silencieux */ }

// ── Sélecteurs : UN conteneur par post ────────────────────────

// On cible le conteneur de post entier, pas les sous-éléments.
// Un seul bouton sera injecté par conteneur.
const POST_SELECTORS = {
  facebook:  [
    'div[role="article"]',
    'div[data-pagelet^="FeedUnit"]',
    'div[aria-posinset]',
    'div.userContentWrapper',
    'div._5pcr',
  ],
  twitter:   ['article[data-testid="tweet"]', 'article'],
  whatsapp:  ['div.message-in', 'div.message-out', 'div[data-pre-plain-text]'],
  linkedin:  ['div.feed-shared-update-v2', 'div.occludable-update', 'div[data-urn]'],
  instagram: ['article', 'div[role="presentation"] article', 'div._aagv', 'section main article'],
  youtube:   ['ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-compact-video-renderer', '#primary ytd-watch-flexy'],
  tiktok:    ['div[data-e2e="recommend-list-item-container"]', 'div[class*="DivItemContainerV2"]', 'div[class*="DivVideoFeedV2"]', 'article'],
  reddit:    ['shreddit-post', 'div[data-testid="post-container"]', 'article', 'div.Post'],
  telegram:  ['div.message.js-message-start', 'div.im_message_wrap', 'div[class*="im_message"]'],
  threads:   ['div[data-pressable-container="true"]', 'article', 'div[role="article"]'],
};

// Labels selon le type de contenu détecté dans le post
const CTX_LABELS = {
  video:   'Vérifier cette vidéo avec VigIA',
  text:    'Vérifier cette information avec VigIA',
  link:    'Vérifier ce lien avec VigIA',
  account: 'Vérifier ce compte avec VigIA',
};

const CTX_MODULE = {
  video:   'VÉRIF-MÉDIA',
  text:    'VÉRIF-INFO',
  link:    'VÉRIF-LIEN',
  account: 'VÉRIF-COMPTE',
};

const CTX_TO_MOD = {
  video: 'media', text: 'info', link: 'link', account: 'account',
};

const SHIELD_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><path d="M12 2L21 6V12C21 17 17 21 12 22C7 21 3 17 3 12V6Z" fill="#0A5C42"/><path d="M8 12l3 3 5-6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ── Détection du type de contenu dans un post ─────────────────

function detectContext(postEl) {
  if (postEl.querySelector('video')) return 'video';

  const link = postEl.querySelector([
    'a[href*="l.facebook.com/l.php"]', 'a[href*="bit.ly"]',
    'a[href*=".xyz"]', 'a[href*="t.co"]', 'a[href*="linktr.ee"]',
    'a[href*="tinyurl"]', 'a[href*="goo.gl"]',
  ].join(','));
  if (link) return 'link';

  const textEl = postEl.querySelector([
    'div[dir="auto"]', '[data-testid="tweetText"]', '.break-words',
    'span.selectable-text', 'p', 'yt-formatted-string#content',
    'span[class*="text"]', 'div[class*="text-content"]',
    'div[data-e2e="browse-video-desc"]',
  ].join(','));
  if (textEl?.innerText?.trim().length > 20) return 'text';

  return null;
}

// ── Injection : UN bouton par post ─────────────────────────────

function injectButtons() {
  if (!SITE) return;

  const selectors = POST_SELECTORS[SITE] || [];

  // Chercher les conteneurs de post dans l'ordre de priorité
  let posts = [];
  for (const sel of selectors) {
    try {
      const els = Array.from(document.querySelectorAll(sel));
      if (els.length) { posts = els; break; }
    } catch (_) {}
  }

  posts.slice(0, 20).forEach(attachOneButton);

  // Page de profil : ajouter un bouton "Vérifier ce compte"
  injectProfileButton();
}

function attachOneButton(postEl) {
  if (postEl.dataset.vigiaOk) return;

  const context = detectContext(postEl);
  if (!context) {
    // Marquer quand même pour ne pas ré-essayer à chaque mutation
    postEl.dataset.vigiaOk = 'skip';
    return;
  }

  postEl.dataset.vigiaOk = '1';

  const cta = document.createElement('div');
  cta.className = 'vigia-cta';
  cta.dataset.vigiaContext = context;

  const btn = document.createElement('button');
  btn.className = 'vigia-btn';
  btn.innerHTML = `${SHIELD_SVG}${CTX_LABELS[context]}`;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    triggerAnalysis(postEl, context, cta);
  });

  cta.appendChild(btn);

  // Insérer à la FIN du post (comme un footer natif)
  // On utilise appendChild : le bouton s'ajoute après tout le contenu du post
  try {
    postEl.appendChild(cta);
  } catch (_) {
    try { postEl.insertAdjacentElement('afterend', cta); } catch (__) {}
  }
}

// ── Bouton "Vérifier ce compte" sur page de profil ─────────────

function injectProfileButton() {
  // Détecte si on est sur une page de profil (URL = /pseudo ou /profile.php)
  const isProfilePage =
    /^\/(?!groups|pages|watch|events|marketplace|gaming)[^/?#]+\/?$/.test(location.pathname) ||
    location.pathname.includes('/profile.php');

  if (!isProfilePage) return;

  const profileZone = document.querySelector(
    'h1, [id*="profile"], [data-pagelet="ProfileTilesFeed"], .profileTimeline, #timeline'
  );
  if (!profileZone || profileZone.dataset.vigiaProfileOk) return;
  profileZone.dataset.vigiaProfileOk = '1';

  const cta = document.createElement('div');
  cta.className = 'vigia-cta vigia-cta--profile';
  cta.dataset.vigiaContext = 'account';

  const btn = document.createElement('button');
  btn.className = 'vigia-btn';
  btn.innerHTML = `${SHIELD_SVG}${CTX_LABELS.account}`;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    triggerAnalysis(profileZone, 'account', cta);
  });

  cta.appendChild(btn);

  // Insérer après la zone de profil
  try { profileZone.insertAdjacentElement('afterend', cta); } catch (_) {}
}

// ── Lecture de la page (pour popup "Tout vérifier") ────────────

function getPageSummary() {
  // Texte des posts
  const textEls = Array.from(document.querySelectorAll(
    'div[dir="auto"], [data-testid="tweetText"], .break-words, span.selectable-text, p'
  ));
  const text = textEls
    .map(el => el.innerText?.trim())
    .filter(t => t && t.length > 20)
    .slice(0, 6)
    .join('\n\n')
    .slice(0, 2000);

  const hasMedia = document.querySelectorAll('video').length > 0
    || document.querySelectorAll([
      'img[src*="fbcdn"]', 'img[src*="scontent"]', 'img[src*="licdn"]',
      'img[src*="cdninstagram"]', 'img[src*="ytimg"]', 'img[src*="twimg"]',
    ].join(',')).length > 3;

  const suspLinks = Array.from(document.querySelectorAll([
    'a[href*="l.facebook.com/l.php"]', 'a[href*="bit.ly"]',
    'a[href*=".xyz"]', 'a[href*="t.co"]', 'a[href*="tinyurl"]',
    'a[href*="linktr.ee"]',
  ].join(',')));
  const firstSuspLink = suspLinks[0]?.href || '';

  const profileName = [
    document.querySelector('h1'),
    document.querySelector('h2'),
    document.querySelector('#fb-timeline-cover-name'),
    document.querySelector('._2yap'),
  ].map(el => el?.innerText?.trim()).find(t => t && t.length > 1) || '';

  const slug = location.pathname.replace(/^\//, '').split('/')[0].split('?')[0];

  return {
    text,
    hasMedia,
    hasSuspLinks: suspLinks.length > 0,
    firstSuspLink,
    profileName: profileName || slug,
  };
}

// ── Analyse d'un post ──────────────────────────────────────────

function triggerAnalysis(postEl, context, cta) {
  const payload = buildPayload(postEl, context);
  if (!payload) { setCtaError(cta, 'Contenu non lisible.'); return; }

  setCtaLoading(cta);

  chrome.runtime.sendMessage({ type: 'VERIFY', payload }, result => {
    if (chrome.runtime.lastError || !result) {
      setCtaError(cta, 'Erreur d\'analyse.');
      return;
    }
    renderResult(cta, result, context);
    notifyPopup(context, result);
  });
}

function buildPayload(postEl, context) {
  if (context === 'video') {
    const vid = postEl.querySelector('video');
    const src = vid?.src || vid?.querySelector('source')?.src || location.href;
    return { type: 'image', content: { image_url: src }, source: SITE, cacheKey: `vid:${simpleHash(src)}` };
  }

  if (context === 'link') {
    const a = postEl.querySelector('a[href*="l.facebook.com/l.php"], a[href*="bit.ly"], a[href*="t.co"]');
    if (!a) return null;
    return { type: 'url', content: { url: a.href }, source: SITE, cacheKey: `url:${a.href}` };
  }

  if (context === 'text') {
    const textEl = postEl.querySelector('div[dir="auto"], [data-testid="tweetText"], .break-words, p') || postEl;
    const text = textEl.innerText?.trim();
    if (!text || text.length < 15) return null;
    return { type: 'text', content: { text: text.slice(0, 1000) }, source: SITE, cacheKey: `txt:${simpleHash(text)}` };
  }

  if (context === 'account') {
    const name = postEl.querySelector('h1, h2')?.innerText?.trim()
      || postEl.getAttribute('aria-label')
      || location.pathname.replace(/^\//, '').split('/')[0];
    return { type: 'account', content: { profile_name: name, profile_image_url: '' }, source: SITE, cacheKey: `acc:${simpleHash(name)}` };
  }

  return null;
}

// ── Notification du popup ──────────────────────────────────────

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
  cta.innerHTML = `<div class="vigia-error">${msg}</div>`;
}

function renderResult(cta, result, context) {
  const level  = result.level || 'error';
  const module = CTX_MODULE[context] || 'VÉRIF';
  const mods   = result.modules || {};
  const mod    = Object.values(mods)[0];
  const score  = mod?.score != null ? Math.round(mod.score * 100) : null;
  const label  = mod?.label || result.explanation || '—';
  const detail = result.explanation && result.explanation !== mod?.label ? result.explanation : '';
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
  if (msg.type === 'SCAN_PAGE') {
    try { sendResponse({ ok: true, site: SITE, ...getPageSummary() }); }
    catch (e) { sendResponse({ ok: false, error: String(e) }); }
    return false;
  }

  if (msg.type === 'SCAN_ALL') {
    try { injectButtons(); } catch (_) {}
    setTimeout(() => {
      const btns = Array.from(document.querySelectorAll('.vigia-btn'));
      btns.forEach(b => { try { b.click(); } catch (_) {} });
      sendResponse({ ok: true, found: btns.length });
    }, 500);
    return true;
  }

  if (msg.type === 'SCAN_MODULE') {
    // Pour les boutons individuels du popup, cliquer les boutons du bon contexte
    const { context } = msg;
    const ctxMap = { media: 'video', info: 'text', link: 'link', account: 'account' };
    const wantedCtx = ctxMap[context] || context;
    setTimeout(() => {
      const ctas = document.querySelectorAll(`.vigia-cta[data-vigia-context="${wantedCtx}"]`);
      let found = 0;
      ctas.forEach(cta => {
        const btn = cta.querySelector('.vigia-btn');
        if (btn) { btn.click(); found++; }
      });
      sendResponse({ ok: true, found });
    }, 400);
    return true;
  }
});

// ── MutationObserver + démarrage ──────────────────────────────

if (SITE) {
  // Injecter les boutons au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { try { injectButtons(); } catch (_) {} });
  } else {
    try { injectButtons(); } catch (_) {}
  }

  // Ré-injecter quand de nouveaux posts sont chargés (scroll infini)
  let injectTimer = null;
  const mo = new MutationObserver(() => {
    clearTimeout(injectTimer);
    injectTimer = setTimeout(() => { try { injectButtons(); } catch (_) {} }, 600);
  });
  mo.observe(document.body, { childList: true, subtree: true });
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
