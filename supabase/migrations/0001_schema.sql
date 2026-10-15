-- =============================================================================
-- Jarvis — schéma PostgreSQL (Supabase)
-- Multi-entreprise : toutes les données métier portent business_id.
-- Les clés étrangères composites (business_id, x_id) empêchent physiquement
-- de rattacher une ligne à un objet d'une AUTRE entreprise.
-- =============================================================================

create extension if not exists pgcrypto;

-- Mise à jour automatique de updated_at
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Utilisateurs (profil 1:1 avec auth.users, géré par Supabase Auth)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  first_name  text not null default '',
  last_name   text not null default '',
  phone       text,
  created_at  timestamptz not null default now()
);

-- Création automatique du profil à l'inscription (prénom/nom passés en métadonnées)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Entreprises (tenants)
-- -----------------------------------------------------------------------------
create table public.businesses (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  vertical        text not null default 'plombier',   -- métier : plombier, electricien, …
  phone           text,
  email           text,
  address         text,
  postal_code     text,
  city            text,
  siret           text,
  works_alone     boolean not null default true,
  team_size       integer not null default 1 check (team_size >= 1),
  zone_radius_km  integer check (zone_radius_km >= 0),
  timezone        text not null default 'Europe/Paris',
  is_demo         boolean not null default false,
  onboarded_at    timestamptz,
  created_at      timestamptz not null default now()
);

create type public.member_role as enum ('owner', 'admin', 'member');

create table public.business_members (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.member_role not null default 'member',
  created_at   timestamptz not null default now(),
  unique (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

create table public.business_settings (
  business_id               uuid primary key references public.businesses (id) on delete cascade,
  hourly_rate               numeric(10, 2) not null default 60 check (hourly_rate >= 0),
  travel_fee                numeric(10, 2) not null default 30 check (travel_fee >= 0),
  vat_rate                  numeric(5, 2) not null default 10 check (vat_rate between 0 and 30),
  quote_validity_days       integer not null default 30 check (quote_validity_days > 0),
  work_start                text not null default '08:00' check (work_start ~ '^\d{2}:\d{2}$'),
  work_end                  text not null default '18:00' check (work_end ~ '^\d{2}:\d{2}$'),
  working_days              smallint[] not null default '{1,2,3,4,5}', -- ISO : 1 = lundi … 7 = dimanche
  emergencies_accepted      boolean not null default false,
  emergency_until           text check (emergency_until ~ '^\d{2}:\d{2}$'),
  max_appointments_per_day  integer not null default 5 check (max_appointments_per_day > 0),
  services                  text[] not null default '{}',
  refused_services          text[] not null default '{}',
  suppliers                 text[] not null default '{}',
  calendar_tool             text,
  invoicing_tool            text,
  signature                 text,
  permissions               jsonb not null default '{
    "auto_create_tasks": true,
    "create_appointments": true,
    "modify_appointments": true,
    "prepare_quotes": true,
    "save_preferences": true,
    "draft_messages": true
  }'::jsonb,
  updated_at                timestamptz not null default now()
);
create trigger business_settings_updated_at before update on public.business_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Clients (mini CRM)
-- -----------------------------------------------------------------------------
create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  civility        text check (civility in ('M.', 'Mme')),
  first_name      text,
  last_name       text not null,
  company         text,
  phone           text,
  email           text,
  address         text,
  postal_code     text,
  city            text,
  lat             double precision,
  lng             double precision,
  notes           text,
  important_info  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (business_id, id)
);
create index clients_business_name_idx on public.clients (business_id, last_name);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

create table public.client_notes (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  client_id    uuid not null,
  content      text not null,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (business_id, client_id) references public.clients (business_id, id) on delete cascade
);
create index client_notes_client_idx on public.client_notes (business_id, client_id);

-- -----------------------------------------------------------------------------
-- Interventions / rendez-vous
-- -----------------------------------------------------------------------------
create table public.appointments (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete cascade,
  client_id          uuid,
  title              text not null,
  intervention_type  text not null,
  start_at           timestamptz not null,
  duration_minutes   integer not null default 60 check (duration_minutes between 5 and 1440),
  address            text,
  city               text,
  status             text not null default 'confirmed'
                     check (status in ('to_confirm', 'confirmed', 'in_progress', 'done', 'cancelled')),
  notes              text,
  external_event_id  text,       -- identifiant dans l'agenda externe (Google, Outlook…)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (business_id, client_id) references public.clients (business_id, id) on delete set null (client_id)
);
create index appointments_business_start_idx on public.appointments (business_id, start_at);
create index appointments_client_idx on public.appointments (business_id, client_id);
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Devis
-- -----------------------------------------------------------------------------
create table public.quotes (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  client_id    uuid,
  number       text not null,
  title        text not null,
  description  text,
  status       text not null default 'draft'
               check (status in ('draft', 'sent', 'accepted', 'refused', 'expired')),
  vat_rate     numeric(5, 2) not null default 10,
  total_ht     numeric(12, 2) not null default 0,
  total_vat    numeric(12, 2) not null default 0,
  total_ttc    numeric(12, 2) not null default 0,
  notes        text,
  valid_until  date,
  sent_at      timestamptz,
  created_by   text not null default 'user' check (created_by in ('user', 'ai')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, number),
  foreign key (business_id, client_id) references public.clients (business_id, id) on delete set null (client_id)
);
create index quotes_business_status_idx on public.quotes (business_id, status);
create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();

create table public.quote_items (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  quote_id     uuid not null,
  kind         text not null check (kind in ('labor', 'material', 'travel', 'other')),
  label        text not null,
  quantity     numeric(10, 2) not null default 1 check (quantity >= 0),
  unit_price   numeric(12, 2) not null default 0 check (unit_price >= 0),
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  foreign key (business_id, quote_id) references public.quotes (business_id, id) on delete cascade
);
create index quote_items_quote_idx on public.quote_items (business_id, quote_id, position);

-- -----------------------------------------------------------------------------
-- Tâches
-- -----------------------------------------------------------------------------
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  title         text not null,
  description   text,
  due_date      date,
  priority      text not null default 'normal' check (priority in ('normal', 'high')),
  status        text not null default 'todo' check (status in ('todo', 'done')),
  client_id     uuid,
  quote_id      uuid,
  created_by    text not null default 'user' check (created_by in ('user', 'ai')),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (business_id, client_id) references public.clients (business_id, id) on delete set null (client_id),
  foreign key (business_id, quote_id) references public.quotes (business_id, id) on delete set null (quote_id)
);
create index tasks_business_status_idx on public.tasks (business_id, status, due_date);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Mémoire de Jarvis (« Ce que Jarvis sait de moi »)
-- INFERRED = suggestion déduite par Jarvis, statut 'pending' jusqu'à validation.
-- -----------------------------------------------------------------------------
create table public.memories (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  user_id        uuid references auth.users (id) on delete cascade, -- null = mémoire de l'entreprise
  category       text not null check (category in ('FACT', 'PREFERENCE', 'RULE', 'BUSINESS_INFO', 'CLIENT_INFO', 'TEMPORARY', 'INFERRED')),
  section        text not null check (section in ('business', 'preferences', 'rules', 'suppliers', 'pricing', 'habits')),
  content        text not null,
  key            text,
  status         text not null default 'active' check (status in ('active', 'disabled', 'pending', 'rejected')),
  source         text not null default 'user' check (source in ('user', 'onboarding', 'jarvis')),
  confidence     real check (confidence between 0 and 1),
  evidence       text,
  snoozed_until  timestamptz,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Garde-fou : une mémoire déduite ne peut pas être active sans être devenue une préférence validée.
  constraint inferred_never_active check (not (category = 'INFERRED' and status = 'active'))
);
create unique index memories_key_uidx on public.memories (business_id, key) where key is not null;
create index memories_business_status_idx on public.memories (business_id, status);
create trigger memories_updated_at before update on public.memories
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Conversations avec Jarvis
-- -----------------------------------------------------------------------------
create table public.conversations (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null default 'Nouvelle conversation',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, id)
);
create index conversations_user_idx on public.conversations (business_id, user_id, updated_at desc);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  conversation_id  uuid not null,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null default '',
  blocks           jsonb not null default '[]'::jsonb, -- cartes d'interface produites par les outils
  created_at       timestamptz not null default now(),
  foreign key (business_id, conversation_id) references public.conversations (business_id, id) on delete cascade
);
create index messages_conversation_idx on public.messages (business_id, conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- Traçabilité des actions de Jarvis
-- -----------------------------------------------------------------------------
create table public.agent_actions (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  conversation_id  uuid,
  user_id          uuid references auth.users (id) on delete set null,
  action           text not null,          -- CREATE_APPOINTMENT, CREATE_QUOTE, …
  tool_name        text not null,
  level            smallint not null check (level in (1, 2, 3)),
  status           text not null check (status in ('PENDING_CONFIRMATION', 'CONFIRMED', 'EXECUTED', 'FAILED', 'CANCELLED')),
  initiated_by     text not null check (initiated_by in ('AI', 'USER')),
  summary          text not null default '',
  args             jsonb not null default '{}'::jsonb,
  result           jsonb,
  error            text,
  confirmed_at     timestamptz,
  executed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (business_id, conversation_id) references public.conversations (business_id, id) on delete set null (conversation_id)
);
create index agent_actions_business_idx on public.agent_actions (business_id, created_at desc);
create trigger agent_actions_updated_at before update on public.agent_actions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Intégrations externes (Composio : Google Agenda, Gmail, Outlook, Drive…)
-- Les jetons OAuth restent chez Composio : on ne stocke que l'identifiant du compte connecté.
-- -----------------------------------------------------------------------------
create table public.integrations (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses (id) on delete cascade,
  kind                 text not null check (kind in ('calendar', 'email', 'sms', 'drive')),
  provider             text not null default 'mock' check (provider in ('mock', 'composio')),
  app                  text,
  status               text not null default 'disconnected' check (status in ('connected', 'disconnected')),
  external_account_id  text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (business_id, kind, app)
);
create trigger integrations_updated_at before update on public.integrations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Insights (proactivité) — préparé pour une exécution en tâche de fond.
-- En V1 les insights sont calculés à l'affichage (src/core/insights).
-- -----------------------------------------------------------------------------
create table public.insights (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  kind         text not null,
  dedupe_key   text not null,
  severity     text not null default 'info' check (severity in ('info', 'warning')),
  title        text not null,
  detail       text,
  href         text,
  status       text not null default 'open' check (status in ('open', 'dismissed', 'done')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  unique (business_id, dedupe_key)
);
