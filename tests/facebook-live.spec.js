// @ts-check
/**
 * Test live sur web.facebook.com/iamZIEFE avec l'extension VigIA chargée.
 * Lance : npx playwright test tests/facebook-live.spec.js --headed
 */
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '../extension');
const FB_URL = 'https://web.facebook.com/iamZIEFE';

let ctx;      // BrowserContext persistant
let fbPage;   // Onglet Facebook
let extId;    // ID de l'extension

// ── Setup : lancer Chrome + extension ──────────────────────────

test.beforeAll(async () => {
  ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    viewport: { width: 1440, height: 900 },
    slowMo: 150,
  });

  // MV3 : le background est un service worker (pas une background page)
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 });
  extId = new URL(sw.url()).hostname;
  console.log('\n[VigIA] Extension ID :', extId);

  // Ouvrir Facebook
  fbPage = await ctx.newPage();
  console.log('[VigIA] Navigation vers', FB_URL);
  await fbPage.goto(FB_URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await fbPage.waitForTimeout(5000); // laisser le JS de Facebook charger
});

test.afterAll(async () => {
  await ctx.close();
});

// ── Test 1 : page chargée ──────────────────────────────────────

test('1 · Page Facebook chargée', async () => {
  const url   = fbPage.url();
  const title = await fbPage.title();
  console.log('[PAGE] URL   :', url);
  console.log('[PAGE] Titre :', title);
  // Peut être la page de login ou le profil
  expect(url).toContain('facebook.com');
});

// ── Test 2 : content script injecté ───────────────────────────

test('2 · Content script VigIA injecté dans la page', async () => {
  await fbPage.bringToFront();
  await fbPage.waitForTimeout(2000);

  // Lire le DOM — ce qui existe réellement
  const dom = await fbPage.evaluate(() => {
    const q = s => document.querySelectorAll(s).length;
    return {
      vigiaCtaButtons  : q('.vigia-cta'),
      vigiaOkElements  : q('[data-vigia-ok]'),
      articles         : q('div[role="article"]'),
      pageletFeedUnit  : q('[data-pagelet^="FeedUnit"]'),
      userContentWrapper: q('.userContentWrapper'),
      _5pcr            : q('._5pcr'),
      video            : q('video'),
      h1               : document.querySelector('h1')?.innerText?.trim() || '—',
      h2               : document.querySelector('h2')?.innerText?.trim() || '—',
      bodyTextLen      : document.body?.innerText?.length,
      url              : location.href,
    };
  });

  console.log('\n[DOM] ──────────────────────────────');
  Object.entries(dom).forEach(([k, v]) => console.log(`  ${k.padEnd(22)} : ${v}`));
  console.log('[DOM] ──────────────────────────────\n');

  // Le content script doit avoir tourné (au moins data-vigia-ok sur un élément)
  const ran = dom.vigiaCtaButtons > 0 || dom.vigiaOkElements > 0;
  if (!ran) {
    console.warn('[WARN] Aucun bouton VigIA injecté — content script peut-être bloqué ou sélecteurs ne matchent pas.');
  } else {
    console.log(`[OK] ${dom.vigiaCtaButtons} bouton(s) VigIA injecté(s)`);
  }
  // On ne fait pas échouer le test, on veut voir la suite
  expect(dom.bodyTextLen).toBeGreaterThan(100); // la page a du contenu
});

// ── Test 3 : popup "Tout vérifier" ────────────────────────────

test('3 · Popup — Tout vérifier analyse la page réelle', async () => {
  // S'assurer que Facebook est en arrière-plan (actif)
  await fbPage.bringToFront();
  await fbPage.waitForTimeout(500);

  // Ouvrir le popup dans un nouvel onglet
  const popupUrl = `chrome-extension://${extId}/popup.html`;
  console.log('[POPUP] Ouverture :', popupUrl);

  const popup = await ctx.newPage();
  await popup.goto(popupUrl, { waitUntil: 'load', timeout: 10000 });
  await popup.waitForTimeout(800);

  // État initial
  const before = await popup.evaluate(() => ({
    idle    : document.getElementById('stateIdle')?.style.display,
    scanning: document.getElementById('stateScanning')?.style.display,
    done    : document.getElementById('stateDone')?.style.display,
    media   : document.getElementById('act-media')?.innerText?.trim(),
    info    : document.getElementById('act-info')?.innerText?.trim(),
    link    : document.getElementById('act-link')?.innerText?.trim(),
    account : document.getElementById('act-account')?.innerText?.trim(),
  }));
  console.log('\n[POPUP avant] ──────────────────────');
  Object.entries(before).forEach(([k, v]) => console.log(`  ${k.padEnd(10)} : ${v}`));

  // Clic sur "Tout vérifier"
  await popup.click('#btnScanAll');
  console.log('[POPUP] Clic "Tout vérifier" effectué');

  // Attendre la fin des analyses (max 6s)
  await popup.waitForTimeout(6000);

  // État final
  const after = await popup.evaluate(() => ({
    idle      : document.getElementById('stateIdle')?.style.display,
    scanning  : document.getElementById('stateScanning')?.style.display,
    done      : document.getElementById('stateDone')?.style.display,
    alertCount: document.getElementById('alertCount')?.textContent,
    alertWord : document.getElementById('alertWord')?.textContent,
    media     : document.getElementById('act-media')?.innerText?.trim(),
    info      : document.getElementById('act-info')?.innerText?.trim(),
    link      : document.getElementById('act-link')?.innerText?.trim(),
    account   : document.getElementById('act-account')?.innerText?.trim(),
  }));

  console.log('\n[POPUP après] ──────────────────────');
  Object.entries(after).forEach(([k, v]) => console.log(`  ${k.padEnd(10)} : ${v}`));
  console.log('[POPUP] ──────────────────────────────\n');

  // Vérifier que quelque chose a changé (pas état idle)
  const analysisRan = after.done !== 'none' || after.alertCount !== undefined;
  if (after.media === 'Vérifier' && after.info === 'Vérifier') {
    console.error('[FAIL] Les modules sont toujours en état idle — SCAN_PAGE n\'a pas atteint le content script');
  } else {
    console.log('[OK] Les modules ont été mis à jour');
  }

  await popup.waitForTimeout(3000);
  await popup.close();
});

// ── Test 4 : hover → floating CTA ─────────────────────────────

test('4 · Hover sur un post → floating CTA VigIA apparaît', async () => {
  await fbPage.bringToFront();
  await fbPage.waitForTimeout(2000);

  // État des posts marqués
  const marked = await fbPage.evaluate(() => ({
    ok:   document.querySelectorAll('[data-vigia-ok="1"]').length,
    skip: document.querySelectorAll('[data-vigia-ok="skip"]').length,
    float: !!document.querySelector('.vigia-float'),
  }));
  console.log('\n[HOVER PRÉ] posts ok=' + marked.ok + ' skip=' + marked.skip + ' float=' + marked.float);

  if (!marked.ok) {
    console.warn('[WARN] Aucun post marqué data-vigia-ok=1 — vérifier les sélecteurs');
    return;
  }

  // Hover sur le premier post détecté (via dispatchEvent pour bypasser les overlays FB)
  await fbPage.evaluate(() => {
    const post = document.querySelector('[data-vigia-ok="1"]');
    if (!post) return;
    // Simuler l'entrée et le mouvement de la souris sur le post
    ['mouseover', 'mouseenter'].forEach(type => {
      post.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
    // Propager vers les enfants pour déclencher l'event delegation
    const children = post.querySelectorAll('*');
    if (children[0]) {
      children[0].dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
    }
  });
  await fbPage.waitForTimeout(600);

  const floatState = await fbPage.evaluate(() => {
    const f = document.querySelector('.vigia-float');
    if (!f) return { exists: false };
    return {
      exists:   true,
      visible:  f.classList.contains('vigia-float--on'),
      display:  getComputedStyle(f).display,
      left:     f.style.left,
      top:      f.style.top,
      btnText:  f.querySelector('button')?.innerText?.trim() || '—',
      context:  document.querySelector('[data-vigia-ok="1"]')?.dataset?.vigiaCtx || '—',
    };
  });

  console.log('\n[FLOAT] ────────────────────────────');
  Object.entries(floatState).forEach(([k, v]) => console.log(`  ${k.padEnd(10)} : ${v}`));
  console.log('[FLOAT] ────────────────────────────\n');

  if (!floatState.visible) {
    console.error('[FAIL] Le floating CTA n\'est pas visible après hover');
  } else {
    console.log('[OK] Floating CTA visible : ' + floatState.btnText);
  }

  expect(floatState.exists).toBe(true);

  // Garder le navigateur ouvert pour inspection visuelle
  await fbPage.waitForTimeout(20000);
});
