import AsyncStorage from '@react-native-async-storage/async-storage';

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

  const res = await fetch(`${API_BASE}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer public',
      'X-Client-Id': clientId,
    },
    body: JSON.stringify({ type, content, source: 'mobile' }),
  });

  if (!res.ok) throw new Error('Erreur ' + res.status);
  return res.json();
}
