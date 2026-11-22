-- TRCK Gym database. Run once in a NEW Supabase project: SQL Editor, New query, paste all of this, Run.
-- Safe to read top to bottom: tables, then who can see what, then the actions the app is allowed to take.
-- Money is whole rupees (integers). Dates are calendar dates in the gym's time zone.
-- Rules that matter:
--   * Every row carries gym_id, so a second gym later is a new row, not a rebuild.
--   * New members never get table access. They submit the join form through submit_join_request().
--   * Clients never read tables directly. They read their own membership through my_home().
--   * Memberships and payments are only written through functions, each in one transaction.
--   * Nothing is deleted. Payments are voided with a reason, memberships are cancelled, clients archived.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(name) between 1 and 80),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  address text check (length(address) <= 200),
  time_zone text not null default 'Asia/Kolkata',
  templates jsonb not null default '{}'::jsonb check (jsonb_typeof(templates) = 'object'),
  join_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id uuid references auth.users (id) on delete set null,
  role text not null check (role in ('owner', 'staff')),
  name text check (length(name) <= 80),
  created_at timestamptz not null default now(),
  unique (gym_id, email)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  name text not null check (length(name) between 1 and 40),
  months int not null default 0 check (months between 0 and 36),
  days int not null default 0 check (days between 0 and 366),
  price int not null check (price between 0 and 1000000),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  check (months > 0 or days > 0)
);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  full_name text not null check (length(full_name) between 2 and 80),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (email = lower(email) and length(email) <= 120)),
  dob date,
  gender text check (length(gender) <= 20),
  goal text check (length(goal) <= 40),
  emergency_name text check (length(emergency_name) <= 80),
  emergency_phone text check (emergency_phone is null or emergency_phone ~ '^\+[1-9][0-9]{7,14}$'),
  source text check (length(source) <= 80),
  plan_interest uuid references public.plans (id),
  health jsonb not null default '{}'::jsonb,
  health_flag boolean not null default false,
  health_note text check (length(health_note) <= 300),
  consent_terms boolean not null check (consent_terms),
  consent_whatsapp boolean not null default false,
  client_id uuid,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  reject_reason text check (length(reject_reason) <= 200),
  created_at timestamptz not null default now()
);
create index join_requests_gym_status on public.join_requests (gym_id, status, created_at desc);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null check (length(full_name) between 2 and 80),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (email = lower(email) and length(email) <= 120)),
  dob date,
  gender text check (length(gender) <= 20),
  goal text check (length(goal) <= 40),
  emergency_name text check (length(emergency_name) <= 80),
  emergency_phone text check (emergency_phone is null or emergency_phone ~ '^\+[1-9][0-9]{7,14}$'),
  source text check (length(source) <= 80),
  health jsonb not null default '{}'::jsonb,
  health_flag boolean not null default false,
  health_note text check (length(health_note) <= 300),
  consent_whatsapp boolean not null default false,
  notes text check (length(notes) <= 2000),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, phone)
);
create index clients_email on public.clients (lower(email));
create index clients_user on public.clients (user_id);
alter table public.join_requests add constraint join_requests_client_fk foreign key (client_id) references public.clients (id);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  client_id uuid not null references public.clients (id),
  plan_id uuid references public.plans (id),
  plan_name text not null check (length(plan_name) between 1 and 40),
  start_date date not null,
  end_date date not null,
  price int not null check (price between 0 and 1000000),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  note text check (length(note) <= 300),
  cancel_reason text check (length(cancel_reason) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index memberships_client on public.memberships (client_id, end_date desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  receipt_no bigint generated always as identity unique,
  gym_id uuid not null references public.gyms (id),
  client_id uuid not null references public.clients (id),
  membership_id uuid references public.memberships (id),
  amount int not null check (amount between 1 and 1000000),
  method text not null check (method in ('cash', 'upi', 'card', 'bank', 'other')),
  paid_on date not null,
  note text check (length(note) <= 300),
  voided boolean not null default false,
  void_reason text check (length(void_reason) <= 200),
  voided_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index payments_client on public.payments (client_id, paid_on desc);
create index payments_gym_date on public.payments (gym_id, paid_on desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  client_id uuid references public.clients (id),
  request_id uuid references public.join_requests (id),
  kind text not null check (length(kind) <= 40),
  channel text not null check (channel in ('copy', 'whatsapp')),
  body text not null check (length(body) <= 2000),
  sent_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index messages_client on public.messages (client_id, created_at desc);

-- Analytics and errors live here so there is no outside tracking service. Owners read them on the Insights screen.
create table public.events (
  id bigint generated always as identity primary key,
  gym_id uuid references public.gyms (id),
  name text not null,
  props jsonb not null default '{}'::jsonb,
  user_id uuid,
  anon_id text check (length(anon_id) <= 40),
  created_at timestamptz not null default now()
);
create index events_gym_time on public.events (gym_id, created_at desc);

create table public.app_errors (
  id bigint generated always as identity primary key,
  gym_id uuid references public.gyms (id),
  message text not null,
  stack text,
  url text,
  user_agent text,
  app_version text,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index app_errors_time on public.app_errors (created_at desc);

create table public.activity (
  id bigint generated always as identity primary key,
  gym_id uuid,
  actor uuid,
  action text not null,
  table_name text not null,
  row_id uuid,
  data jsonb,
  created_at timestamptz not null default now()
);
create index activity_gym_time on public.activity (gym_id, created_at desc);

-- ---------------------------------------------------------------- helpers

create function public.is_staff(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where gym_id = g and user_id = auth.uid())
$$;

create function public.is_owner(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where gym_id = g and user_id = auth.uid() and role = 'owner')
$$;

create function public.gym_today(g uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select time_zone from gyms where id = g), 'Asia/Kolkata'))::date
$$;

-- A plan of 1 month from 15 Jan ends 14 Feb. A 7 day trial from 1 Mar ends 7 Mar.
-- Month adding clamps, so 1 month from 31 Jan ends 27 Feb (28 Feb minus one day). The app mirrors this exactly.
create function public.membership_end(start_date date, months int, days int) returns date
language sql immutable as $$
  select ((start_date + make_interval(months => months))::date + days - 1)
$$;

create function public.clean_text(v text, max_len int) returns text
language sql immutable as $$
  select nullif(left(btrim(regexp_replace(coalesce(v, ''), '\s+', ' ', 'g')), max_len), '')
$$;

create function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();

create function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into activity (gym_id, actor, action, table_name, row_id, data)
  values ((r->>'gym_id')::uuid, auth.uid(), lower(tg_op), tg_table_name, (r->>'id')::uuid, r);
  return coalesce(new, old);
end $$;
create trigger clients_activity after insert or update on public.clients for each row execute function public.log_activity();
create trigger memberships_activity after insert or update on public.memberships for each row execute function public.log_activity();
create trigger payments_activity after insert or update on public.payments for each row execute function public.log_activity();
create trigger requests_activity after insert or update on public.join_requests for each row execute function public.log_activity();
create trigger plans_activity after insert or update or delete on public.plans for each row execute function public.log_activity();
create trigger staff_activity after insert or update or delete on public.staff for each row execute function public.log_activity();

-- The gym's main owner (the first owner, made by setup_gym) cannot be removed or demoted from the app.
create function public.protect_first_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare first_id uuid;
begin
  select id into first_id from staff where gym_id = old.gym_id and role = 'owner' order by created_at, id limit 1;
  if old.id = first_id and (tg_op = 'DELETE' or new.role <> 'owner' or new.email <> old.email) then
    raise exception 'The main owner cannot be removed or changed here.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger staff_protect before update or delete on public.staff for each row execute function public.protect_first_owner();

-- ---------------------------------------------------------------- who can see what

alter table public.gyms enable row level security;
alter table public.staff enable row level security;
alter table public.plans enable row level security;
alter table public.join_requests enable row level security;
alter table public.clients enable row level security;
alter table public.memberships enable row level security;
alter table public.payments enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;
alter table public.app_errors enable row level security;
alter table public.activity enable row level security;

-- Anyone not signed in gets no table access at all. They use join_info() and submit_join_request().
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

create policy gyms_read on public.gyms for select to authenticated using (is_staff(id));
create policy gyms_owner_update on public.gyms for update to authenticated using (is_owner(id)) with check (is_owner(id));

create policy staff_read on public.staff for select to authenticated using (is_staff(gym_id));
create policy staff_owner_insert on public.staff for insert to authenticated with check (is_owner(gym_id));
create policy staff_owner_update on public.staff for update to authenticated using (is_owner(gym_id)) with check (is_owner(gym_id));
create policy staff_owner_delete on public.staff for delete to authenticated using (is_owner(gym_id));

create policy plans_read on public.plans for select to authenticated using (is_staff(gym_id));
create policy plans_owner_insert on public.plans for insert to authenticated with check (is_owner(gym_id));
create policy plans_owner_update on public.plans for update to authenticated using (is_owner(gym_id)) with check (is_owner(gym_id));

create policy requests_read on public.join_requests for select to authenticated using (is_staff(gym_id));

create policy clients_read on public.clients for select to authenticated using (is_staff(gym_id));
create policy clients_insert on public.clients for insert to authenticated with check (is_staff(gym_id) and user_id is null);
create policy clients_update on public.clients for update to authenticated using (is_staff(gym_id)) with check (is_staff(gym_id));

create policy memberships_read on public.memberships for select to authenticated using (is_staff(gym_id));
create policy payments_read on public.payments for select to authenticated using (is_staff(gym_id));

create policy messages_read on public.messages for select to authenticated using (is_staff(gym_id));
create policy messages_insert on public.messages for insert to authenticated with check (is_staff(gym_id) and sent_by = auth.uid());

create policy events_owner_read on public.events for select to authenticated using (is_owner(gym_id));
create policy errors_owner_read on public.app_errors for select to authenticated
  using (exists (select 1 from staff where user_id = auth.uid() and role = 'owner'));
create policy activity_owner_read on public.activity for select to authenticated using (is_owner(gym_id));

-- Staff may only change a client's details, never who the client's account is.
revoke update on public.clients from authenticated;
grant update (full_name, phone, email, dob, gender, goal, emergency_name, emergency_phone, source, health_note,
  consent_whatsapp, notes, archived) on public.clients to authenticated;
revoke update on public.staff from authenticated;
grant update (role, name) on public.staff to authenticated;
revoke update on public.gyms from authenticated;
grant update (name, phone, address, templates, join_open) on public.gyms to authenticated;

-- ---------------------------------------------------------------- actions

-- Every function starts closed. The grants at the end open exactly the ones each kind of person needs.

-- Run by Aditya in the SQL editor, never from the app. Makes the gym, its first owner and three starter plans.
create function public.setup_gym(p_slug text, p_name text, p_owner_email text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  insert into gyms (slug, name, phone) values (lower(p_slug), p_name, p_phone) returning id into g;
  insert into staff (gym_id, email, role, name) values (g, lower(btrim(p_owner_email)), 'owner', 'Owner');
  insert into plans (gym_id, name, months, days, price, sort) values
    (g, 'Monthly', 1, 0, 1500, 1), (g, 'Quarterly', 3, 0, 4000, 2), (g, 'Half year', 6, 0, 7000, 3), (g, 'Yearly', 12, 0, 12000, 4);
  return g;
end $$;

-- What the public join page needs: the gym's name and whether it is taking requests. Nothing private.
create function public.join_info(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', g.name, 'open', g.join_open,
    'plans', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'price', p.price, 'months', p.months, 'days', p.days) order by p.sort, p.price)
      from plans p where p.gym_id = g.id and p.active), '[]'::jsonb))
  from gyms g where g.slug = lower(p_slug)
$$;

-- The public join form. Validates everything again here, because the browser can be bypassed.
-- Sending the same phone twice while a request is still waiting returns the first request, so a double tap is harmless.
create function public.submit_join_request(p_slug text, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  g gyms%rowtype;
  existing uuid;
  rid uuid;
  v_phone text := btrim(coalesce(p->>'phone', ''));
  v_email text := lower(clean_text(p->>'email', 120));
  v_emph text := clean_text(p->>'emergency_phone', 16);
  v_dob date;
  v_health jsonb := coalesce(p->'health', '{}'::jsonb);
  v_plan uuid;
begin
  select * into g from gyms where slug = lower(p_slug);
  if not found then raise exception 'This join link is not valid.' using errcode = 'P0001'; end if;
  if not g.join_open then raise exception 'This gym is not taking new requests right now.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p) <> 'object' or length(p::text) > 5000 then raise exception 'The form is too long.' using errcode = 'P0001'; end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Check the phone number.' using errcode = 'P0001'; end if;
  if v_emph is not null and v_emph !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Check the emergency contact number.' using errcode = 'P0001'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Check the email address.' using errcode = 'P0001'; end if;
  if coalesce(length(clean_text(p->>'full_name', 80)), 0) < 2 then raise exception 'Add your full name.' using errcode = 'P0001'; end if;
  if coalesce((p->>'consent_terms')::boolean, false) is not true then raise exception 'Please agree to the gym terms.' using errcode = 'P0001'; end if;
  if jsonb_typeof(v_health) <> 'object' or (select count(*) from jsonb_object_keys(v_health)) > 12
     or exists (select 1 from jsonb_each(v_health) e where jsonb_typeof(e.value) <> 'boolean' or length(e.key) > 40) then
    raise exception 'The health answers are not valid.' using errcode = 'P0001';
  end if;
  begin
    v_dob := nullif(p->>'dob', '')::date;
  exception when others then raise exception 'Check the date of birth.' using errcode = 'P0001';
  end;
  if v_dob is not null and (v_dob < date '1920-01-01' or v_dob > gym_today(g.id) - interval '10 years') then
    raise exception 'Check the date of birth.' using errcode = 'P0001';
  end if;
  begin
    v_plan := nullif(p->>'plan_interest', '')::uuid;
  exception when others then v_plan := null;
  end;
  if v_plan is not null and not exists (select 1 from plans where id = v_plan and gym_id = g.id) then v_plan := null; end if;

  select id into existing from join_requests where gym_id = g.id and phone = v_phone and status = 'pending' limit 1;
  if existing is not null then return existing; end if;
  if (select count(*) from join_requests where gym_id = g.id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many requests right now. Try again in an hour, or ask at the front desk.' using errcode = 'P0001';
  end if;

  insert into join_requests (gym_id, full_name, phone, email, dob, gender, goal, emergency_name, emergency_phone, source,
    plan_interest, health, health_flag, health_note, consent_terms, consent_whatsapp)
  values (g.id, clean_text(p->>'full_name', 80), v_phone, v_email, v_dob, clean_text(p->>'gender', 20), clean_text(p->>'goal', 40),
    clean_text(p->>'emergency_name', 80), v_emph, clean_text(p->>'source', 80), v_plan, v_health,
    exists (select 1 from jsonb_each(v_health) e where e.value = 'true'::jsonb), clean_text(p->>'health_note', 300),
    true, coalesce((p->>'consent_whatsapp')::boolean, false))
  returning id into rid;
  return rid;
end $$;

-- Who the signed in person is. Links an invited staff email, or a client record with the same verified email.
-- Returns {role: 'owner'|'staff'|'client'|null, gym_id, client_id, email, ambiguous}.
create function public.whoami() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_email text;
  verified boolean;
  s staff%rowtype;
  c_id uuid;
  c_gym uuid;
  n int;
begin
  if uid is null then return jsonb_build_object('role', null); end if;
  select lower(email), email_confirmed_at is not null into v_email, verified from auth.users where id = uid;
  if v_email is null or not verified then
    return jsonb_build_object('role', null, 'email', v_email);
  end if;

  update staff set user_id = uid where email = v_email and user_id is null;
  select * into s from staff where user_id = uid order by (role = 'owner') desc, created_at limit 1;
  if found then return jsonb_build_object('role', s.role, 'gym_id', s.gym_id, 'email', v_email); end if;

  select id, gym_id into c_id, c_gym from clients where user_id = uid and not archived order by created_at desc limit 1;
  if c_id is null then
    select count(*) into n from clients where lower(email) = v_email and user_id is null and not archived;
    if n = 1 then
      update clients set user_id = uid where lower(email) = v_email and user_id is null and not archived returning id, gym_id into c_id, c_gym;
    elsif n > 1 then
      return jsonb_build_object('role', null, 'email', v_email, 'ambiguous', true);
    end if;
  end if;
  if c_id is not null then return jsonb_build_object('role', 'client', 'gym_id', c_gym, 'client_id', c_id, 'email', v_email); end if;
  return jsonb_build_object('role', null, 'email', v_email);
end $$;

-- A client's own page: their details, plans and payments, and how to reach the gym. Staff notes and health answers stay out.
create function public.my_home() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'client', jsonb_build_object('id', c.id, 'full_name', c.full_name, 'phone', c.phone, 'email', c.email),
    'gym', jsonb_build_object('name', g.name, 'phone', g.phone, 'address', g.address, 'today', gym_today(g.id)),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'plan_name', m.plan_name, 'start_date', m.start_date,
        'end_date', m.end_date, 'price', m.price, 'status', m.status) order by m.end_date desc)
      from memberships m where m.client_id = c.id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'receipt_no', p.receipt_no, 'membership_id', p.membership_id,
        'amount', p.amount, 'method', p.method, 'paid_on', p.paid_on) order by p.paid_on desc, p.receipt_no desc)
      from payments p where p.client_id = c.id and not p.voided), '[]'::jsonb))
  from clients c join gyms g on g.id = c.gym_id
  where c.user_id = auth.uid() and not c.archived
  order by c.created_at desc limit 1
$$;

-- Shared by approve and renew: adds a membership and, if money was taken, its payment.
create function public.add_membership_core(p_gym uuid, p_client uuid, p_plan uuid, p_start date, p_price int,
  p_paid int, p_method text, p_paid_on date, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pl plans%rowtype;
  mid uuid;
  pid uuid;
begin
  select * into pl from plans where id = p_plan and gym_id = p_gym;
  if not found then raise exception 'Pick a plan.' using errcode = 'P0001'; end if;
  if p_start is null then raise exception 'Pick a start date.' using errcode = 'P0001'; end if;
  if p_price is null or p_price < 0 then raise exception 'Check the price.' using errcode = 'P0001'; end if;
  if coalesce(p_paid, 0) < 0 then raise exception 'Check the amount paid.' using errcode = 'P0001'; end if;
  if coalesce(p_paid, 0) > p_price then raise exception 'Amount paid is more than the price.' using errcode = 'P0001'; end if;
  insert into memberships (gym_id, client_id, plan_id, plan_name, start_date, end_date, price, note, created_by)
  values (p_gym, p_client, pl.id, pl.name, p_start, membership_end(p_start, pl.months, pl.days), p_price, clean_text(p_note, 300), auth.uid())
  returning id into mid;
  if coalesce(p_paid, 0) > 0 then
    if p_method is null or p_method not in ('cash', 'upi', 'card', 'bank', 'other') then raise exception 'Pick how they paid.' using errcode = 'P0001'; end if;
    insert into payments (gym_id, client_id, membership_id, amount, method, paid_on, created_by)
    values (p_gym, p_client, mid, p_paid, p_method, coalesce(p_paid_on, gym_today(p_gym)), auth.uid())
    returning id into pid;
  end if;
  return jsonb_build_object('client_id', p_client, 'membership_id', mid, 'payment_id', pid);
end $$;

-- Owner or staff approves a join request: makes (or reuses, by phone) the client, starts the plan, records any payment.
create function public.approve_join_request(p_request uuid, p_plan uuid, p_start date, p_price int,
  p_paid int default 0, p_method text default null, p_paid_on date default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r join_requests%rowtype;
  cid uuid;
  res jsonb;
begin
  select * into r from join_requests where id = p_request for update;
  if not found or not is_staff(r.gym_id) then raise exception 'Request not found.' using errcode = 'P0001'; end if;
  if r.status <> 'pending' then raise exception 'This request was already handled.' using errcode = 'P0001'; end if;

  select id into cid from clients where gym_id = r.gym_id and phone = r.phone;
  if cid is null then
    insert into clients (gym_id, full_name, phone, email, dob, gender, goal, emergency_name, emergency_phone, source,
      health, health_flag, health_note, consent_whatsapp)
    values (r.gym_id, r.full_name, r.phone, r.email, r.dob, r.gender, r.goal, r.emergency_name, r.emergency_phone, r.source,
      r.health, r.health_flag, r.health_note, r.consent_whatsapp)
    returning id into cid;
  else
    -- Returning member: fill gaps and refresh health answers and consent, keep everything staff already wrote.
    update clients set
      email = coalesce(email, r.email), dob = coalesce(dob, r.dob), gender = coalesce(gender, r.gender), goal = coalesce(r.goal, goal),
      emergency_name = coalesce(r.emergency_name, emergency_name), emergency_phone = coalesce(r.emergency_phone, emergency_phone),
      health = r.health, health_flag = r.health_flag, health_note = r.health_note, consent_whatsapp = r.consent_whatsapp, archived = false
    where id = cid;
  end if;

  res := add_membership_core(r.gym_id, cid, p_plan, p_start, p_price, p_paid, p_method, p_paid_on, p_note);
  update join_requests set status = 'approved', client_id = cid, decided_by = auth.uid(), decided_at = now() where id = r.id;
  return res;
end $$;

create function public.reject_join_request(p_request uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r join_requests%rowtype;
begin
  select * into r from join_requests where id = p_request for update;
  if not found or not is_staff(r.gym_id) then raise exception 'Request not found.' using errcode = 'P0001'; end if;
  if r.status <> 'pending' then raise exception 'This request was already handled.' using errcode = 'P0001'; end if;
  update join_requests set status = 'rejected', reject_reason = clean_text(p_reason, 200), decided_by = auth.uid(), decided_at = now() where id = r.id;
end $$;

-- Renew or start a new plan for an existing client.
create function public.add_membership(p_client uuid, p_plan uuid, p_start date, p_price int,
  p_paid int default 0, p_method text default null, p_paid_on date default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  select gym_id into g from clients where id = p_client;
  if g is null or not is_staff(g) then raise exception 'Client not found.' using errcode = 'P0001'; end if;
  return add_membership_core(g, p_client, p_plan, p_start, p_price, p_paid, p_method, p_paid_on, p_note);
end $$;

-- Money in against a plan (or with no plan, for extras). A plan cannot be paid more than its price.
create function public.add_payment(p_client uuid, p_membership uuid, p_amount int, p_method text,
  p_paid_on date default null, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  g uuid;
  m memberships%rowtype;
  already int;
  pid uuid;
begin
  select gym_id into g from clients where id = p_client;
  if g is null or not is_staff(g) then raise exception 'Client not found.' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'Check the amount.' using errcode = 'P0001'; end if;
  if p_method is null or p_method not in ('cash', 'upi', 'card', 'bank', 'other') then raise exception 'Pick how they paid.' using errcode = 'P0001'; end if;
  if p_membership is not null then
    select * into m from memberships where id = p_membership and client_id = p_client for update;
    if not found then raise exception 'Plan not found.' using errcode = 'P0001'; end if;
    select coalesce(sum(amount), 0) into already from payments where membership_id = m.id and not voided;
    if already + p_amount > m.price then
      raise exception 'That is more than what is due on this plan (Rs %).', m.price - already using errcode = 'P0001';
    end if;
  end if;
  insert into payments (gym_id, client_id, membership_id, amount, method, paid_on, note, created_by)
  values (g, p_client, p_membership, p_amount, p_method, coalesce(p_paid_on, gym_today(g)), clean_text(p_note, 300), auth.uid())
  returning id into pid;
  return pid;
end $$;

create function public.void_payment(p_payment uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare p payments%rowtype;
begin
  select * into p from payments where id = p_payment for update;
  if not found or not is_owner(p.gym_id) then raise exception 'Only the owner can void a payment.' using errcode = 'P0001'; end if;
  if p.voided then return; end if;
  if clean_text(p_reason, 200) is null then raise exception 'Say why it is being voided.' using errcode = 'P0001'; end if;
  update payments set voided = true, void_reason = clean_text(p_reason, 200), voided_by = auth.uid(), voided_at = now() where id = p.id;
end $$;

create function public.cancel_membership(p_membership uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare m memberships%rowtype;
begin
  select * into m from memberships where id = p_membership for update;
  if not found or not is_owner(m.gym_id) then raise exception 'Only the owner can cancel a plan.' using errcode = 'P0001'; end if;
  if clean_text(p_reason, 200) is null then raise exception 'Say why it is being cancelled.' using errcode = 'P0001'; end if;
  update memberships set status = 'cancelled', cancel_reason = clean_text(p_reason, 200) where id = m.id;
end $$;

-- Usage events from the app. Anyone may send join page events, signed in staff and clients may send the rest.
-- Unknown names are dropped, and a flood is capped, so this can never fill the free database.
create function public.track(p_name text, p_props jsonb default '{}'::jsonb, p_slug text default null, p_anon text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  g uuid;
  public_names text[] := array['join_viewed', 'join_step', 'join_submitted', 'join_failed'];
  signed_names text[] := array['signed_in', 'request_approved', 'request_rejected', 'membership_added', 'payment_added',
    'message_copied', 'message_opened', 'client_added', 'client_home_viewed', 'join_link_copied', 'backup_downloaded'];
begin
  if p_name = any (public_names) then
    select id into g from gyms where slug = lower(p_slug);
  elsif p_name = any (signed_names) and auth.uid() is not null then
    select gym_id into g from staff where user_id = auth.uid() limit 1;
    if g is null then select gym_id into g from clients where user_id = auth.uid() limit 1; end if;
  else
    return;
  end if;
  if g is null then return; end if;
  if p_props is null or jsonb_typeof(p_props) <> 'object' or length(p_props::text) > 1000 then p_props := '{}'::jsonb; end if;
  if (select count(*) from events where gym_id = g and created_at > now() - interval '1 hour') >= 2000 then return; end if;
  insert into events (gym_id, name, props, user_id, anon_id) values (g, p_name, p_props, auth.uid(), left(p_anon, 40));
end $$;

-- Crashes and failed requests from the app, for the owner's Insights screen and for debugging with Claude.
create function public.log_error(p_message text, p_stack text default null, p_url text default null,
  p_user_agent text default null, p_version text default null) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if (select count(*) from app_errors where created_at > now() - interval '1 hour') >= 200 then return; end if;
  if auth.uid() is not null then select gym_id into g from staff where user_id = auth.uid() limit 1; end if;
  insert into app_errors (gym_id, message, stack, url, user_agent, app_version, user_id)
  values (g, left(coalesce(p_message, 'unknown'), 500), left(p_stack, 4000), left(p_url, 300), left(p_user_agent, 300), left(p_version, 40), auth.uid());
end $$;

-- Event counts for the Insights screen, for the last p_days days.
create function public.insights(p_gym uuid, p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_owner(p_gym) then raise exception 'Only the owner can see insights.' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'counts', coalesce((select jsonb_object_agg(name, n) from (
      select name, count(*) n from events where gym_id = p_gym and created_at > now() - make_interval(days => least(greatest(p_days, 1), 365)) group by name) x), '{}'::jsonb),
    'visitors', (select count(distinct anon_id) from events where gym_id = p_gym and name = 'join_viewed'
      and created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))),
    'errors', coalesce((select jsonb_agg(e order by e.created_at desc) from (
      select id, message, url, app_version, created_at from app_errors where gym_id = p_gym or gym_id is null
      order by created_at desc limit 20) e), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- function access

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.join_info(text), public.submit_join_request(text, jsonb),
  public.track(text, jsonb, text, text), public.log_error(text, text, text, text, text) to anon, authenticated;
grant execute on function public.is_staff(uuid), public.is_owner(uuid), public.gym_today(uuid), public.membership_end(date, int, int),
  public.whoami(), public.my_home(), public.approve_join_request(uuid, uuid, date, int, int, text, date, text),
  public.reject_join_request(uuid, text), public.add_membership(uuid, uuid, date, int, int, text, date, text),
  public.add_payment(uuid, uuid, int, text, date, text), public.void_payment(uuid, text), public.cancel_membership(uuid, text),
  public.insights(uuid, int) to authenticated;
-- setup_gym and add_membership_core stay closed: setup is run by hand in the SQL editor, core only from inside approve and renew.
