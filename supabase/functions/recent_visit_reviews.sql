-- recent_visit_reviews: 메인 화면 "최근 리뷰"에 쓸 전체 이용자의 방문 후기를 최신순으로 반환한다.
-- visit_reviews는 RLS로 "자기 것만" 조회 가능하므로, top_saved_places.sql과 동일한 이유로
-- SECURITY DEFINER 집계 함수가 필요하다. 가게 정보 + 만족여부 + 한줄평 + 작성 시각만 반환하고
-- 누가 남겼는지(user_id)는 절대 내보내지 않는다. RLS 자체는 테이블에 그대로 켜져 있다(끄지 않음).
--
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

create or replace function public.recent_visit_reviews(limit_count int default 8)
returns table (
  place_name text,
  category_name text,
  address text,
  satisfied boolean,
  comment text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select vr.place_name, vr.category_name, vr.address, vr.satisfied, vr.comment, vr.created_at
  from public.visit_reviews vr
  order by vr.created_at desc
  limit limit_count;
$$;

revoke all on function public.recent_visit_reviews(int) from public;
grant execute on function public.recent_visit_reviews(int) to anon, authenticated;
