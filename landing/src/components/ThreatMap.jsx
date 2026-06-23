import { useEffect, useRef, useState } from 'react';

const API = 'https://vegia-production.up.railway.app/api/v1';

const PLATFORM = {
  facebook: 'Facebook', twitter: 'X/Twitter', whatsapp: 'WhatsApp', linkedin: 'LinkedIn',
  instagram: 'Instagram', mobile: 'Mobile', 'mobile-web': 'Mobile',
};
const TYPE = { text: 'Texte', url: 'Lien', image: 'Média', account: 'Compte' };

function flag(code) {
  if (!code || code.length !== 2) return '🌍';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export default function ThreatMap() {
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`${API}/public/threat-map`)
      .then(r => r.json()).then(setData)
      .catch(() => setErr("Carte temporairement indisponible."));
  }, []);

  useEffect(() => {
    if (!data || !window.L || !mapRef.current) return;
    if (!mapObj.current) {
      mapObj.current = window.L.map(mapRef.current, { scrollWheelZoom: false }).setView([6.5, 12.5], 4);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 12,
      }).addTo(mapObj.current);
    }
    const cities = (data.by_city || []).filter(c => c.lat != null && c.lon != null);
    const max = Math.max(1, ...cities.map(c => c.alerts));
    cities.forEach(c => {
      const radius = 8 + (c.alerts / max) * 24;
      window.L.circleMarker([c.lat, c.lon], {
        radius, color: '#C8102E', fillColor: '#C8102E', fillOpacity: 0.45, weight: 1.5,
      }).bindPopup(`<b>${c.city || 'Inconnu'}</b><br>${c.alerts} alerte(s)`).addTo(mapObj.current);
    });
  }, [data]);

  return (
    <main className="api-doc">
      <div className="api-hero">
        <div className="eyebrow">Observatoire public</div>
        <h1 style={{ fontSize: 'clamp(28px,5vw,46px)' }}>Carte des arnaques & menaces</h1>
        <p className="hero-sub" style={{ margin: '14px auto 8px' }}>
          Zones et types de contenus signalés comme dangereux par VigIA, en temps réel.
          Données agrégées et anonymisées.
        </p>
        {data && (
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f87171', marginTop: 8 }}>
            {data.total_alerts} alertes détectées
          </div>
        )}
      </div>

      <section className="section" style={{ paddingTop: 8 }}>
        {err && <div className="admin-error" style={{ color: '#f87171' }}>{err}</div>}
        <div ref={mapRef} className="threat-map" />

        <div className="admin-grid2" style={{ marginTop: 28 }}>
          <div>
            <h3 className="api-h3">Alertes par pays</h3>
            {(() => {
              const list = (data?.by_country || []);
              const m = Math.max(1, ...list.map(c => c.alerts));
              return list.map((c, i) => (
                <div className="admin-bar-row" key={i}>
                  <span className="admin-bar-lbl">{flag(c.code)} {c.country}</span>
                  <span className="admin-bar-track"><span className="admin-bar-fill" style={{ width: `${(c.alerts / m) * 100}%`, background: 'linear-gradient(90deg,#C8102E,#f87171)' }} /></span>
                  <span className="admin-bar-num">{c.alerts}</span>
                </div>
              ));
            })()}
            {(!data || !data.by_country?.length) && <p style={{ color: '#7ab89a' }}>Aucune alerte pour l'instant.</p>}
          </div>
          <div>
            <h3 className="api-h3">Menaces récentes</h3>
            <div className="threat-feed">
              {(data?.recent_scams || []).map((s, i) => (
                <div className="threat-item" key={i}>
                  <span className="threat-dot" />
                  <span>{TYPE[s.type] || s.type || 'Contenu'} suspect{s.source ? ` · ${PLATFORM[s.source] || s.source}` : ''}{s.city ? ` · ${s.city}` : ''}</span>
                  <span className="threat-time">{(s.time || '').slice(11, 16)}</span>
                </div>
              ))}
              {(!data || !data.recent_scams?.length) && <p style={{ color: '#7ab89a' }}>Aucune menace récente.</p>}
            </div>
          </div>
        </div>

        <p className="api-note" style={{ marginTop: 24 }}>
          Ces données proviennent des vérifications effectuées par les utilisateurs de VigIA
          (extension & application). Elles sont strictement <strong>agrégées et anonymisées</strong> —
          aucune donnée personnelle n'est exposée.
        </p>
        <p style={{ marginTop: 16 }}><a className="btn btn-ghost btn-md" href="#">← Retour à l'accueil</a></p>
      </section>
    </main>
  );
}
