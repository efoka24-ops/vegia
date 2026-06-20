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

const CTX_LABELS = {
  images:   'Vérifier cette vidéo avec VigIA',
  posts:    'Vérifier ce texte avec VigIA',
  links:    'Vérifier ce lien avec VigIA',
  profiles: 'Vérifier ce compte avec VigIA',
};

const CTX_MODULE = {
  images:   'VÉRIF-MÉDIA',
  posts:    'VÉRIF-INFO',
  links:    'VÉRIF-LIEN',
  profiles: 'VÉRIF-COMPTE',
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

// ---------- Injection du bouton contextuel ----------

function attachButton(element, context) {
  if (element.dataset.vigiaOk) return;
  element.dataset.vigiaOk = '1';

  const cta = document.createElement('div');
  cta.className = 'vigia-cta';

  const btn = document.createElement('button');
  btn.className = 'vigia-btn';
  btn.innerHTML = `<span class="vigia-btn-icon"></span>${CTX_LABELS[context] || 'Vérifier avec VigIA'}`;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    runVerification(element, context, cta);
  });

  cta.appendChild(btn);
  element.insertAdjacentElement('afterend', cta);
}

// ---------- Lancement de la vérification ----------

async function runVerification(element, context, cta) {
  const payload = buildPayload(element, context);
  if (!payload) return;

  setCtaLoading(cta);

  chrome.runtime.sendMessage({ type: 'VERIFY', payload }, (result) => {
    if (chrome.runtime.lastError) {
      setCtaError(cta);
      return;
    }
    renderResult(cta, result, context);
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
    return { type: 'url', content: { url: element.href }, source: site, cacheKey: `url:${element.href}` };
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

// ---------- États de la CTA ----------

function setCtaLoading(cta) {
  cta.innerHTML = `
    <div class="vigia-loading">
      <span class="vigia-spinner"></span>
      Analyse en cours…
    </div>
    <div class="vigia-scan-bar"><div class="vigia-scan-progress"></div></div>
  `;
}

function setCtaError(cta) {
  cta.innerHTML = `<div class="vigia-error">Impossible de contacter VigIA. Réessayez.</div>`;
}

// ---------- Rendu du résultat inline ----------

function renderResult(cta, result, context) {
  const level  = result.level || 'error';
  const module = CTX_MODULE[context] || 'VÉRIF';
  const mods   = result.modules || {};
  const mod    = Object.values(mods)[0];
  const score  = mod?.score != null ? Math.round(mod.score * 100) : null;
  const label  = mod?.label || result.explanation || '—';
  const detail = result.explanation || mod?.label || '';

  const icons = { red: '⚠️', orange: '⚠️', green: '✅', error: '❓' };
  const colors = { red: '#C8102E', orange: '#d97706', green: '#0A5C42', error: '#64748b' };
  const bgs    = { red: '#FCEBEC', orange: '#FFF8EC', green: '#EEF3F0', error: '#f8f8f8' };

  cta.innerHTML = `
    <div class="vigia-result vigia-result--${level}">
      <div class="vigia-result-header">
        <span class="vigia-result-icon">${icons[level] || '❓'}</span>
        <span class="vigia-result-module">${module}</span>
        ${score !== null ? `<span class="vigia-result-score">${score}%</span>` : ''}
      </div>
      <div class="vigia-result-label">${escHtml(label)}</div>
      ${detail && detail !== label ? `<div class="vigia-result-detail">${escHtml(detail)}</div>` : ''}
      <button class="vigia-result-report">Signaler</button>
    </div>
  `;

  cta.querySelector('.vigia-result-report')?.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'REPORT', payload: { result, url: location.href } });
    e.target.textContent = 'Signalé ✓';
    e.target.disabled = true;
  });

  if (level !== 'error') {
    saveHistory({ level, type: context || 'image', label: mod?.label || result.explanation || '' });
    updateStats(level);
  }
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
scanNode(document.body);

// ---------- Utilitaires ----------

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < Math.min(str.length, 200); i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
