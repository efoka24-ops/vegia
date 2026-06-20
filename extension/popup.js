async function loadStats() {
  const data = await chrome.storage.local.get(['statsGreen', 'statsOrange', 'statsRed', 'enabled']);

  document.getElementById('countGreen').textContent  = data.statsGreen  || 0;
  document.getElementById('countOrange').textContent = data.statsOrange || 0;
  document.getElementById('countRed').textContent    = data.statsRed    || 0;

  const toggle = document.getElementById('toggleEnabled');
  toggle.checked = data.enabled !== false;
}

document.getElementById('toggleEnabled').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ enabled: e.target.checked });
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (e.target.checked) {
    dot.className  = 'status__dot status__dot--on';
    text.textContent = 'Actif sur cette page';
  } else {
    dot.className  = 'status__dot status__dot--off';
    text.textContent = 'Désactivé';
  }
});

loadStats();
