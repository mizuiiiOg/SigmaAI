-- Run this once in Supabase → SQL Editor → New query → Run

create table if not exists public.bots (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  personality text not null,
  pfp text,
  fish_key text,
  fish_voice_id text,
  has_voice boolean default false,
  messages jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table public.bots enable row level security;

create policy "Users can view their own bots"
  on public.bots for select
  using (auth.uid() = user_id);

create policy "Users can insert their own bots"
  on public.bots for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own bots"
  on public.bots for update
  using (auth.uid() = user_id);

create policy "Users can delete their own bots"
  on public.bots for delete
  using (auth.uid() = user_id);
