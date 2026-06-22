// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const baseURL = 'file://' + path.resolve(__dirname, '../prototype/VigIA - Prototype extension.dc.html').replace(/\\/g, '/');

test.describe('VigIA Prototype — Facebook', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.locator('button', { hasText: /VigIA/ }).first().waitFor({ state: 'visible', timeout: 2000 }); // Attendre l'init de dc-runtime
  });

  test('La page se charge et affiche le bouton VigIA', async ({ page }) => {
    const vigiaBtn = page.locator('button').filter({ hasText: /VigIA/ }).first();
    await expect(vigiaBtn).toBeVisible();
  });

  test('Le popup Facebook s\'ouvre au clic sur VigIA', async ({ page }) => {
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
    await expect(page.locator('text=Vérifier cette vidéo avec VigIA').first()).toBeVisible();
  });

  test('Clic Vérifier-Média → spinner → résultat 82%', async ({ page }) => {
    // Clic sur le bouton "Vérifier cette vidéo avec VigIA" dans la page
    await page.locator('text=Vérifier cette vidéo avec VigIA').first().click();

    // Le spinner doit apparaître
    await expect(page.locator('text=Analyse Vérif-Média en cours…').first()).toBeVisible();

    // Le résultat 82% doit apparaître (Playwright attendra automatiquement)
    await expect(page.locator('text=82%').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Vidéo probablement manipulée par IA.').first()).toBeVisible();
  });

  test('Popup : clic Vérifier dans Vérif-Média → spinner inline puis résultat', async ({ page }) => {
    // Ouvrir le popup VigIA Facebook
    const vigiaBtn = page.locator('button').filter({ hasText: /VigIA/ }).first();
    await vigiaBtn.click();

    // Clic sur le bouton Vérifier dans la ligne Vérif-Média du popup
    await expect(page.locator('text=Prêt à analyser cette page.')).toBeVisible();
    const verifierBtn = page.locator('.vigia-popup, div').filter({ hasText: 'Vérif-Média' }).locator('button', { hasText: 'Vérifier' }).first();
    await verifierBtn.click();

    // Spinner dans le popup
    // "Analyse en cours" ou le résultat doit être visible
    await expect(
      page.locator('text=Analyse en cours…').or(page.locator('text=⚠ 82%'))
    ).toBeVisible({ timeout: 5000 });
  });

  test('"Tout vérifier" déclenche les 3 analyses Facebook', async ({ page }) => {
    const vigiaBtn = page.locator('button').filter({ hasText: /VigIA/ }).first();
    await vigiaBtn.click();
    await expect(page.locator('text=Prêt à analyser cette page.')).toBeVisible();

    await page.locator('text=Tout vérifier sur cette page').first().click();

    // Au moins un spinner ou "Analyse en cours" doit apparaître
    await expect(page.locator('text=Analyse en cours…').first()).toBeVisible();

    // Attendre que les résultats apparaissent
    await expect(page.locator('text=82%')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=arnaque')).toBeVisible({ timeout: 8000 });
  });

});

test.describe('VigIA Prototype — LinkedIn', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.locator('button', { hasText: /VigIA/ }).nth(1).waitFor({ state: 'visible', timeout: 2000 });
  });

  test('Le bouton VigIA LinkedIn est visible', async ({ page }) => {
    // Deuxième instance VigIA = LinkedIn
    const vigiaButtons = page.locator('button').filter({ hasText: /VigIA/ });
    await expect(vigiaButtons.nth(1)).toBeVisible();
  });

  test('Vérifier cette vidéo avec VigIA visible sur le post LinkedIn', async ({ page }) => {
    // Il y a deux "Vérifier cette vidéo avec VigIA" (FB + LI)
    const btns = page.locator('text=Vérifier cette vidéo avec VigIA');
    await expect(btns.nth(1)).toBeVisible();
  });

  test('Clic Vérifier-Lien LinkedIn → résultat arnaque pyramide', async ({ page }) => {
    await page.locator('text=Vérifier ce lien avec VigIA').nth(1).click();
    await expect(
      page.locator('text=Arnaque identifiée').or(page.locator('text=pyramide'))
    ).toBeVisible({ timeout: 5000 });
  });

});
