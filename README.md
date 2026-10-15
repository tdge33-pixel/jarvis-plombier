# Jarvis Plombier

> Jarvis s'occupe de l'administratif pendant que vous vous occupez de vos clients.
> Plus vous utilisez Jarvis, plus il apprend comment vous travaillez.

Assistant IA personnel pour plombiers indépendants et petites entreprises de plomberie : planning, clients, devis, tâches, messages clients et mémoire personnelle — piloté en langage naturel.

Architecture conçue pour être réutilisée par d'autres métiers (électricien, chauffagiste, coiffeur, garage…) : voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Essayer sans rien installer (GitHub Codespaces)

Sur la page GitHub du dépôt : bouton vert **Code** → onglet **Codespaces** → **Create codespace on main**.
Après 2 à 3 minutes, l'application s'ouvre automatiquement dans un nouvel onglet (sinon : onglet **Ports** → port 3000 → icône globe).

## Démarrage rapide (mode démo, aucune configuration)

```bash
npm install
npm run dev
```

Ouvrez http://localhost:3000 et connectez-vous avec le compte de démonstration :

- **Email** : `thomas@martin-plomberie.fr`
- **Mot de passe** : `jarvis2026`

(Bouton « Remplir automatiquement » sur la page de connexion.) Vous pouvez aussi créer votre propre compte : l'onboarding conversationnel configure votre entreprise.

En mode démo, les données sont stockées dans `.data/demo-db.json` et Jarvis utilise un **moteur local hors-ligne** (règles en français). Pour un vrai modèle d'IA, ajoutez une clé (voir ci-dessous).

### Essayez avec Jarvis

- « Qu'est-ce que j'ai demain ? »
- « Ajoute Mme Martin vendredi à 14h pour une fuite »
- « Prépare un devis pour Mme Martin : remplacement chauffe-eau 200L, 4 heures de main-d'œuvre, chauffe-eau 620 € »
- « Rappelle-moi ce qu'on avait fait chez Dupont »
- « Note que je ne prends jamais de dépannage à plus de 30 km après 17h »
- « Prépare un SMS pour prévenir mon prochain client que j'ai 20 minutes de retard »
- « Rappelle-moi de commander le chauffe-eau de Mme Dupont demain »
- « Quels devis sont en attente ? »

## Configuration

Copiez `.env.example` vers `.env.local` et renseignez ce dont vous avez besoin.

| Variable | Rôle |
|---|---|
| `DATA_BACKEND` | `demo` ou `supabase` (auto : `supabase` si l'URL Supabase est définie) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Réservé aux tâches d'administration futures (jamais exposé au navigateur) |
| `SESSION_SECRET` | Signature des sessions du mode démo (obligatoire si démo exposée en ligne) |
| `AI_PROVIDER` | `anthropic`, `openai` ou `local` (auto : premier fournisseur dont la clé est présente) |
| `AI_MODEL` | Modèle à utiliser (défaut : `claude-opus-5-5` / `gpt-4.1`) |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Clés des fournisseurs d'IA (lues côté serveur uniquement) |
| `COMPOSIO_API_KEY` | Active les intégrations Composio (Google Agenda, Gmail, Outlook…) |

### Passer sur Supabase

1. Créez un projet Supabase.
2. Exécutez dans l'ordre (SQL Editor ou `supabase db push`) :
   - `supabase/migrations/0001_schema.sql` — tables, contraintes, index
   - `supabase/migrations/0002_rls.sql` — Row Level Security + fonction `create_business`
   - `supabase/seed.sql` — fonction de données de démonstration (facultatif)
3. Renseignez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Créez un compte depuis l'application (`/inscription`).
5. Facultatif — pour charger Martin Plomberie sur un compte qui n'a pas encore fait l'onboarding :
   `select public.seed_demo_business('<uuid de l''utilisateur>');`

## Scripts

| Commande | |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run typecheck` | Vérification TypeScript stricte |

## Structure

```
src/
  app/                      Pages (App Router) et routes API
    (auth)/                 Connexion, inscription
    (app)/                  Accueil, Jarvis, Planning, Clients, Devis, Tâches, Mémoire, Paramètres
    onboarding/             Onboarding conversationnel
    api/jarvis/             Conversation + confirmation des actions
    api/export/             Export des données (RGPD)
  core/                     Moteur générique (indépendant du métier)
    agent/                  Boucle agentique, outils, permissions, prompt, blocs d'interface
    insights/               Proactivité « Jarvis a remarqué »
  verticals/                Connaissances métier (plombier/ ; demain electricien/, garage/…)
  lib/
    ai/                     Abstraction des fournisseurs d'IA (anthropic, openai, local)
    data/                   Accès aux données : Supabase ou démo, isolé par entreprise
    integrations/           Interfaces + Mock + Composio
    services/               Logique métier partagée par l'interface et par Jarvis
    domain/                 Types du domaine
  components/               Composants d'interface réutilisables
supabase/                   Schéma SQL, RLS, données de démonstration
docs/ARCHITECTURE.md        Architecture et décisions techniques
```

## Ce que le MVP ne fait pas (volontairement)

Pas de comptabilité, de paiement, de commande fournisseur automatique, de téléphonie, d'application mobile native, de gestion de stock ni de fine-tuning. L'architecture (interfaces d'intégration, niveaux de permission, table `insights`) est prête pour les ajouter.
