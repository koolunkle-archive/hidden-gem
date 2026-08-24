-- 인기 랭킹 / 맞춤 추천 기능을 데이터 없이도 확인해볼 수 있도록, saved_places에 더미 데이터
-- 100건을 채워 넣는다.
--
-- saved_places.user_id는 auth.users(id)를 참조하는 FK라서, "여러 사람이 같은 가게를 담았다"를
-- 재현하려면 실제로 서로 다른 계정이 필요하다(같은 계정은 같은 place_id를 두 번 담을 수 없음
-- — UNIQUE(user_id, place_id)). 그래서 로그인은 불가능한(비밀번호를 알 수 없는) 더미 계정
-- 20개를 auth.users에 만들어 그 계정들 명의로 저장한다. 더미 계정은 이메일이
-- dummy-user-%@hiddengem.test 패턴이라 아래 정리용 스크립트로 나중에 한 번에 지울 수 있다.
--
-- 실제 내 계정으로 이미 담아둔 가게(예: 레알라면 등)는 건드리지 않고 그대로 남아 있고,
-- 인기 랭킹 집계에도 자연스럽게 함께 포함된다.
--
-- Supabase 대시보드 > SQL Editor에서 실행하세요. (top_saved_places.sql을 먼저 실행해 두면
-- 실행 직후 바로 랭킹 함수로 결과를 확인할 수 있습니다.)

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
    ('dummy-001', '오월의김밥',   '음식점 > 분식', '서울 관악구 봉천로 605',   127.0276, 37.4979, 16),
    ('dummy-002', '영미김밥',     '음식점 > 분식', '서울 서대문구 신촌역로 21', 126.9368, 37.5559, 14),
    ('dummy-003', '진순설렁탕',   '음식점 > 한식', '서울 강남구 테헤란로 123', 127.0364, 37.4979, 12),
    ('dummy-004', '스미레 라멘',  '음식점 > 일식', '서울 강남구 역삼로 45',    127.0400, 37.5000, 10),
    ('dummy-005', '마라공방',     '음식점 > 중식', '서울 강남구 삼성로 78',    127.0500, 37.5100, 9),
    ('dummy-006', '뜨락 파스타',  '음식점 > 양식', '서울 강남구 논현로 12',    127.0300, 37.5050, 8),
    ('dummy-007', '본죽마을',     '음식점 > 한식', '서울 강남구 도곡로 34',    127.0450, 37.4900, 7),
    ('dummy-008', '카페 온도',    '카페 > 커피전문점', '서울 강남구 선릉로 56', 127.0480, 37.5030, 6),
    ('dummy-009', '원조누드김밥', '음식점 > 분식', '서울 종로구 창경궁로 88',  127.0020, 37.5720, 5),
    ('dummy-010', '홍콩반점',     '음식점 > 중식', '서울 마포구 양화로 90',    126.9250, 37.5550, 4),
    ('dummy-011', '연남동수제비', '음식점 > 한식', '서울 마포구 연남로 11',    126.9230, 37.5620, 3),
    ('dummy-012', '을지로냉면',   '음식점 > 한식', '서울 중구 을지로 22',      126.9910, 37.5660, 2),
    ('dummy-013', '성수족발',     '음식점 > 한식', '서울 성동구 성수이로 33',  127.0560, 37.5440, 2),
    ('dummy-014', '한남동스시',   '음식점 > 일식', '서울 용산구 이태원로 44',  127.0000, 37.5340, 1),
    ('dummy-015', '망원동파스타', '음식점 > 양식', '서울 마포구 망원로 55',    126.9020, 37.5560, 1)
)
insert into public.saved_places (user_id, place_id, place_name, category_name, address, x, y)
select du.id, p.place_id, p.place_name, p.category_name, p.address, p.x, p.y
from places p
join dummy_users du on du.rn <= p.save_count
on conflict (user_id, place_id) do nothing;

-- 3) 확인 (top_saved_places.sql을 먼저 실행했다면 바로 랭킹을 볼 수 있다)
-- select * from public.top_saved_places(5);

-- ── 정리용(나중에 더미 데이터를 지우고 싶을 때 아래 두 줄의 주석만 해제해서 실행) ──
-- delete from public.saved_places where place_id like 'dummy-%';
-- delete from auth.users where email like 'dummy-user-%@hiddengem.test';
