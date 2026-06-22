import Shield from './components/Shield.jsx';
import Faq from './components/Faq.jsx';

const MODULES = [
  {
    icon: '🎬',
    iconBg: 'rgba(10,92,66,0.18)',
    title: 'Vérif-Média',
    desc: 'Détecte les vidéos et images manipulées par IA (deepfakes). Score de probabilité de falsification affiché en temps réel.',
    tag: 'Deepfake · GAN · Face-swap',
    tagClass: 'mtag-red',
  },
  {
    icon: '📰',
    iconBg: 'rgba(242,183,5,0.12)',
    title: 'Vérif-Info',
    desc: 'Fact-checking automatique des textes. Détecte les termes sensationnalistes et croise avec les bases de désinformation connues.',
    tag: 'Désinformation · Rumeurs',
    tagClass: 'mtag-orange',
  },
  {
    icon: '🔗',
    iconBg: 'rgba(200,16,46,0.12)',
    title: 'Vérif-Lien',
    desc: 'Analyse chaque URL avant que vous cliquiez. Détecte le phishing, les scams Mobile Money et les liens malveillants raccourcis.',
    tag: 'Phishing · Mobile Money · Scam',
    tagClass: 'mtag-red',
  },
  {
    icon: '👤',
    iconBg: 'rgba(10,92,66,0.12)',
    title: 'Vérif-Compte',
    desc: 'Vérifie si un compte se faisant passer pour une institution officielle camerounaise est réellement authentique.',
    tag: 'Usurpation · Faux comptes officiels',
    tagClass: 'mtag-green',
  },
];

const STEPS = [
  { n: '01', icon: '👁', title: 'Détection auto', desc: 'VigIA repère chaque vidéo, lien, texte et profil suspect dans votre fil.' },
  { n: '02', icon: '🔍', title: 'Bouton "Vérifier"', desc: 'Un bouton contextuel apparaît sous chaque élément. Vous choisissez quand analyser.' },
  { n: '03', icon: '⚡', title: 'Analyse IA', desc: 'Les 4 modules analysent le contenu en 1–2 secondes via notre moteur de détection.' },
  { n: '04', icon: '✅', title: 'Résultat clair', desc: "Un verdict coloré (vert / orange / rouge) s'affiche directement sous le contenu." },
];

export default function App() {
  return (
    <>
      {/* NAV */}
      <nav>
        <a className="nav-logo" href="#">
          <Shield size={26} />
          <span className="logo-text">Vig<span>IA</span></span>
        </a>
        <div className="nav-links">
          <a href="#demo">Démo</a>
          <a href="#modules">Modules</a>
          <a href="#installer">Installer</a>
          <a href="#faq">FAQ</a>
          <a href="#installer" className="nav-cta">Télécharger →</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-badge"><span className="pulse-dot" />Prototype bêta · Cameroun</div>
        <h1>Protégez-vous des <em>deepfakes</em><br />et arnaques en ligne</h1>
        <p className="hero-sub">VigIA analyse vidéos, liens, textes et comptes directement dans votre fil d'actualité — en temps réel, sans quitter la page.</p>
        <div className="hero-actions">
          <a href="#demo" className="btn btn-primary btn-lg">
            <Shield size={17} fill="#fff" stroke="#0A5C42" />
            Voir la démo interactive
          </a>
          <a href="#installer" className="btn btn-ghost btn-lg">↓ Télécharger l'extension</a>
        </div>
        <div className="platforms">
          <span className="chip">🔵 Facebook</span>
          <span className="chip">🔷 LinkedIn</span>
          <span className="chip">🐦 X / Twitter</span>
          <span className="chip">💬 WhatsApp Web</span>
        </div>
      </section>

      {/* STATS */}
      <div style={{ padding: '0 24px', maxWidth: 860, margin: '0 auto 80px' }}>
        <div className="stats-strip">
          <div className="stat-cell"><div className="stat-val" style={{ color: '#4ade80' }}>4</div><div className="stat-lbl">Modules IA</div></div>
          <div className="stat-cell"><div className="stat-val" style={{ color: '#F2B705' }}>4</div><div className="stat-lbl">Plateformes</div></div>
          <div className="stat-cell"><div className="stat-val" style={{ color: '#f87171' }}>0</div><div className="stat-lbl">Données envoyées</div></div>
        </div>
      </div>

      {/* DÉMO */}
      <section id="demo" className="section" style={{ paddingTop: 0 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="eyebrow">Démo interactive complète</div>
          <div className="section-title" style={{ marginBottom: 8 }}>Testez VigIA maintenant</div>
          <p style={{ color: '#7ab89a', fontSize: 15, maxWidth: 520, margin: '0 auto' }}>
            Cliquez sur le bouton VigIA vert dans la barre du navigateur simulé, puis utilisez les boutons "Vérifier" sur chaque post.
          </p>
        </div>
        <div className="proto-wrap">
          <iframe src="/prototype/" title="VigIA — Prototype interactif" loading="lazy" />
          <div className="proto-overlay-label">↑ Prototype interactif complet — Facebook &amp; LinkedIn</div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="section">
        <div className="eyebrow">Ce que VigIA détecte</div>
        <div className="section-title">4 modules de protection<br /><span>intégrés dans votre navigateur</span></div>
        <div className="modules-grid">
          {MODULES.map((m) => (
            <div className="module-card" key={m.title}>
              <div className="mod-icon" style={{ background: m.iconBg }}>{m.icon}</div>
              <h3>{m.title}</h3>
              <p>{m.desc}</p>
              <span className={`mtag ${m.tagClass}`}>{m.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="eyebrow">Fonctionnement</div>
        <div className="section-title">Simple à utiliser,<br /><span>puissant sous le capot</span></div>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.n}>
              <div className="step-n">{s.n}</div>
              <span className="step-icon">{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INSTALL */}
      <section id="installer" style={{ padding: '0 24px 80px' }}>
        <div className="install-wrap">
          <div className="install-grid">
            <div>
              <div className="eyebrow">Installation</div>
              <div className="section-title" style={{ fontSize: 'clamp(24px,3vw,36px)', marginBottom: 6 }}>Prêt en<br />3 étapes</div>
              <p style={{ color: '#7ab89a', fontSize: 13, marginBottom: 0 }}>Chrome ou Edge · Gratuit · Aucun compte requis</p>
              <div className="install-steps">
                <div className="istep">
                  <div className="istep-num">1</div>
                  <div>
                    <h4>Télécharger le ZIP</h4>
                    <p>Cliquez sur le bouton ci-contre et décompressez <code>vigia-extension.zip</code> dans un dossier.</p>
                  </div>
                </div>
                <div className="istep">
                  <div className="istep-num">2</div>
                  <div>
                    <h4>Ouvrir les extensions Chrome</h4>
                    <p>Allez sur <code>chrome://extensions</code> → activez <strong>Mode développeur</strong> en haut à droite.</p>
                  </div>
                </div>
                <div className="istep">
                  <div className="istep-num">3</div>
                  <div>
                    <h4>Charger l'extension</h4>
                    <p>Cliquez <strong>"Charger l'extension non empaquetée"</strong> → sélectionnez le dossier <code>extension/</code> extrait du ZIP.</p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: 19, fontWeight: 800, marginBottom: 6 }}>Télécharger VigIA</h3>
              <p style={{ color: '#7ab89a', fontSize: 13, marginBottom: 20 }}>Extension Chrome / Edge · v0.1.0 bêta</p>
              <div className="sys-reqs">
                <div className="req"><span className="req-ok">✓</span> Chrome 88+ ou Edge 88+</div>
                <div className="req"><span className="req-ok">✓</span> Windows, macOS, Linux</div>
                <div className="req"><span className="req-ok">✓</span> Facebook, LinkedIn, X, WhatsApp</div>
                <div className="req"><span className="req-warn">~</span> Moteur IA simulé en bêta</div>
              </div>
              <a href="/vigia-extension.zip" className="dl-btn" download="vigia-extension.zip">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Télécharger vigia-extension.zip
              </a>
              <p className="dl-note">⚠ Version bêta — résultats d'analyse simulés</p>
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.07)' }}>
                <p style={{ fontSize: 12, color: '#4a7c5f', lineHeight: 1.7 }}>
                  Données traitées <strong style={{ color: '#7ab89a' }}>localement</strong> — aucune donnée personnelle envoyée à nos serveurs en version bêta.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <Faq />

      {/* CTA FINAL */}
      <section className="cta-final">
        <h2>Prêt à vous protéger ?</h2>
        <p>Testez la démo ou installez l'extension maintenant — c'est gratuit.</p>
        <div className="hero-actions">
          <a href="#demo" className="btn btn-primary btn-lg">
            <Shield size={17} fill="#fff" stroke="#0A5C42" />
            Voir la démo
          </a>
          <a href="#installer" className="btn btn-ghost btn-lg">↓ Télécharger l'extension</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <Shield size={20} />
          <span style={{ color: '#4a7c5f', fontWeight: 700 }}>VigIA</span>
        </a>
        <span>VigIA v0.1.0 · Cameroun · Données locales uniquement</span>
        <a href="mailto:efoka24@gmail.com">Contact</a>
      </footer>
    </>
  );
}
