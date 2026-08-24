-- top_saved_places: 전체 이용자가 담은 횟수를 합산해 가장 많이 담긴 가게 순으로 반환한다.
-- saved_places는 RLS로 "자기 것만" 조회 가능하므로, 메인 화면의 인기 랭킹(모든 사람의 데이터를
-- 합산한 결과)은 일반 select로는 만들 수 없다. 이 함수를 SECURITY DEFINER로 만들어
-- (함수 소유자 권한으로 실행되어 RLS를 우회) 서버 쪽에서 미리 집계한 뒤,
-- "가게 정보 + 담긴 횟수"만 반환한다 — 누가 담았는지(user_id)는 함수 안에서만 쓰이고
-- 절대 결과에 포함되지 않는다. RLS 자체는 saved_places 테이블에 그대로 켜져 있다.
-- place_id/category_name/address는 인기 랭킹 카드뿐 아니라 "오늘의 추천"(js/today-pick.js)이
-- 가중치 랜덤으로 뽑은 가게를 카카오맵으로 바로 연결하는 데도 쓰인다.
--
-- 이미 이 함수를 만들어 두었다면 반환 컬럼(타입)이 바뀌어서 create or replace만으로는
-- 안 되므로, 먼저 기존 함수를 지우고 다시 만든다 — 이 파일은 여러 번 실행해도 안전하다.
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

drop function if exists public.top_saved_places(int);

create or replace function public.top_saved_places(limit_count int default 5)
returns table (
  place_id text,
  place_name text,
  category_name text,
  address text,
  save_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select sp.place_id, sp.place_name, sp.category_name, sp.address, count(*)::bigint as save_count
  from public.saved_places sp
  group by sp.place_id, sp.place_name, sp.category_name, sp.address
  order by save_count desc, sp.place_name asc
  limit limit_count;
$$;

-- 기본적으로 신규 함수는 PUBLIC(모든 role)에 실행 권한이 열려 있으므로, 먼저 걷어낸 뒤
-- 로그인 여부와 관계없이(메인 화면은 비로그인도 볼 수 있어야 하므로) anon/authenticated에만
-- 명시적으로 다시 부여한다.
revoke all on function public.top_saved_places(int) from public;
grant execute on function public.top_saved_places(int) to anon, authenticated;
