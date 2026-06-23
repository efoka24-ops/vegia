const API_BASE = 'https://vegia-production.up.railway.app';

function Code({ children }) {
  return <pre className="api-code"><code>{children}</code></pre>;
}

export default function ApiDocs() {
  return (
    <main className="api-doc">
      <div className="api-hero">
        <div className="eyebrow">Développeurs</div>
        <h1 style={{ fontSize: 'clamp(30px,5vw,52px)' }}>API VigIA</h1>
        <p className="hero-sub" style={{ margin: '16px auto 24px' }}>
          Intégrez la vérification de contenus (deepfakes, désinformation, liens, comptes)
          dans votre propre application via une API REST simple.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary btn-md" href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">
            Documentation interactive (Swagger) →
          </a>
          <a className="btn btn-ghost btn-md" href={`${API_BASE}/openapi.json`} target="_blank" rel="noreferrer">
            Schéma OpenAPI
          </a>
        </div>
      </div>

      <section className="section api-section">
        <h2 className="api-h2">Base URL</h2>
        <Code>{`${API_BASE}/api/v1`}</Code>

        <h2 className="api-h2">Authentification</h2>
        <p>Chaque requête à <code>/verify</code> et <code>/me</code> requiert un en-tête Bearer :</p>
        <Code>{`Authorization: Bearer <votre_clé>`}</Code>
        <ul className="api-list">
          <li><strong>public</strong> — jeton ouvert utilisé par l'extension grand public (quota par IP).</li>
          <li><strong>vig_…</strong> — clé partenaire avec quota mensuel (voir « Obtenir une clé »).</li>
        </ul>

        <h2 className="api-h2">Endpoints</h2>
        <div className="api-table-wrap">
          <table className="api-table">
            <thead>
              <tr><th>Méthode</th><th>Chemin</th><th>Auth</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td>GET</td><td>/health</td><td>—</td><td>État du service</td></tr>
              <tr><td>POST</td><td>/verify</td><td>Bearer</td><td>Analyse un contenu (image, texte, url, account)</td></tr>
              <tr><td>GET</td><td>/blacklist</td><td>—</td><td>Liste noire des URL signalées</td></tr>
              <tr><td>POST</td><td>/report</td><td>—</td><td>Signaler un contenu</td></tr>
              <tr><td>POST</td><td>/send-report</td><td>—</td><td>Envoyer un rapport d'analyse par email</td></tr>
              <tr><td>GET</td><td>/me</td><td>Bearer</td><td>Palier et consommation (30 j) de la clé</td></tr>
            </tbody>
          </table>
        </div>

        <h2 className="api-h2">POST /verify</h2>
        <p>Requête :</p>
        <Code>{`{
  "type": "url",
  "content": { "url": "https://mtn-momo-verify.xyz/login" },
  "source": "facebook"
}`}</Code>
        <p><code>type</code> ∈ <code>image | text | url | account</code>. Champs de <code>content</code> selon le type :
        <code>image_url</code>, <code>text</code>, <code>url</code>, <code>profile_image_url</code> + <code>profile_name</code>.</p>
        <p>Réponse :</p>
        <Code>{`{
  "request_id": "…",
  "score": 0.92,
  "level": "red",
  "modules": { "link": { "score": 0.92, "label": "lien probablement malveillant" } },
  "explanation": "Ce contenu est probablement manipulé ou trompeur. …",
  "sources": ["Google Safe Browsing"]
}`}</Code>
        <p><code>level</code> : <span style={{ color: '#4ade80' }}>green</span> (&lt; 0,35) ·
          <span style={{ color: '#fbbf24' }}> orange</span> (&lt; 0,70) ·
          <span style={{ color: '#f87171' }}> red</span> (≥ 0,70).</p>

        <h2 className="api-h2">Exemples</h2>
        <h3 className="api-h3">cURL</h3>
        <Code>{`curl -X POST ${API_BASE}/api/v1/verify \\
  -H "Authorization: Bearer vig_VOTRE_CLE" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"text","content":{"text":"Investissez 10000 et doublez en 24h, garanti !"}}'`}</Code>

        <h3 className="api-h3">JavaScript</h3>
        <Code>{`const res = await fetch("${API_BASE}/api/v1/verify", {
  method: "POST",
  headers: {
    "Authorization": "Bearer vig_VOTRE_CLE",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ type: "url", content: { url: "https://exemple.com" } }),
});
const data = await res.json();
console.log(data.level, data.explanation);`}</Code>

        <h3 className="api-h3">Python</h3>
        <Code>{`import httpx

r = httpx.post(
    "${API_BASE}/api/v1/verify",
    headers={"Authorization": "Bearer vig_VOTRE_CLE"},
    json={"type": "image", "content": {"image_url": "https://exemple.com/photo.jpg"}},
)
print(r.json()["score"], r.json()["level"])`}</Code>

        <h2 className="api-h2">Obtenir une clé partenaire</h2>
        <p>Écrivez-nous à <a href="mailto:infos@trugroup.com">infos@trugroup.com</a> avec le nom
          de votre projet et votre cas d'usage. Nous vous fournissons une clé <code>vig_…</code> avec
          un quota adapté.</p>

        <p className="api-note">⚠️ Version bêta. Les modules utilisent des services tiers
          (Google Safe Browsing, Sightengine, Claude) avec repli heuristique ; les résultats sont
          indicatifs. Traitez-les comme une aide à la décision, non comme une vérité absolue.</p>

        <p style={{ marginTop: 28 }}>
          <a className="btn btn-ghost btn-md" href="#">← Retour à l'accueil</a>
        </p>
      </section>
    </main>
  );
}
