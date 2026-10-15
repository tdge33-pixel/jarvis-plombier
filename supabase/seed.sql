-- =============================================================================
-- Données de démonstration : « Martin Plomberie » (Thomas Martin, Bordeaux).
-- Usage (SQL editor Supabase, après avoir créé l'utilisateur via l'inscription) :
--   select public.seed_demo_business('<uuid de l''utilisateur>');
-- Les dates sont relatives au jour courant. Équivalent TS : src/lib/data/demo/seed.ts
-- =============================================================================

create or replace function public.seed_demo_business(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  b uuid := gen_random_uuid();
  tz text := 'Europe/Paris';
  d date := current_date;
  tomorrow date := case when extract(isodow from current_date + 1) = 7 then current_date + 2 else current_date + 1 end;
  c_dupont uuid := gen_random_uuid();
  c_martin uuid := gen_random_uuid();
  c_bernard uuid := gen_random_uuid();
  c_lefevre uuid := gen_random_uuid();
  c_garcia uuid := gen_random_uuid();
  c_moreau uuid := gen_random_uuid();
  q_dupont uuid := gen_random_uuid();
  q_martin uuid := gen_random_uuid();
  q_garcia uuid := gen_random_uuid();
  q_bernard uuid := gen_random_uuid();
begin
  if exists (select 1 from business_members where user_id = p_user) then
    raise exception 'Cet utilisateur appartient déjà à une entreprise';
  end if;

  update profiles set first_name = 'Thomas', last_name = 'Martin', phone = '06 12 34 56 78' where id = p_user;

  insert into businesses (id, name, vertical, phone, email, address, postal_code, city, siret, works_alone, team_size, zone_radius_km, is_demo, onboarded_at)
  values (b, 'Martin Plomberie', 'plombier', '06 12 34 56 78', 'thomas@martin-plomberie.fr', '8 rue des Artisans', '33000', 'Bordeaux', '123 456 789 00012', true, 1, 30, true, now());
  insert into business_members (business_id, user_id, role) values (b, p_user, 'owner');
  insert into business_settings (business_id, hourly_rate, travel_fee, vat_rate, work_start, work_end, working_days, emergencies_accepted, emergency_until,
                                 max_appointments_per_day, services, refused_services, suppliers, calendar_tool, invoicing_tool, signature)
  values (b, 65, 35, 10, '08:00', '18:00', '{1,2,3,4,5,6}', true, '20:00', 5,
          '{"Recherche de fuite","Débouchage","Chauffe-eau","Robinetterie","Salle de bain","WC"}', '{"Chauffage au fioul","Climatisation"}',
          '{"Cedeo Bordeaux Lac","Point P Mérignac"}', 'Google Agenda', 'Excel', 'Thomas');

  -- Clients
  insert into clients (id, business_id, civility, first_name, last_name, phone, email, address, postal_code, city, lat, lng, notes, important_info) values
    (c_dupont,  b, 'Mme', 'Sylvie', 'Dupont',  '06 21 43 65 87', 'sylvie.dupont@email.fr', '14 avenue Jean Jaurès', '33150', 'Cenon',    44.8578, -0.5317, 'Maison avec sous-sol. Chauffe-eau 200 L de 2009.', 'Code portail : 1234B'),
    (c_martin,  b, 'Mme', 'Claire', 'Martin',  '06 98 76 54 32', 'claire.martin@email.fr', '12 rue Sainte-Catherine', '33000', 'Bordeaux', 44.8378, -0.5736, 'Appartement 3e étage sans ascenseur.', 'Cliente disponible de préférence le matin.'),
    (c_bernard, b, 'M.',  'Paul',   'Bernard', '07 11 22 33 44', 'paul.bernard@email.fr',  '5 rue du Port',          '33310', 'Lormont',  44.8792, -0.5217, 'Problème de pression récurrent.', null),
    (c_lefevre, b, 'M.',  'Julien', 'Lefèvre', '06 55 44 33 22', null,                     '27 cours de la Libération', '33400', 'Talence', 44.8025, -0.5886, null, null),
    (c_garcia,  b, 'Mme', 'Ana',    'Garcia',  '06 77 88 99 00', 'ana.garcia@email.fr',    '3 allée des Pins',       '33700', 'Mérignac', 44.8386, -0.6436, 'Projet de rénovation salle de bain.', 'Préfère être contactée par SMS.'),
    (c_moreau,  b, 'M.',  'Henri',  'Moreau',  '05 56 12 34 56', null,                     '40 rue Carnot',          '33130', 'Bègles',   44.8086, -0.5478, 'Client fidèle depuis 2019.', null);

  insert into client_notes (business_id, client_id, content, created_by, created_at) values
    (b, c_martin, 'Robinet cuisine Grohe remplacé, ancien joint très entartré.', p_user, now() - interval '30 days'),
    (b, c_dupont, 'Chauffe-eau en fin de vie, devis de remplacement à proposer.', p_user, now() - interval '60 days');

  -- Interventions (heure locale → timestamptz)
  insert into appointments (business_id, client_id, title, intervention_type, start_at, duration_minutes, address, city, status, notes) values
    (b, c_dupont,  'Détartrage chauffe-eau', 'Détartrage chauffe-eau', ((d - 60) + time '09:00') at time zone tz, 120, '14 avenue Jean Jaurès', 'Cenon', 'done', 'Chauffe-eau vieillissant, prévoir remplacement.'),
    (b, c_martin,  'Remplacement robinet cuisine', 'Remplacement robinet cuisine', ((d - 30) + time '10:00') at time zone tz, 90, '12 rue Sainte-Catherine', 'Bordeaux', 'done', 'Robinet Grohe posé. Cliente satisfaite.'),
    (b, c_bernard, 'Recherche de fuite', 'Recherche de fuite', ((d - 12) + time '14:00') at time zone tz, 60, '5 rue du Port', 'Lormont', 'done', 'Fuite sur raccord sous l''évier, réparée.'),
    (b, c_lefevre, 'Débouchage', 'Débouchage', ((d - 20) + time '18:30') at time zone tz, 60, '27 cours de la Libération', 'Talence', 'cancelled', 'Annulé : créneau trop tardif.'),
    (b, c_garcia,  'Visite technique', 'Visite technique', ((d - 15) + time '19:00') at time zone tz, 60, '3 allée des Pins', 'Mérignac', 'cancelled', 'Annulé : reporté au matin.'),
    (b, c_moreau,  'Fuite chasse d''eau', 'Fuite chasse d''eau', ((d - 8) + time '18:30') at time zone tz, 45, '40 rue Carnot', 'Bègles', 'cancelled', 'Annulé : trop tard dans la journée.'),
    (b, c_martin,  'Fuite sous évier', 'Fuite sous évier', (tomorrow + time '08:30') at time zone tz, 60, '12 rue Sainte-Catherine', 'Bordeaux', 'confirmed', null),
    (b, c_dupont,  'Remplacement chauffe-eau', 'Remplacement chauffe-eau', (tomorrow + time '11:00') at time zone tz, 180, '14 avenue Jean Jaurès', 'Cenon', 'confirmed', 'Chauffe-eau Atlantic 200 L à récupérer chez Cedeo.'),
    (b, c_bernard, 'Diagnostic pression', 'Diagnostic pression', (tomorrow + time '15:30') at time zone tz, 60, '5 rue du Port', 'Lormont', 'to_confirm', null),
    (b, c_moreau,  'Remplacement WC', 'Remplacement WC', ((d + 3) + time '10:00') at time zone tz, 120, '40 rue Carnot', 'Bègles', 'confirmed', null);

  -- Devis
  insert into quotes (id, business_id, client_id, number, title, description, status, vat_rate, total_ht, total_vat, total_ttc, valid_until, sent_at, created_at) values
    (q_martin,  b, c_martin,  'D-' || extract(year from d) || '-012', 'Remplacement robinet cuisine', null, 'accepted', 10, 277.50, 27.75, 305.25, d - 5, now() - interval '34 days', now() - interval '35 days'),
    (q_dupont,  b, c_dupont,  'D-' || extract(year from d) || '-014', 'Remplacement chauffe-eau 200 L', 'Dépose de l''ancien chauffe-eau, fourniture et pose d''un chauffe-eau électrique Atlantic 200 L, mise en service.', 'sent', 10, 963.00, 96.30, 1059.30, d + 18, now() - interval '11 days', now() - interval '12 days'),
    (q_garcia,  b, c_garcia,  'D-' || extract(year from d) || '-015', 'Remplacement baignoire par douche', null, 'sent', 10, 1560.00, 156.00, 1716.00, d + 25, now() - interval '4 days', now() - interval '5 days'),
    (q_bernard, b, c_bernard, 'D-' || extract(year from d) || '-016', 'Remplacement réducteur de pression', null, 'draft', 10, 217.50, 21.75, 239.25, d + 28, null, now() - interval '2 days');
  insert into quote_items (business_id, quote_id, kind, label, quantity, unit_price, position) values
    (b, q_martin, 'material', 'Mitigeur évier Grohe', 1, 145, 0), (b, q_martin, 'labor', 'Main-d''œuvre', 1.5, 65, 1), (b, q_martin, 'travel', 'Déplacement', 1, 35, 2),
    (b, q_dupont, 'material', 'Chauffe-eau Atlantic 200 L', 1, 620, 0), (b, q_dupont, 'material', 'Groupe de sécurité + raccords', 1, 48, 1), (b, q_dupont, 'labor', 'Main-d''œuvre', 4, 65, 2), (b, q_dupont, 'travel', 'Déplacement', 1, 35, 3),
    (b, q_garcia, 'material', 'Receveur extra-plat 120×90', 1, 320, 0), (b, q_garcia, 'material', 'Colonne de douche thermostatique', 1, 260, 1), (b, q_garcia, 'labor', 'Main-d''œuvre', 14, 65, 2), (b, q_garcia, 'travel', 'Déplacement', 2, 35, 3),
    (b, q_bernard, 'material', 'Réducteur de pression 20/27', 1, 85, 0), (b, q_bernard, 'labor', 'Main-d''œuvre', 1.5, 65, 1), (b, q_bernard, 'travel', 'Déplacement', 1, 35, 2);

  -- Tâches
  insert into tasks (business_id, title, due_date, priority, status, client_id, quote_id, created_by, completed_at) values
    (b, 'Rappeler Mme Dupont pour le devis chauffe-eau', d, 'high', 'todo', c_dupont, q_dupont, 'user', null),
    (b, 'Commander le chauffe-eau de Mme Dupont chez Cedeo', d, 'high', 'todo', c_dupont, null, 'user', null),
    (b, 'Relancer le devis de M. Bernard', d - 2, 'normal', 'todo', c_bernard, q_bernard, 'user', null),
    (b, 'Vérifier la facture fournisseur Point P', d + 3, 'normal', 'todo', null, null, 'user', null),
    (b, 'Rappeler M. Moreau pour confirmer l''heure', d + 1, 'normal', 'todo', c_moreau, null, 'ai', null),
    (b, 'Envoyer les photos de la fuite à l''assurance de Mme Martin', d - 5, 'normal', 'done', c_martin, null, 'user', now() - interval '4 days');

  -- Mémoire
  insert into memories (business_id, category, section, content, source) values
    (b, 'BUSINESS_INFO', 'business',    'Zone d''intervention : 30 km autour de Bordeaux.', 'onboarding'),
    (b, 'BUSINESS_INFO', 'business',    'Horaires : 08h00 - 18h00, du lundi au samedi.', 'onboarding'),
    (b, 'BUSINESS_INFO', 'business',    'Urgences acceptées jusqu''à 20h.', 'onboarding'),
    (b, 'FACT',          'business',    'Je travaille seul, sans salarié.', 'onboarding'),
    (b, 'BUSINESS_INFO', 'pricing',     'Je facture 65 € HT / heure.', 'onboarding'),
    (b, 'BUSINESS_INFO', 'pricing',     'Déplacement : 35 €.', 'onboarding'),
    (b, 'RULE',          'rules',       'Je ne travaille pas le dimanche.', 'onboarding'),
    (b, 'RULE',          'rules',       'Je ne prends pas d''intervention à plus de 30 km après 17h.', 'user'),
    (b, 'RULE',          'rules',       'Ne jamais planifier plus de 5 interventions dans la même journée.', 'user'),
    (b, 'PREFERENCE',    'suppliers',   'Je préfère Atlantic pour les chauffe-eaux.', 'user'),
    (b, 'FACT',          'suppliers',   'Fournisseur principal : Cedeo Bordeaux Lac. Secondaire : Point P Mérignac.', 'onboarding'),
    (b, 'PREFERENCE',    'preferences', 'Je préfère regrouper les interventions par zone géographique.', 'user'),
    (b, 'PREFERENCE',    'habits',      'Je préfère conserver 30 minutes entre deux grosses interventions.', 'user'),
    (b, 'PREFERENCE',    'habits',      'Je signe mes messages « Thomas ».', 'onboarding');

  return b;
end $$;

revoke all on function public.seed_demo_business(uuid) from public, anon, authenticated;
