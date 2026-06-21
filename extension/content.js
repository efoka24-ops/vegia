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

// ── Sélecteurs de conteneur de post ───────────────────────────

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
  video:   'VÉRIF-MÉDIA',
  text:    'VÉRIF-INFO',
  link:    'VÉRIF-LIEN',
  account: 'VÉRIF-COMPTE',
};

const CTX_TO_MOD = {
  video: 'media', text: 'info', link: 'link', account: 'account',
};

const SHIELD_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><path d="M12 2L21 6V12C21 17 17 21 12 22C7 21 3 17 3 12V6Z" fill="#fff" fill-opacity=".9"/><path d="M8 12l3 3 5-6" stroke="#0A5C42" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ── Floating CTA (UN seul élément fixe, zéro injection dans les posts) ─

const FLOAT = (() => {
  const el = document.createElement('div');
  el.className = 'vigia-float';
  document.body.appendChild(el);
  return el;
})();

let _post      = null;   // post actuellement survolé
let _hasResult = false;  // un résultat est affiché → ne pas remplacer
let _hideT     = null;

function showFloat(postEl, ctx) {
  if (_post === postEl && FLOAT.classList.contains('vigia-float--on')) return; // déjà affiché pour ce post

  clearTimeout(_hideT);
  _post = postEl;

  positionFloat(postEl);
  renderIdleBtn(postEl, ctx);
  FLOAT.classList.add('vigia-float--on');
}

function positionFloat(postEl) {
  const r = postEl.getBoundingClientRect();
  const W = 300;
  const left = Math.max(8, Math.min(
    r.left + (r.width - W) / 2,
    window.innerWidth - W - 8
  ));
  // Positionner en bas du post, visible dans le viewport
  const top = Math.max(8, Math.min(
    r.bottom - 52,
    window.innerHeight - 60
  ));
  FLOAT.style.left  = left + 'px';
  FLOAT.style.top   = top  + 'px';
  FLOAT.style.width = W    + 'px';
}

function renderIdleBtn(postEl, ctx) {
  FLOAT.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'vigia-float-btn';
  btn.innerHTML = `${SHIELD_SVG}<span>${CTX_LABELS[ctx]}</span>`;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    _hasResult = true;
    triggerAnalysis(postEl, ctx, FLOAT);
  });
  FLOAT.appendChild(btn);
}

function scheduleHide() {
  if (_hasResult) return; // ne pas cacher pendant qu'un résultat est affiché
  clearTimeout(_hideT);
  _hideT = setTimeout(() => {
    FLOAT.classList.remove('vigia-float--on');
    _post = null;
  }, 350);
}

// Mise à jour de la position au scroll
window.addEventListener('scroll', () => {
  if (_post && FLOAT.classList.contains('vigia-float--on') && !_hasResult) {
    positionFloat(_post);
  }
}, { passive: true });

// ── Event delegation : mouseover sur document (robuste face aux overlays) ─
// Utiliser mouseover (bubblement) + closest() plutôt que mouseenter direct.
// On itère chaque sélecteur séparément pour trouver l'ancêtre MARQUÉ le plus
// proche, évitant que closest(csv) ne remonte vers un élément non marqué.

function findMarkedPost(target) {
  const selectors = POST_SELECTORS[SITE] || [];
  for (const sel of selectors) {
    try {
      const el = target.closest(sel);
      if (el && el.dataset.vigiaOk === '1') return el;
    } catch (_) {}
  }
  return null;
}

document.addEventListener('mouseover', e => {
  // Hover sur le floating panel → garder visible
  if (FLOAT.contains(e.target)) {
    clearTimeout(_hideT);
    return;
  }

  // Un résultat est affiché → ne pas perturber
  if (_hasResult) return;

  const postEl = findMarkedPost(e.target);

  if (postEl) {
    showFloat(postEl, postEl.dataset.vigiaCtx);
  } else {
    scheduleHide();
  }
}, { passive: true });

// ── Marquer les posts et stocker leur contexte ─────────────────

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

  // Fallback : texte brut de l'élément entier
  const raw = postEl.innerText?.trim();
  if (raw && raw.length > 30) return 'text';

  return null;
}

function markPosts() {
  if (!SITE || !POST_SEL_FLAT) return;

  const selectors = POST_SELECTORS[SITE] || [];
  let posts = [];
  for (const sel of selectors) {
    try {
      const els = Array.from(document.querySelectorAll(sel));
      if (els.length) { posts = els; break; }
    } catch (_) {}
  }

  posts.slice(0, 40).forEach(postEl => {
    if (postEl.dataset.vigiaOk) return;
    const ctx = detectContext(postEl);
    if (!ctx) { postEl.dataset.vigiaOk = 'skip'; return; }
    postEl.dataset.vigiaOk  = '1';
    postEl.dataset.vigiaCtx = ctx;
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
    firstSuspLink: suspLinks[0]?.href || '',
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

// ── États du floating panel ────────────────────────────────────

function setCtaLoading(cta) {
  cta.innerHTML = `
    <div class="vigia-loading">
      <span class="vigia-spinner"></span>Analyse en cours…
    </div>`;
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

  // Auto-fermeture après 12 secondes
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

// ── MutationObserver + démarrage ──────────────────────────────

if (SITE) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { try { markPosts(); } catch (_) {} });
  } else {
    try { markPosts(); } catch (_) {}
  }

  let markTimer = null;
  const mo = new MutationObserver(() => {
    clearTimeout(markTimer);
    markTimer = setTimeout(() => { try { markPosts(); } catch (_) {} }, 600);
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
