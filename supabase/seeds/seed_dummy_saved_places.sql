-- 인기 랭킹/추천 기능을 데이터 없이 확인할 수 있도록 saved_places에 더미 100건을 채운다.
--
-- user_id는 auth.users FK이자 UNIQUE(user_id, place_id)라, "여러 명이 같은 가게를 담음"을
-- 재현하려면 서로 다른 계정이 필요하다 — 로그인 불가능한 더미 계정 20개(이메일
-- dummy-user-%@hiddengem.test)를 만들어 그 명의로 저장한다.
--
-- place_id/좌표(x, y)는 실제 카카오 로컬 API 검색 결과를 그대로 썼다 — 지어낸 값이면
-- "카카오맵에서 보기"가 존재하지 않는 페이지로 연결되고 /api/place-photo(이름+좌표 매칭)가
-- 실패해 사진도 항상 플레이스홀더로 남는다(둘 다 실제로 겪은 문제).
--
-- Supabase 대시보드 > SQL Editor에서 실행하세요(top_saved_places.sql을 먼저 실행해두면
-- 직후 결과 확인 가능).
--
-- 예전 버전(가짜 place_id 'dummy-001' 등)을 이미 실행했다면, 아래 insert 전에 먼저
-- 기존 더미 데이터를 지워야 한다(안 지우면 랭킹이 중복으로 부풀려짐):
--   delete from public.saved_places
--   where user_id in (select id from auth.users where email like 'dummy-user-%@hiddengem.test');

create extension if not exists pgcrypto;

-- 1) 더미 계정 20개 생성 (비밀번호는 알 수 없는 임의 값 — 실제 로그인 용도가 아니라 FK를
--    만족시키기 위한 시드용 계정)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'dummy-user-' || lpad(n::text, 2, '0') || '@hiddengem.test',
  crypt('dummy-password-' || n::text, gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '', '', '', ''
from generate_series(1, 20) as n
where not exists (
  select 1 from auth.users
  where email = 'dummy-user-' || lpad(n::text, 2, '0') || '@hiddengem.test'
);

-- 2) 가게 15곳 + 각 가게가 몇 명에게 담길지(총합 100) 정의하고, 더미 계정 순서대로 배정해
--    saved_places에 삽입한다.
with dummy_users as (
  select id, row_number() over (order by email) as rn
  from auth.users
  where email like 'dummy-user-%@hiddengem.test'
),
places(place_id, place_name, category_name, address, x, y, save_count) as (
  values
    ('18442419',   '강남김밥',              '음식점 > 분식',             '서울 강남구 선릉로130길 20',    127.04264755226313, 37.51647777507762, 16),
    ('1950857675', '오레노라멘 강남점',      '음식점 > 일식 > 일본식라면', '서울 강남구 테헤란로1길 28-9',   127.028078079522,   37.5005037179803,   14),
    ('16649489',   '이남장 삼성점',          '음식점 > 한식 > 설렁탕',     '서울 강남구 봉은사로108길 21',   127.064450126559,   37.5135684607614,   12),
    ('1492101227', '샤오당쟈마라탕 신사본점', '음식점 > 중식 > 중국요리',   '서울 강남구 강남대로152길 30',   127.02184049107709, 37.51766827477119,  10),
    ('18074322',   '파씨오네',              '음식점 > 양식',             '서울 강남구 언주로164길 39',     127.036748507093,   37.525448340313,    9),
    ('7902291',    '본죽&비빔밥cafe 강남점',  '음식점 > 퓨전요리 > 퓨전한식', '서울 강남구 강남대로94길 21',  127.02902433515636, 37.49970069286392,  8),
    ('35026031',   '스타벅스 강남R점',       '음식점 > 카페 > 커피전문점',  '서울 강남구 강남대로 390',      127.028443419181,   37.4976744709989,   7),
    ('8025375',    '우래옥 본점',            '음식점 > 한식 > 냉면',       '서울 중구 창경궁로 62-29',      126.99871865898974, 37.56821185731751,  6),
    ('2143988257', '진중 우육면관 본점',      '음식점 > 중식',             '서울 종로구 청계천로 75-2',     126.98611119582282, 37.56855522765132,  5),
    ('1819203967', '포가',                  '음식점 > 중식 > 중국요리',   '서울 마포구 동교로46길 24-4',   126.92585929482384, 37.56200955375736,  4),
    ('24767822',   '마포낙지한마리수제비 마포점', '음식점 > 한식 > 수제비',  '서울 마포구 독막로 308',       126.946893859873,   37.5436387288475,   3),
    ('7914330',    '부원면옥',              '음식점 > 한식 > 냉면',       '서울 중구 남대문시장4길 41-6',  126.977604365846,   37.5584213149079,   2),
    ('1502310578', '박만배아리랑보쌈 성수점', '음식점 > 한식 > 족발,보쌈',  '서울 성동구 뚝섬로3길 13',      127.04922682675,    37.5413960199056,   2),
    ('24211286',   '기다스시',              '음식점 > 일식 > 초밥,롤',    '서울 용산구 이태원로 230',      126.999289460706,   37.5354948156729,   1),
    ('1181461605', '10평파스타',            '음식점 > 양식 > 이탈리안',   '서울 마포구 망원로 88',         126.90653088301868, 37.55756563347033,  1)
)
insert into public.saved_places (user_id, place_id, place_name, category_name, address, x, y)
select du.id, p.place_id, p.place_name, p.category_name, p.address, p.x, p.y
from places p
join dummy_users du on du.rn <= p.save_count
on conflict (user_id, place_id) do nothing;

-- 3) 확인 (top_saved_places.sql을 먼저 실행했다면 바로 랭킹을 볼 수 있다)
-- select * from public.top_saved_places(5);

-- ── 정리용(나중에 더미 데이터를 지우고 싶을 때 아래 두 줄의 주석만 해제해서 실행) ──
-- place_id가 이제 실제 카카오맵 장소 ID라 'dummy-%' 패턴으로 걸러낼 수 없으므로,
-- 더미 계정(user_id) 기준으로 지운다.
-- delete from public.saved_places where user_id in (select id from auth.users where email like 'dummy-user-%@hiddengem.test');
-- delete from auth.users where email like 'dummy-user-%@hiddengem.test';
