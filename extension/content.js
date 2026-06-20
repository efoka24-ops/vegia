// ---------- Configuration par site ----------

const SITE_CONFIG = {
  facebook: {
    // Chaque post Facebook est un div[role="article"]
    posts:    'div[role="article"]',
    // Vidéos natives + images du fil
    images:   'div[role="article"] video, div[role="article"] img[src*="fbcdn"], div[role="article"] img[src*="scontent"]',
    // Liens externes (Facebook les réécrit via l.facebook.com)
    links:    'div[role="article"] a[href*="l.facebook.com/l.php"]',
    // Profils : avatars dans l'en-tête d'un article
    profiles: 'div[role="article"] a[href*="profile.php"] img, div[role="article"] h2 a, div[role="article"] strong > a',
  },
  twitter: {
    posts:    'article[data-testid="tweet"]',
    images:   'article img[src*="twimg.com/media"]',
    links:    'article a[href*="t.co"]',
    profiles: 'a[href$="/photo"] img, div[data-testid="UserAvatar-Container"] img',
  },
  whatsapp: {
    posts:    'div.message-in, div.message-out',
    images:   'img.x10l6tqk',
    links:    'a.tOVPCe',
    profiles: 'img[src*="pps.whatsapp"]',
  },
  linkedin: {
    posts:    'div.feed-shared-update-v2, div.occludable-update',
    images:   'img[src*="media.licdn.com"], img[data-delayed-url*="media.licdn.com"]',
    links:    'a.feed-shared-article__title, .update-components-article-link__title a',
    profiles: 'img.EntityPhoto-circle-3, img.presence-entity__image',
  },
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

const CTX_TO_MOD = { images: 'media', posts: 'info', links: 'link', profiles: 'account' };

const SHIELD_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><path d="M12 2L21 6V12C21 17 17 21 12 22C7 21 3 17 3 12V6Z" fill="#0A5C42"/><path d="M8 12l3 3 5-6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ---------- Initialisation ----------

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
  cta.dataset.vigiaContext = context;

  const btn = document.createElement('button');
  btn.className = 'vigia-btn';
  btn.innerHTML = `${SHIELD_SVG}${CTX_LABELS[context] || 'Vérifier avec VigIA'}`;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    runVerification(element, context, cta);
  });

  cta.appendChild(btn);

  // Pour les posts (articles), insérer à la fin de l'article (pas afterend)
  if (context === 'posts') {
    element.appendChild(cta);
  } else {
    element.insertAdjacentElement('afterend', cta);
  }
}

// ---------- Lancement de la vérification ----------

async function runVerification(element, context, cta) {
  const payload = buildPayload(element, context);
  if (!payload) {
    setCtaError(cta);
    return;
  }

  setCtaLoading(cta);

  chrome.runtime.sendMessage({ type: 'VERIFY', payload }, (result) => {
    if (chrome.runtime.lastError || !result) {
      setCtaError(cta);
      return;
    }
    renderResult(cta, result, context);
    notifyPopup(context, result);
  });
}

function buildPayload(element, context) {
  const tag = element.tagName;

  // Pour les posts : extraire le texte du contenu de l'article
  if (context === 'posts') {
    const textEl = element.querySelector('div[dir="auto"]') || element;
    const text   = textEl.innerText?.trim() || element.innerText?.trim();
    if (!text || text.length < 20) return null;
    return {
      type: 'text',
      content: { text: text.slice(0, 1000) },
      source: site,
      cacheKey: `txt:${simpleHash(text)}`,
    };
  }

  if (context === 'images') {
    if (tag === 'VIDEO') {
      const src = element.src || element.querySelector('source')?.src || '';
      return { type: 'image', content: { image_url: src || location.href }, source: site, cacheKey: `vid:${src}` };
    }
    if (tag === 'IMG') {
      const url = element.src;
      if (!url || url.startsWith('data:')) return null;
      return { type: 'image', content: { image_url: url }, source: site, cacheKey: `img:${url}` };
    }
    return null;
  }

  if (context === 'links' && tag === 'A') {
    return { type: 'url', content: { url: element.href }, source: site, cacheKey: `url:${element.href}` };
  }

  if (context === 'profiles') {
    if (tag === 'IMG') {
      const nameEl = element.closest('a, [role="link"]');
      const name   = nameEl?.getAttribute('aria-label') || nameEl?.title || element.alt || '';
      return { type: 'account', content: { profile_image_url: element.src, profile_name: name }, source: site, cacheKey: `acc:${element.src}` };
    }
    if (tag === 'A') {
      const name = element.innerText?.trim() || element.getAttribute('aria-label') || '';
      return { type: 'account', content: { profile_image_url: '', profile_name: name }, source: site, cacheKey: `acc:${simpleHash(name)}` };
    }
    return null;
  }

  return null;
}

// ---------- Notification popup ----------

function notifyPopup(context, result) {
  const mod   = CTX_TO_MOD[context];
  const level = result.level || 'error';
  if (!mod || level === 'error') return;

  const mods    = result.modules || {};
  const modData = Object.values(mods)[0];
  const score   = modData?.score != null ? Math.round(modData.score * 100) : null;
  const label   = modData?.label || result.explanation || '—';

  let badge;
  if (level === 'red')         badge = score != null ? `⚠ ${score}%` : '⚠ alerte';
  else if (level === 'orange') badge = score != null ? `⚠ ${score}%` : '⚠ douteux';
  else                         badge = '✓ RAS';

  try { chrome.runtime.sendMessage({ type: 'SCAN_RESULT', mod, result: { level, badge, label } }); } catch (_) {}
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
  cta.innerHTML = `<div class="vigia-error">Aucun contenu analysable détecté.</div>`;
}

// ---------- Rendu du résultat inline ----------

function renderResult(cta, result, context) {
  const level  = result.level || 'error';
  const module = CTX_MODULE[context] || 'VÉRIF';
  const mods   = result.modules || {};
  const mod    = Object.values(mods)[0];
  const score  = mod?.score != null ? Math.round(mod.score * 100) : null;
  const label  = mod?.label || result.explanation || '—';
  const detail = result.explanation && result.explanation !== mod?.label ? result.explanation : '';

  const icons = { red: '⚠️', orange: '⚠️', green: '✅', error: '❓' };

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
    </div>
  `;

  cta.querySelector('.vigia-result-report')?.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'REPORT', payload: { result, url: location.href } });
    e.target.textContent = 'Signalé ✓';
    e.target.disabled = true;
  });
}

// ---------- Scan d'un nœud DOM ----------

function scanNode(root) {
  for (const [context, selector] of Object.entries(config)) {
    try {
      const elements = root.matches?.(selector)
        ? [root]
        : Array.from(root.querySelectorAll?.(selector) || []);
      elements.forEach(el => attachButton(el, context));
    } catch (_) {}
  }
}

// ---------- Observer MutationObserver (scroll infini) ----------

const mutationObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      scanNode(node);
    }
  }
});

mutationObserver.observe(document.body, { childList: true, subtree: true });

// ---------- IntersectionObserver (boutons au scroll) ----------

function observeArticles() {
  const articleSelector = site === 'facebook' ? 'div[role="article"]'
    : site === 'twitter'   ? 'article'
    : site === 'linkedin'  ? 'div.feed-shared-update-v2, div.occludable-update'
    : null;

  if (!articleSelector) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        scanNode(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  const observeAll = () => {
    document.querySelectorAll(articleSelector).forEach(el => {
      if (!el.dataset.vigiaObserved) {
        el.dataset.vigiaObserved = '1';
        io.observe(el);
      }
    });
  };

  observeAll();

  // Ré-observer les nouveaux articles ajoutés au fil
  const feedObserver = new MutationObserver(observeAll);
  feedObserver.observe(document.body, { childList: true, subtree: true });
}

// ---------- Listener messages du popup ----------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SCAN_ALL') {
    // 1. Re-scanner la page pour injecter les boutons manquants
    scanNode(document.body);
    // 2. Après injection, cliquer tous les boutons disponibles
    setTimeout(() => {
      const btns = Array.from(document.querySelectorAll('.vigia-btn'));
      btns.forEach(btn => btn.click());
      sendResponse({ ok: true, found: btns.length });
    }, 300);
    return true; // réponse asynchrone
  }

  if (msg.type === 'SCAN_MODULE') {
    const { context } = msg;
    const selector = config[context];
    if (selector) {
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (!el.dataset.vigiaOk) attachButton(el, context);
        });
      } catch (_) {}
    }
    setTimeout(() => {
      const ctas = document.querySelectorAll(`.vigia-cta[data-vigia-context="${context}"]`);
      let found = 0;
      ctas.forEach(cta => {
        const btn = cta.querySelector('.vigia-btn');
        if (btn) { btn.click(); found++; }
      });
      sendResponse({ ok: true, found });
    }, 300);
    return true;
  }
});

// ---------- Démarrage ----------

// Scan initial après chargement complet
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    scanNode(document.body);
    observeArticles();
  });
} else {
  scanNode(document.body);
  observeArticles();
}

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
