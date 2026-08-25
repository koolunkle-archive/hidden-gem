-- "최근 리뷰"를 빈 화면 없이 확인해볼 수 있도록 visit_reviews에 더미 방문 후기 12건을 채운다.
-- seed_dummy_saved_places.sql이 만든 더미 계정(dummy-user-%@hiddengem.test)을 그대로
-- 재사용하므로, 이 스크립트보다 먼저 seed_dummy_saved_places.sql을 실행해 두어야 한다.
--
-- 가게 정보는 seed_dummy_saved_places.sql과 동일한 실제 카카오 로컬 API 검색 결과를 쓴다.
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
    (1, '18442419', '강남김밥', '음식점 > 분식', '서울 강남구 선릉로130길 20', true, '김밥 속재료가 꽉 차 있고 신선해요. 포장해가도 밥이 잘 뭉쳐 있어서 좋아요.', interval '2 hours'),
    (2, '16649489', '이남장 삼성점', '음식점 > 한식 > 설렁탕', '서울 강남구 봉은사로108길 21', true, '국물이 깊고 깔끔해요. 12시 전에 가면 웨이팅 없이 바로 먹을 수 있어요.', interval '5 hours'),
    (3, '1950857675', '오레노라멘 강남점', '음식점 > 일식 > 일본식라면', '서울 강남구 테헤란로1길 28-9', true, '차슈가 두툼하고 국물이 진해요. 점심시간엔 줄이 좀 있는 편이에요.', interval '9 hours'),
    (4, '1492101227', '샤오당쟈마라탕 신사본점', '음식점 > 중식 > 중국요리', '서울 강남구 강남대로152길 30', true, '맵기 단계를 골라 먹을 수 있어서 좋아요. 향신료가 강하니 처음이면 순한맛을 추천해요.', interval '1 day'),
    (5, '7902291', '본죽&비빔밥cafe 강남점', '음식점 > 퓨전요리 > 퓨전한식', '서울 강남구 강남대로94길 21', true, '속이 안 좋을 때 자주 찾는 곳. 양은 적당하고 가격도 부담 없어요.', interval '1 day 4 hours'),
    (6, '35026031', '스타벅스 강남R점', '음식점 > 카페 > 커피전문점', '서울 강남구 강남대로 390', true, '좌석이 넓고 층고가 높아서 점심시간에 여유롭게 쉬다 가기 좋아요.', interval '1 day 10 hours'),
    (7, '8025375', '우래옥 본점', '음식점 > 한식 > 냉면', '서울 중구 창경궁로 62-29', true, '슴슴한 평양냉면 육수가 일품이에요. 점심시간엔 웨이팅이 긴 편이라 서둘러야 해요.', interval '2 days'),
    (8, '2143988257', '진중 우육면관 본점', '음식점 > 중식', '서울 종로구 청계천로 75-2', false, '우육면 국물이 생각보다 짜고, 웨이팅에 비해 회전이 느렸어요.', interval '2 days 6 hours'),
    (9, '1819203967', '포가', '음식점 > 중식 > 중국요리', '서울 마포구 동교로46길 24-4', false, '짜장면은 평범했고, 요청한 곱빼기가 안 나와서 아쉬웠어요.', interval '3 days'),
    (10, '24767822', '마포낙지한마리수제비 마포점', '음식점 > 한식 > 수제비', '서울 마포구 독막로 308', true, '수제비 면이 쫄깃하고 국물이 칼칼해서 해장으로 딱이에요.', interval '3 days 8 hours'),
    (11, '7914330', '부원면옥', '음식점 > 한식 > 냉면', '서울 중구 남대문시장4길 41-6', true, '여름 아니어도 생각나는 맛. 양이 적어서 곱빼기 추천합니다.', interval '4 days'),
    (12, '1502310578', '박만배아리랑보쌈 성수점', '음식점 > 한식 > 족발,보쌈', '서울 성동구 뚝섬로3길 13', true, '보쌈 고기가 부드럽고 반찬 구성도 알차요. 2인 세트가 넉넉해요.', interval '5 days')
)
insert into public.visit_reviews (user_id, place_id, place_name, category_name, address, satisfied, comment, created_at)
select du.id, r.place_id, r.place_name, r.category_name, r.address, r.satisfied, r.comment, now() - r.ago
from reviews r
join dummy_users du on du.rn = r.rn;

-- ── 정리용(나중에 더미 리뷰를 지우고 싶을 때 주석 해제해서 실행) ──
-- place_id가 이제 실제 카카오맵 장소 ID라 'dummy-%' 패턴으로 걸러낼 수 없으므로,
-- 더미 계정(user_id) 기준으로 지운다.
-- delete from public.visit_reviews where user_id in (select id from auth.users where email like 'dummy-user-%@hiddengem.test');
