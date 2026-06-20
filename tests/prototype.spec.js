// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const PROTO = 'file://' + path.resolve(__dirname, '../prototype/VigIA - Prototype extension.dc.html').replace(/\\/g, '/');

test.describe('VigIA Prototype — Facebook', () => {

  test('La page se charge et affiche le bouton VigIA', async ({ page }) => {
    await page.goto(PROTO);
    await page.waitForTimeout(1500); // dc-runtime init

    const vigiaBtn = page.locator('button').filter({ hasText: /VigIA/ }).first();
    await expect(vigiaBtn).toBeVisible();
  });

  test('Le popup Facebook s\'ouvre au clic sur VigIA', async ({ page }) => {
    await page.goto(PROTO);
    await page.waitForTimeout(1500);

    // Clic sur le bouton VigIA Facebook (le premier)
    const vigiaBtn = page.locator('button').filter({ hasText: /VigIA/ }).first();
    await vigiaBtn.click();

    // Le popup doit afficher "Prêt à analyser"
    await expect(page.locator('text=Prêt à analyser cette page.')).toBeVisible();
    await expect(page.locator('text=Vérif-Média')).toBeVisible();
    await expect(page.locator('text=Vérif-Lien')).toBeVisible();
    await expect(page.locator('text=Vérif-Compte')).toBeVisible();
  });

  test('Bouton "Vérifier cette vidéo avec VigIA" visible sur le post Facebook', async ({ page }) => {
    await page.goto(PROTO);
    await page.waitForTimeout(1500);

    await expect(page.locator('text=Vérifier cette vidéo avec VigIA').first()).toBeVisible();
  });

  test('Clic Vérifier-Média → spinner → résultat 82%', async ({ page }) => {
    await page.goto(PROTO);
    await page.waitForTimeout(1500);

    // Clic sur le bouton "Vérifier cette vidéo avec VigIA" dans la page
    await page.locator('text=Vérifier cette vidéo avec VigIA').first().click();

    // Spinner doit apparaître
    await expect(page.locator('text=Analyse Vérif-Média en cours…').first()).toBeVisible();

    // Après 2s environ, le résultat 82% doit apparaître
    await page.waitForTimeout(2200);
    await expect(page.locator('text=82%').first()).toBeVisible();
    await expect(page.locator('text=Vidéo probablement manipulée par IA.').first()).toBeVisible();
  });

  test('Popup : clic Vérifier dans Vérif-Média → spinner inline puis résultat', async ({ page }) => {
    await page.goto(PROTO);
    await page.waitForTimeout(1500);

    // Ouvrir le popup VigIA Facebook
    const vigiaBtn = page.locator('button').filter({ hasText: /VigIA/ }).first();
    await vigiaBtn.click();

    // Clic sur le bouton Vérifier dans la ligne Vérif-Média du popup
    await page.locator('text=Prêt à analyser cette page.').waitFor();
    const verifierBtn = page.locator('.vigia-popup, div').filter({ hasText: 'Vérif-Média' }).locator('button', { hasText: 'Vérifier' }).first();
    await verifierBtn.click();

    // Spinner dans le popup
    await page.waitForTimeout(200);
    const spinner = page.locator('.vigia-popup span[style*="animation"]').first();
    // Spinner ou "Analyse en cours" doit être visible
    await expect(page.locator('text=Analyse en cours…').or(page.locator('text=⚠ 82%'))).toBeVisible({ timeout: 3000 });
  });

  test('"Tout vérifier" déclenche les 3 analyses Facebook', async ({ page }) => {
    await page.goto(PROTO);
    await page.waitForTimeout(1500);

    const vigiaBtn = page.locator('button').filter({ hasText: /VigIA/ }).first();
    await vigiaBtn.click();
    await page.locator('text=Prêt à analyser cette page.').waitFor();

    await page.locator('text=Tout vérifier sur cette page').first().click();

    // Au moins un spinner ou "Analyse en cours" doit apparaître
    await expect(page.locator('text=Analyse en cours…').first()).toBeVisible({ timeout: 1000 });

    // Attendre que les 3 analyses se terminent (max 8s)
    await page.waitForTimeout(6500);
    await expect(page.locator('text=82%').first()).toBeVisible();
    await expect(page.locator('text=arnaque').first()).toBeVisible();
  });

});

test.describe('VigIA Prototype — LinkedIn', () => {

  test('Le bouton VigIA LinkedIn est visible', async ({ page }) => {
    await page.goto(PROTO);
    await page.waitForTimeout(1500);

    // Deuxième instance VigIA = LinkedIn
    const vigiaButtons = page.locator('button').filter({ hasText: /VigIA/ });
    await expect(vigiaButtons.nth(1)).toBeVisible();
  });

  test('Vérifier cette vidéo avec VigIA visible sur le post LinkedIn', async ({ page }) => {
    await page.goto(PROTO);
    await page.waitForTimeout(1500);

    // Il y a deux "Vérifier cette vidéo avec VigIA" (FB + LI)
    const btns = page.locator('text=Vérifier cette vidéo avec VigIA');
    await expect(btns.nth(1)).toBeVisible();
  });

  test('Clic Vérifier-Lien LinkedIn → résultat arnaque pyramide', async ({ page }) => {
    await page.goto(PROTO);
    await page.waitForTimeout(1500);

    await page.locator('text=Vérifier ce lien avec VigIA').nth(1).click();
    await page.waitForTimeout(2200);
    await expect(page.locator('text=Arnaque identifiée').or(page.locator('text=pyramide'))).toBeVisible({ timeout: 5000 });
  });

});
