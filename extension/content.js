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
  }
};

function detectSite() {
  const h = location.hostname;
  if (h.includes('facebook')) return 'facebook';
  if (h.includes('twitter') || h.includes('x.com')) return 'twitter';
  if (h.includes('whatsapp')) return 'whatsapp';
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

  setBadge(wrapper, 'loading', '...');

  chrome.runtime.sendMessage({ type: 'VERIFY', payload }, (result) => {
    if (chrome.runtime.lastError) {
      setBadge(wrapper, 'error', '!');
      return;
    }
    renderResult(wrapper, result);
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

function setBadge(wrapper, level, text) {
  let badge = wrapper.querySelector('.vigia-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'vigia-badge';
    wrapper.appendChild(badge);
  }
  badge.className = `vigia-badge vigia-badge--${level}`;
  badge.textContent = text;
}

function renderResult(wrapper, result) {
  const icons = { green: '✓', orange: '⚠', red: '✗', error: '!' };
  const labels = { green: 'Fiable', orange: 'Douteux', red: 'Suspect', error: 'Erreur' };
  const level = result.level || 'error';

  setBadge(wrapper, level, `${icons[level] || '?'} ${labels[level] || ''}`);

  const badge = wrapper.querySelector('.vigia-badge');
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTooltip(badge, result);
  });
}

function toggleTooltip(badge, result) {
  const existing = badge.querySelector('.vigia-tooltip');
  if (existing) { existing.remove(); return; }

  const tt = document.createElement('div');
  tt.className = 'vigia-tooltip';
  tt.innerHTML = buildTooltipHTML(result);

  tt.querySelector('.vigia-tooltip__btn--sources')?.addEventListener('click', () => {
    const src = result.sources?.[0];
    if (src) window.open(src, '_blank');
  });

  tt.querySelector('.vigia-tooltip__btn--report')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'REPORT', payload: { result, url: location.href } });
    tt.remove();
  });

  badge.appendChild(tt);

  // Ferme le tooltip au clic extérieur
  setTimeout(() => {
    document.addEventListener('click', () => tt.remove(), { once: true });
  }, 0);
}

function buildTooltipHTML(result) {
  const mods = result.modules || {};
  const moduleLabels = { media: '🖼 Image', info: '📰 Info', link: '🔗 Lien', account: '👤 Compte' };

  const rows = Object.entries(moduleLabels).map(([key, label]) => {
    const mod = mods[key];
    const val = mod ? mod.label : 'non analysé';
    return `<div class="vigia-tooltip__row">
      <span class="vigia-tooltip__label">${label}</span>
      <span>${val}</span>
    </div>`;
  }).join('');

  return `
    <div class="vigia-tooltip__title">VigIA — Analyse</div>
    ${rows}
    <div style="margin-top:8px;font-size:11px;color:#94a3b8">${result.explanation || ''}</div>
    <div class="vigia-tooltip__actions">
      <button class="vigia-tooltip__btn vigia-tooltip__btn--sources">Voir sources</button>
      <button class="vigia-tooltip__btn vigia-tooltip__btn--report">Signaler</button>
    </div>
  `;
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
