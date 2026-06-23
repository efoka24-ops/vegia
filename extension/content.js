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
  linkedin:  [
    // Nouvelle UI "SDUI" (classes obfusquées) : ancres stables
    'div[data-testid="mainFeed"] div[data-lazy-mount-id]',
    'div[data-sdui-screen] div[data-lazy-mount-id]',
    'main[id="workspace"] div[data-lazy-mount-id]',
    // Ancienne UI (repli)
    'div.feed-shared-update-v2',
    'div[data-urn^="urn:li:activity"]',
    'div.fie-impression-container',
    'div[data-finite-scroll-hotkey-item]',
    'div.occludable-update',
  ],
  instagram: [
    'article',
    'div[role="presentation"] article',
    'main article',
    'div[style*="flex-direction"] > div > article',
  ],
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

// ── Helpers DOM sûrs (compatibles Trusted Types : X / Instagram / LinkedIn) ──
// Ces sites bloquent toute affectation .innerHTML depuis l'extension.
// On construit donc tout via createElement / createElementNS / textContent.

function mkEl(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function makeShield() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '15');
  svg.setAttribute('height', '15');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.style.flexShrink = '0';
  const p1 = document.createElementNS(NS, 'path');
  p1.setAttribute('d', 'M12 2L21 6V12C21 17 17 21 12 22C7 21 3 17 3 12V6Z');
  p1.setAttribute('fill', '#fff');
  p1.setAttribute('fill-opacity', '.9');
  const p2 = document.createElementNS(NS, 'path');
  p2.setAttribute('d', 'M8 12l3 3 5-6');
  p2.setAttribute('stroke', '#0A5C42');
  p2.setAttribute('stroke-width', '2.4');
  p2.setAttribute('stroke-linecap', 'round');
  p2.setAttribute('stroke-linejoin', 'round');
  svg.append(p1, p2);
  return svg;
}

// ── Détection des types de contenu vérifiables ────────────────
// Renvoie un tableau ordonné (jamais vide) parmi : video, text, link, account.
// L'utilisateur choisit ensuite précisément quoi vérifier au survol.

function isProfilePage() {
  const slug = location.pathname.replace(/^\//, '').split('/')[0].split('?')[0];
  const feedSlugs = ['feed', 'watch', 'groups', 'events', 'marketplace',
                     'notifications', 'messages', 'home', 'explore', 'reels', ''];
  return slug.length > 2 && !feedSlugs.includes(slug);
}

// Récupère le nom de l'auteur/compte d'un post (multi-sites, robuste FB)
function findAuthorName(postEl) {
  const sels = [
    '[data-testid="UserName"]',
    'h1', 'h2', 'h3',
    'strong a[role="link"]',
    'span a[role="link"] strong',
    'a[role="link"] strong',
    'a[aria-label]',
  ];
  for (const s of sels) {
    let e;
    try { e = postEl.querySelector(s); } catch (_) { continue; }
    if (!e) continue;
    const t = ((e.innerText || e.getAttribute('aria-label') || '').trim().split('\n')[0] || '').trim();
    if (t && t.length > 1 && t.length < 80) return t;
  }
  return '';
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

  // Compte : proposé sur les pages de profil, ou si le post expose un auteur
  if (isProfilePage() || findAuthorName(postEl)) {
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
  FLOAT.replaceChildren();
  const list = Array.isArray(ctxs) ? ctxs : [ctxs || 'text'];

  // Un seul type → bouton unique (comportement d'origine)
  if (list.length === 1) {
    const ctx = list[0];
    const btn = mkEl('button', 'vigia-float-btn');
    btn.append(makeShield(), mkEl('span', null, CTX_LABELS[ctx] || CTX_LABELS.text));
    btn.addEventListener('click', e => {
      e.stopPropagation(); e.preventDefault();
      runCheck(postEl, ctx);
    });
    FLOAT.appendChild(btn);
    return;
  }

  // Plusieurs types → menu : l'utilisateur choisit quoi vérifier précisément
  const menu = mkEl('div', 'vigia-float-menu');
  const title = mkEl('div', 'vigia-float-title');
  title.append(makeShield(), mkEl('span', null, 'Vérifier avec VigIA'));
  menu.appendChild(title);

  const row = mkEl('div', 'vigia-float-options');
  list.forEach(ctx => {
    const opt = mkEl('button', `vigia-float-opt vigia-opt--${ctx}`);
    opt.title = CTX_LABELS[ctx] || '';
    opt.append(
      mkEl('span', 'vigia-opt-ic', CTX_ICON[ctx] || '🔍'),
      mkEl('span', null, CTX_SHORT[ctx] || 'Vérifier'),
    );
    opt.addEventListener('click', e => {
      e.stopPropagation(); e.preventDefault();
      runCheck(postEl, ctx);
    });
    row.appendChild(opt);
  });
  menu.appendChild(row);
  FLOAT.appendChild(menu);
}

// Ouvre le menu VigIA à une position donnée (utilisé par le bouton persistant)
function openMenuAt(postEl, x, y) {
  clearTimeout(_hideT);
  _post = postEl;
  _hasResult = false;

  const W = 300;
  FLOAT.style.left  = Math.max(8, Math.min(x - W / 2, window.innerWidth - W - 8)) + 'px';
  FLOAT.style.top   = Math.min(y, window.innerHeight - 170) + 'px';
  FLOAT.style.width = W + 'px';

  const ctxs = (postEl.dataset.vigiaCtxs || detectContexts(postEl).join(',')).split(',');
  renderIdleBtn(postEl, ctxs);
  FLOAT.classList.add('vigia-float--on');
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
  // Repli générique
  try {
    const el = target.closest('article');
    if (el) {
      if (!el.dataset.vigiaCtxs) el.dataset.vigiaCtxs = detectContexts(el).join(',');
      return el;
    }
  } catch (_) {}
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

let _lastPostCount = -1;

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
  // Repli générique si aucun sélecteur spécifique ne matche (DOM modifié par le site)
  if (!posts.length) {
    try { posts = Array.from(document.querySelectorAll('article')); } catch (_) {}
  }
  if (posts.length !== _lastPostCount) {
    _lastPostCount = posts.length;
    console.log('[VigIA]', SITE, '— posts détectés :', posts.length);
  }
  posts.slice(0, 40).forEach(el => {
    const ctxs = detectContexts(el);
    el.dataset.vigiaCtxs = ctxs.join(',');
    injectPostBar(el);
  });
}

// Bouton VigIA persistant, ancré sous chaque post.
// Inséré en FRÈRE du post (afterend) plutôt que dans le post : les SPA comme
// LinkedIn/X re-rendent et vident leur sous-arbre, supprimant un enfant injecté.
// Un frère survit à ces re-renders. Idempotent + ré-injection via MutationObserver.
function injectPostBar(el) {
  // Déjà un bouton juste après ce post ?
  const sib = el.nextElementSibling;
  if (sib && sib.classList && sib.classList.contains('vigia-postbar')) return;
  // Ancienne injection enfant (compat) ?
  if (el.querySelector(':scope > .vigia-postbar')) return;
  try {
    const bar = mkEl('div', 'vigia-postbar');
    bar.append(makeShield(), mkEl('span', null, 'Vérifier avec VigIA'));
    bar.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      const r = bar.getBoundingClientRect();
      openMenuAt(el, r.left + r.width / 2, r.bottom + 6);
    });
    // Frère du post (hors sous-arbre géré par le framework)
    el.insertAdjacentElement('afterend', bar);
  } catch (_) {
    try {
      const bar2 = mkEl('div', 'vigia-postbar');
      bar2.append(makeShield(), mkEl('span', null, 'Vérifier avec VigIA'));
      bar2.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        const r = bar2.getBoundingClientRect();
        openMenuAt(el, r.left + r.width / 2, r.bottom + 6);
      });
      el.appendChild(bar2);
    } catch (__) {}
  }
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
    renderResult(cta, result, context, payload.content);
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
    const name = findAuthorName(postEl)
      || postEl.getAttribute('aria-label')
      || decodeURIComponent(location.pathname.replace(/^\//, '').split('/')[0]);
    let img = '';
    try {
      const imgEl = postEl.querySelector('img[src*="scontent"], img[src*="fbcdn"], img[src*="licdn"], img[src*="cdninstagram"], img[src*="twimg"]');
      img = imgEl?.src || '';
    } catch (_) {}
    return { type: 'account', content: { profile_name: name, profile_image_url: img }, source: SITE, cacheKey: `acc:${simpleHash(name)}` };
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
  cta.replaceChildren();
  const wrap = mkEl('div', 'vigia-loading');
  wrap.appendChild(mkEl('span', 'vigia-spinner'));
  wrap.appendChild(document.createTextNode('Analyse en cours…'));
  cta.appendChild(wrap);
}

function setCtaError(cta, msg) {
  _hasResult = false;
  cta.replaceChildren();
  cta.appendChild(mkEl('div', 'vigia-error', msg));
  setTimeout(scheduleHide, 3000);
}

function targetLabel(context, content) {
  if (!content) return '';
  if (context === 'link')    return content.url || '';
  if (context === 'account') return content.profile_name || '';
  if (context === 'video')   return 'Vidéo de la publication';
  if (context === 'text') {
    const t = (content.text || '').trim();
    return t.length > 160 ? t.slice(0, 160) + '…' : t;
  }
  return '';
}

function renderResult(cta, result, context, content) {
  const level  = result.level || 'error';
  const module = CTX_MODULE[context] || 'VÉRIF';
  const mods   = result.modules || {};
  const mod    = Object.values(mods)[0];
  const score  = mod?.score != null ? Math.round(mod.score * 100) : null;
  const label  = mod?.label || result.explanation || '—';
  const detail = result.explanation && result.explanation !== mod?.label ? result.explanation : '';
  const target = targetLabel(context, content);
  const tgtLbl = { link: 'Lien analysé', account: 'Compte analysé', video: 'Média analysé', text: 'Texte analysé' }[context] || 'Élément analysé';
  const icons  = { red: '⚠️', orange: '⚠️', green: '✅', error: '❓' };

  cta.replaceChildren();
  const box = mkEl('div', `vigia-result vigia-result--${level}`);

  const header = mkEl('div', 'vigia-result-header');
  header.appendChild(mkEl('span', 'vigia-result-icon', icons[level] || '❓'));
  header.appendChild(mkEl('span', 'vigia-result-module', module));
  if (score !== null) {
    const s = mkEl('span', 'vigia-result-score', 'Risque ' + score + '%');
    s.title = 'Indice de risque : 0 % = sûr, 100 % = très suspect';
    header.appendChild(s);
  }
  const closeBtn = mkEl('button', 'vigia-result-close', '✕');
  closeBtn.title = 'Fermer';
  header.appendChild(closeBtn);
  box.appendChild(header);

  box.appendChild(mkEl('div', 'vigia-result-label', label));
  if (detail) box.appendChild(mkEl('div', 'vigia-result-detail', detail));
  if (target) {
    const t = mkEl('div', 'vigia-result-target');
    t.appendChild(mkEl('span', 'vigia-result-target-lbl', tgtLbl));
    t.appendChild(document.createTextNode(target));
    box.appendChild(t);
  }
  if (score !== null) {
    box.appendChild(mkEl('div', 'vigia-result-scale', 'Indice de risque — 0 % = sûr · 100 % = très suspect'));
  }
  // Boucle de feedback : l'utilisateur indique si le verdict est juste
  const fb = mkEl('div', 'vigia-result-fb');
  fb.appendChild(mkEl('span', 'vigia-fb-q', 'Ce verdict est-il correct ?'));
  const up = mkEl('button', 'vigia-fb-btn', '👍');
  const down = mkEl('button', 'vigia-fb-btn', '👎');
  fb.append(up, down);
  box.appendChild(fb);
  const sendFb = (correct) => {
    try {
      chrome.runtime.sendMessage({ type: 'FEEDBACK', payload: {
        request_id: result.request_id, level: result.level, ctype: context, source: SITE, correct,
      }});
    } catch (_) {}
    fb.replaceChildren(mkEl('span', 'vigia-fb-q', 'Merci pour votre retour ✓'));
  };
  up.addEventListener('click', e => { e.stopPropagation(); sendFb(true); });
  down.addEventListener('click', e => { e.stopPropagation(); sendFb(false); });

  const reportBtn = mkEl('button', 'vigia-result-report', 'Signaler');
  box.appendChild(reportBtn);
  cta.appendChild(box);

  closeBtn.addEventListener('click', e => {
    e.stopPropagation();
    _hasResult = false;
    _post = null;
    FLOAT.classList.remove('vigia-float--on');
  });
  reportBtn.addEventListener('click', e => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'REPORT', payload: { result, url: location.href } });
    reportBtn.textContent = 'Signalé ✓';
    reportBtn.disabled = true;
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
  console.log('[VigIA] actif sur', SITE);
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
