# VigIA Mobile (Expo / React Native)

Application mobile VigIA — vérification de contenus (deepfakes, désinformation,
arnaques) sur **iOS et Android**, branchée sur la même API que l'extension.

## Démarrer

```bash
cd vigia-mobile
npm install
npx expo start
```

- Scanne le QR code avec l'app **Expo Go** (Android/iOS) pour tester sur ton téléphone.
- Ou `npm run android` / `npm run ios` (émulateur).

## État actuel (v0.2)

✅ Logo VigIA (icône, icône adaptative Android, splash)
✅ Vérification **Texte / Lien / Compte** branchée sur l'API Railway
✅ **Vérif-Voix** : enregistrement micro (`expo-av`) → détection de voix clonée (`/verify-audio`)
✅ Verdict coloré + indice de risque explicite (0 % sûr → 100 % suspect)
✅ Boucle de **feedback** (👍/👎) sous chaque résultat
✅ Identifiant d'installation anonyme (`X-Client-Id`) → remonte dans le back-office (source `mobile`)

## Backend

Aucune modification nécessaire : l'app appelle `POST {API_BASE}/verify`.
`API_BASE` est défini dans [`src/api.js`](src/api.js) (par défaut le service Railway).

## Roadmap mobile

- 📤 **« Partager vers VigIA »** (Android Share Intent / iOS Share Extension)
  via `expo-share-intent` — recevoir un lien/texte/image partagé depuis
  WhatsApp, Facebook, etc. (la killer-feature mobile).
- 🖼️ **Vérif-Média** : choisir une image (`expo-image-picker`).
  ⚠️ Nécessite un endpoint backend d'upload (l'API actuelle attend une URL
  publique `image_url`, pas un fichier local).
- 🗂️ Historique local des vérifications.
- 🏪 Build & publication via **EAS Build** (Play Store / App Store).

## Build de production (plus tard)

```bash
npm install -g eas-cli
eas build -p android   # .aab / .apk
eas build -p ios       # .ipa
```
