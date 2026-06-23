export const C = {
  green: '#0A5C42',
  green2: '#22c55e',
  yellow: '#F2B705',
  red: '#C8102E',
  orange: '#d97706',
  dark: '#11201A',
  card: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.10)',
  text: '#ffffff',
  muted: '#7ab89a',
};

export function levelColor(level) {
  if (level === 'red') return C.red;
  if (level === 'orange') return C.orange;
  if (level === 'green') return C.green2;
  return '#94a3b8';
}

export function levelLabel(level) {
  if (level === 'red') return '⚠️  Risque élevé';
  if (level === 'orange') return '⚠️  À vérifier';
  if (level === 'green') return '✅  Aucun risque détecté';
  return '❓  Indéterminé';
}
