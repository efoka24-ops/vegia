/**
 * Serveur mock VigIA API — pour démo locale sans backend Python
 * Lance avec : node mock-server/server.mjs
 * Ecoute sur http://localhost:8000
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = 8000;

// Simule un délai réseau réaliste
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Réponses simulées selon le type de contenu
function buildResponse(body) {
  const { type, content, source } = body;

  // --- image : deepfake ---
  if (type === 'image') {
    const url = content?.image_url || '';
    // Simule : images provenant de domaines suspects → score élevé
    const isSuspect = url.includes('blob') || url.includes('cdn-cgi') || Math.random() < 0.3;
    const score = isSuspect ? 0.82 + Math.random() * 0.15 : 0.08 + Math.random() * 0.2;
    return {
      request_id: randomUUID(),
      score: +score.toFixed(3),
      level: score > 0.7 ? 'red' : score > 0.35 ? 'orange' : 'green',
      modules: {
        media: {
          score: +score.toFixed(3),
          label: score > 0.7
            ? 'probable deepfake (artefacts détectés autour des yeux et de la bouche)'
            : score > 0.35
            ? 'image potentiellement retouchée'
            : 'image authentique',
        },
      },
      explanation: score > 0.7
        ? 'Cette image présente des artefacts caractéristiques d\'une manipulation IA.'
        : score > 0.35
        ? 'Quelques irrégularités détectées — vérifiez la source.'
        : 'Aucun signe de manipulation détecté.',
      sources: score > 0.35 ? ['https://factcheck.cm/ref/demo-123'] : [],
    };
  }

  // --- text : fact-check ---
  if (type === 'text') {
    const text = (content?.text || '').toLowerCase();
    const isFake = text.includes('faux') || text.includes('arnaque') ||
                   text.includes('urgent') || text.includes('gratuit') || Math.random() < 0.25;
    const score = isFake ? 0.75 + Math.random() * 0.2 : 0.05 + Math.random() * 0.25;
    return {
      request_id: randomUUID(),
      score: +score.toFixed(3),
      level: score > 0.7 ? 'red' : score > 0.35 ? 'orange' : 'green',
      modules: {
        info: {
          score: +score.toFixed(3),
          label: score > 0.7
            ? 'similaire à un contenu faux (confiance 87%)'
            : score > 0.35
            ? 'aucune correspondance certaine — vérifiez la source'
            : 'aucune correspondance dans la base fact-check',
          sources: score > 0.5 ? ['https://factcheck.cm/ref/demo-456'] : [],
        },
      },
      explanation: score > 0.7
        ? 'Ce texte ressemble fortement à une publication déjà réfutée par nos partenaires fact-checkers.'
        : 'Contenu non répertorié dans notre base de vérifications.',
      sources: score > 0.5 ? ['https://factcheck.cm/ref/demo-456'] : [],
    };
  }

  // --- url : phishing ---
  if (type === 'url') {
    const url = (content?.url || '').toLowerCase();
    const isPhishing = url.includes('bit.ly') || url.includes('tinyurl') ||
                       url.includes('login') || url.includes('verify') ||
                       url.includes('secure') || Math.random() < 0.2;
    const score = isPhishing ? 0.78 + Math.random() * 0.2 : 0.04 + Math.random() * 0.2;
    return {
      request_id: randomUUID(),
      score: +score.toFixed(3),
      level: score > 0.7 ? 'red' : score > 0.35 ? 'orange' : 'green',
      modules: {
        link: {
          score: +score.toFixed(3),
          label: score > 0.7
            ? 'lien probablement malveillant (structure URL suspecte)'
            : 'lien a priori sûr',
        },
      },
      explanation: score > 0.7
        ? 'Ce lien présente plusieurs caractéristiques de phishing (raccourcisseur, mots-clés suspects).'
        : 'Aucun indicateur de phishing détecté.',
      sources: [],
    };
  }

  // --- account : faux compte ---
  if (type === 'account') {
    const name = (content?.profile_name || '').toLowerCase();
    const isFake = name.includes('officiel') || name.includes('president') ||
                   name.includes('ministre') || Math.random() < 0.3;
    const score = isFake ? 0.0 : 0.65;
    return {
      request_id: randomUUID(),
      score: +score.toFixed(3),
      level: isFake ? 'green' : 'orange',
      modules: {
        account: {
          score: +score.toFixed(3),
          label: isFake
            ? 'correspond au compte officiel vérifié'
            : 'aucun compte officiel correspondant trouvé',
        },
      },
      explanation: isFake
        ? 'Ce profil correspond à un compte officiel dans le registre MINPOSTEL/ANTIC.'
        : 'Ce profil ne correspond à aucun compte officiel vérifié dans notre registre.',
      sources: [],
    };
  }

  return { request_id: randomUUID(), score: 0, level: 'green', modules: {}, explanation: 'Type non reconnu.', sources: [] };
}

const server = createServer(async (req, res) => {
  // CORS — autorise l'extension Chrome
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /api/v1/blacklist
  if (req.method === 'GET' && url.pathname === '/api/v1/blacklist') {
    res.writeHead(200);
    res.end(JSON.stringify({
      entries: ['http://arnaque-cm.biz', 'https://bit.ly/fake123', 'http://mtn-promo.site'],
      count: 3,
    }));
    return;
  }

  // POST /api/v1/verify
  if (req.method === 'POST' && url.pathname === '/api/v1/verify') {
    let body = '';
    for await (const chunk of req) body += chunk;

    try {
      const parsed = JSON.parse(body);
      console.log(`[VigIA Mock] ${new Date().toISOString()} — ${parsed.type} | source: ${parsed.source}`);

      await delay(400 + Math.random() * 600); // simule latence IA

      const result = buildResponse(parsed);
      console.log(`  → level: ${result.level} | score: ${result.score}`);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'JSON invalide' }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Route inconnue' }));
});

server.listen(PORT, () => {
  console.log(`\n✓ VigIA Mock API — http://localhost:${PORT}`);
  console.log('  POST /api/v1/verify    → analyse (image|text|url|account)');
  console.log('  GET  /api/v1/blacklist → liste noire\n');
});
