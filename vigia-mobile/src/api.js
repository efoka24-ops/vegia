import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Backend VigIA (Railway). Modifie ici si tu mappes un domaine custom.
export const API_BASE = 'https://vegia-production.up.railway.app/api/v1';

let _clientId = null;

// Identifiant d'installation anonyme (persistant) — remonte dans le back-office.
export async function getClientId() {
  if (_clientId) return _clientId;
  try {
    let id = await AsyncStorage.getItem('vigia_client_id');
    if (!id) {
      id = 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
      await AsyncStorage.setItem('vigia_client_id', id);
    }
    _clientId = id;
    return id;
  } catch (_) {
    return 'm-anon';
  }
}

// type: 'text' | 'url' | 'account'
export async function verify(type, value) {
  const content = {};
  if (type === 'text') content.text = value;
  else if (type === 'url') content.url = value;
  else if (type === 'account') content.profile_name = value;

  const clientId = await getClientId();

  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer public',
  };
  // En-tête custom : envoyé sur natif (mobile). Sur web il déclencherait un
  // preflight CORS ; le backend l'autorise désormais (allow_headers *), mais on
  // reste prudent tant que le déploiement n'est pas propagé.
  if (Platform.OS !== 'web') headers['X-Client-Id'] = clientId;

  const res = await fetch(`${API_BASE}/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type, content, source: Platform.OS === 'web' ? 'mobile-web' : 'mobile' }),
  });

  if (!res.ok) throw new Error('Erreur ' + res.status);
  return res.json();
}

export async function sendFeedback({ request_id, level, ctype, correct }) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (Platform.OS !== 'web') headers['X-Client-Id'] = await getClientId();
    await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ request_id, level, ctype, source: 'mobile', correct }),
    });
  } catch (_) { /* best effort */ }
}
