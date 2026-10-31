-- Photo meal logging (0.6.0). Run once in Supabase: SQL Editor, New query, paste, Run.
-- Counts photos per person per day so one person cannot use up the shared free Gemini quota.
-- Nobody can read or write this table from the app. Only the Edge Function (service role) calls the function below.
create table if not exists public.photo_quota (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  n int not null default 0,
  primary key (user_id, day)
);
alter table public.photo_quota enable row level security;

-- Adds one to today's count and returns the new count, or -1 when the cap is already reached. Day resets at midnight UTC.
create or replace function public.bump_photo_quota(p_user uuid, p_cap int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare used int;
begin
  insert into public.photo_quota (user_id, day, n) values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set n = photo_quota.n + 1 where photo_quota.n < p_cap
  returning n into used;
  return coalesce(used, -1);
end;
$$;
revoke all on function public.bump_photo_quota(uuid, int) from public, anon, authenticated;
grant execute on function public.bump_photo_quota(uuid, int) to service_role;
