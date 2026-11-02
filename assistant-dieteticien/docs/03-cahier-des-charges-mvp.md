# 03 - Cahier des charges du MVP

> Version 1, novembre 2026. Document de travail, à relire avec 2 ou 3 diététiciens avant de coder.

## 1. Objectif du MVP

Démontrer, avec **5 diététiciens pilotes**, qu'un outil peut :

1. enregistrer une consultation (en cabinet ou en visio), avec l'accord du patient ;
2. produire en moins de 2 minutes une **fiche de renseignements pré-remplie** et un **résumé** fiables ;
3. faire gagner du temps : moins de 5 minutes de relecture au lieu de la prise de notes.

Le MVP sert à valider l'usage et la volonté de payer. Ce n'est pas encore un produit commercial
complet : pas de paiement en ligne, et les pilotes sont gratuits.

## 2. Utilisateurs

| Rôle | Description | Accès |
|---|---|---|
| Praticien | Diététicien libéral, utilisateur principal | Ses patients, ses consultations, ses fiches |
| Patient | Ne se connecte pas au MVP | Informé et consentant, il peut demander l'accès ou la suppression via le praticien |
| Administrateur | Vous | Gestion des comptes, support, **sans accès au contenu médical** |

## 3. Parcours principal

1. Le praticien se connecte (e-mail + mot de passe + code à usage unique).
2. Il crée ou choisit un patient.
3. Il démarre une consultation : type (1er RDV / suivi), lieu (cabinet / visio).
4. Il **confirme le consentement oral du patient** (case obligatoire, horodatée).
5. Il lance l'enregistrement. Pendant la séance (option) : la checklist des rubriques non abordées se met à jour.
6. Il arrête l'enregistrement. Après moins de 2 min, la fiche pré-remplie et le résumé sont prêts.
7. Il relit : chaque champ affiche son statut et, au clic, l'extrait de conversation dont il vient. Il corrige si besoin.
8. Il **valide**. La fiche est verrouillée et horodatée, et l'audio est définitivement supprimé.
9. Il exporte en PDF ou en Word, ou retrouve la fiche dans le dossier du patient.

## 4. Fonctionnalités

Priorités : **M** = indispensable au MVP, **S** = souhaitable si le temps le permet,
**V2** = après le MVP.

### 4.1 Comptes et sécurité

| ID | Fonction | Priorité |
|---|---|---|
| C1 | Inscription sur invitation (pilotes uniquement) | M |
| C2 | Connexion e-mail + mot de passe + **double authentification** (code e-mail ou application TOTP) | M |
| C3 | Déconnexion automatique après 30 min d'inactivité | M |
| C4 | Réinitialisation du mot de passe | M |
| C5 | Suppression du compte et export complet des données | S |

### 4.2 Patients

| ID | Fonction | Priorité |
|---|---|---|
| P1 | Créer / modifier / rechercher un patient (nom, prénom, date de naissance, téléphone, e-mail) | M |
| P2 | Voir l'historique des consultations d'un patient | M |
| P3 | Supprimer un patient et toutes ses données (droit à l'effacement) | M |

### 4.3 Modèles de fiche

| ID | Fonction | Priorité |
|---|---|---|
| F1 | **Fiche diététique par défaut**, reprise de la fiche fournie (`fiche-renseignement-modele.docx`) | M |
| F2 | Éditeur simple : ajouter, renommer, supprimer ou réordonner des rubriques et des champs | S |
| F3 | Import d'une fiche Word du praticien, convertie automatiquement par l'IA en modèle modifiable | V2 |
| F4 | Fiche de suivi (consultations suivantes) distincte du 1er RDV | S |

Types de champs à gérer : texte court, texte long, nombre avec unité (kg, cm), date,
choix unique, choix multiple (cases à cocher), oui/non, champ calculé (IMC = poids / taille²).

### 4.4 Enregistrement

| ID | Fonction | Priorité |
|---|---|---|
| E1 | Case de consentement obligatoire avant le démarrage (horodatage enregistré) | M |
| E2 | Enregistrement **en cabinet** avec le micro du téléphone, de la tablette ou de l'ordinateur, depuis le navigateur | M |
| E3 | Enregistrement **en visio** : micro du praticien + son de l'onglet de visio (Chrome/Edge sur ordinateur). Solution de repli : micro de l'ordinateur sans casque | M |
| E4 | Pause / reprise, chronomètre, voyant d'enregistrement bien visible | M |
| E5 | Envoi de l'audio par morceaux de 30 s : une coupure réseau ou un onglet fermé ne fait pas perdre la séance (morceaux gardés en local, chiffrés, puis renvoyés) | M |
| E6 | Durée maximale : 2 h par consultation | M |

### 4.5 Transcription et IA

| ID | Fonction | Priorité |
|---|---|---|
| T1 | Transcription en français par morceaux, au fil de la séance | M |
| T2 | Distinction praticien / patient dans la transcription (par le service de transcription si disponible, sinon par l'IA) | S |
| T3 | **Checklist en direct** : rubriques de la fiche pas encore abordées, mises à jour toutes les 1 à 2 min | S |
| T4 | **Pré-remplissage de la fiche** à la fin de la séance, en données structurées (JSON validé par rapport au modèle) | M |
| T5 | Pour chaque champ : valeur, **statut** (rempli / à vérifier / non abordé) et **extrait source** de la transcription | M |
| T6 | **Rappel alimentaire des 24 h** reconstitué dans la rubrique ALIMENTATION (repas, horaires, grignotages, boissons) | M |
| T7 | **Résumé général** de la consultation (10 à 15 lignes), plus les points à réévaluer | M |
| T8 | Courrier au médecin traitant, récapitulatif des objectifs pour le patient | V2 |
| T9 | Mode suivi : comparaison avec la consultation précédente | V2 |

Règles imposées à l'IA :

- **Ne jamais inventer.** Une information non dite donne « non abordé ». Une information ambiguë donne « à vérifier ».
- Champs critiques (allergies, traitements, antécédents, TCA) : en cas de doute, **toujours** « à vérifier ».
- Ton neutre et bienveillant, sans jugement sur le poids ni sur le corps.
- Aucun diagnostic, aucune recommandation médicale ou diététique : l'outil documente, il ne conseille pas.
- Ne pas reprendre dans la fiche les propos sans rapport avec la consultation.

### 4.6 Relecture, validation, export

| ID | Fonction | Priorité |
|---|---|---|
| R1 | Écran de relecture : fiche à gauche, transcription à droite. Un clic sur un champ surligne son extrait source | M |
| R2 | Modification libre de chaque champ ; les champs « à vérifier » sont mis en évidence | M |
| R3 | Validation : fiche verrouillée, horodatée, audio supprimé | M |
| R4 | Export **PDF** et **Word (.docx)** fidèles à la mise en page de la fiche | M |
| R5 | Réglage : conserver ou supprimer la transcription texte après validation (supprimée par défaut) | S |
| R6 | Bouton « signaler une erreur de l'IA » (sert à améliorer l'outil) | M |

### 4.7 Administration et mesure

| ID | Fonction | Priorité |
|---|---|---|
| A1 | Inviter / désactiver un praticien | M |
| A2 | Statistiques anonymes : nombre de consultations, durée, temps de relecture, taux de champs corrigés | M |
| A3 | Suivi du coût IA par consultation | M |
| A4 | Paiement en ligne et abonnements (Stripe) | V2 |

## 5. Hors périmètre du MVP

Paiement, applications iOS/Android natives (le MVP est une application web installable),
prise de rendez-vous, facturation des patients, connexion à Doctolib ou à d'autres logiciels,
autres métiers que la diététique, autres langues que le français.

## 6. Exigences non fonctionnelles

### Sécurité et conformité (bloquant avant tout vrai patient)

- **Hébergement certifié HDS** pour l'application, la base de données, les fichiers **et** les services d'IA
  qui reçoivent l'audio ou le texte. Tant que ce n'est pas le cas, seules des consultations simulées sont autorisées.
- Chiffrement en transit (HTTPS/TLS) et au repos (base de données et fichiers).
- Double authentification obligatoire, mots de passe hachés, sessions courtes.
- Journal des accès aux données (qui a consulté ou modifié quoi, et quand), conservé 1 an.
- Sauvegardes chiffrées quotidiennes, conservées 30 jours, avec un test de restauration avant le pilote.
- Audio supprimé à la validation, et au plus tard 7 jours après la consultation si elle n'est jamais validée.
- Rôles RGPD : le **praticien est responsable du traitement**, vous êtes **sous-traitant**. Documents à produire :
  contrat de sous-traitance (DPA), registre des traitements, analyse d'impact (AIPD, outil PIA de la CNIL),
  politique de confidentialité, modèle de **note d'information patient** (affiche ou texte à lire).
- Engagement contractuel des fournisseurs d'IA : pas d'utilisation des données pour l'entraînement, et données stockées en UE.

### Performance

- Fiche et résumé disponibles **moins de 2 min** après l'arrêt d'un enregistrement de 60 min.
- Checklist en direct : moins de 1 min de décalage.
- Coût variable visé : **≤ 0,25 € par consultation** (voir `02-tarifs-et-couts.md`).

### Compatibilité et ergonomie

- Navigateurs récents : Chrome, Edge, Safari, Firefox, sur ordinateur, tablette et téléphone.
  La capture audio d'un onglet de visio fonctionne seulement sur Chrome et Edge, sur ordinateur.
- Interface en français, utilisable sur un écran de téléphone, sans formation (moins de 10 min de prise en main).
- Disponibilité visée pendant le pilote : 99 % aux heures de consultation (8 h - 20 h).

## 7. Qualité de l'IA : protocole de test

Avant le pilote :

1. Écrire et **jouer 15 consultations simulées** avec un diététicien : cas variés (perte de poids, sportif,
   TCA dans l'entourage, allergies multiples, patient peu bavard, visio avec mauvais son).
2. Pour chacune, remplir à la main la fiche attendue (la « bonne réponse »).
3. Comparer automatiquement la fiche générée et la fiche attendue, à chaque modification des consignes de l'IA.

Seuils pour démarrer le pilote :

| Indicateur | Seuil |
|---|---|
| Champs corrects ou correctement marqués « non abordé » | ≥ 90 % |
| Informations **inventées** sur un champ critique | **0** |
| Informations inventées sur les autres champs | ≤ 2 % |
| Rappel des 24 h : repas correctement retrouvés | ≥ 85 % |

## 8. Architecture technique proposée

Choix guidés par un développement en solo avec un petit budget : un seul langage, peu de briques,
des fournisseurs interchangeables.

| Brique | Choix proposé |
|---|---|
| Application (interface + serveur) | Next.js + TypeScript (même pile que Jarvis Plombier) |
| Base de données | PostgreSQL chez un hébergeur HDS (OVHcloud, Scaleway ou Clever Cloud) |
| Fichiers audio temporaires | Stockage objet chiffré du même hébergeur |
| Authentification | Bibliothèque éprouvée (par ex. Auth.js) avec double authentification |
| Transcription | Interface interne interchangeable : Mistral Voxtral ou Whisper (OVHcloud AI Endpoints) |
| IA de remplissage | Interface interne interchangeable : Claude (via un accès certifié en UE, par ex. AWS Bedrock, à confirmer) ou un modèle hébergé chez un hébergeur HDS. Choix final par le protocole de test (section 7) |
| Export | Génération PDF et .docx côté serveur |
| Phase prototype | Hébergement classique autorisé, **uniquement avec des données fictives** |

Principe clé : la transcription et l'IA passent par une interface interne. Changer de fournisseur
(pour la conformité HDS ou pour le prix) ne demande alors qu'un réglage, pas une réécriture.

### Données principales

| Objet | Contenu |
|---|---|
| Praticien | Identité, e-mail, paramètres, modèles de fiche |
| Patient | Identité, coordonnées, praticien rattaché |
| Modèle de fiche | Rubriques et champs (type, libellé, options, critique oui/non) |
| Consultation | Patient, date, type, lieu, consentement horodaté, statut (en cours / à relire / validée) |
| Morceau audio | Fichier temporaire, ordre, état de transcription, supprimé après validation |
| Transcription | Texte horodaté, locuteur si disponible |
| Fiche remplie | Pour chaque champ : valeur, statut, extrait source, modifié par le praticien oui/non |
| Journal d'accès | Utilisateur, action, objet, date |

## 9. Planning (solo, à temps partiel : estimation)

| Phase | Durée | Contenu | Livrable |
|---|---|---|---|
| 0. Préparation | 1 à 2 sem. | Relecture de ce document par 2 ou 3 diététiciens, écriture des 15 consultations simulées | Cahier validé, jeu de test |
| 1. Prototype | 4 à 6 sem. | Enregistrement, transcription, fiche pré-remplie, relecture, export (données fictives) | Démo sur consultations simulées |
| 2. Qualité IA | 2 à 3 sem. | Ajustement des consignes jusqu'aux seuils de la section 7 | Rapport de test |
| 3. Mise en conformité | 2 à 4 sem. | Migration HDS, double authentification, journal, sauvegardes, documents RGPD | Plateforme prête pour de vrais patients |
| 4. Pilote | 4 sem. | 5 diététiciens en conditions réelles, point chaque semaine | Bilan et décision de lancement |

Total : **environ 3 à 4 mois**.

## 10. Critères de réussite du pilote

- Les pilotes utilisent l'outil pour **au moins 70 %** de leurs consultations.
- Temps de relecture médian **inférieur à 5 min**.
- Moins de 10 % des champs corrigés par le praticien.
- **Au moins 3 pilotes sur 5** déclarent qu'ils paieraient 29 € par mois ou plus.
- Aucun incident de sécurité ni de confidentialité.

## 11. Budget du MVP

| Poste | Estimation |
|---|---|
| Phases 0 à 2 (données fictives) | 10 à 30 €/mois |
| Phases 3 et 4 (HDS, assurance, etc.) | ~200 €/mois |
| Documents juridiques | 0 à 1 500 € (une fois) |
| IA pendant le pilote (5 × 60 consultations × 0,20 €) | ~60 €/mois |

## 12. Questions ouvertes

1. Quels fournisseurs d'IA et de transcription sont réellement couverts par une certification HDS ? (à vérifier en phase 0)
2. Qualité de la séparation praticien / patient en français, notamment en visio.
3. Le praticien veut-il garder la transcription texte, ou seulement la fiche ?
4. Faut-il une fiche de suivi dès le pilote (F4) ?
5. Nom définitif du produit.
