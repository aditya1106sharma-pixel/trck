-- Run once in Supabase: SQL Editor, New query, paste, Run.
create table if not exists public.trck_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.trck_state enable row level security;
create policy "own row read" on public.trck_state for select using (auth.uid() = user_id);
create policy "own row insert" on public.trck_state for insert with check (auth.uid() = user_id);
create policy "own row update" on public.trck_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
