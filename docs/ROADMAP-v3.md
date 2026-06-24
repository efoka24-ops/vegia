# VigIA — Feuille de route V3

> Branche `v3` · à reprendre plus tard. La V2 (`v2.0.0`) est en production.

## 🤖 Feature phare V3 : Bot WhatsApp

**Idée** : l'utilisateur transfère un message / lien / image / note vocale suspect au
numéro WhatsApp VigIA → il reçoit un **verdict** en réponse. Zéro installation.
Réutilise l'API `/verify` existante — le bot n'est qu'un client de plus.

### Architecture
```
Utilisateur WhatsApp ──► Meta WhatsApp Cloud API ──webhook──► Backend VigIA (FastAPI)
                                                               /whatsapp/webhook
                                                               → /verify (texte/lien)
                                                               → média (image) / audio (voix)
                                                  ◄── réponse (verdict + indice de risque)
```

### Canal
- **Meta WhatsApp Cloud API** (recommandé prod) : officiel, gratuit jusqu'à un volume, webhook. Business à vérifier.
- **Twilio WhatsApp sandbox** : prototypage en 5 min.

### Backend à ajouter (FastAPI)
- `GET /whatsapp/webhook` : handshake de vérification Meta (renvoie `hub.challenge`).
- `POST /whatsapp/webhook` : reçoit les messages →
  - texte/lien → `_info.analyze` / `_link.analyze`
  - image → télécharge le média (Graph API `/{media_id}`) → `_media.analyze_frames` (bytes)
  - audio (note vocale) → `_audio.analyze`
- Réponse via `POST graph.facebook.com/v21.0/{PHONE_ID}/messages` (verdict formaté).
- Sécurité : vérifier `X-Hub-Signature-256` avec l'`APP_SECRET`.
- Journalise les events (source `whatsapp`) → remonte dans back-office + carte des menaces.

### Variables d'environnement
```
WHATSAPP_PHONE_ID
WHATSAPP_TOKEN          (temporaire 24h pour tester, puis token permanent System User)
WHATSAPP_VERIFY_TOKEN   (chaîne choisie, pour le handshake)
WHATSAPP_APP_SECRET     (vérif. signature)
```

### Étapes de création du compte Meta
1. developers.facebook.com → Create App → type Business.
2. Add product **WhatsApp** → numéro de test gratuit + token temporaire.
3. Récupérer Phone number ID + token ; ajouter son numéro comme destinataire de test.
4. Webhook : URL = `https://vegia-production.up.railway.app/api/v1/whatsapp/webhook` + verify token ; subscribe `messages`.
5. Token permanent : Business Settings → System Users.
6. App Secret : App Settings → Basic.

### Effort
MVP texte/lien ~2 j · +image/audio ~1-2 j · prod : vérification business.

---

## Autres pistes V3
- **Modèles deepfake/audio self-hosted** entraînés sur données locales (le dataset se
  constitue via la boucle de feedback déjà en place → onglet Qualité, export CSV).
- **Mode SMS / USSD** pour zones à faible connectivité (vérifier un numéro/lien par SMS).
- **API vidéo dédiée** (fournisseur acceptant une URL vidéo) pour couvrir les vidéos
  cross-origin que la capture navigateur ne peut pas extraire.
- **Dashboard B2B** pour médias / fact-checkers (monitoring de contenus suspects).
- **Multilingue** (pidgin, langues locales) pour le module Vérif-Info.
- **Facturation** des clés API partenaires (Stripe / Mobile Money) — back-office prêt.
- **Notifications push** sur pics d'arnaques régionaux (le calcul d'alertes existe déjà).

## État au gel de la V3 (départ)
- Prod = `preprod` (= `v2`). Tags : `v1.0.0`, `v2.0.0`.
- Backend (Railway), landing + back-office + carte menaces + éducation (Vercel),
  extension, app mobile (APK) : tous déployés.
