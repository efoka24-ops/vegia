// ---------- Configuration par site ----------

const SITE_CONFIG = {
  facebook: {
    images:   'div[data-pagelet] img[src*="fbcdn"], img[data-imgperflogname]',
    posts:    'div[data-ad-preview="message"], div[data-testid="post_message"]',
    links:    'a[href*="l.facebook.com/l.php"]',
    profiles: 'a[href*="/profile.php"] img, a[role="link"] img.x1b0d499'
  },
  twitter: {
    images:   'article img[src*="twimg.com/media"]',
    posts:    'article div[data-testid="tweetText"]',
    links:    'article a[href*="t.co"]',
    profiles: 'a[href$="/photo"] img, div[data-testid="UserAvatar-Container"] img'
  },
  whatsapp: {
    images:   'img.x10l6tqk',
    posts:    'span.selectable-text.copyable-text',
    links:    'a[href*="http"]',
    profiles: 'img[src*="pps.whatsapp"]'
  },
  linkedin: {
    images:   'img[src*="media.licdn.com"], img[data-delayed-url*="media.licdn.com"]',
    posts:    '.feed-shared-text .break-words, .update-components-text .break-words, .feed-shared-update-v2__description span',
    links:    'a.feed-shared-article__title, .update-components-article-link__title a, a[data-tracking-will-navigate][href*="/pulse/"]',
    profiles: 'img.EntityPhoto-circle-3, img.presence-entity__image, .ivm-view-attr__img--centered'
  }
};

function detectSite() {
  const h = location.hostname;
  if (h.includes('facebook')) return 'facebook';
  if (h.includes('twitter') || h.includes('x.com')) return 'twitter';
  if (h.includes('whatsapp')) return 'whatsapp';
  if (h.includes('linkedin')) return 'linkedin';
  return null;
}

const site = detectSite();
if (!site) throw new Error('[VigIA] Site non supporté');

const config = SITE_CONFIG[site];

// ---------- Injection du bouton ----------

function attachButton(element, context) {
  if (element.dataset.vigiaOk) return;
  element.dataset.vigiaOk = '1';

  const wrapper = document.createElement('div');
  wrapper.className = 'vigia-wrapper';
  element.parentNode.insertBefore(wrapper, element);
  wrapper.appendChild(element);

  const btn = document.createElement('button');
  btn.className = 'vigia-btn';
  btn.textContent = 'Vérifier';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    runVerification(element, context, wrapper);
  });
  wrapper.appendChild(btn);
}

// ---------- Lancement de la vérification ----------

async function runVerification(element, context, wrapper) {
  const payload = buildPayload(element, context);
  if (!payload) return;

  setBadge(wrapper, 'loading');

  chrome.runtime.sendMessage({ type: 'VERIFY', payload }, (result) => {
    if (chrome.runtime.lastError) {
      setBadge(wrapper, 'error');
      return;
    }
    renderResult(wrapper, result, context);
  });
}

function buildPayload(element, context) {
  const tag = element.tagName;

  if (context === 'images' && tag === 'IMG') {
    const url = element.src;
    if (!url || url.startsWith('data:')) return null;
    return { type: 'image', content: { image_url: url }, source: site, cacheKey: `img:${url}` };
  }

  if (context === 'links' && tag === 'A') {
    const url = element.href;
    return { type: 'url', content: { url }, source: site, cacheKey: `url:${url}` };
  }

  if (context === 'posts') {
    const text = element.innerText?.trim();
    if (!text || text.length < 20) return null;
    return { type: 'text', content: { text: text.slice(0, 1000) }, source: site, cacheKey: `txt:${simpleHash(text)}` };
  }

  if (context === 'profiles' && tag === 'IMG') {
    const profileUrl = element.src;
    const nameEl = element.closest('a, [role="link"]');
    const name = nameEl?.getAttribute('aria-label') || nameEl?.title || '';
    return { type: 'account', content: { profile_image_url: profileUrl, profile_name: name }, source: site, cacheKey: `acc:${profileUrl}` };
  }

  return null;
}

// ---------- Rendu du badge + tooltip ----------

const BADGE_CFG = {
  green:   { icon: '✓', label: 'Fiable' },
  orange:  { icon: '⚠', label: 'Douteux' },
  red:     { icon: '✗', label: 'Suspect' },
  loading: { icon: '',  label: '...' },
  error:   { icon: '!', label: 'Erreur' },
};

const MODULE_META = {
  media:   { icon: '🖼', name: 'Image / Vidéo' },
  info:    { icon: '📰', name: 'Fact-check' },
  link:    { icon: '🔗', name: 'Lien' },
  account: { icon: '👤', name: 'Compte' },
};

function setBadge(wrapper, level, _unused) {
  let badge = wrapper.querySelector('.vigia-badge');
  if (!badge) {
    badge = document.createElement('div');
    wrapper.appendChild(badge);
  }
  const cfg = BADGE_CFG[level] || BADGE_CFG.error;
  badge.className = `vigia-badge vigia-badge--${level}`;
  badge.textContent = cfg.label;
  return badge;
}

function renderResult(wrapper, result, context) {
  const level = result.level || 'error';
  const badge = setBadge(wrapper, level);

  // Sauvegarde dans l'historique
  if (level !== 'loading' && level !== 'error') {
    const mod = Object.values(result.modules || {})[0];
    saveHistory({ level, type: context || 'image', label: mod?.label || result.explanation || '' });
    updateStats(level);
  }

  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleTooltip(badge, result);
  });
}

function toggleTooltip(badge, result) {
  const existing = badge.querySelector('.vigia-tooltip');
  if (existing) { existing.remove(); return; }

  const tt = document.createElement('div');
  tt.className = 'vigia-tooltip';
  tt.innerHTML = buildTooltipHTML(result);

  tt.querySelector('.btn-sources')?.addEventListener('click', () => {
    const src = result.sources?.[0];
    if (src) window.open(src, '_blank');
    tt.remove();
  });

  tt.querySelector('.btn-report')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'REPORT', payload: { result, url: location.href } });
    tt.remove();
  });

  badge.appendChild(tt);
  setTimeout(() => {
    document.addEventListener('click', () => tt.remove(), { once: true });
  }, 0);
}

function scoreClass(score) {
  if (score == null) return '';
  if (score >= 0.7)  return 'vigia-tooltip__score--high';
  if (score >= 0.35) return 'vigia-tooltip__score--mid';
  return 'vigia-tooltip__score--low';
}

function buildTooltipHTML(result) {
  const mods  = result.modules || {};
  const level = result.level || 'error';
  const verdicts = { green: 'Fiable', orange: 'Douteux', red: 'Suspect' };

  const rows = Object.entries(MODULE_META).map(([key, meta]) => {
    const mod = mods[key];
    if (!mod) return '';
    const sc = mod.score != null ? `<span class="vigia-tooltip__score ${scoreClass(mod.score)}">${Math.round(mod.score * 100)}%</span>` : '';
    return `
      <div class="vigia-tooltip__row">
        <span class="vigia-tooltip__module-icon">${meta.icon}</span>
        <div class="vigia-tooltip__module-info">
          <div class="vigia-tooltip__module-name">${meta.name}</div>
          <div class="vigia-tooltip__module-label">${mod.label || '—'}</div>
        </div>
        ${sc}
      </div>`;
  }).join('');

  const hasSources = result.sources?.length > 0;

  return `
    <div class="vigia-tooltip__header">
      <span class="vigia-tooltip__header-icon"></span>
      <span>VigIA</span>
      <span class="vigia-tooltip__verdict vigia-tooltip__verdict--${level}">${verdicts[level] || level}</span>
    </div>
    <div class="vigia-tooltip__body">${rows || '<div style="color:#64748b;font-size:11px;padding:4px 0">Aucun module activé</div>'}</div>
    ${result.explanation ? `<div class="vigia-tooltip__explanation">${result.explanation}</div>` : ''}
    <div class="vigia-tooltip__actions">
      ${hasSources ? `<button class="vigia-tooltip__btn vigia-tooltip__btn--primary btn-sources">Voir sources</button>` : ''}
      <button class="vigia-tooltip__btn btn-report">Signaler</button>
    </div>
  `;
}

// ---------- Historique & stats ----------

async function saveHistory(entry) {
  const { history = [] } = await chrome.storage.local.get('history');
  history.push({ ...entry, ts: Date.now() });
  if (history.length > 50) history.splice(0, history.length - 50);
  chrome.storage.local.set({ history });
}

async function updateStats(level) {
  const key = { green: 'statsGreen', orange: 'statsOrange', red: 'statsRed' }[level];
  if (!key) return;
  const data = await chrome.storage.local.get(key);
  chrome.storage.local.set({ [key]: (data[key] || 0) + 1 });
}

// ---------- Observer (infinite scroll) ----------

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;
      scanNode(node);
    }
  }
});

function scanNode(root) {
  for (const [context, selector] of Object.entries(config)) {
    const elements = root.matches?.(selector)
      ? [root]
      : Array.from(root.querySelectorAll?.(selector) || []);
    elements.forEach((el) => attachButton(el, context));
  }
}

observer.observe(document.body, { childList: true, subtree: true });
scanNode(document.body); // scan initial

// ---------- Utilitaires ----------

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < Math.min(str.length, 200); i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}
