import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');

// ---------- Utilitaires extraits de content.js (version testable) ----------

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < Math.min(str.length, 200); i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function scoreToLevel(score) {
  if (score < 0.35) return 'green';
  if (score < 0.70) return 'orange';
  return 'red';
}

function aggregateScore(modules) {
  const scores = Object.values(modules)
    .filter(v => v && v.score != null)
    .map(v => v.score);
  return scores.length ? Math.max(...scores) : 0.0;
}

function buildPayloadType(element) {
  if (element.tagName === 'IMG' && element.src && !element.src.startsWith('data:'))
    return 'image';
  if (element.tagName === 'A')
    return 'url';
  if (element.tagName === 'SPAN' || element.tagName === 'DIV')
    return 'text';
  return null;
}

// ---------- Tests ----------

describe('Manifest V3', () => {
  test('manifest.json est du JSON valide', () => {
    const raw = readFileSync(join(root, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(raw);
    assert.equal(manifest.manifest_version, 3, 'manifest_version doit être 3');
  });

  test('manifest contient les champs obligatoires', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
    assert.ok(manifest.name,         'name manquant');
    assert.ok(manifest.version,      'version manquante');
    assert.ok(manifest.background,   'background manquant');
    assert.ok(manifest.content_scripts?.length, 'content_scripts manquant');
  });

  test('content_scripts couvre les 3 plateformes cibles', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
    const matches  = manifest.content_scripts[0].matches.join(' ');
    assert.ok(matches.includes('facebook.com'), 'Facebook manquant');
    assert.ok(matches.includes('twitter.com'),  'Twitter manquant');
    assert.ok(matches.includes('whatsapp.com'), 'WhatsApp manquant');
  });
});

describe('Fichiers JS — syntaxe', () => {
  const files = ['background.js', 'content.js', 'popup.js'];

  for (const file of files) {
    test(`${file} ne contient pas d'erreur de syntaxe évidente`, () => {
      const src = readFileSync(join(root, file), 'utf8');
      assert.ok(src.length > 0, `${file} est vide`);
      // Vérifie que les accolades sont équilibrées
      let depth = 0;
      for (const ch of src) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
        assert.ok(depth >= 0, `${file} : accolade fermante inattendue`);
      }
      assert.equal(depth, 0, `${file} : accolades non équilibrées (delta = ${depth})`);
    });
  }
});

describe('simpleHash', () => {
  test('retourne une chaîne non vide', () => {
    assert.ok(simpleHash('bonjour').length > 0);
  });

  test('même entrée → même hash (déterministe)', () => {
    const text = 'Cette publication contient une fausse information.';
    assert.equal(simpleHash(text), simpleHash(text));
  });

  test('entrées différentes → hashes différents', () => {
    assert.notEqual(simpleHash('vrai'), simpleHash('faux'));
  });

  test('ne plante pas sur une chaîne vide', () => {
    assert.doesNotThrow(() => simpleHash(''));
  });

  test('tronque à 200 caractères (perf)', () => {
    const long   = 'a'.repeat(500);
    const courte = 'a'.repeat(200);
    assert.equal(simpleHash(long), simpleHash(courte));
  });
});

describe('scoreToLevel', () => {
  test('0.0 → green',  () => assert.equal(scoreToLevel(0.0),  'green'));
  test('0.34 → green', () => assert.equal(scoreToLevel(0.34), 'green'));
  test('0.35 → orange',() => assert.equal(scoreToLevel(0.35), 'orange'));
  test('0.69 → orange',() => assert.equal(scoreToLevel(0.69), 'orange'));
  test('0.70 → red',   () => assert.equal(scoreToLevel(0.70), 'red'));
  test('1.0 → red',    () => assert.equal(scoreToLevel(1.0),  'red'));
});

describe('aggregateScore', () => {
  test('prend le score max entre les modules', () => {
    const result = aggregateScore({
      media:   { score: 0.9 },
      link:    { score: 0.2 },
      account: { score: null },
    });
    assert.equal(result, 0.9);
  });

  test('retourne 0 si aucun module na de score', () => {
    assert.equal(aggregateScore({ media: { score: null } }), 0.0);
    assert.equal(aggregateScore({}), 0.0);
  });

  test('fonctionne avec un seul module', () => {
    assert.equal(aggregateScore({ info: { score: 0.55 } }), 0.55);
  });
});

describe('buildPayloadType', () => {
  const makeEl = (tag, extra = {}) => ({ tagName: tag, ...extra });

  test('IMG avec src http → image',   () => assert.equal(buildPayloadType(makeEl('IMG', { src: 'https://example.com/img.jpg' })), 'image'));
  test('IMG data: URI → null',        () => assert.equal(buildPayloadType(makeEl('IMG', { src: 'data:image/png;base64,abc' })), null));
  test('A → url',                     () => assert.equal(buildPayloadType(makeEl('A')),    'url'));
  test('DIV → text',                  () => assert.equal(buildPayloadType(makeEl('DIV')),  'text'));
  test('SPAN → text',                 () => assert.equal(buildPayloadType(makeEl('SPAN')), 'text'));
  test('BUTTON → null',               () => assert.equal(buildPayloadType(makeEl('BUTTON')), null));
});
