-- saved_places: 로그인한 사용자가 "담기"한 맛집 한 줄씩 저장.
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  place_id text not null,
  place_name text not null,
  category_name text,
  address text,
  x double precision,
  y double precision,
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

alter table public.saved_places enable row level security;

create policy "saved_places_select_own"
  on public.saved_places for select
  to authenticated
  using (auth.uid() = user_id);

create policy "saved_places_insert_own"
  on public.saved_places for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "saved_places_update_own"
  on public.saved_places for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saved_places_delete_own"
  on public.saved_places for delete
  to authenticated
  using (auth.uid() = user_id);
