-- Access rule and action tests for the gym schema. Each block names the rule it proves.
-- Runs as postgres, switching role and signed in user the same way Supabase does for each request.
\set ON_ERROR_STOP 1
create schema t;
grant usage on schema t to anon, authenticated;
-- Runs a statement and passes only if it fails with a message containing `want`.
create function t.fails(stmt text, want text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'EXPECTED FAILURE did not happen: %', stmt;
exception when others then
  if sqlerrm like 'EXPECTED FAILURE%' then raise; end if;
  if position(lower(want) in lower(sqlerrm)) = 0 then raise exception 'wrong failure for %: % (wanted %)', stmt, sqlerrm, want; end if;
end $$;
grant execute on function t.fails(text, text) to anon, authenticated;
create function t.eq(got anyelement, want anyelement, what text) returns void language plpgsql as $$
begin if got is distinct from want then raise exception '% : got %, wanted %', what, got, want; end if; end $$;
grant execute on function t.eq(anyelement, anyelement, text) to anon, authenticated;

-- ------------------------------------------------ setup, as Aditya in the SQL editor
insert into auth.users values
  ('a0000000-0000-0000-0000-000000000001', 'owner@a.com', now()),
  ('a0000000-0000-0000-0000-000000000002', 'staff@a.com', now()),
  ('a0000000-0000-0000-0000-000000000003', 'owner@b.com', now()),
  ('a0000000-0000-0000-0000-000000000004', 'rohan@x.com', now()),
  ('a0000000-0000-0000-0000-000000000006', 'sneaky@x.com', null);
select setup_gym('forge', 'Forge Fitness', 'Owner@A.com', '+919800000000') as gym_a \gset
select setup_gym('other', 'Other Gym', 'owner@b.com') as gym_b \gset
insert into staff (gym_id, email, role, name) values (:'gym_a', 'staff@a.com', 'staff', 'Sam');
select id as monthly from plans where gym_id = :'gym_a' and name = 'Monthly' \gset
select id as plan_b from plans where gym_id = :'gym_b' and name = 'Monthly' \gset
select t.eq(membership_end('2026-01-15', 1, 0), date '2026-02-14', 'one month from 15 Jan');
select t.eq(membership_end('2026-01-31', 1, 0), date '2026-02-27', 'one month from 31 Jan clamps');
select t.eq(membership_end('2026-03-01', 0, 7), date '2026-03-07', 'seven day trial');
select t.eq(membership_end('2026-01-01', 12, 0), date '2026-12-31', 'one year');

-- ------------------------------------------------ public join form, not signed in
set request.jwt.claims = '';
set role anon;
select t.eq((join_info('FORGE')->>'name'), 'Forge Fitness', 'join_info finds the gym by slug');
select t.eq(jsonb_array_length(join_info('forge')->'plans'), 4, 'join_info lists active plans');
select t.eq(join_info('nope'), null::jsonb, 'unknown slug gives nothing');
select submit_join_request('forge', '{"full_name":"  Rohan   Mehta ","phone":"+919876543210","email":"Rohan@X.com","dob":"1996-03-14","consent_terms":true,"consent_whatsapp":true,"health":{"heart":false,"injury":true},"goal":"Build muscle"}') as req1 \gset
select t.eq(submit_join_request('forge', '{"full_name":"Rohan Mehta","phone":"+919876543210","consent_terms":true}'), :'req1'::uuid, 'second tap returns the same request');
select t.fails($$select submit_join_request('forge', '{"full_name":"A B","phone":"98765","consent_terms":true}')$$, 'phone number');
select t.fails($$select submit_join_request('forge', '{"full_name":"A B","phone":"+919111111111","consent_terms":false}')$$, 'terms');
select t.fails($$select submit_join_request('forge', '{"full_name":"A B","phone":"+919111111111","consent_terms":true,"dob":"2024-01-01"}')$$, 'date of birth');
select t.fails($$select submit_join_request('forge', '{"full_name":"A B","phone":"+919111111111","consent_terms":true,"health":{"x":"yes"}}')$$, 'health');
select t.fails($$select submit_join_request('nope', '{"full_name":"A B","phone":"+919111111111","consent_terms":true}')$$, 'not valid');
select t.fails($$select * from join_requests$$, 'permission denied');
select t.fails($$select * from clients$$, 'permission denied');
select t.fails($$select * from payments$$, 'permission denied');
select t.fails($$select whoami()$$, 'permission denied');
select t.fails($$select setup_gym('x1', 'X', 'x@x.com')$$, 'permission denied');
select track('join_viewed', '{"step":1}', 'forge', 'anon-1');
select track('payment_added', '{}', 'forge', 'anon-1'); -- not allowed for the public, silently dropped
reset role;
select t.eq((select count(*) from events where gym_id = :'gym_a'), 1::bigint, 'only the public event was kept');
select t.eq((select full_name from join_requests where id = :'req1'), 'Rohan Mehta', 'name is tidied');
select t.eq((select email from join_requests where id = :'req1'), 'rohan@x.com', 'email is lower cased');
select t.eq((select health_flag from join_requests where id = :'req1'), true, 'any yes on health raises the flag');

-- ------------------------------------------------ who is who
set request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001"}';
set role authenticated;
select t.eq(whoami()->>'role', 'owner', 'invited owner email becomes owner');
select t.fails($$select setup_gym('x2', 'X', 'x@x.com')$$, 'permission denied');
select t.fails($$select add_membership_core(null, null, null, null, null, null, null, null, null)$$, 'permission denied');
reset role;
set request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002"}';
set role authenticated;
select t.eq(whoami()->>'role', 'staff', 'invited staff email becomes staff');
select t.eq((select count(*) from join_requests where status = 'pending'), 1::bigint, 'staff sees the pending request');
reset role;
set request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003"}';
set role authenticated;
select t.eq(whoami()->>'role', 'owner', 'other gym owner');
select t.eq((select count(*) from join_requests), 0::bigint, 'another gym sees none of our requests');
select t.fails(format($$select approve_join_request(%L, %L, '2026-01-31', 1500)$$, :'req1', :'plan_b'), 'not found');
select t.fails(format($$insert into clients (gym_id, full_name, phone) values (%L, 'Bad Row', '+919000000001')$$, :'gym_a'), 'row-level security');
reset role;

-- ------------------------------------------------ approve, pay, void
set request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002"}';
set role authenticated;
select approve_join_request(:'req1', :'monthly', '2026-01-31', 1500, 1000, 'upi', '2026-01-31') as approved \gset
reset role;
select (:'approved'::jsonb->>'client_id') as client1, (:'approved'::jsonb->>'membership_id') as mem1, (:'approved'::jsonb->>'payment_id') as pay1 \gset
select t.eq((select end_date from memberships where id = :'mem1'), date '2026-02-27', 'approved plan end date');
select t.eq((select status from join_requests where id = :'req1'), 'approved', 'request marked approved');
select t.eq((select count(*) from payments where client_id = :'client1'), 1::bigint, 'first payment recorded');
set role authenticated;
select t.fails(format($$select approve_join_request(%L, %L, '2026-01-31', 1500)$$, :'req1', :'monthly'), 'already handled');
select t.fails(format($$select add_payment(%L, %L, 600, 'cash')$$, :'client1', :'mem1'), 'more than what is due');
select t.fails(format($$select add_payment(%L, %L, 100, 'bitcoin')$$, :'client1', :'mem1'), 'how they paid');
select add_payment(:'client1', :'mem1', 500, 'cash', '2026-02-05') as pay2 \gset
select t.fails(format($$select void_payment(%L, 'typo')$$, :'pay2'), 'only the owner');
select t.fails(format($$select cancel_membership(%L, 'typo')$$, :'mem1'), 'only the owner');
update plans set price = 1 where id = :'monthly';
select t.fails(format($$update clients set user_id = %L where id = %L$$, 'a0000000-0000-0000-0000-000000000002', :'client1'), 'permission denied');
update clients set notes = 'Prefers mornings' where id = :'client1';
select t.fails($$select insights((select gym_id from staff limit 1), 30)$$, 'only the owner');
select t.eq((select count(*) from activity), 0::bigint, 'staff cannot read the audit log');
insert into messages (gym_id, client_id, kind, channel, body) values (:'gym_a', :'client1', 'welcome', 'whatsapp', 'Hi Rohan');
reset role;
select t.eq((select price from plans where id = :'monthly'), 1500, 'staff cannot change prices');
select t.eq((select notes from clients where id = :'client1'), 'Prefers mornings', 'staff can edit client details');
set request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001"}';
set role authenticated;
select void_payment(:'pay2', 'Entered twice');
select t.fails(format($$select void_payment(%L, '  ')$$, :'pay1'), 'say why');
update plans set price = 1600 where id = :'monthly';
select t.eq((insights(:'gym_a', 30)->'counts'->>'join_viewed'), '1', 'owner sees the funnel');
select t.eq((select count(*) > 0 from activity), true, 'owner reads the audit log');
select t.fails(format($$delete from staff where gym_id = %L and email = 'owner@a.com'$$, :'gym_a'), 'main owner');
select t.fails(format($$update staff set role = 'staff' where gym_id = %L and email = 'owner@a.com'$$, :'gym_a'), 'main owner');
select add_membership(:'client1', :'monthly', '2026-02-28', 1600, 0) as renewed \gset
reset role;
select t.eq((select price from plans where id = :'monthly'), 1600, 'owner can change prices');
select t.eq((select count(*) from memberships where client_id = :'client1'), 2::bigint, 'renewal added');

-- ------------------------------------------------ the client's own view
set request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004"}';
set role authenticated;
select t.eq(whoami()->>'role', 'client', 'verified email matching a client links them');
select t.eq(jsonb_array_length(my_home()->'memberships'), 2, 'client sees both plans');
select t.eq(jsonb_array_length(my_home()->'payments'), 1, 'voided payments are hidden');
select t.eq((my_home()->'client') ? 'notes', false, 'staff notes never reach the client');
select t.eq((select count(*) from clients), 0::bigint, 'client cannot read the clients table');
select t.eq((select count(*) from gyms), 0::bigint, 'client cannot read the gyms table');
select t.eq((select count(*) from payments), 0::bigint, 'client cannot read the payments table');
select t.fails(format($$select add_payment(%L, null, 100, 'cash')$$, :'client1'), 'not found');
select t.fails(format($$select approve_join_request(%L, %L, '2026-01-31', 1500)$$, :'req1', :'monthly'), 'not found');
select track('client_home_viewed');
reset role;
select t.eq((select user_id from clients where id = :'client1'), 'a0000000-0000-0000-0000-000000000004'::uuid, 'client account linked');
select t.eq((select count(*) from events where name = 'client_home_viewed'), 1::bigint, 'signed in event kept');

-- An email that was never confirmed links to nothing, even if a client has it.
update clients set email = 'sneaky@x.com' where id = :'client1';
set request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000006"}';
set role authenticated;
select t.eq(whoami()->>'role', null, 'unconfirmed email gets no role');
select t.eq(my_home(), null::jsonb, 'and sees no membership');
reset role;

-- A returning member who joins again with the same phone keeps one client record.
set request.jwt.claims = '';
set role anon;
select submit_join_request('forge', '{"full_name":"Rohan Mehta","phone":"+919876543210","consent_terms":true,"goal":"Lose fat"}') as req2 \gset
reset role;
set request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001"}';
set role authenticated;
select approve_join_request(:'req2', :'monthly', '2026-04-01', 1600) as again \gset
select t.eq((:'again'::jsonb->>'client_id'), :'client1', 'same phone reuses the client');
select t.fails(format($$select reject_join_request(%L)$$, :'req2'), 'already handled');
reset role;
select t.eq((select goal from clients where id = :'client1'), 'Build muscle', 'a returning member keeps what staff had');
select t.eq((select email from clients where id = :'client1'), 'sneaky@x.com', 'the form never changes a member email');

-- ------------------------------------------------ fixes from the first db-guard review
-- Bad booleans give a friendly error, not a raw cast error.
set request.jwt.claims = '';
set role anon;
select t.fails($$select submit_join_request('forge', '{"full_name":"A B","phone":"+919222222222","consent_terms":"yes"}')$$, 'not valid');
select t.fails(format($$select insights(%L, 30)$$, :'gym_a'), 'permission denied');
select t.fails($$select my_home()$$, 'permission denied');
select t.fails(format($$select add_payment(%L, null, 100, 'cash')$$, :'client1'), 'permission denied');
select log_error('join page broke', 'stack', '/gym/#/join', 'ua', '0.1.0', 'forge');
select submit_join_request('forge', '{"full_name":"Meera Joshi","phone":"+919333333333","consent_terms":true}') as req3 \gset
reset role;
select t.eq((select gym_id from app_errors where message = 'join page broke'), :'gym_a'::uuid, 'join page errors belong to the gym in the link');
select t.fails($$insert into join_requests (gym_id, full_name, phone, consent_terms) select gym_id, 'Meera Joshi', phone, true from join_requests where phone = '+919333333333'$$, 'duplicate key');

-- Another gym sees none of ours.
set request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003"}';
set role authenticated;
select t.eq((select count(*) from clients), 0::bigint, 'gym B: no clients of A');
select t.eq((select count(*) from memberships), 0::bigint, 'gym B: no plans of A');
select t.eq((select count(*) from payments), 0::bigint, 'gym B: no payments of A');
select t.eq((select count(*) from messages), 0::bigint, 'gym B: no messages of A');
select t.eq((select count(*) from events), 0::bigint, 'gym B: no events of A');
select t.eq((select count(*) from activity where gym_id = :'gym_a'), 0::bigint, 'gym B: no audit rows of A');
select t.eq((select count(*) from app_errors), 0::bigint, 'gym B: no errors of A');
select t.eq(jsonb_array_length(insights(:'gym_b', 30)->'errors'), 0, 'gym B insights show no errors of A');
select t.fails(format($$insert into messages (gym_id, client_id, kind, channel, body) values (%L, %L, 'x', 'copy', 'x')$$, :'gym_b', :'client1'), 'row-level security');
reset role;

-- Staff cannot manage staff. Owners invite by email only.
insert into clients (gym_id, full_name, phone) values (:'gym_b', 'Other Member', '+919444444444') returning id as client_b \gset
set request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002"}';
set role authenticated;
select t.fails(format($$insert into staff (gym_id, email, role) values (%L, 'new@a.com', 'staff')$$, :'gym_a'), 'row-level security');
select t.eq((select count(*) from events), 0::bigint, 'staff cannot read events');
select t.fails(format($$insert into messages (gym_id, client_id, kind, channel, body) values (%L, %L, 'x', 'copy', 'x')$$, :'gym_a',   :'client_b'), 'row-level security');
reset role;
set request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001"}';
set role authenticated;
insert into staff (gym_id, email, role, name) values (:'gym_a', 'coach@a.com', 'owner', 'Coach');
select t.fails(format($$insert into staff (gym_id, email, role, created_at) values (%L, 'sneak@a.com', 'owner', '2000-01-01')$$, :'gym_a'), 'permission denied');
select t.fails(format($$insert into staff (gym_id, email, role, user_id) values (%L, 'sneak2@a.com', 'owner', 'a0000000-0000-0000-0000-000000000004')$$, :'gym_a'), 'permission denied');
delete from staff where email = 'coach@a.com';
select t.eq((select count(*) from staff where email = 'coach@a.com'), 0::bigint, 'owner can remove staff');
select t.eq(jsonb_array_length(insights(:'gym_a', 30)->'errors'), 1, 'owner A sees the join page error');
-- Cancelling twice keeps the first reason, and a cancelled plan takes no money.
select cancel_membership((:'renewed'::jsonb->>'membership_id')::uuid, 'Wrong plan');
select cancel_membership((:'renewed'::jsonb->>'membership_id')::uuid, 'Second reason');
select t.fails(format($$select add_payment(%L, %L, 100, 'cash')$$, :'client1', (:'renewed'::jsonb->>'membership_id')), 'cancelled');
select reject_join_request(:'req3', 'Duplicate');
select t.fails(format($$select add_membership(%L, %L, '2026-05-01', 2000000)$$, :'client1', :'monthly'), 'check the price');
reset role;
select t.eq((select cancel_reason from memberships where id = (:'renewed'::jsonb->>'membership_id')::uuid), 'Wrong plan', 'first cancel reason kept');
select t.eq((select status from join_requests where id = :'req3'), 'rejected', 'request declined');
