import { useState } from 'react';

const API = 'https://vegia-production.up.railway.app/api/v1';

const CATEGORIES = ['Banque', 'Opérateur télécom', 'Administration / Ministère', 'Média', 'Entreprise', 'ONG', 'Autre'];

export default function VerifiedForm() {
  const [form, setForm] = useState({ name: '', category: '', official_url: '', contact: '' });
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setState('sending');
    try {
      const res = await fetch(`${API}/verified/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setState(res.ok ? 'done' : 'error');
    } catch { setState('error'); }
  };

  return (
    <main className="api-doc">
      <div className="api-hero">
        <div className="eyebrow">Pour les institutions</div>
        <h1 style={{ fontSize: 'clamp(28px,5vw,46px)' }}>VigIA Verified <span style={{ color: '#F2B705' }}>✓</span></h1>
        <p className="hero-sub" style={{ margin: '14px auto 0' }}>
          Banques, opérateurs, administrations, médias : faites vérifier votre identité officielle.
          Vos comptes obtiennent le badge <strong>« VigIA Verified »</strong>, et VigIA signale toute
          usurpation à des millions d'utilisateurs.
        </p>
      </div>

      <section className="section" style={{ paddingTop: 8, maxWidth: 620 }}>
        {state === 'done' ? (
          <div className="install-wrap" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: '10px 0' }}>Demande envoyée !</h3>
            <p style={{ color: '#7ab89a' }}>
              Notre équipe va examiner votre demande de vérification. Vous serez recontacté(e).
            </p>
            <p style={{ marginTop: 20 }}><a className="btn btn-ghost btn-md" href="#">← Retour à l'accueil</a></p>
          </div>
        ) : (
          <form className="install-wrap" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="vf-label">Nom de l'institution *
              <input className="vf-input" value={form.name} onChange={set('name')} required placeholder="Ex. MINSANTE, MTN Cameroon…" />
            </label>
            <label className="vf-label">Catégorie
              <select className="vf-input" value={form.category} onChange={set('category')}>
                <option value="">— Sélectionner —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="vf-label">Site web officiel
              <input className="vf-input" value={form.official_url} onChange={set('official_url')} placeholder="https://…" />
            </label>
            <label className="vf-label">Email / téléphone de contact
              <input className="vf-input" value={form.contact} onChange={set('contact')} placeholder="contact@institution.cm" />
            </label>
            <button className="btn btn-primary btn-lg" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Envoi…' : 'Demander la vérification'}
            </button>
            {state === 'error' && <p style={{ color: '#f87171', fontSize: 13 }}>Erreur d'envoi. Réessayez plus tard.</p>}
            <p style={{ fontSize: 12, color: '#4a7c5f', textAlign: 'center' }}>
              Service en bêta · la vérification est manuelle pour garantir l'authenticité.
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
