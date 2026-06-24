import { useState, useEffect, useCallback, Fragment } from 'react';

const TOKEN_KEY = 'vigia_admin_token';
const API_KEY = 'vigia_admin_api';

function defaultApiBase() {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:8000/api/v1';
  }
  return 'https://vegia-production.up.railway.app/api/v1';
}

const TYPE_LABEL = { text: 'Texte', url: 'Lien', image: 'Média', account: 'Compte' };
function cleanType(t) {
  const v = (t || '').replace('ContentType.', '');
  return TYPE_LABEL[v] || v || '—';
}

function downloadCSV(filename, rows) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const NAV = [
  ["Vue d'ensemble", [['dashboard', '📊', 'Tableau de bord']]],
  ['Analyse', [['analytics', '📈', 'Analytique'], ['users', '👥', 'Utilisateurs'], ['feedback', '✅', 'Qualité'], ['alerts', '🚨', 'Alertes']]],
  ['Modération', [['blacklist', '🔗', 'Liste noire'], ['reports', '🚩', 'Signalements'], ['accounts', '🏛️', 'Comptes officiels'], ['verified', '🛡️', 'VigIA Verified']]],
  ['Contenu & API', [['quiz', '🎓', 'Quiz (CMS)'], ['keys', '🔑', 'Clés API']]],
  ['Administration', [['admins', '👤', 'Admins'], ['system', '⚙️', 'Système']]],
];
const LABELS = Object.fromEntries(NAV.flatMap(([, items]) => items.map(([id, , label]) => [id, label])));

export default function AdminPanel() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [apiBase, setApiBase] = useState(() => sessionStorage.getItem(API_KEY) || defaultApiBase());
  const [authed, setAuthed] = useState(false);
  const [section, setSection] = useState('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const [error, setError] = useState('');

  const api = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${apiBase}${path}`, {
      ...opts,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    if (res.status === 401 || res.status === 403) { throw new Error('Token administrateur invalide'); }
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    return res.status === 204 ? null : res.json();
  }, [token, apiBase]);

  const login = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/stats');
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(API_KEY, apiBase);
      setAuthed(true);
    } catch (err) {
      setError(err.message + ' (le backend est-il en ligne ?)');
    }
  };

  const logout = () => { sessionStorage.removeItem(TOKEN_KEY); setToken(''); setAuthed(false); };

  if (!authed) {
    return (
      <main className="adm-login-wrap">
        <form className="adm-login" onSubmit={login}>
          <div className="adm-login-logo">🛡️</div>
          <h1>Administration <span>VigIA</span></h1>
          <p>URL de l'API et jeton administrateur.</p>
          <input type="text" placeholder="URL API" value={apiBase} onChange={e => setApiBase(e.target.value)} />
          <input type="password" placeholder="Jeton (ADMIN_TOKEN ou clé admin)" value={token} onChange={e => setToken(e.target.value)} autoFocus />
          <button className="btn btn-primary btn-md" type="submit">Se connecter</button>
          {error && <div className="admin-error">{error}</div>}
          <a href="#" className="admin-back">← Retour au site</a>
        </form>
      </main>
    );
  }

  const SECTIONS = {
    dashboard: <Dashboard api={api} />, analytics: <Analytics api={api} />, users: <Identities api={api} />,
    feedback: <Feedback api={api} />, alerts: <Alerts api={api} />, blacklist: <Blacklist api={api} />,
    reports: <Reports api={api} />, accounts: <Accounts api={api} />, verified: <Verified api={api} />,
    quiz: <QuizCMS api={api} />, keys: <Keys api={api} />, admins: <Admins api={api} />, system: <System api={api} />,
  };

  return (
    <div className={`adm${navOpen ? ' adm--navopen' : ''}`}>
      <aside className="adm-side">
        <div className="adm-brand">🛡️ Vig<span>IA</span><small>Admin</small></div>
        <nav>
          {NAV.map(([group, items]) => (
            <div className="adm-group" key={group}>
              <div className="adm-group-title">{group}</div>
              {items.map(([id, icon, label]) => (
                <button key={id} className={`adm-link${section === id ? ' on' : ''}`}
                  onClick={() => { setSection(id); setNavOpen(false); }}>
                  <span className="adm-ico">{icon}</span>{label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button className="adm-logout" onClick={logout}>Déconnexion</button>
      </aside>
      <main className="adm-main">
        <div className="adm-topbar">
          <button className="adm-burger" onClick={() => setNavOpen(v => !v)}>☰</button>
          <strong>{LABELS[section]}</strong>
          <a href="#" className="adm-back-link">↗ Voir le site</a>
        </div>
        <div className="adm-content">{SECTIONS[section]}</div>
      </main>
    </div>
  );
}

// ── Graphiques SVG (sans dépendance) ──
function Donut({ segments, size = 130, stroke = 22 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - stroke) / 2;
  const Circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={stroke} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map((s, i) => {
          const len = (s.value / total) * Circ;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
            strokeWidth={stroke} strokeDasharray={`${len} ${Circ - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </g>
    </svg>
  );
}

function LineChart({ series, height = 150 }) {
  if (!series || !series.length) return <p style={{ color: '#7ab89a' }}>Pas encore de données.</p>;
  const w = 600;
  const max = Math.max(1, ...series.map(s => s.count));
  const step = series.length > 1 ? w / (series.length - 1) : w;
  const pt = (val, i) => `${i * step},${height - (val / max) * (height - 24) - 12}`;
  const line = series.map((s, i) => pt(s.count, i)).join(' ');
  const alerts = series.map((s, i) => pt(s.alerts || 0, i)).join(' ');
  const area = `${line} ${w},${height} 0,${height}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polygon points={area} fill="rgba(34,197,94,.12)" />
      <polyline points={line} fill="none" stroke="#22c55e" strokeWidth="2.5" />
      <polyline points={alerts} fill="none" stroke="#f87171" strokeWidth="2" strokeDasharray="4 3" />
    </svg>
  );
}

function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const reload = useCallback(() => {
    fn().then(setData).catch(e => setErr(e.message));
  }, deps); // eslint-disable-line
  useEffect(() => { reload(); }, [reload]);
  return { data, err, reload, setErr };
}

function Stats({ api }) {
  const { data, err } = useLoad(() => api('/admin/stats'));
  if (err) return <div className="admin-error">{err}</div>;
  if (!data) return <p>Chargement…</p>;
  const cards = [
    ['Vérifications (30 j)', data.verifications_30d, '#4ade80'],
    ['Clés actives', data.active_keys, '#F2B705'],
    ['Signalements', data.reports, '#f87171'],
    ['Liste noire', data.blacklist, '#60a5fa'],
    ['Comptes officiels', data.official_accounts, '#a78bfa'],
  ];
  return (
    <div className="admin-cards">
      {cards.map(([l, v, c]) => (
        <div className="admin-card" key={l}>
          <div className="admin-card-val" style={{ color: c }}>{v}</div>
          <div className="admin-card-lbl">{l}</div>
        </div>
      ))}
    </div>
  );
}

const PLATFORM = {
  facebook: 'Facebook', twitter: 'X / Twitter', whatsapp: 'WhatsApp', linkedin: 'LinkedIn',
  instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', reddit: 'Reddit',
  telegram: 'Telegram', threads: 'Threads',
};

function flag(code) {
  if (!code || code.length !== 2) return '🌍';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function uaShort(ua) {
  if (!ua) return '—';
  let os = /Windows/.test(ua) ? 'Windows' : /Mac OS|Macintosh/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
  let br = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [br, os].filter(Boolean).join(' · ') || 'inconnu';
}

function Identities({ api }) {
  const { data, err } = useLoad(() => api('/admin/users'));
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState({});

  const toggle = async (uid) => {
    if (open === uid) { setOpen(null); return; }
    setOpen(uid);
    if (!detail[uid]) {
      try {
        const d = await api(`/admin/users/${encodeURIComponent(uid)}`);
        setDetail(prev => ({ ...prev, [uid]: d.events || [] }));
      } catch { /* ignore */ }
    }
  };

  if (err) return <div className="admin-error">{err}</div>;
  if (!data) return <p>Chargement…</p>;
  const users = data.users || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <p className="api-note" style={{ margin: 0 }}>
          Chaque utilisateur est identifié par un <strong>identifiant d'installation anonyme</strong>
          (aucune donnée de compte personnelle). {users.length} utilisateur(s).
        </p>
        <button className="admin-tab" style={{ flexShrink: 0 }} onClick={() => downloadCSV('vigia-utilisateurs.csv',
          users.map(u => ({ id: u.uid, ville: u.city, pays: u.country, navigateur: uaShort(u.user_agent), plateformes: u.platforms, verifs: u.verifs, alertes: u.alerts, premiere: u.first_seen, derniere: u.last_seen, ip: u.ip })))}>⬇ Exporter CSV</button>
      </div>
      <table className="admin-table">
        <thead><tr>
          <th>Utilisateur</th><th>Localisation</th><th>Navigateur</th>
          <th>Plateformes</th><th>Vérifs</th><th>Alertes</th><th>Dernière activité</th>
        </tr></thead>
        <tbody>
          {users.map((u) => (
            <Fragment key={u.uid}>
              <tr onClick={() => toggle(u.uid)} style={{ cursor: 'pointer' }}>
                <td><code>{(u.uid || '').slice(0, 12)}…</code></td>
                <td>{flag(u.country_code)} {[u.city, u.country].filter(Boolean).join(', ') || '—'}</td>
                <td>{uaShort(u.user_agent)}</td>
                <td>{u.platforms || '—'}</td>
                <td>{u.verifs}</td>
                <td style={{ color: u.alerts > 0 ? '#f87171' : '#94a3b8' }}>{u.alerts}</td>
                <td>{(u.last_seen || '').slice(0, 16).replace('T', ' ')}</td>
              </tr>
              {open === u.uid && (
                <tr><td colSpan={7} style={{ background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                    Première activité : {(u.first_seen || '').slice(0, 16).replace('T', ' ')} · IP : {u.ip || '—'}
                  </div>
                  {(detail[u.uid] || []).map((e, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '2px 0', color: '#c9d6cf' }}>
                      {(e.time || '').slice(0, 16).replace('T', ' ')} · {e.source || '—'} · {cleanType(e.ctype)} ·
                      <span style={{ color: e.level === 'red' ? '#f87171' : e.level === 'orange' ? '#fbbf24' : '#4ade80' }}> {e.level || '—'}</span>
                    </div>
                  ))}
                  {(detail[u.uid] || []).length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>Chargement…</div>}
                </td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Feedback({ api }) {
  const { data, err } = useLoad(() => api('/admin/feedback'));
  if (err) return <div className="admin-error">{err}</div>;
  if (!data) return <p>Chargement…</p>;
  return (
    <div>
      <div className="admin-cards" style={{ marginBottom: 20 }}>
        <div className="admin-card"><div className="admin-card-val" style={{ color: '#F2B705' }}>{data.total}</div><div className="admin-card-lbl">Retours reçus</div></div>
        <div className="admin-card"><div className="admin-card-val" style={{ color: '#4ade80' }}>{data.accuracy == null ? '—' : data.accuracy + '%'}</div><div className="admin-card-lbl">Justesse perçue</div></div>
        <div className="admin-card"><div className="admin-card-val" style={{ color: '#f87171' }}>{data.incorrect}</div><div className="admin-card-lbl">Verdicts contestés</div></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="admin-tab" onClick={() => downloadCSV('vigia-feedback.csv',
          (data.recent || []).map(r => ({ heure: r.time, verdict: r.level, type: cleanType(r.ctype), plateforme: r.source, correct: r.correct, commentaire: r.comment })))}>⬇ Exporter CSV (dataset)</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Heure</th><th>Verdict</th><th>Type</th><th>Plateforme</th><th>Correct ?</th></tr></thead>
        <tbody>
          {(data.recent || []).map((r, i) => (
            <tr key={i}>
              <td>{(r.time || '').slice(0, 16).replace('T', ' ')}</td>
              <td>{r.level || '—'}</td><td>{cleanType(r.ctype)}</td><td>{r.source || '—'}</td>
              <td style={{ color: r.correct ? '#4ade80' : '#f87171' }}>{r.correct ? '👍 oui' : '👎 non'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="api-note">Ces retours constituent un jeu de données pour entraîner/améliorer les futurs modèles VigIA.</p>
    </div>
  );
}

function Verified({ api }) {
  const { data, err, reload } = useLoad(() => api('/admin/verified'));
  const act = async (id, action) => { await api(`/admin/verified/${id}/${action}`, { method: 'POST' }); reload(); };
  if (err) return <div className="admin-error">{err}</div>;
  if (!data) return <p>Chargement…</p>;
  return (
    <div>
      <p className="api-note" style={{ marginBottom: 14 }}>
        Demandes d'institutions pour le badge « VigIA Verified ». Approuver ajoute le compte au registre Vérif-Compte.
      </p>
      <table className="admin-table">
        <thead><tr><th>Nom</th><th>Catégorie</th><th>Site officiel</th><th>Contact</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          {(data.requests || []).map(r => (
            <tr key={r.id}>
              <td>{r.name}</td><td>{r.category || '—'}</td>
              <td style={{ wordBreak: 'break-all' }}>{r.official_url || '—'}</td>
              <td>{r.contact || '—'}</td>
              <td style={{ color: r.status === 'approved' ? '#4ade80' : r.status === 'rejected' ? '#f87171' : '#fbbf24' }}>{r.status}</td>
              <td>{r.status === 'pending' && (
                <span style={{ display: 'flex', gap: 6 }}>
                  <button className="admin-tab" onClick={() => act(r.id, 'approve')}>✓ Approuver</button>
                  <button className="admin-del" onClick={() => act(r.id, 'reject')}>Rejeter</button>
                </span>
              )}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function System({ api }) {
  const { data, err } = useLoad(() => api('/admin/providers'));
  if (err) return <div className="admin-error">{err}</div>;
  if (!data) return <p>Chargement…</p>;
  const labels = {
    anthropic: 'Claude (Vérif-Info)', safe_browsing: 'Google Safe Browsing (Vérif-Lien)',
    sightengine: 'Sightengine (Vérif-Média)', smtp: 'Email SMTP', database: 'PostgreSQL',
  };
  return (
    <div>
      <h3 className="api-h3">Fournisseurs configurés</h3>
      <table className="admin-table">
        <thead><tr><th>Service</th><th>Statut</th></tr></thead>
        <tbody>
          {Object.entries(data.providers || {}).map(([k, v]) => (
            <tr key={k}>
              <td>{labels[k] || k}</td>
              <td style={{ color: v ? '#4ade80' : '#94a3b8' }}>{v ? '✓ actif' : '○ non configuré (repli heuristique)'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 14, color: '#7ab89a', fontSize: 13 }}>
        Modèle IA : <code>{data.model}</code> · Version API : <code>{data.version}</code>
      </p>
    </div>
  );
}

function Analytics({ api }) {
  const { data, err } = useLoad(() => api('/admin/analytics'));
  if (err) return <div className="admin-error">{err}</div>;
  if (!data) return <p>Chargement…</p>;
  const max = Math.max(1, ...(data.by_country || []).map(c => c.count));
  return (
    <div>
      <div className="admin-cards" style={{ marginBottom: 24 }}>
        <div className="admin-card"><div className="admin-card-val" style={{ color: '#4ade80' }}>{data.unique_users}</div><div className="admin-card-lbl">Utilisateurs uniques</div></div>
        <div className="admin-card"><div className="admin-card-val" style={{ color: '#F2B705' }}>{data.total_verifs}</div><div className="admin-card-lbl">Vérifications totales</div></div>
      </div>
      <div className="admin-grid2">
        <div>
          <h3 className="api-h3">Localisation géographique</h3>
          {(data.by_country || []).length === 0 && <p>Aucune donnée pour l'instant.</p>}
          {(data.by_country || []).map((c, i) => (
            <div className="admin-bar-row" key={i}>
              <span className="admin-bar-lbl">{flag(c.code)} {c.country}</span>
              <span className="admin-bar-track"><span className="admin-bar-fill" style={{ width: `${(c.count / max) * 100}%` }} /></span>
              <span className="admin-bar-num">{c.count}</span>
            </div>
          ))}
        </div>
        <div>
          <h3 className="api-h3">Plateformes</h3>
          <table className="admin-table"><tbody>
            {(data.by_platform || []).map((p, i) => (
              <tr key={i}><td>{PLATFORM[p.source] || p.source}</td><td>{p.count}</td></tr>
            ))}
          </tbody></table>
          <h3 className="api-h3">Verdicts</h3>
          <table className="admin-table"><tbody>
            {(data.by_level || []).map((l, i) => (
              <tr key={i}><td>{l.level}</td><td>{l.count}</td></tr>
            ))}
          </tbody></table>
        </div>
      </div>
      <div className="admin-grid2" style={{ marginTop: 24 }}>
        <div>
          <h3 className="api-h3">Par type de contenu</h3>
          <table className="admin-table"><tbody>
            {(data.by_type || []).map((t, i) => (
              <tr key={i}><td>{cleanType(t.type)}</td><td>{t.count}</td></tr>
            ))}
          </tbody></table>
          <h3 className="api-h3">Par ville</h3>
          <table className="admin-table"><tbody>
            {(data.by_city || []).map((c, i) => (
              <tr key={i}><td>{c.city}</td><td>{c.count}</td></tr>
            ))}
          </tbody></table>
        </div>
        <div>
          <h3 className="api-h3">Par heure (fuseau Douala)</h3>
          {(() => {
            const map = Object.fromEntries((data.by_hour || []).map(h => [h.hour, h.count]));
            const hmax = Math.max(1, ...Object.values(map));
            return Array.from({ length: 24 }, (_, h) => (
              <div className="admin-bar-row" key={h}>
                <span className="admin-bar-lbl" style={{ width: 40 }}>{String(h).padStart(2, '0')}h</span>
                <span className="admin-bar-track"><span className="admin-bar-fill" style={{ width: `${((map[h] || 0) / hmax) * 100}%` }} /></span>
                <span className="admin-bar-num">{map[h] || 0}</span>
              </div>
            ));
          })()}
        </div>
      </div>

      <h3 className="api-h3" style={{ marginTop: 24 }}>Activité par jour (14 j)</h3>
      {(() => {
        const dmax = Math.max(1, ...(data.by_day || []).map(d => d.count));
        return (data.by_day || []).map((d, i) => (
          <div className="admin-bar-row" key={i}>
            <span className="admin-bar-lbl">{d.day}</span>
            <span className="admin-bar-track"><span className="admin-bar-fill" style={{ width: `${(d.count / dmax) * 100}%` }} /></span>
            <span className="admin-bar-num">{d.count}</span>
          </div>
        ));
      })()}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
        <h3 className="api-h3" style={{ margin: 0 }}>Activité récente</h3>
        <button className="admin-tab" onClick={() => downloadCSV('vigia-activite.csv',
          (data.recent || []).map(r => ({ heure: r.time, ville: r.city, pays: r.country, plateforme: r.source, type: cleanType(r.ctype), verdict: r.level })))}>⬇ Exporter CSV</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Heure</th><th>Lieu</th><th>Plateforme</th><th>Type</th><th>Verdict</th></tr></thead>
        <tbody>
          {(data.recent || []).map((r, i) => (
            <tr key={i}>
              <td>{(r.time || '').slice(0, 16).replace('T', ' ')}</td>
              <td>{[r.city, r.country].filter(Boolean).join(', ') || '—'}</td>
              <td>{PLATFORM[r.source] || r.source || '—'}</td>
              <td>{cleanType(r.ctype)}</td>
              <td>{r.level || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="api-note">Données agrégées et anonymisées (identifiant d'installation aléatoire + géoloc approximative par IP). Aucune donnée personnelle de compte n'est collectée.</p>
    </div>
  );
}

function Keys({ api }) {
  const { data, err, reload } = useLoad(() => api('/admin/keys'));
  const [label, setLabel] = useState('');
  const [quota, setQuota] = useState('');
  const [created, setCreated] = useState(null);

  const create = async (e) => {
    e.preventDefault();
    const body = { label, tier: 'pro', monthly_quota: quota ? Number(quota) : null };
    const res = await api('/admin/keys', { method: 'POST', body: JSON.stringify(body) });
    setCreated(res.key); setLabel(''); setQuota(''); reload();
  };
  const revoke = async (key) => { await api(`/admin/keys/${key}`, { method: 'DELETE' }); reload(); };

  return (
    <div>
      <form className="admin-form" onSubmit={create}>
        <input placeholder="Nom du partenaire" value={label} onChange={e => setLabel(e.target.value)} required />
        <input placeholder="Quota mensuel (optionnel)" value={quota} onChange={e => setQuota(e.target.value)} type="number" />
        <button className="btn btn-primary btn-md" type="submit">Créer une clé</button>
      </form>
      {created && <div className="admin-ok">Clé créée (copiez-la, affichée une seule fois) : <code>{created}</code></div>}
      {err && <div className="admin-error">{err}</div>}
      <table className="admin-table">
        <thead><tr><th>Clé</th><th>Nom</th><th>Palier</th><th>Quota</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {(data?.keys || []).map((k, i) => (
            <tr key={i}>
              <td><code>{k.key}</code></td><td>{k.label}</td><td>{k.tier}</td>
              <td>{k.monthly_quota ?? '∞'}</td><td>{k.active ? '✓' : '✕'}</td>
              <td>{k.active && <button className="admin-del" onClick={() => revoke(k.key.replace('…',''))}>révoquer</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="api-note">Note : la révocation nécessite la clé complète ; depuis cette liste les clés sont masquées. Révoquez via l'API si besoin.</p>
    </div>
  );
}

function Blacklist({ api }) {
  const { data, err, reload } = useLoad(() => api('/admin/blacklist'));
  const [url, setUrl] = useState('');
  const [reason, setReason] = useState('');
  const add = async (e) => {
    e.preventDefault();
    await api('/admin/blacklist', { method: 'POST', body: JSON.stringify({ url, reason }) });
    setUrl(''); setReason(''); reload();
  };
  const remove = async (u) => { await api(`/admin/blacklist?url=${encodeURIComponent(u)}`, { method: 'DELETE' }); reload(); };
  return (
    <div>
      <form className="admin-form" onSubmit={add}>
        <input placeholder="URL malveillante" value={url} onChange={e => setUrl(e.target.value)} required />
        <input placeholder="Raison" value={reason} onChange={e => setReason(e.target.value)} />
        <button className="btn btn-primary btn-md" type="submit">Ajouter</button>
      </form>
      {err && <div className="admin-error">{err}</div>}
      <table className="admin-table">
        <thead><tr><th>URL</th><th>Raison</th><th>Ajouté</th><th></th></tr></thead>
        <tbody>
          {(data?.entries || []).map((b) => (
            <tr key={b.id}>
              <td style={{ wordBreak: 'break-all' }}>{b.url}</td><td>{b.reason}</td>
              <td>{(b.created_at || '').slice(0, 10)}</td>
              <td><button className="admin-del" onClick={() => remove(b.url)}>suppr.</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Accounts({ api }) {
  const { data, err, reload } = useLoad(() => api('/admin/official-accounts'));
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [src, setSrc] = useState('');
  const add = async (e) => {
    e.preventDefault();
    await api('/admin/official-accounts', { method: 'POST', body: JSON.stringify({ name, title, source_url: src }) });
    setName(''); setTitle(''); setSrc(''); reload();
  };
  const remove = async (id) => { await api(`/admin/official-accounts/${id}`, { method: 'DELETE' }); reload(); };
  return (
    <div>
      <form className="admin-form" onSubmit={add}>
        <input placeholder="Nom officiel (ex. MINPOSTEL)" value={name} onChange={e => setName(e.target.value)} required />
        <input placeholder="Titre / institution" value={title} onChange={e => setTitle(e.target.value)} />
        <input placeholder="URL officielle" value={src} onChange={e => setSrc(e.target.value)} />
        <button className="btn btn-primary btn-md" type="submit">Ajouter</button>
      </form>
      {err && <div className="admin-error">{err}</div>}
      <table className="admin-table">
        <thead><tr><th>Nom</th><th>Titre</th><th>Source</th><th></th></tr></thead>
        <tbody>
          {(data?.accounts || []).map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td><td>{a.title}</td>
              <td style={{ wordBreak: 'break-all' }}>{a.source_url}</td>
              <td><button className="admin-del" onClick={() => remove(a.id)}>suppr.</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Reports({ api }) {
  const { data, err } = useLoad(() => api('/admin/reports'));
  if (err) return <div className="admin-error">{err}</div>;
  return (
    <table className="admin-table">
      <thead><tr><th>Date</th><th>URL signalée</th><th>IP</th></tr></thead>
      <tbody>
        {(data?.reports || []).map((r) => (
          <tr key={r.id}>
            <td>{(r.created_at || '').slice(0, 16).replace('T', ' ')}</td>
            <td style={{ wordBreak: 'break-all' }}>{r.content_url || '—'}</td>
            <td>{r.reporter_ip || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Dashboard({ api }) {
  const { data, err } = useLoad(() => api('/admin/dashboard'));
  if (err) return <div className="admin-error">{err}</div>;
  if (!data) return <p>Chargement…</p>;
  const lvl = { green: '#4ade80', orange: '#fbbf24', red: '#f87171' };
  const donut = (data.donut || []).map(d => ({ value: d.count, color: lvl[d.level] || '#94a3b8' }));
  const trend = (t) => t == null ? '' : (t >= 0 ? `▲ ${t}%` : `▼ ${Math.abs(t)}%`);
  const tcol = (t) => t == null ? '#94a3b8' : (t >= 0 ? '#4ade80' : '#f87171');
  const Card = ({ v, l, c, tr }) => (
    <div className="adm-kpi">
      <div className="adm-kpi-val" style={{ color: c }}>{v}</div>
      <div className="adm-kpi-lbl">{l}</div>
      {tr !== undefined && <div className="adm-kpi-trend" style={{ color: tcol(tr) }}>{trend(tr)}</div>}
    </div>
  );
  return (
    <div>
      <div className="adm-kpis">
        <Card v={data.v24} l="Vérifications (24 h)" c="#4ade80" tr={data.v24_trend} />
        <Card v={data.v7} l="Vérifications (7 j)" c="#60a5fa" tr={data.v7_trend} />
        <Card v={data.users} l="Utilisateurs uniques" c="#F2B705" />
        <Card v={data.alerts} l="Alertes rouges" c="#f87171" />
        <Card v={data.alert_rate + '%'} l="Taux d'alerte" c="#a78bfa" />
      </div>
      <div className="adm-grid2" style={{ marginTop: 22 }}>
        <div className="adm-panel">
          <h3 className="api-h3" style={{ marginTop: 0 }}>Activité (14 jours)</h3>
          <LineChart series={data.series || []} />
          <div className="adm-legend"><span><i style={{ background: '#22c55e' }} />Vérifications</span><span><i style={{ background: '#f87171' }} />Alertes</span></div>
        </div>
        <div className="adm-panel">
          <h3 className="api-h3" style={{ marginTop: 0 }}>Répartition des verdicts</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Donut segments={donut.length ? donut : [{ value: 1, color: 'rgba(255,255,255,.1)' }]} />
            <div>{(data.donut || []).map((d, i) => (
              <div className="adm-legend-row" key={i}><i style={{ background: lvl[d.level] || '#94a3b8' }} />{d.level} · {d.count}</div>
            ))}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Alerts({ api }) {
  const { data, err } = useLoad(() => api('/admin/alerts'));
  if (err) return <div className="admin-error">{err}</div>;
  if (!data) return <p>Chargement…</p>;
  const spikes = data.spikes || [];
  return (
    <div>
      <p className="api-note" style={{ marginBottom: 14 }}>
        Pics d'arnaques sur les dernières 24 h (≥ {data.threshold} alertes rouges par ville).
      </p>
      {spikes.length === 0
        ? <div className="adm-panel" style={{ textAlign: 'center', color: '#4ade80' }}>✅ Aucun pic d'alerte — situation calme.</div>
        : spikes.map((s, i) => (
          <div className="adm-alert" key={i}>
            <span className="adm-alert-dot" /><strong>{s.city}</strong>{s.country ? `, ${s.country}` : ''}
            <span className="adm-alert-count">{s.alerts_24h} alertes / 24 h</span>
          </div>
        ))}
    </div>
  );
}

function QuizCMS({ api }) {
  const { data, err, reload } = useLoad(() => api('/admin/quiz'));
  const [f, setF] = useState({ domain: '', question: '', o0: '', o1: '', o2: '', answer: 0, explain: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const add = async (e) => {
    e.preventDefault();
    const options = [f.o0, f.o1, f.o2].filter(x => x.trim());
    if (!f.question.trim() || options.length < 2) return;
    await api('/admin/quiz', { method: 'POST', body: JSON.stringify({ domain: f.domain, question: f.question, options, answer: Number(f.answer), explain: f.explain }) });
    setF({ domain: '', question: '', o0: '', o1: '', o2: '', answer: 0, explain: '' });
    reload();
  };
  const del = async (id) => { await api(`/admin/quiz/${id}`, { method: 'DELETE' }); reload(); };
  if (err) return <div className="admin-error">{err}</div>;
  return (
    <div>
      <form className="adm-panel" onSubmit={add} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <h3 className="api-h3" style={{ marginTop: 0 }}>Ajouter une question</h3>
        <input className="vf-input" placeholder="Domaine (ex. mobile_money, deepfake…)" value={f.domain} onChange={set('domain')} />
        <input className="vf-input" placeholder="Question" value={f.question} onChange={set('question')} required />
        <input className="vf-input" placeholder="Option 1" value={f.o0} onChange={set('o0')} />
        <input className="vf-input" placeholder="Option 2" value={f.o1} onChange={set('o1')} />
        <input className="vf-input" placeholder="Option 3 (optionnel)" value={f.o2} onChange={set('o2')} />
        <label className="vf-label">Index de la bonne réponse (0, 1 ou 2)
          <input className="vf-input" type="number" min="0" max="2" value={f.answer} onChange={set('answer')} />
        </label>
        <input className="vf-input" placeholder="Explication" value={f.explain} onChange={set('explain')} />
        <button className="btn btn-primary btn-md" type="submit">Ajouter la question</button>
      </form>
      <table className="admin-table">
        <thead><tr><th>Domaine</th><th>Question</th><th>Bonne réponse</th><th></th></tr></thead>
        <tbody>{(data?.questions || []).map(q => (
          <tr key={q.id}>
            <td>{q.domain || '—'}</td>
            <td style={{ maxWidth: 360 }}>{q.question}</td>
            <td>{(q.options || [])[q.answer]}</td>
            <td><button className="admin-del" onClick={() => del(q.id)}>suppr.</button></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Admins({ api }) {
  const { data, err, reload } = useLoad(() => api('/admin/admins'));
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('admin');
  const [created, setCreated] = useState(null);
  const add = async (e) => {
    e.preventDefault();
    const r = await api('/admin/admins', { method: 'POST', body: JSON.stringify({ username, role }) });
    setCreated(r.token); setUsername(''); reload();
  };
  const revoke = async (id) => { await api(`/admin/admins/${id}`, { method: 'DELETE' }); reload(); };
  if (err) return <div className="admin-error">{err}</div>;
  return (
    <div>
      <form className="adm-panel" onSubmit={add} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input className="vf-input" placeholder="Nom d'utilisateur" value={username} onChange={e => setUsername(e.target.value)} required style={{ flex: 1, minWidth: 160 }} />
        <select className="vf-input" value={role} onChange={e => setRole(e.target.value)}>
          <option value="admin">admin</option>
          <option value="viewer">viewer (lecture seule)</option>
        </select>
        <button className="btn btn-primary btn-md" type="submit">Créer un admin</button>
      </form>
      {created && <div className="admin-ok">Jeton créé (copiez-le, affiché une seule fois) : <code>{created}</code></div>}
      <table className="admin-table">
        <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Actif</th><th>Créé</th><th></th></tr></thead>
        <tbody>{(data?.admins || []).map(a => (
          <tr key={a.id}>
            <td>{a.username}</td><td>{a.role}</td><td>{a.active ? '✓' : '✕'}</td>
            <td>{(a.created_at || '').slice(0, 10)}</td>
            <td>{a.active && <button className="admin-del" onClick={() => revoke(a.id)}>révoquer</button>}</td>
          </tr>
        ))}</tbody>
      </table>
      <p className="api-note">Les admins se connectent avec leur jeton. Le super-admin reste l'<code>ADMIN_TOKEN</code> d'environnement.</p>
    </div>
  );
}
