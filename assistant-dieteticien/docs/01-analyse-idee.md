# 01 - Analyse de l'idée et du marché

## Verdict

Bonne idée et vrai besoin, mais le concept de « scribe IA » existe déjà chez les
généralistes. L'avantage à jouer, c'est la **spécialisation diététique** : fiche structurée,
sujets sensibles (TCA, rapport au corps), rappel alimentaire, suivi des séances.

## Concurrence

| Acteur | Ce qu'il fait | Risque |
|---|---|---|
| Doctolib (assistant de consultation) | Notes IA dans le dossier patient. Généralistes et dentistes d'abord, **paramédicaux annoncés d'ici fin 2026** | Élevé |
| Nabla, Tandem Health, Heidi, Dragon Copilot, Lyrebird… | Scribes généralistes, parfois avec modèles personnalisés | Moyen |
| Logiciels métier diététique | Dossiers, calculs nutritionnels | À vérifier : pas de scribe IA spécialisé trouvé |

## Marché

- Environ 17 500 diététiciens en France, dont environ 45 % en libéral ou en mixte, soit **7 500 à 8 000 cibles**.
- Seuls, les diététiciens forment une petite niche : il faudra ensuite s'étendre à d'autres métiers et à la francophonie.

## Points non négociables

1. Hébergement **HDS** + RGPD (données de santé, article 9) + analyse d'impact (AIPD).
2. **Consentement du patient** à l'enregistrement ; audio supprimé après validation.
3. Rester un **outil de documentation** (pas de diagnostic ni de prescription), pour ne pas devenir un dispositif médical.
4. Le praticien relit et valide toujours.

## Fonctionnalités qui différencient

1. Fiches personnalisables (chaque praticien importe la sienne).
2. Checklist en direct des rubriques pas encore abordées.
3. Remplissage traçable (extrait source pour chaque champ, « non abordé » plutôt qu'une invention).
4. Rappel alimentaire des 24 h extrait de la conversation (la rubrique ALIMENTATION de la fiche).
5. Mode suivi : comparaison avec la séance précédente.
6. Documents générés : synthèse, courrier au médecin traitant, récapitulatif des objectifs pour le patient.
7. Ton neutre et bienveillant, adapté aux TCA.

## Démarche

1. Entretiens avec 10 à 15 diététiciens (temps passé sur les notes, prix acceptable).
2. MVP web : enregistrement, transcription, fiche pré-remplie, relecture, export.
3. Pilote d'un mois avec 5 diététiciens.
4. Ensuite : HDS en production, facturation, extension.
