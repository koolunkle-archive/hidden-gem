-- top_saved_places: 전체 이용자가 담은 횟수를 합산해 가장 많이 담긴 가게 순으로 반환한다.
-- saved_places는 RLS로 "자기 것만" 조회되므로, SECURITY DEFINER로 RLS를 우회해 서버에서
-- 집계한다. user_id는 절대 반환하지 않고, RLS 자체는 테이블에 그대로 켜져 있다.
--
-- 반환 컬럼(타입)이 바뀌면 create or replace만으로 안 되므로 먼저 drop한다 — 재실행 안전.
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

drop function if exists public.top_saved_places(int);

create or replace function public.top_saved_places(limit_count int default 5)
returns table (
  place_id text,
  place_name text,
  category_name text,
  address text,
  x double precision,
  y double precision,
  save_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select sp.place_id, sp.place_name, sp.category_name, sp.address, sp.x, sp.y, count(*)::bigint as save_count
  from public.saved_places sp
  group by sp.place_id, sp.place_name, sp.category_name, sp.address, sp.x, sp.y
  order by save_count desc, sp.place_name asc
  limit limit_count;
$$;

-- 신규 함수는 기본적으로 PUBLIC에 실행 권한이 열리므로, 걷어내고 anon/authenticated에만 부여.
revoke all on function public.top_saved_places(int) from public;
grant execute on function public.top_saved_places(int) to anon, authenticated;
