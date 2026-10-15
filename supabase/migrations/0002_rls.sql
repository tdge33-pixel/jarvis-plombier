-- =============================================================================
-- Row Level Security : une entreprise ne voit JAMAIS les données d'une autre.
-- Toutes les requêtes de l'application utilisent la clé anonyme + la session
-- de l'utilisateur ; ces policies sont donc la barrière finale côté base.
-- =============================================================================

-- L'utilisateur courant est-il membre de l'entreprise ?
create or replace function public.is_member(p_business_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid()
  );
$$;

-- L'utilisateur courant a-t-il l'un des rôles donnés dans l'entreprise ?
create or replace function public.has_role(p_business_id uuid, p_roles public.member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid() and role = any (p_roles)
  );
$$;

alter table public.profiles          enable row level security;
alter table public.businesses        enable row level security;
alter table public.business_members  enable row level security;
alter table public.business_settings enable row level security;
alter table public.clients           enable row level security;
alter table public.client_notes      enable row level security;
alter table public.appointments      enable row level security;
alter table public.quotes            enable row level security;
alter table public.quote_items       enable row level security;
alter table public.tasks             enable row level security;
alter table public.memories          enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.agent_actions     enable row level security;
alter table public.integrations      enable row level security;
alter table public.insights          enable row level security;

-- ----------------------------------------------------------------- profils
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from public.business_members me
    join public.business_members other on other.business_id = me.business_id
    where me.user_id = auth.uid() and other.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------------------------------------------- entreprises
-- Création uniquement via la fonction create_business() ; pas de suppression depuis l'app.
create policy businesses_select on public.businesses for select using (public.is_member(id));
create policy businesses_update on public.businesses for update
  using (public.has_role(id, '{owner,admin}')) with check (public.has_role(id, '{owner,admin}'));

create policy members_select on public.business_members for select using (public.is_member(business_id));
create policy members_manage on public.business_members for all
  using (public.has_role(business_id, '{owner,admin}')) with check (public.has_role(business_id, '{owner,admin}'));

create policy settings_select on public.business_settings for select using (public.is_member(business_id));
create policy settings_update on public.business_settings for update
  using (public.has_role(business_id, '{owner,admin}')) with check (public.has_role(business_id, '{owner,admin}'));

-- -------------------------------------------- tables métier de l'entreprise
do $$
declare
  t text;
begin
  foreach t in array array['clients', 'client_notes', 'appointments', 'quotes', 'quote_items', 'tasks', 'agent_actions', 'integrations', 'insights'] loop
    execute format('create policy %1$s_select on public.%1$I for select using (public.is_member(business_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert with check (public.is_member(business_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update using (public.is_member(business_id)) with check (public.is_member(business_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete using (public.is_member(business_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- mémoire
-- Mémoires de l'entreprise (user_id null) : tous les membres.
-- Préférences personnelles (user_id renseigné) : uniquement leur propriétaire.
create policy memories_select on public.memories for select
  using (public.is_member(business_id) and (user_id is null or user_id = auth.uid()));
create policy memories_insert on public.memories for insert
  with check (public.is_member(business_id) and (user_id is null or user_id = auth.uid()));
create policy memories_update on public.memories for update
  using (public.is_member(business_id) and (user_id is null or user_id = auth.uid()))
  with check (public.is_member(business_id) and (user_id is null or user_id = auth.uid()));
create policy memories_delete on public.memories for delete
  using (public.is_member(business_id) and (user_id is null or user_id = auth.uid()));

-- ---------------------------------------------------------- conversations
-- Les conversations sont personnelles, même au sein d'une entreprise.
create policy conversations_all on public.conversations for all
  using (public.is_member(business_id) and user_id = auth.uid())
  with check (public.is_member(business_id) and user_id = auth.uid());

create policy messages_all on public.messages for all
  using (
    public.is_member(business_id)
    and exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
  )
  with check (
    public.is_member(business_id)
    and exists (select 1 from public.conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
  );

-- =============================================================================
-- Création d'une entreprise (onboarding) — atomique, pour l'utilisateur connecté.
-- =============================================================================
create or replace function public.create_business(
  p_name text,
  p_vertical text default 'plombier',
  p_business jsonb default '{}'::jsonb,
  p_settings jsonb default '{}'::jsonb
) returns public.businesses
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_business public.businesses;
begin
  if v_uid is null then
    raise exception 'Utilisateur non authentifié';
  end if;
  -- MVP : une entreprise par utilisateur.
  if exists (select 1 from public.business_members where user_id = v_uid) then
    raise exception 'Cet utilisateur appartient déjà à une entreprise';
  end if;

  insert into public.businesses (name, vertical, phone, email, address, postal_code, city, siret,
                                 works_alone, team_size, zone_radius_km, onboarded_at)
  values (
    p_name,
    coalesce(nullif(p_vertical, ''), 'plombier'),
    p_business ->> 'phone',
    p_business ->> 'email',
    p_business ->> 'address',
    p_business ->> 'postal_code',
    p_business ->> 'city',
    p_business ->> 'siret',
    coalesce((p_business ->> 'works_alone')::boolean, true),
    coalesce((p_business ->> 'team_size')::integer, 1),
    (p_business ->> 'zone_radius_km')::numeric::integer,
    coalesce((p_business ->> 'onboarded_at')::timestamptz, now())
  )
  returning * into v_business;

  insert into public.business_members (business_id, user_id, role) values (v_business.id, v_uid, 'owner');
  insert into public.business_settings (business_id) values (v_business.id);

  update public.business_settings set
    hourly_rate              = coalesce((p_settings ->> 'hourly_rate')::numeric, hourly_rate),
    travel_fee               = coalesce((p_settings ->> 'travel_fee')::numeric, travel_fee),
    vat_rate                 = coalesce((p_settings ->> 'vat_rate')::numeric, vat_rate),
    work_start               = coalesce(p_settings ->> 'work_start', work_start),
    work_end                 = coalesce(p_settings ->> 'work_end', work_end),
    working_days             = coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(p_settings -> 'working_days') x), working_days),
    emergencies_accepted     = coalesce((p_settings ->> 'emergencies_accepted')::boolean, emergencies_accepted),
    emergency_until          = coalesce(p_settings ->> 'emergency_until', emergency_until),
    max_appointments_per_day = coalesce((p_settings ->> 'max_appointments_per_day')::integer, max_appointments_per_day),
    services                 = coalesce((select array_agg(x) from jsonb_array_elements_text(p_settings -> 'services') x), services),
    refused_services         = coalesce((select array_agg(x) from jsonb_array_elements_text(p_settings -> 'refused_services') x), refused_services),
    suppliers                = coalesce((select array_agg(x) from jsonb_array_elements_text(p_settings -> 'suppliers') x), suppliers),
    calendar_tool            = coalesce(p_settings ->> 'calendar_tool', calendar_tool),
    invoicing_tool           = coalesce(p_settings ->> 'invoicing_tool', invoicing_tool),
    signature                = coalesce(p_settings ->> 'signature', signature)
  where business_id = v_business.id;

  return v_business;
end $$;

revoke all on function public.create_business(text, text, jsonb, jsonb) from public;
grant execute on function public.create_business(text, text, jsonb, jsonb) to authenticated;
