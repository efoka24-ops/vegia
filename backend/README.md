# VigIA API

API de vérification de contenus : **deepfakes**, **désinformation**, **liens malveillants**
et **usurpation de comptes**. Conçue pour l'extension VigIA et pour l'intégration par des
partenaires tiers.

> Stratégie « APIs tierces » : chaque module appelle un fournisseur externe
> (Google Safe Browsing, Sightengine, Claude) avec **repli heuristique** automatique.
> L'API fonctionne donc **sans aucune clé** (résultats heuristiques), et devient plus
> précise au fur et à mesure que les clés fournisseurs sont configurées.

## Base URL

```
https://api.vigia.cm/api/v1        (production)
http://localhost:8000/api/v1       (local)
```

## Authentification

Toutes les requêtes `/verify` et `/me` exigent un en-tête Bearer :

```
Authorization: Bearer <token>
```

- `public` — jeton ouvert utilisé par l'extension grand public (quota par IP).
- `vig_...` — clé partenaire (quota mensuel configurable). Voir « Obtenir une clé ».

## Endpoints

| Méthode | Chemin | Auth | Description |
|--------|--------|------|-------------|
| GET  | `/health` | — | État du service |
| POST | `/verify` | Bearer | Analyse un contenu (image, texte, url, account) |
| GET  | `/blacklist` | — | Liste noire des URL signalées |
| POST | `/report` | — | Signaler un contenu (option : ajout liste noire) |
| GET  | `/me` | Bearer | Palier et consommation (30 j) de la clé |
| POST | `/admin/keys` | Admin | Créer une clé partenaire |
| GET  | `/admin/keys` | Admin | Lister les clés |
| DELETE | `/admin/keys/{key}` | Admin | Révoquer une clé |

Documentation interactive (OpenAPI/Swagger) : **`/docs`** · schéma : **`/openapi.json`**

### POST /verify

Requête :

```json
{
  "type": "url",
  "content": { "url": "https://mtn-momo-verify.xyz/login" },
  "source": "facebook"
}
```

`type` ∈ `image | text | url | account`. Champs de `content` selon le type :
`image_url`, `text`, `url`, `profile_image_url` + `profile_name`.

Réponse :

```json
{
  "request_id": "…",
  "score": 0.92,
  "level": "red",
  "modules": { "link": { "score": 0.92, "label": "lien probablement malveillant" } },
  "explanation": "Ce contenu est probablement manipulé ou trompeur. …",
  "sources": ["Google Safe Browsing"]
}
```

`level` : `green` (< 0.35) · `orange` (< 0.70) · `red` (≥ 0.70).

## Exemples d'intégration

### cURL

```bash
curl -X POST https://api.vigia.cm/api/v1/verify \
  -H "Authorization: Bearer vig_VOTRE_CLE" \
  -H "Content-Type: application/json" \
  -d '{"type":"text","content":{"text":"Investissez 10000 et doublez en 24h, garanti !"}}'
```

### JavaScript (fetch)

```js
const res = await fetch("https://api.vigia.cm/api/v1/verify", {
  method: "POST",
  headers: {
    "Authorization": "Bearer vig_VOTRE_CLE",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ type: "url", content: { url: "https://exemple.com" } }),
});
const data = await res.json();
console.log(data.level, data.explanation);
```

### Python

```python
import httpx

r = httpx.post(
    "https://api.vigia.cm/api/v1/verify",
    headers={"Authorization": "Bearer vig_VOTRE_CLE"},
    json={"type": "image", "content": {"image_url": "https://exemple.com/photo.jpg"}},
)
print(r.json()["score"], r.json()["level"])
```

## Obtenir une clé partenaire

L'administrateur crée une clé avec le jeton `ADMIN_TOKEN` :

```bash
curl -X POST https://api.vigia.cm/api/v1/admin/keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"Partenaire X","tier":"pro","monthly_quota":50000}'
# → { "key": "vig_…", "label": "Partenaire X", "tier": "pro" }
```

Transmettez la clé `vig_…` au partenaire (affichée une seule fois).

## Déploiement (Railway)

1. Nouveau service depuis le repo GitHub → **Root Directory = `backend`**.
2. Ajouter un plugin **PostgreSQL** (la variable `DATABASE_URL` est injectée).
3. Variables d'environnement (onglet *Variables*) : voir [`.env.example`](../.env.example)
   — au minimum `ADMIN_TOKEN`, puis les clés fournisseurs souhaitées.
4. Railway build via le `Dockerfile` ; healthcheck sur `/api/v1/health`.
5. (Optionnel) Mapper le domaine custom `api.vigia.cm` au service.

## Variables d'environnement

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | PostgreSQL (injectée par Railway) |
| `ADMIN_TOKEN` | Administration des clés API |
| `GOOGLE_SAFE_BROWSING_KEY` | Vérif-Lien (sinon heuristique) |
| `SIGHTENGINE_USER` / `SIGHTENGINE_SECRET` | Vérif-Média deepfake (sinon indisponible) |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Vérif-Info (sinon heuristique) |
| `CORS_ORIGINS` | Origines web partenaires autorisées |
