-- "최근 리뷰"를 빈 화면 없이 확인해볼 수 있도록 visit_reviews에 더미 방문 후기 12건을 채운다.
-- seed_dummy_saved_places.sql이 만든 더미 계정(dummy-user-%@hiddengem.test)을 그대로
-- 재사용하므로, 이 스크립트보다 먼저 seed_dummy_saved_places.sql을 실행해 두어야 한다.
--
-- UNIQUE 제약이 없어 다시 실행하면 그대로 중복 삽입되니 한 번만 실행하세요.
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

with dummy_users as (
  select id, row_number() over (order by email) as rn
  from auth.users
  where email like 'dummy-user-%@hiddengem.test'
),
reviews(rn, place_id, place_name, category_name, address, satisfied, comment, ago) as (
  values
    (1, 'dummy-001', '오월의김밥', '음식점 > 분식', '서울 관악구 봉천로 605', true, '김밥이 꽉 차 있고 속재료가 신선해요. 점심시간에 가도 회전이 빨라서 좋아요.', interval '2 hours'),
    (2, 'dummy-003', '진순설렁탕', '음식점 > 한식', '서울 강남구 테헤란로 123', true, '국물이 진하고 깔끔해요. 12시 전에 가면 웨이팅 없이 바로 먹을 수 있어요.', interval '5 hours'),
    (3, 'dummy-004', '스미레 라멘', '음식점 > 일식', '서울 강남구 역삼로 45', true, '차슈가 두툼해서 만족스러웠어요. 자리가 좁아서 혼자 갈 때가 더 편해요.', interval '9 hours'),
    (4, 'dummy-005', '마라공방', '음식점 > 중식', '서울 강남구 삼성로 78', true, '맵기 조절이 잘 돼서 좋아요. 회사 사람들이랑 단체로 가기에도 괜찮은 규모예요.', interval '1 day'),
    (5, 'dummy-007', '본죽마을', '음식점 > 한식', '서울 강남구 도곡로 34', true, '속이 안 좋을 때 자주 찾는 곳. 양은 적당하고 가격도 부담 없어요.', interval '1 day 4 hours'),
    (6, 'dummy-002', '영미김밥', '음식점 > 분식', '서울 서대문구 신촌역로 21', false, '맛은 무난한데 포장 주문이 밀려서 20분 넘게 기다렸어요.', interval '1 day 10 hours'),
    (7, 'dummy-006', '뜨락 파스타', '음식점 > 양식', '서울 강남구 논현로 12', true, '크림파스타가 느끼하지 않고 담백해요. 점심 세트 가격도 합리적입니다.', interval '2 days'),
    (8, 'dummy-008', '카페 온도', '카페 > 커피전문점', '서울 강남구 선릉로 56', true, '원두가 산미보다 고소한 쪽이라 커피 못 마시는 사람도 부담 없이 마실 만해요.', interval '2 days 6 hours'),
    (9, 'dummy-010', '홍콩반점', '음식점 > 중식', '서울 마포구 양화로 90', false, '짜장면은 평범했고, 요청한 곱빼기가 안 나와서 아쉬웠어요.', interval '3 days'),
    (10, 'dummy-011', '연남동수제비', '음식점 > 한식', '서울 마포구 연남로 11', true, '수제비 면이 쫄깃하고 국물이 칼칼해서 해장으로 딱이에요.', interval '3 days 8 hours'),
    (11, 'dummy-009', '원조누드김밥', '음식점 > 분식', '서울 종로구 창경궁로 88', true, '누드김밥 특유의 촉촉함이 좋아요. 포장해서 사무실에서 먹기도 편해요.', interval '4 days'),
    (12, 'dummy-012', '을지로냉면', '음식점 > 한식', '서울 중구 을지로 22', true, '여름 아니어도 생각나는 맛. 양이 적어서 곱빼기 추천합니다.', interval '5 days')
)
insert into public.visit_reviews (user_id, place_id, place_name, category_name, address, satisfied, comment, created_at)
select du.id, r.place_id, r.place_name, r.category_name, r.address, r.satisfied, r.comment, now() - r.ago
from reviews r
join dummy_users du on du.rn = r.rn;

-- ── 정리용(나중에 더미 리뷰를 지우고 싶을 때 주석 해제해서 실행) ──
-- delete from public.visit_reviews where place_id like 'dummy-%';
