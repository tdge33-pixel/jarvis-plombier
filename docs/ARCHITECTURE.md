# Architecture de Jarvis

Jarvis est un **assistant IA personnel pour artisans**. Le MVP cible les plombiers (« Jarvis Plombier »), mais le moteur est générique : un « Jarvis Électricien » ou « Jarvis Garage » réutilise tout sauf le dossier du métier.

## 1. Les 5 couches séparées

| Couche | Où | Contenu | Change quand… |
|---|---|---|---|
| **Moteur générique de l'agent** | `src/core/agent`, `src/core/insights` | Boucle agentique, outils, permissions, confirmations, proactivité | on améliore Jarvis pour tous les métiers |
| **Connaissances métier** | `src/verticals/<metier>` | Vocabulaire, types d'interventions, modèles de devis, questions d'onboarding, exemples | on ajoute ou ajuste un métier |
| **Données de l'entreprise** | tables `businesses`, `business_settings`, `clients`, `appointments`, `quotes`, `tasks`… | Ce que l'entreprise possède | l'artisan travaille |
| **Préférences de l'utilisateur** | table `memories` (catégories FACT, RULE, PREFERENCE…) | « Ce que Jarvis sait de moi » | l'artisan parle à Jarvis ou édite sa mémoire |
| **Intégrations externes** | `src/lib/integrations` | Interfaces `CalendarProvider`, `EmailProvider`, `SmsProvider`, `DriveProvider` + implémentations Mock / Composio | on connecte un nouvel outil |

Le prompt système (`src/core/agent/prompt.ts`) assemble ces couches à chaque tour : règles du moteur → expertise métier → données entreprise → mémoire active → repères de dates.

## 2. Vue d'ensemble

```
Navigateur (Next.js / React)
   │  pages serveur + server actions (CRUD)      POST /api/jarvis  /api/jarvis/actions/:id
   ▼
AppContext (utilisateur + entreprise + TenantStore limité à business_id)
   │
   ├── Services métier  (src/lib/services)   ← utilisés par l'UI ET par les outils de Jarvis
   │
   ├── Moteur agent     (src/core/agent)
   │      engine.ts ── AIProvider (Anthropic | OpenAI | local)
   │         │
   │         └── outils (zod) ── permissions ── agent_actions (traçabilité)
   │
   ├── Insights         (src/core/insights)  règles proactives « Jarvis a remarqué »
   │
   └── DataBackend (src/lib/data)
          ├── SupabaseBackend : PostgreSQL + Auth + RLS
          └── DemoBackend     : mémoire + fichier .data/ (démo sans configuration)
```

## 3. Le moteur agentique

Fichier central : `src/core/agent/engine.ts`.

1. Le message de l'utilisateur est enregistré (`messages`).
2. Le prompt système est construit (métier + entreprise + mémoire).
3. Le fournisseur d'IA reçoit l'historique et la liste des outils (JSON Schema généré depuis zod).
4. Pour chaque appel d'outil :
   - validation des arguments par le schéma zod ;
   - décision de permission (`src/core/agent/permissions.ts`) ;
   - **exécution directe** (niveau 1, ou niveau 2 autorisé sans validation) → `agent_actions` = `EXECUTED` ;
   - **ou préparation d'une confirmation** : l'outil résout le client, vérifie les disponibilités, puis une action `PENDING_CONFIRMATION` est créée et le tour s'arrête. L'interface affiche *Confirmer / Modifier / Annuler*.
5. Les résultats réels des outils sont renvoyés au modèle, qui rédige la réponse. Les **cartes** affichées (rendez-vous, devis, brouillon de SMS…) sont produites par les outils, jamais par le modèle : l'IA ne peut pas inventer le résultat d'une action.

### Outils

| Outil | Intention | Niveau | Confirmation |
|---|---|---|---|
| `getAppointments`, `getCalendarAvailability` | READ_CALENDAR | 1 | non |
| `searchClient` | SEARCH_CLIENT | 1 | non |
| `getClientHistory` | SEARCH_HISTORY | 1 | non |
| `createClient` | CREATE_CLIENT | 2 | non |
| `createAppointment` | CREATE_APPOINTMENT | 2 | **toujours** |
| `updateAppointment` | UPDATE_APPOINTMENT | 2 | **toujours** |
| `createQuoteDraft` | CREATE_QUOTE | 1 | non (brouillon uniquement) |
| `listQuotes` | LIST_QUOTES | 1 | non |
| `sendQuote` | SEND_QUOTE | **3** | **toujours** |
| `createTask` | CREATE_TASK | 2 | selon « créer automatiquement des tâches » |
| `listTasks` | LIST_TASKS | 1 | non |
| `addMemory` | ADD_MEMORY | 2 | non (demande explicite de l'utilisateur) |
| `suggestPreference` | SUGGEST_MEMORY | 1 | crée une suggestion INFERRED à valider |
| `searchMemory` | SEARCH_MEMORY | 1 | non |
| `draftCustomerMessage` | DRAFT_MESSAGE | 1 | non (brouillon, jamais envoyé) |

Ajouter un outil : créer un `defineTool({...})` dans `src/core/agent/tools/` et l'ajouter au registre `tools/index.ts`.

### Niveaux de permission

- **Niveau 1** — lecture et préparation : exécuté directement.
- **Niveau 2** — action réversible : confirmation selon l'outil et les réglages (*Paramètres › Permissions Jarvis*).
- **Niveau 3** — action sensible : confirmation explicite **toujours**, quels que soient les réglages.
- Aucune opération bancaire, aucun paiement, aucune commande fournisseur n'existe dans le MVP.

## 4. Fournisseurs d'IA

`src/lib/ai/provider.ts` choisit le fournisseur (`AI_PROVIDER`) ; tous implémentent `AIProvider.chat()` avec un format neutre (`src/lib/ai/types.ts`).

- `anthropic` — SDK officiel `@anthropic-ai/sdk`, modèle par défaut `claude-opus-5-5` (surchargeable via `AI_MODEL`), repli serveur automatique en cas de refus (`fallbacks: "default"`).
- `openai` — SDK officiel `openai`, Chat Completions + function calling.
- `local` — moteur **hors-ligne à règles** qui reconnaît les demandes courantes en français et appelle les mêmes outils. Il permet la démo sans clé ; il ne remplace pas un vrai modèle.

## 5. Mémoire et apprentissage

Pas de fine-tuning : Jarvis relit sa mémoire structurée à chaque conversation.

- Catégories : `FACT`, `PREFERENCE`, `RULE`, `BUSINESS_INFO`, `CLIENT_INFO`, `TEMPORARY` (expire), `INFERRED`.
- Rubriques d'affichage : Mon entreprise, Mes préférences, Mes règles, Fournisseurs, Tarifs, Habitudes.
- Statuts : `active`, `disabled`, `pending` (suggestion), `rejected`.
- **Une mémoire INFERRED ne devient jamais une RULE automatiquement.** Elle reste `pending` ; « Oui, retenir » la transforme en `PREFERENCE` active. Garde-fou en base : contrainte `inferred_never_active`.
- Détection V1 (`detectInferredPreferences`) : ≥ 3 interventions après 18h annulées en 3 mois ⇒ suggestion « J'évite les interventions après 18h ».
- `user_id` null = mémoire de l'entreprise ; renseigné = préférence personnelle (visible uniquement par son auteur, y compris via RLS).

## 6. Multi-entreprise et sécurité

- Toutes les tables métier portent `business_id`.
- **Applicatif** : chaque accès passe par un `TenantStore` lié à une entreprise (`ctx.store`), qui filtre et force `business_id`.
- **Base** : Row Level Security (`supabase/migrations/0002_rls.sql`) via `is_member(business_id)` ; conversations et préférences personnelles limitées à leur auteur.
- **Intégrité** : clés étrangères composites `(business_id, client_id)` → impossible de rattacher un rendez-vous au client d'une autre entreprise.
- Création d'entreprise par la fonction `create_business()` (SECURITY DEFINER, atomique).
- Les clés API ne sont lues que côté serveur ; le navigateur n'appelle que `/api/jarvis`.
- Ces garanties ont été testées sur PostgreSQL 16 (deux utilisateurs, lectures et écritures croisées refusées).

## 7. Intégrations (Composio)

`src/lib/integrations/index.ts › getIntegrations(ctx)` renvoie un `IntegrationSet`. Pour chaque type :

- si `COMPOSIO_API_KEY` est défini **et** que l'entreprise a une ligne `integrations` connectée → `ComposioCalendarProvider` / `ComposioEmailProvider` ;
- sinon → `MockCalendarProvider`, `MockEmailProvider`, `MockSmsProvider`…

La logique métier ne voit que les interfaces : brancher Google Agenda ne modifie ni les services ni les outils. Le parcours OAuth (bouton « Connecter ») est le prochain chantier ; les slugs d'outils Composio sont isolés dans `composio/providers.ts`.

## 8. Proactivité (insights)

`src/core/insights/engine.ts` : des règles pures évaluées sur un instantané de données (devis sans réponse ≥ 10 j, rendez-vous non confirmés, interventions à moins de 3 km le lendemain, stock bas, tâches en retard, journée surchargée, créneau libre). La table `insights` est prête pour exécuter ces règles en tâche de fond (cron) et notifier l'artisan.

## 9. Ajouter un métier

1. Copier `src/verticals/plombier` vers `src/verticals/electricien` et adapter : `trade`, `promptExpertise`, `interventionTypes`, `quoteTemplates`, `onboarding`, `examplePrompts`.
2. L'enregistrer dans `src/verticals/index.ts`.
3. Créer les entreprises avec `vertical = 'electricien'`.

## 10. Décisions techniques

| Décision | Raison |
|---|---|
| Next.js 15.5 (App Router) plutôt que 16 | Version stable, API connue (middleware, server actions) ; montée de version simple plus tard |
| Couche `DataBackend` (Supabase / démo) | Démonstration immédiate sans configuration, et même code métier en production |
| Store générique par table plutôt qu'un ORM | Peu de dépendances, typage strict par `TenantTables`, isolation imposée à un seul endroit |
| zod pour les outils | Une seule définition → validation des arguments de l'IA + JSON Schema envoyé au modèle |
| Boucle agentique maison (pas de framework) | Besoin d'arrêter le tour pour une confirmation humaine et de journaliser chaque action |
| Historique rejoué en texte seulement | Les cartes restent côté interface ; pas de « tool_use » orphelin quand un tour s'arrête pour confirmation |
| Insights calculés à l'affichage | Suffisant pour la V1 ; la table `insights` prépare l'exécution asynchrone |
| Recherche mémoire par mots-clés | Volume faible ; remplaçable par une recherche sémantique sans changer l'interface |
| Dictée via Web Speech API | Voix utilisable dès maintenant dans Chrome/Safari, hook remplaçable par une transcription serveur |

## 11. Pistes suivantes

- Branchement OAuth Composio (Google Agenda, Gmail/Outlook, Drive) et envoi réel des devis en PDF.
- Réponses en streaming et saisie vocale côté serveur.
- Insights en tâche de fond + notifications (email / push).
- Invitations de membres (`business_members`) et rôles.
- Géocodage des adresses clients (calcul de distances, regroupement par zone).
- Tests unitaires du parseur local et des outils ; tests e2e en CI.
