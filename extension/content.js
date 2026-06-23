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

// ── Sélecteurs de conteneurs de post ──────────────────────────

const POST_SELECTORS = {
  facebook:  ['div[role="article"]', 'div[data-pagelet^="FeedUnit"]', 'div[aria-posinset]'], // userContentWrapper et _5pcr sont obsolètes
  twitter:   ['article[data-testid="tweet"]', 'article'],
  whatsapp:  ['div.message-in', 'div.message-out', 'div[data-pre-plain-text]'],
  linkedin:  ['div.feed-shared-update-v2', 'div.occludable-update', 'div[data-urn]'],
  instagram: ['article', 'div[role="presentation"] article', 'section main article'],
  youtube:   ['ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-compact-video-renderer', '#primary ytd-watch-flexy'],
  tiktok:    ['div[data-e2e="recommend-list-item-container"]', 'div[class*="DivItemContainerV2"]', 'article'],
  reddit:    ['shreddit-post', 'div[data-testid="post-container"]', 'article', 'div.Post'],
  telegram:  ['div.message.js-message-start', 'div.im_message_wrap'],
  threads:   ['div[data-pressable-container="true"]', 'article', 'div[role="article"]'],
};

const CTX_LABELS = {
  video:   'Vérifier cette vidéo avec VigIA',
  text:    'Vérifier cette information avec VigIA',
  link:    'Vérifier ce lien avec VigIA',
  account: 'Vérifier ce compte avec VigIA',
};

const CTX_MODULE = {
  video: 'VÉRIF-MÉDIA', text: 'VÉRIF-INFO', link: 'VÉRIF-LIEN', account: 'VÉRIF-COMPTE',
};

const CTX_TO_MOD = {
  video: 'media', text: 'info', link: 'link', account: 'account',
};

// Libellés courts + icônes pour le menu multi-options au survol
const CTX_ICON  = { video: '🎬', text: '📰', link: '🔗', account: '👤' };
const CTX_SHORT = { video: 'Vidéo', text: 'Texte', link: 'Lien', account: 'Compte' };

const SHIELD_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><path d="M12 2L21 6V12C21 17 17 21 12 22C7 21 3 17 3 12V6Z" fill="#fff" fill-opacity=".9"/><path d="M8 12l3 3 5-6" stroke="#0A5C42" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ── Détection des types de contenu vérifiables ────────────────
// Renvoie un tableau ordonné (jamais vide) parmi : video, text, link, account.
// L'utilisateur choisit ensuite précisément quoi vérifier au survol.

function isProfilePage() {
  const slug = location.pathname.replace(/^\//, '').split('/')[0].split('?')[0];
  const feedSlugs = ['feed', 'watch', 'groups', 'events', 'marketplace',
                     'notifications', 'messages', 'home', 'explore', 'reels', ''];
  return slug.length > 2 && !feedSlugs.includes(slug);
}

function detectContexts(postEl) {
  const ctxs = [];

  if (postEl.querySelector('video')) ctxs.push('video');

  const link = postEl.querySelector([
    'a[href*="l.facebook.com/l.php"]', 'a[href*="bit.ly"]',
    'a[href*=".xyz"]', 'a[href*="t.co"]', 'a[href*="linktr.ee"]',
    'a[href*="tinyurl"]', 'a[href*="goo.gl"]',
  ].join(','));
  if (link) ctxs.push('link');

  const textEl = postEl.querySelector([
    'div[dir="auto"]', '[data-testid="tweetText"]', '.break-words',
    'span.selectable-text', 'p', 'yt-formatted-string#content',
    'span[class*="text"]', 'div[class*="text-content"]',
    'div[data-e2e="browse-video-desc"]',
  ].join(','));
  const hasText = (textEl?.innerText?.trim().length > 10)
    || (postEl.innerText || '').trim().length > 10;
  if (hasText) ctxs.push('text');

  // Compte : proposé sur les pages de profil, ou si le post expose un nom (h1/h2)
  if (isProfilePage() || postEl.querySelector('h1, h2, [data-testid="UserName"]')) {
    ctxs.push('account');
  }

  if (ctxs.length === 0) ctxs.push('text'); // toujours au moins le texte
  return ctxs;
}

// ── Floating CTA (un seul élément fixe, zéro injection dans les posts) ─

let FLOAT;
try {
  FLOAT = document.createElement('div');
  FLOAT.className = 'vigia-float';
  (document.body || document.documentElement).appendChild(FLOAT);
} catch (_) {
  FLOAT = document.createElement('div');
}

let _post      = null;
let _hasResult = false;
let _hideT     = null;
let _mouseX    = 0;
let _mouseY    = 0;

// Suivre la position du curseur pour positionner le bouton près de lui
document.addEventListener('mousemove', e => {
  _mouseX = e.clientX;
  _mouseY = e.clientY;
}, { passive: true });

function showFloat(postEl, ctxs) {
  if (_post === postEl && FLOAT.classList.contains('vigia-float--on')) return;

  clearTimeout(_hideT);
  _post = postEl;

  // Positionner près du curseur (toujours visible dans le viewport)
  const W = 300;
  const x = Math.max(8, Math.min(_mouseX - W / 2, window.innerWidth - W - 8));
  const y = Math.min(_mouseY + 18, window.innerHeight - 120);

  FLOAT.style.left  = x + 'px';
  FLOAT.style.top   = y + 'px';
  FLOAT.style.width = W + 'px';

  if (!_hasResult) renderIdleBtn(postEl, ctxs);
  FLOAT.classList.add('vigia-float--on');
}

function runCheck(postEl, ctx) {
  _hasResult = true;
  triggerAnalysis(postEl, ctx, FLOAT);
}

function renderIdleBtn(postEl, ctxs) {
  FLOAT.innerHTML = '';
  const list = Array.isArray(ctxs) ? ctxs : [ctxs || 'text'];

  // Un seul type → bouton unique (comportement d'origine)
  if (list.length === 1) {
    const ctx = list[0];
    const btn = document.createElement('button');
    btn.className = 'vigia-float-btn';
    btn.innerHTML = `${SHIELD_SVG}<span>${CTX_LABELS[ctx] || CTX_LABELS.text}</span>`;
    btn.addEventListener('click', e => {
      e.stopPropagation(); e.preventDefault();
      runCheck(postEl, ctx);
    });
    FLOAT.appendChild(btn);
    return;
  }

  // Plusieurs types → menu : l'utilisateur choisit quoi vérifier précisément
  const menu = document.createElement('div');
  menu.className = 'vigia-float-menu';

  const title = document.createElement('div');
  title.className = 'vigia-float-title';
  title.innerHTML = `${SHIELD_SVG}<span>Vérifier avec VigIA</span>`;
  menu.appendChild(title);

  const row = document.createElement('div');
  row.className = 'vigia-float-options';
  list.forEach(ctx => {
    const opt = document.createElement('button');
    opt.className = `vigia-float-opt vigia-opt--${ctx}`;
    opt.title = CTX_LABELS[ctx] || '';
    opt.innerHTML = `<span class="vigia-opt-ic">${CTX_ICON[ctx] || '🔍'}</span><span>${CTX_SHORT[ctx] || 'Vérifier'}</span>`;
    opt.addEventListener('click', e => {
      e.stopPropagation(); e.preventDefault();
      runCheck(postEl, ctx);
    });
    row.appendChild(opt);
  });
  menu.appendChild(row);
  FLOAT.appendChild(menu);
}

function scheduleHide() {
  if (_hasResult) return;
  clearTimeout(_hideT);
  _hideT = setTimeout(() => {
    FLOAT.classList.remove('vigia-float--on');
    _post = null;
  }, 350);
}

FLOAT.addEventListener('mouseenter', () => clearTimeout(_hideT));
FLOAT.addEventListener('mouseleave', scheduleHide);

// ── Détection paresseuse au survol ────────────────────────────
// On ne marque jamais skip définitivement. Chaque survol réessaie
// de détecter le contexte si non encore mis en cache.

function findPostUnderCursor(target) {
  if (!SITE) return null;
  const selectors = POST_SELECTORS[SITE] || [];
  for (const sel of selectors) {
    try {
      const el = target.closest(sel);
      if (!el) continue;

      // Contexte déjà mis en cache
      if (el.dataset.vigiaCtxs) return el;

      // Détection à la volée (lazy) — contenu peut avoir chargé depuis la dernière fois
      const ctxs = detectContexts(el);
      if (ctxs.length) {
        el.dataset.vigiaCtxs = ctxs.join(',');
        return el;
      }
    } catch (_) {}
  }
  return null;
}

// ── Event delegation ──────────────────────────────────────────

document.addEventListener('mouseover', e => {
  if (!SITE) return;
  if (FLOAT && FLOAT.isConnected && FLOAT.contains(e.target)) {
    clearTimeout(_hideT);
    return;
  }
  if (_hasResult) return;

  const postEl = findPostUnderCursor(e.target);
  if (postEl) {
    const ctxs = (postEl.dataset.vigiaCtxs || 'text').split(',');
    showFloat(postEl, ctxs);
  } else {
    scheduleHide();
  }
}, { passive: true });

// ── Pré-marquer les posts au chargement (accélère le premier survol) ─

function markPosts() {
  if (!SITE) return;
  const selectors = POST_SELECTORS[SITE] || [];
  let posts = [];
  for (const sel of selectors) {
    try {
      const els = Array.from(document.querySelectorAll(sel));
      if (els.length) { posts = els; break; }
    } catch (_) {}
  }
  posts.slice(0, 40).forEach(el => {
    if (el.dataset.vigiaCtxs) return; // déjà marqué
    const ctxs = detectContexts(el);
    if (ctxs.length) el.dataset.vigiaCtxs = ctxs.join(',');
  });
}

// ── Lecture de la page (popup "Tout vérifier") ────────────────

function getPageSummary() {
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

  // Profil : uniquement sur les pages de profil (pas le feed)
  const slug = location.pathname.replace(/^\//, '').split('/')[0].split('?')[0];
  const feedSlugs = ['feed','watch','groups','events','marketplace','notifications','messages','home',''];
  const isProfilePage = slug.length > 2 && !feedSlugs.includes(slug);

  const profileName = isProfilePage
    ? ([
        document.querySelector('h1'),
        document.querySelector('h2'),
        document.querySelector('[data-testid="UserName"]'),
        document.querySelector('#fb-timeline-cover-name'),
      ].map(el => el?.innerText?.trim()).find(t => t && t.length > 1) || slug)
    : '';

  return {
    text,
    hasMedia,
    hasSuspLinks: suspLinks.length > 0,
    firstSuspLink: suspLinks[0]?.href || '',
    profileName,
  };
}

// ── Analyse au clic ────────────────────────────────────────────

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
    const url = a?.href || location.href;
    return { type: 'url', content: { url }, source: SITE, cacheKey: `url:${simpleHash(url)}` };
  }
  if (context === 'account') {
    const name = postEl.querySelector('h1, h2')?.innerText?.trim()
      || postEl.getAttribute('aria-label')
      || location.pathname.replace(/^\//, '').split('/')[0];
    return { type: 'account', content: { profile_name: name, profile_image_url: '' }, source: SITE, cacheKey: `acc:${simpleHash(name)}` };
  }
  // text (défaut)
  const textEl = postEl.querySelector('div[dir="auto"], [data-testid="tweetText"], .break-words, p') || postEl;
  const text = (textEl.innerText || postEl.innerText || '').trim().slice(0, 1000);
  if (!text) return null;
  return { type: 'text', content: { text }, source: SITE, cacheKey: `txt:${simpleHash(text)}` };
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

// ── États du floating panel ────────────────────────────────────

function setCtaLoading(cta) {
  cta.innerHTML = `<div class="vigia-loading"><span class="vigia-spinner"></span>Analyse en cours…</div>`;
}

function setCtaError(cta, msg) {
  _hasResult = false;
  cta.innerHTML = `<div class="vigia-error">${msg}</div>`;
  setTimeout(scheduleHide, 3000);
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
        <button class="vigia-result-close" title="Fermer">✕</button>
      </div>
      <div class="vigia-result-label">${escHtml(label)}</div>
      ${detail ? `<div class="vigia-result-detail">${escHtml(detail)}</div>` : ''}
      <button class="vigia-result-report">Signaler</button>
    </div>`;

  cta.querySelector('.vigia-result-close')?.addEventListener('click', e => {
    e.stopPropagation();
    _hasResult = false;
    _post = null;
    FLOAT.classList.remove('vigia-float--on');
  });
  cta.querySelector('.vigia-result-report')?.addEventListener('click', e => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'REPORT', payload: { result, url: location.href } });
    e.target.textContent = 'Signalé ✓';
    e.target.disabled = true;
  });

  setTimeout(() => {
    if (_hasResult) {
      _hasResult = false;
      _post = null;
      FLOAT.classList.remove('vigia-float--on');
    }
  }, 12000);
}

// ── Listener messages du popup ─────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg.type === 'SCAN_PAGE') {
    try { sendResponse({ ok: true, site: SITE, ...getPageSummary() }); }
    catch (e) { sendResponse({ ok: false, error: String(e) }); }
    return false;
  }
  if (msg.type === 'SCAN_ALL' || msg.type === 'SCAN_MODULE') {
    sendResponse({ ok: true });
    return false;
  }
});

// ── Démarrage + MutationObserver ──────────────────────────────

if (SITE) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { try { markPosts(); } catch (_) {} });
  } else {
    try { markPosts(); } catch (_) {}
  }

  let _markTimer = null;
  const mo = new MutationObserver(() => {
    clearTimeout(_markTimer);
    _markTimer = setTimeout(() => { try { markPosts(); } catch (_) {} }, 600);
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

// ── Utilitaires ───────────────────────────────────────────────

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < Math.min(str.length, 200); i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h.toString(36);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
