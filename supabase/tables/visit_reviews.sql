-- visit_reviews: 로그인한 사용자가 "맛집 주머니"에서 실제로 다녀온 가게에 남기는
-- 방문 후기(만족/불만족 + 한줄평) 한 줄씩. saved_places.sql과 동일한 패턴을 따른다:
-- user_id는 컬럼 기본값 auth.uid()가 채우고, RLS(4방향)로 "자기 것만" 조회/작성/수정/삭제된다.
--
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

create table if not exists public.visit_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  place_id text not null,
  place_name text not null,
  category_name text,
  address text,
  satisfied boolean not null,
  comment text not null check (char_length(trim(comment)) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.visit_reviews enable row level security;

create policy "visit_reviews_select_own"
  on public.visit_reviews for select
  to authenticated
  using (auth.uid() = user_id);

create policy "visit_reviews_insert_own"
  on public.visit_reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "visit_reviews_update_own"
  on public.visit_reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "visit_reviews_delete_own"
  on public.visit_reviews for delete
  to authenticated
  using (auth.uid() = user_id);
