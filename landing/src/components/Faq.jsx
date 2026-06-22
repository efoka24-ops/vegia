import { useState } from 'react';

const ITEMS = [
  {
    q: 'Est-ce que VigIA lit mes messages privés ?',
    a: "Non. VigIA ne lit que les éléments visibles dans votre fil public (images, textes, liens). Il n'accède pas à vos messages privés, mots de passe ou données de compte. Tout est traité localement dans votre navigateur.",
  },
  {
    q: 'Les résultats sont-ils fiables à 100% ?',
    a: 'Non. En version bêta, le moteur IA est simulé. Les vrais modèles de détection deepfake (EfficientNet fine-tuné sur FaceForensics++) et de fact-checking seront intégrés en v1.0. Traitez les résultats actuels comme indicatifs.',
  },
  {
    q: 'VigIA fonctionne-t-il sur mobile ?',
    a: "Non, pour l'instant VigIA est une extension Chrome/Edge pour ordinateur. Une version mobile est prévue une fois le moteur IA validé. La démo interactive ci-dessus fonctionne sur mobile.",
  },
  {
    q: 'Comment signaler une fausse alerte ?',
    a: 'Cliquez sur le bouton "Signaler" qui apparaît sous chaque résultat d\'analyse dans l\'extension ou le prototype. Votre signalement aide à améliorer le modèle.',
  },
  {
    q: 'Pourquoi "Mode développeur" dans Chrome ?',
    a: "En version bêta, VigIA n'est pas encore publié sur le Chrome Web Store. Le mode développeur permet de charger des extensions non vérifiées. Une soumission au Chrome Web Store est prévue après validation du prototype.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(null);

  return (
    <section id="faq" style={{ padding: '0 24px' }}>
      <div className="faq-wrap" style={{ margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="eyebrow">FAQ</div>
          <div className="section-title">Questions fréquentes</div>
        </div>
        {ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div className={`faq-item${isOpen ? ' open' : ''}`} key={i}>
              <button className="faq-q" onClick={() => setOpen(isOpen ? null : i)}>
                {item.q}
                <span className="faq-icon" style={{ transform: isOpen ? 'rotate(45deg)' : 'none' }}>+</span>
              </button>
              {isOpen && <div className="faq-a">{item.a}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
