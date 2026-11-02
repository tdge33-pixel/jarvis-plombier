# 02 - Prix de l'abonnement et coûts réels

> Estimation de novembre 2026. Prix des fournisseurs relevés en octobre 2026, convertis
> à environ 1 $ = 0,90 €. Ce sont des ordres de grandeur : à revérifier avant le lancement.

## 1. Coût réel d'une consultation (coût variable)

Hypothèse : consultation moyenne de **40 minutes** (1er RDV environ 60 min, suivis 30 à 45 min).

### Transcription audio → texte (le poste le plus cher)

| Option | Prix | Pour 40 min |
|---|---|---|
| Whisper via OVHcloud AI Endpoints (hébergeur français, HDS annoncé) | ~0,0028 $/min | ~0,10 € |
| Mistral Voxtral Mini Transcribe 3 (lot) | 0,0035 $/min | ~0,13 € |
| Mistral Voxtral temps réel | 0,008 $/min | ~0,29 € |

**Astuce clé :** envoyer l'audio par **petits morceaux de 30 s** au tarif « lot ». On obtient
un quasi-direct (environ 30 s de décalage) au prix le plus bas, ce qui suffit pour la checklist en direct.

### IA (remplissage de la fiche + résumé + courrier)

Environ 15 000 jetons en entrée et 5 000 en sortie par consultation.

| Modèle | Prix (entrée / sortie, par million de jetons) | Par consultation |
|---|---|---|
| Claude Haiku 5.5 | 0,10 $ / 0,50 $ | ~0,004 € |
| Claude Sonnet 5.5 | 2 $ / 10 $ | ~0,07 € |
| Claude Opus 5.5 | 4 $ / 20 $ | ~0,15 € |

Checklist en direct (petit modèle interrogé toutes les 2 min environ) : ~0,01 € par consultation.

### Total par consultation

| Scénario | Composition | Coût |
|---|---|---|
| Économique | Whisper OVH + Haiku | **~0,10 €** |
| **Standard (recommandé)** | Voxtral par morceaux + Sonnet + checklist | **~0,20 €** |
| Haut de gamme | Temps réel + Opus | ~0,45 € |

### Par praticien et par mois (scénario standard)

| Profil | Consultations/mois | Coût IA |
|---|---|---|
| Temps partiel | 30 | ~6 € |
| Moyen | 60 | ~12 € |
| Très actif | 120 | ~25 € |

## 2. Frais fixes (à votre charge, quel que soit le nombre de clients)

### Phase 0 : prototype (consultations simulées, aucune vraie donnée patient)

| Poste | Coût mensuel |
|---|---|
| Crédits API pour les tests | 10 à 20 € |
| Nom de domaine | ~1 € |
| **Total** | **~10 à 30 €/mois** |

Pas besoin d'hébergement HDS tant qu'aucune vraie donnée de santé n'est traitée : on teste
avec des consultations jouées entre vous et un(e) diététicien(ne).

### Phase 1 : pilotes et lancement (vrais patients, donc HDS obligatoire)

| Poste | Coût mensuel |
|---|---|
| Hébergement certifié HDS (serveur, base de données, stockage), par ex. OVHcloud, Scaleway, Clever Cloud | 50 à 150 € |
| Domaine + e-mail pro | 5 à 10 € |
| Assurance RC Pro + cyber (500 à 900 €/an) | 40 à 80 € |
| Banque pro | 0 à 15 € |
| Logiciel compta / facturation | 0 à 20 € |
| **Total** | **~100 à 275 €/mois (compter ~200 €)** |

### Frais ponctuels

| Poste | Coût |
|---|---|
| Création d'une micro-entreprise | 0 € |
| Analyse d'impact RGPD (AIPD) avec l'outil PIA gratuit de la CNIL | 0 € |
| CGU/CGV, politique de confidentialité, contrat de sous-traitance RGPD | 0 € (modèles) à ~1 500 € (juriste) |
| Application iOS/Android | Évité au départ : une application web installable (PWA) suffit |

### Prélèvements sur le chiffre d'affaires

- **Paiement en ligne (Stripe) :** ~1,5 % + 0,25 € par paiement, soit ~0,80 € sur 39 €.
- **Cotisations micro-entreprise :** environ **21 à 26 % du chiffre d'affaires** selon le classement de l'activité.
  S'y ajoute la CFE chaque année (exonérée la 1re année). À confirmer avec l'URSSAF ou un comptable.
- **TVA :** franchise possible sous un seuil de chiffre d'affaires (à vérifier selon la loi en vigueur).

## 3. Prix de l'abonnement proposé

Repères : Doctolib facture entre 79 et 199 €/mois aux médecins. Les diététiciens gagnent moins
(consultations de 40 à 70 €, non remboursées) : il faut rester nettement en dessous.
Valeur pour le praticien : 10 à 15 min gagnées par consultation, soit **10 à 15 h par mois**
pour 60 consultations, pour moins que le prix d'une consultation.

| Offre | Prix HT | Contenu |
|---|---|---|
| Essai | Gratuit | 14 jours ou 10 consultations |
| **Essentiel** | **29 €/mois** | 50 consultations/mois, fiche pré-remplie en fin de séance, résumé, export PDF/Word, 1 fiche personnalisée |
| **Pro** | **49 €/mois** | 120 consultations/mois, checklist en direct, mode suivi, courriers, fiches illimitées |
| Annuel | 290 € / 490 € | 2 mois offerts |
| Fondateurs (pilotes) | 3 mois gratuits, puis Pro à 29 € à vie | En échange de retours réguliers |
| Hors forfait | 0,50 € par consultation | |

### Marge par abonné (scénario standard)

| Offre | Usage | Coût IA + Stripe | Marge brute |
|---|---|---|---|
| Essentiel 29 € | 30 consultations (typique) | ~7 € | ~22 € (76 %) |
| Essentiel 29 € | 50 consultations (plafond) | ~11 € | ~18 € (61 %) |
| Pro 49 € | 70 consultations (typique) | ~16 € | ~33 € (68 %) |
| Pro 49 € | 120 consultations (plafond) | ~26 € | ~23 € (47 %) |

Les plafonds de consultations sont indispensables : sans eux, un gros utilisateur coûte plus qu'il ne rapporte.

## 4. Combien d'abonnés pour en vivre ?

Hypothèses : prix moyen de 39 €, coût variable de ~12 €, cotisations de ~24 %.
Il reste **~17 € par abonné et par mois**.

| Objectif | Abonnés nécessaires | Part des ~7 500 diététiciens libéraux |
|---|---|---|
| Couvrir les frais fixes (~200 €) | **~12** | 0,2 % |
| Se verser ~2 000 €/mois (avant impôt sur le revenu) | **~125** | 1,7 % |
| Se verser ~4 000 €/mois | ~240 | 3,2 % |

## 5. Points à vérifier avant de choisir les fournisseurs

- **HDS des services d'IA :** chaque service qui reçoit l'audio ou le texte doit être couvert.
  L'API directe d'Anthropic n'est pas un hébergeur HDS. Pistes : Claude via AWS Bedrock en région UE
  (AWS est certifié HDS, mais le périmètre exact de Bedrock est à vérifier, et les tarifs y diffèrent),
  ou des modèles hébergés chez un hébergeur HDS français (OVHcloud AI Endpoints, Scaleway).
- **Prix en vigueur :** les grilles bougent souvent ; refaire le calcul au moment du lancement.
