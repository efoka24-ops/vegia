"""Banque de questions du quiz anti-arnaque (seed initial, multi-domaines)."""

QUIZ_SEED = [
    # Mobile Money
    ("mobile_money", "Un SMS « MTN : vous avez gagné 500 000 F, envoyez votre code PIN » arrive. Que faire ?",
     ["Envoyer mon code PIN", "Supprimer — c'est une arnaque", "Cliquer sur le lien"], 1,
     "Un opérateur ne demande jamais ton code PIN/OTP. Arnaque classique au Mobile Money."),
    ("mobile_money", "Un « agent » t'appelle pour « annuler un transfert reçu par erreur » et te demande ton OTP. Tu…",
     ["Donnes l'OTP pour aider", "Raccroches — c'est une fraude", "Rappelles le numéro"], 1,
     "L'OTP ne doit JAMAIS être communiqué. C'est une technique de vol de compte Mobile Money."),
    ("mobile_money", "Comment vérifier ton solde en sécurité ?",
     ["Via le lien reçu par SMS", "En composant moi-même le code USSD officiel", "En répondant au SMS"], 1,
     "Toujours composer soi-même le code USSD officiel, jamais via un lien reçu."),

    # Deepfake
    ("deepfake", "Une vidéo d'une personnalité fait une annonce choc. Réflexe ?",
     ["Partager vite", "Vérifier sur une source officielle", "Croire car ça semble réel"], 1,
     "Les deepfakes sont crédibles. Toujours croiser avec une source officielle avant de partager."),
    ("deepfake", "Quel indice peut trahir un deepfake vidéo ?",
     ["Clignements anormaux et lèvres désynchronisées", "Une bonne qualité d'image", "Un son clair"], 0,
     "Clignements rares, contours flous et lèvres mal synchronisées sont des signaux."),
    ("deepfake", "Tu reçois un audio d'un proche en détresse réclamant de l'argent. Que faire d'abord ?",
     ["Envoyer l'argent", "Rappeler la personne sur son vrai numéro", "Partager l'audio"], 1,
     "Le clonage vocal existe. Vérifie en rappelant directement la personne."),

    # Phishing / liens
    ("phishing", "Qu'est-ce qui rend un lien suspect ?",
     ["Il est court (bit.ly)", "Il contient des fautes dans le domaine", "Les deux"], 2,
     "Raccourcisseurs ET fautes de domaine sont deux signaux de phishing."),
    ("phishing", "Un site demande tes identifiants après un lien reçu par email. Tu vérifies…",
     ["La couleur du site", "L'URL exacte dans la barre d'adresse", "Le logo"], 1,
     "Les faux sites copient logo et design ; seule l'URL exacte fait foi."),
    ("phishing", "« Agissez maintenant ou votre compte sera bloqué » est…",
     ["Une info utile", "Une technique de manipulation par l'urgence", "Une promotion"], 1,
     "L'urgence est une technique classique pour te faire agir sans réfléchir."),

    # Faux comptes
    ("faux_compte", "Un « compte officiel » te demande de l'argent en message privé. C'est…",
     ["Normal", "Très suspect — probable usurpation", "Une promotion"], 1,
     "Les institutions ne réclament pas d'argent en DM. C'est typiquement une usurpation."),
    ("faux_compte", "Comment repérer un faux compte d'institution ?",
     ["Vérifier badge, ancienneté et URL officielle", "Regarder s'il a une photo", "Compter ses publications"], 0,
     "Badge, ancienneté du compte et correspondance avec l'URL officielle sont déterminants."),

    # Désinformation
    ("desinfo", "Quel mot dans un titre doit éveiller ta méfiance ?",
     ["« URGENT ! PARTAGEZ ! »", "« Communiqué de presse »", "« Rapport annuel »"], 0,
     "Le sensationnalisme et l'appel au partage immédiat sont des marqueurs de désinformation."),
    ("desinfo", "Avant de partager une info importante, tu…",
     ["La partages tout de suite", "La recoupes sur 2-3 sources fiables", "Regardes le nombre de likes"], 1,
     "Recouper l'information sur plusieurs sources fiables évite de propager du faux."),
    ("desinfo", "Une vieille photo ressort présentée comme récente. Quel réflexe ?",
     ["Vérifier la date et le contexte d'origine", "La partager", "Ignorer la date"], 0,
     "Des images anciennes sont souvent ressorties hors contexte pour tromper."),

    # Sécurité des comptes
    ("securite", "Un bon mot de passe est…",
     ["123456", "Le même partout", "Long, unique et avec l'authentification à deux facteurs"], 2,
     "Mot de passe long et unique + 2FA protègent efficacement tes comptes."),
    ("securite", "Tu reçois un code de connexion que tu n'as pas demandé. Cela peut signifier…",
     ["Rien", "Que quelqu'un tente d'accéder à ton compte", "Un bug normal"], 1,
     "Un OTP non sollicité = tentative d'intrusion. Ne le communique à personne."),
]
