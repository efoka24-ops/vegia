import { useState, useEffect } from 'react';

const API = 'https://vegia-production.up.railway.app/api/v1';

const LESSONS = [
  {
    icon: '🎬', title: 'Repérer un deepfake',
    points: [
      'Clignements d\'yeux rares ou anormaux, contours du visage flous.',
      'Lèvres mal synchronisées avec la voix, éclairage incohérent.',
      'En cas de doute, cherche la vidéo originale sur une source officielle.',
    ],
  },
  {
    icon: '📱', title: 'Arnaques Mobile Money',
    points: [
      'MTN/Orange ne te demanderont JAMAIS ton code PIN ou ton OTP par message.',
      'Méfie-toi de « vous avez gagné », « confirmez votre compte », « erreur de transfert ».',
      'Ne clique pas sur les liens reçus ; compose toi-même le code USSD officiel.',
    ],
  },
  {
    icon: '👤', title: 'Faux comptes officiels',
    points: [
      'Vérifie le badge, l\'ancienneté du compte et le nombre d\'abonnés.',
      'Une institution sérieuse ne te contacte pas en privé pour de l\'argent.',
      'Compare l\'URL exacte avec le site officiel (fautes, caractères en trop).',
    ],
  },
  {
    icon: '📰', title: 'Désinformation',
    points: [
      'Titres sensationnalistes (URGENT, CHOC, EXCLUSIF) = signal d\'alerte.',
      'Cherche la même info sur 2-3 sources fiables avant de partager.',
      'Vérifie la date : de vieilles images sont souvent ressorties hors contexte.',
    ],
  },
  {
    icon: '🔗', title: 'Liens piégés',
    points: [
      'Les liens raccourcis (bit.ly…) cachent la vraie destination.',
      'Fautes dans le nom de domaine, extensions douteuses (.xyz, .tk).',
      'L\'urgence (« agissez maintenant ») est une technique de manipulation.',
    ],
  },
];

const QUIZ = [
  {
    q: 'Tu reçois un SMS : « MTN : vous avez gagné 500 000 F, envoyez votre code PIN pour recevoir ». Que fais-tu ?',
    options: ['J\'envoie mon code PIN', 'Je supprime — c\'est une arnaque', 'Je clique sur le lien'],
    answer: 1,
    explain: 'Un opérateur ne demande jamais ton code PIN/OTP. C\'est une arnaque classique au Mobile Money.',
  },
  {
    q: 'Une vidéo d\'une personnalité fait une annonce choc. Quel réflexe ?',
    options: ['Je partage vite', 'Je vérifie sur une source officielle', 'Je crois car la vidéo semble réelle'],
    answer: 1,
    explain: 'Les deepfakes sont crédibles. Toujours croiser avec une source officielle avant de partager.',
  },
  {
    q: 'Quel élément rend un lien suspect ?',
    options: ['Il est court (bit.ly)', 'Il contient des fautes dans le domaine', 'Les deux'],
    answer: 2,
    explain: 'Raccourcisseurs ET fautes de domaine sont deux signaux de phishing.',
  },
  {
    q: 'Un « compte officiel » te demande de l\'argent en message privé. C\'est…',
    options: ['Normal', 'Très suspect — probable usurpation', 'Une promotion'],
    answer: 1,
    explain: 'Les institutions ne réclament pas d\'argent en DM. C\'est typiquement une usurpation.',
  },
  {
    q: 'Quel mot dans un titre doit éveiller ta méfiance ?',
    options: ['« URGENT ! PARTAGEZ ! »', '« Communiqué de presse »', '« Rapport annuel »'],
    answer: 0,
    explain: 'Le sensationnalisme et l\'appel au partage immédiat sont des marqueurs de désinformation.',
  },
];

function Quiz() {
  const [questions, setQuestions] = useState(null);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`${API}/public/quiz?n=8`)
      .then(r => r.json())
      .then(d => {
        const qs = (d.questions || []).map(x => ({ q: x.question, options: x.options, answer: x.answer, explain: x.explain }));
        setQuestions(qs.length ? qs : QUIZ);
      })
      .catch(() => setQuestions(QUIZ)); // repli sur la banque locale
  }, []);

  if (!questions) return <div className="edu-quiz"><p style={{ color: '#7ab89a' }}>Chargement du quiz…</p></div>;

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="edu-quiz">
        <h3 className="edu-quiz-title">Résultat : {score}/{questions.length} ({pct}%)</h3>
        <p style={{ color: '#7ab89a', marginBottom: 16 }}>
          {pct >= 80 ? '🏆 Excellent ! Tu sais repérer les arnaques.'
            : pct >= 50 ? '👍 Pas mal — reste vigilant et révise les pièges.'
            : '⚠️ À renforcer : relis les leçons ci-dessus.'}
        </p>
        <button className="btn btn-primary btn-md" onClick={() => { setI(0); setScore(0); setPicked(null); setDone(false); }}>
          Recommencer
        </button>
      </div>
    );
  }

  const cur = questions[i];
  const choose = (idx) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === cur.answer) setScore(s => s + 1);
  };
  const next = () => {
    if (i + 1 >= questions.length) setDone(true);
    else { setI(i + 1); setPicked(null); }
  };

  return (
    <div className="edu-quiz">
      <div className="edu-quiz-prog">Question {i + 1} / {questions.length}</div>
      <h3 className="edu-quiz-title">{cur.q}</h3>
      <div className="edu-options">
        {cur.options.map((o, idx) => {
          let cls = 'edu-opt';
          if (picked !== null) {
            if (idx === cur.answer) cls += ' edu-opt--good';
            else if (idx === picked) cls += ' edu-opt--bad';
          }
          return <button key={idx} className={cls} onClick={() => choose(idx)}>{o}</button>;
        })}
      </div>
      {picked !== null && (
        <>
          <p className="edu-explain">{picked === cur.answer ? '✅ Correct. ' : '❌ '}{cur.explain}</p>
          <button className="btn btn-primary btn-md" onClick={next}>
            {i + 1 >= questions.length ? 'Voir mon score' : 'Question suivante →'}
          </button>
        </>
      )}
    </div>
  );
}

export default function Education() {
  return (
    <main className="api-doc">
      <div className="api-hero">
        <div className="eyebrow">Apprendre · Patriotisme numérique</div>
        <h1 style={{ fontSize: 'clamp(28px,5vw,46px)' }}>Déjouer les arnaques en ligne</h1>
        <p className="hero-sub" style={{ margin: '14px auto 0' }}>
          Des réflexes simples pour te protéger, toi et tes proches, des deepfakes,
          de la désinformation et des arnaques Mobile Money.
        </p>
      </div>

      <section className="section" style={{ paddingTop: 8 }}>
        <div className="modules-grid">
          {LESSONS.map((l) => (
            <div className="module-card" key={l.title}>
              <div className="mod-icon" style={{ background: 'rgba(10,92,66,0.18)' }}>{l.icon}</div>
              <h3>{l.title}</h3>
              <ul style={{ margin: '8px 0 0 16px' }}>
                {l.points.map((p, i) => <li key={i} style={{ fontSize: 13, color: '#7ab89a', marginBottom: 6, lineHeight: 1.5 }}>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', margin: '48px 0 24px' }}>
          <div className="eyebrow">Teste tes réflexes</div>
          <div className="section-title" style={{ marginBottom: 0 }}>Quiz anti-arnaque</div>
        </div>
        <Quiz />

        <p style={{ marginTop: 28 }}><a className="btn btn-ghost btn-md" href="#">← Retour à l'accueil</a></p>
      </section>
    </main>
  );
}
