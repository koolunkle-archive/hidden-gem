# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 저장소 개요

이 저장소(`hidden-gem`, GitHub 원격 저장소 `koolunkle/hidden-gem`)는 점심 맛집 리뷰 서비스 **Hidden Gem**의 토이/포트폴리오 프로젝트입니다("점심 고민 5분, 지도 한 장으로 끝낸다"). PRD가 목표로 하는 Next.js/Supabase 스택으로 완전히 구현되어 있지는 않지만(여전히 빌드 시스템·프레임워크 없이 정적 HTML/바닐라 JS 기반), 카카오 로컬 API 맛집 검색과 구글 리뷰 조회는 실제로 동작합니다:

**카카오맵 vs 구글맵 역할 분담(정책)**: 이 프로젝트가 실제로 정확한 좌표·`place_id`를 갖고 있는 쪽은 카카오(검색 API로 직접 받아온 데이터)라서, **"지도에서 보기" 링크는 항상 카카오맵으로 통일**한다(`https://place.map.kakao.com/{place_id}`). 반대로 구글은 Google Place ID를 저장하지 않아 지도 링크로 쓰면(`place_name`+`address` 텍스트 검색 추측 URL) 부정확해지므로, **구글은 리뷰를 보여주는 용도로만** 쓴다(평점/리뷰 텍스트/AI 분석 — `js/reviews/review-modal.js`, `js/reviews/google-review-analysis.js`와 그 재사용). 새 화면에 지도/리뷰 링크를 추가할 때 이 분담을 따르세요.

## 폴더 구조

- `js/`는 페이지 단위가 아니라 **기능(도메인) 단위**로 하위 폴더를 나눈다 — `search.html`/`my-page.html`처럼 여러 페이지가 같은 기능을 공유하는 경우가 많아서(예: 리뷰 모달), 페이지별 폴더로 나누면 공유 파일을 어디에 둘지 애매해지기 때문이다.
  - `js/shared/` — 3개 페이지 모두가 쓰는 것: `auth.js`, `quick-nav.js`, `place-photo.js`.
  - `js/reviews/` — 구글 리뷰 관련: `review-modal.js`(search.html + my-page.html 공유), `google-review-analysis.js`.
  - `js/search/` — `search.html` 전용: `kakao-search.js`, `category-dropdown.js`, `saved-places.js`.
  - `js/home/` — `index.html` 전용: `popular-places.js`, `recommendations.js`, `recent-reviews.js`, `today-pick.js`.
  - `js/my-page/` — `my-page.html` 전용: `my-page.js`.
  - 새 스크립트를 추가할 때도 "어느 페이지 전용인지 vs 여러 페이지가 공유하는지"로 폴더를 고르고, 파일을 옮길 땐 해당 파일을 로드하는 모든 `<script src>`(index.html/search.html/my-page.html)와 다른 파일의 주석에 있는 경로 언급도 함께 갱신할 것.
- `supabase/`는 SQL 파일의 성격별로 나눈다: `tables/`(테이블 DDL), `functions/`(RPC로 호출하는 Postgres 함수), `seeds/`(더미 데이터 시드). 전부 Supabase SQL Editor에서 수동 실행하는 스크립트라 코드에서 경로를 참조하지 않으므로, 옮기더라도 실행 순서 안내 문구만 맞으면 된다.
- `api/`는 Vercel 서버리스 함수 규칙상 반드시 저장소 루트에 있어야 하고, `api/_lib/`(언더스코어 prefix)는 라우팅에서 자동 제외되는 Vercel 컨벤션을 그대로 활용해 로컬 서버와 공유하는 순수 로직을 담는다 — 이 둘의 위치는 옮기지 말 것.
- `index.html`/`search.html`/`my-page.html`은 정적 라우팅(및 `server.js`의 단순 경로 매핑)을 위해 반드시 저장소 루트에 있어야 한다 — `pages/` 같은 폴더로 옮기면 Vercel에 `vercel.json` rewrite가 필요해져서 지금까지 피해온 복잡도가 생기므로 옮기지 말 것.
- `docs/`에는 코드에서 경로를 참조하지 않는 순수 참고 문서(`PRD.md`, `DESIGN.md`)를 둔다. `CLAUDE.md`만 예외로 저장소 루트에 그대로 둔다 — Claude Code가 프로젝트 루트에서 자동으로 읽는 파일이라 옮기면 인식되지 않는다.

- `docs/PRD.md` — 제품 요구사항: 한 줄 소개, 타깃 사용자 시나리오, 기능 목록(필수/선택), 그리고 **실제 목표 기술 스택**(Next.js(React) + TypeScript, Tailwind CSS, Supabase(Postgres/Auth/Storage), Kakao Map API, Vercel 배포).
- `docs/DESIGN.md` — 비주얼 작업이 반드시 따라야 하는 디자인 가이드.
- `index.html` — 랜딩 페이지. 헤더에 `search.html`과 동일한 로그인 버튼/모달(`js/shared/auth.js`)이 있다. 아무 동작이 없던 "시작하기" 버튼(퀵점프 칩 바가 생기면서 완전히 중복이 됨)과 "홈으로" 버튼(로고가 이미 `index.html` 링크라 중복)은 제거했다 — 새 CTA를 추가하기 전에 퀵점프 칩/로고와 중복되지 않는지 먼저 확인할 것.
- `search.html` + `js/search/kakao-search.js` — 카카오 로컬(Local) API로 맛집을 검색하고 카드 목록으로 보여주는 실제 동작 기능. `KAKAO_REST_API_KEY`는 카카오 정책상 브라우저에 그대로 노출되는 구조(REST 키를 클라이언트에서 직접 호출)라 서버에서 완전히 숨길 필요는 없지만, 정적 JS 파일에 실제 키를 하드코딩해 커밋하지 않도록 `/api/kakao-config` 엔드포인트로 내려받는다(아래 "환경변수(.env) 설정" 절 참고). 검색 결과 카드는 카카오맵 링크("카카오맵", 실제 동작)와 "구글 리뷰"(아래 `js/reviews/review-modal.js`)를 같은 크기·색상의 아이콘+텍스트로 나란히 보여주는데, 이게 바로 위 "카카오맵 vs 구글맵 역할 분담" 정책의 원형이다. 카테고리 선택은 네이티브 `<select>`가 아니라 버튼 + 커스텀 리스트박스(`#search-category-dropdown` + `js/search/category-dropdown.js`)로 구현되어 있다 — 네이티브 select의 옵션 팝업은 브라우저마다 다른 OS 기본 스타일이라 나머지 pill/카드 UI와 어긋나서 직접 만든 것. 실제 검색 값은 화면에서 숨긴 `<select id="search-category-select">`가 그대로 들고 있고 `js/search/kakao-search.js`는 제출 시 그 `.value`를 읽어가므로(코드 변경 없음), 느슨한 결합이 유지된다.
- `search.html`의 검색 결과 카드(카드 전체 클릭) + `my-page.html`의 맛집 주머니 카드(".google-review-btn" 버튼 클릭) + `js/reviews/review-modal.js` — 클릭하면 구글 리뷰(평점/리뷰 개수/리뷰 내용/구글맵 링크)를 모달로 보여주는 기능. 두 페이지가 모달 UI·`/api/google-review` 호출·`localStorage` 캐시 키(`hiddenGem:googleReview:v1:`)·이벤트를 전부 공유하고 트리거 방식(카드 전체 vs 버튼)만 달라서 하나의 파일로 합쳐져 있다 — 초기화 시 `#search-results`/`#saved-places-list` 중 어느 컨테이너가 페이지에 있는지로 현재 페이지를 판별해 트리거 연결만 다르게 고른다. Google API 키는 브라우저에 노출하지 않고 서버(로컬 서버 또는 Vercel 서버리스 함수)를 거쳐서만 사용한다.
- `api/google-review.js` + `api/_lib/google-places.js` — Google Places API(New)를 호출하는 서버 로직. `api/google-review.js`는 Vercel 서버리스 함수 엔트리포인트, `api/_lib/google-places.js`는 실제 검색/상세조회/거리계산 로직으로 로컬 서버와 공유된다. 이름+좌표로 반경 150m 이내 후보를 찾는 첫 단계(`findNearbyPlaceId`)는 아래 사진 기능과 공유한다.
- `api/place-photo.js` + `api/_lib/google-place-photo.js` — Google Places Photos를 호출하는 서버 로직(아래 `js/shared/place-photo.js`가 클라이언트에서 이 엔드포인트를 쓴다). `api/place-photo.js`는 Vercel 서버리스 함수 엔트리포인트, `api/_lib/google-place-photo.js`는 실제 상세조회(`photos` 필드)·Photo Media 조회 로직으로 로컬 서버와 공유된다. 가게를 찾는 첫 단계(`findNearbyPlaceId`)는 `api/_lib/google-places.js`(리뷰 조회와 공유)에 있다.
- `api/kakao-config.js` + `api/_lib/kakao-config.js` — `KAKAO_REST_API_KEY` 환경변수를 읽어 `window.KAKAO_REST_API_KEY = "..."` 한 줄짜리 스크립트를 응답하는 엔드포인트. `search.html`이 `<script src="/api/kakao-config">`로 그대로 불러 쓴다. Google 쪽과 동일하게 로컬 서버와 Vercel 함수가 `api/_lib/kakao-config.js` 로직을 공유한다.
- 리뷰 모달의 "AI 리뷰 분석" 영역(`#review-ai-section`) + `js/reviews/google-review-analysis.js` — 구글 리뷰가 렌더링되면(리뷰가 1개 이상 있을 때만) Gemini API로 감정 분류(긍정/보통/부정 비율 막대)·핵심 키워드(CSS 태그 클라우드, 중요도=글자크기·맥락=색상)·한 줄 요약(말풍선)을 자동으로 분석해 보여준다. `js/reviews/review-modal.js`와는 직접 호출 없이 `hiddengem:review-modal-opening`/`hiddengem:google-review-rendered` CustomEvent로만 연동된다(느슨한 결합 — 기존 IIFE들이 DOM으로만 결합되는 스타일 유지). 분석 결과는 `localStorage`(`hiddenGem:googleReviewAI:v1:` 접두사, placeId 기준)에 캐싱되어 같은 가게를 재클릭해도 재호출하지 않는다.
- `api/analyze-reviews.js` + `api/_lib/gemini-review-analysis.js` — Gemini API(REST, SDK 미사용)를 호출해 리뷰를 분석하는 서버 로직. `responseSchema`로 구조화된 JSON 응답을 강제하고, 감정 개수는 모델이 아니라 서버가 리뷰별 라벨을 세어 집계한다(모델의 산술 오류 방지). Gemini 키(`GEMINI_API_KEY`)도 Google Places 키와 마찬가지로 서버 전용 — 브라우저에 노출하지 않는다.
- `index.html`/`search.html`/`my-page.html` 헤더의 로그인 버튼/모달 + `js/shared/auth.js` — Supabase Auth(이메일/비밀번호) 기반 로그인·회원가입 기능. 비밀번호 처리는 전부 Supabase에 위임한다. 회원가입은 Supabase 프로젝트의 "Confirm email"이 꺼져 있어야 이메일 인증 대기 없이 즉시 로그인까지 이어진다(Supabase 대시보드 > Authentication > Sign In / Providers > Email에서 직접 꺼야 함 — MCP 도구로는 변경 불가). 로그인 상태는 `supabase-js`가 자동으로 `localStorage`에 세션을 저장해 새로고침해도 유지된다(세 페이지가 같은 오리진이라 세션이 공유된다). 로그인하지 않아도 카카오 검색/구글 리뷰 조회 등 기존 기능은 그대로 누구나 쓸 수 있다. 다른 기능이 로그인 여부/사용자 정보를 가져다 쓸 수 있도록 `window.HiddenGemAuth`(`getSession`/`getUser`/`onChange`/`getClient` — 마지막은 다른 스크립트가 같은 Supabase 클라이언트·세션을 재사용하기 위한 것)와 `hiddengem:auth-changed` CustomEvent를 함께 제공한다(기존 스크립트들과 동일한 느슨한 결합 스타일).
- 헤더의 "주요 기능 바로가기" 퀵점프 칩 바(`#quick-nav`) + `js/shared/quick-nav.js` — `index.html`/`search.html`/`my-page.html` 세 페이지 헤더 공통. 헤더 전체가 `sticky top-0`이라 스크롤 중에도 항상 보인다. 가로 스크롤 flex 한 줄로 만들어서(미디어쿼리 없이) 좁은 화면에선 스크롤, 넓은 화면에선 한 줄에 다 들어와 자연스럽게 데스크톱 nav 역할도 겸한다. 칩은 **"홈"(index.html) / "맛집 검색"(search.html) / "맛집 주머니"(my-page.html) 3개뿐**이고 전부 페이지 단위 링크다 — 활성 표시는 각 페이지 HTML에 미리 박아둔 정적 마크업만으로 결정된다: 현재 페이지에 해당하는 칩은 `class="quick-nav-chip active"`가 붙은 `<span>`(링크 아님, 화살표 없음), 다른 두 칩은 화살표 아이콘이 붙은 `<a>` 링크. `js/shared/quick-nav.js`는 이 활성 상태를 계산하거나 바꾸지 않는다. **주의**: 예전엔 index.html 안의 세 섹션(나를 위한 추천/인기 맛집/최근 리뷰)마다 별도 칩이 있어서 "지금 어느 섹션을 보고 있는지"를 스크롤 위치(`IntersectionObserver`)나 클릭 시점의 해시로 추적해야 했는데, 섹션 경계가 맞닿아 있으면 어느 섹션이 "더 맞는지" 판정이 애매해지는 등 반복적으로 버그의 원인이 됐다 — 세 칩을 "홈" 하나로 합치면서 그 추적 로직 자체를 통째로 없앴다. **같은 페이지 내 섹션을 가리키는 칩을 다시 추가하지 말 것** — 대신 섹션들을 "홈"라는 하나의 목적지로 묶어서 생각할 것.
  - "맛집 주머니" 칩(`#quick-nav-saved`)은 비로그인이어도 항상 노출하고 클릭 시에만 로그인 여부를 확인해 안내 후 로그인 모달을 연다(`.save-btn`과 동일한 "기능 자체는 숨기지 않는다" 패턴 — 예전의 `#saved-places-nav-link`/`js/saved-places-nav.js`는 로그인 전엔 버튼 자체를 완전히 숨겼는데, 발견성이 떨어져 이 패턴으로 교체함).
  - 칩이 화면 밖으로 잘려 가로 스크롤이 더 있음을 알리는 오른쪽 페이드(`.quick-nav-fade`)를 overflow 여부에 따라 토글. 좁은 화면에서 칩 바 자체가 가로 스크롤될 때는 페이지 로드마다 스크롤 위치가 맨 왼쪽으로 초기화되므로, `scrollActiveChipIntoView()`가 로드 시 활성 칩을 가로 스크롤 컨테이너 안에서 보이는 위치로 맞춰준다.
  - **sticky 헤더에 섹션 제목이 가려지는 문제 + 비동기 콘텐츠 때문에 스크롤 위치가 어긋나는 문제**: 퀵점프 칩 자체는 더 이상 `index.html`의 개별 섹션으로 가지 않고, 푸터 내비게이션도 페이지 단위 링크(홈/맛집 검색/맛집 주머니)로 통일해 앱 내부에는 `index.html#popular`/`#reviews` 같은 앵커 링크가 더 이상 없다. 다만 예전에 공유됐거나 검색엔진에 색인된 외부 링크가 여전히 그런 해시로 들어올 수 있으므로 `setupHashReanchor()`는 남겨뒀다 — 그 앵커로 도착했을 때 헤더 높이만큼 `scroll-margin-top`을 주고(섹션 제목이 sticky 헤더에 가려지지 않도록), `#recommendations`/`#popular`/`#reviews`가 "불러오는 중" 상태의 짧은 높이일 때 초기 앵커 스크롤이 일어나 데이터 로드 후 위치가 어긋나는 문제를 로드 후 정해진 시각(300/800/1600ms) 몇 번만 같은 위치로 다시 `scrollIntoView`해서 보정한다. **주의**: 처음엔 이걸 `ResizeObserver`로 `document.body` 높이 변화를 지켜보다 재보정하는 방식으로 짰었는데, `scrollIntoView()` 자체가 레이아웃에 영향을 줘서 `ResizeObserver`를 다시 건드리는 피드백 루프가 생겨 화면이 계속 들썩이는 실제 버그가 났다 — **관찰(observe) 기반으로 스스로의 부작용에 반응하는 재보정 로직을 짜지 말 것**. 정해진 타이머 기반으로 바꾸면서, 그사이 사용자가 직접 스크롤/터치/키 입력을 하면 즉시 재보정을 포기하도록도 해뒀다(사용자가 이미 다른 곳을 보고 있는데 억지로 되돌리지 않도록).
- `api/supabase-config.js` + `api/_lib/supabase-config.js` — `SUPABASE_URL`/`SUPABASE_ANON_KEY` 환경변수를 읽어 `window.SUPABASE_URL`/`window.SUPABASE_ANON_KEY` 스크립트를 응답하는 엔드포인트. 카카오 REST 키와 동일한 이유(정적 JS 파일에 실제 값을 하드코딩해 커밋하지 않기 위함)로 `api/kakao-config.js`와 같은 패턴을 따른다. 로그인이 있는 세 페이지 모두 이 엔드포인트로 값을 받은 뒤 `@supabase/supabase-js`(CDN)로 클라이언트를 만든다.
- 검색 결과 카드의 담기 버튼(`.save-btn`) + `js/search/saved-places.js` — 로그인한 사용자가 가게를 `saved_places` 테이블(Supabase, DDL은 `supabase/tables/saved_places.sql`)에 담고/취소하는 기능. `js/shared/auth.js`가 만든 Supabase 클라이언트를 `window.HiddenGemAuth.getClient()`로 그대로 재사용해 같은 로그인 세션으로 요청하며, `user_id`는 절대 클라이언트에서 보내지 않고(테이블 컬럼 기본값 `auth.uid()`가 채움) 조회/삭제도 "내 것만" 조건 없이 RLS(4방향: select/insert/update/delete, `auth.uid() = user_id`)에 전적으로 위임한다. 비로그인 상태에서 클릭하면 안내 후 로그인 모달을 연다. `review-modal.js`의 카드 클릭 핸들러는 `.save-btn` 클릭을 무시하도록 예외 처리되어 있다(리뷰 모달이 함께 열리지 않도록).
- `my-page.html`("맛집 주머니") + `js/my-page/my-page.js` — 로그인한 사용자가 담은 가게를 `saved_places`에서 최신순(`order("created_at", { ascending: false })`)으로 불러와 카드로 보여준다. `saved-places.js`와 동일하게 `user_id` 필터 없이 RLS에 전적으로 위임해 조회·삭제(`.delete().eq("id", row.id)`)한다. 지도 링크는 `place_id` 기반 카카오맵(`https://place.map.kakao.com/{place_id}`)이다(예전엔 `place_name`+`address` 추측 검색으로 구글맵을 썼는데, 위 정책대로 카카오로 통일). 로그인 여부는 `hiddengem:auth-changed` 이벤트로만 판단(로그아웃 상태면 로그인 안내, 담은 게 없으면 검색 페이지로 유도하는 빈 상태를 보여준다). 각 카드의 "다녀왔어요" 버튼(`.visit-review-btn`)을 누르면 만족/불만족 + 한줄평을 입력하는 모달이 뜨고, 제출하면 `visit_reviews` 테이블(DDL은 `supabase/tables/visit_reviews.sql`, `saved_places`와 동일한 4방향 RLS 패턴)에 새 행을 `insert`한다 — 카드가 이미 들고 있는 `place_id`/`place_name`/`category_name`/`address`를 그대로 써서 별도 조회 없이 채운다. `select`에 `x, y`(카카오 좌표)도 포함해, 카드 article에 `dataset.placeId`/`placeName`/`lat`/`lng`를 심어 둔다 — 이건 `js/reviews/review-modal.js`가 "구글 리뷰 보기" 버튼 클릭을 처리할 때 읽어간다. 같은 `x`/`y`로 `js/shared/place-photo.js`를 통해 카드에 구글 Place Photos 사진도 붙인다(검색 결과/나를 위한 추천/인기 맛집과 동일한 공용 헬퍼 재사용).
- `index.html`의 "지금 뜨는 인기 맛집 TOP 5"(`#popular`) + `js/home/popular-places.js`, 히어로의 "오늘의 추천 받기" + `js/home/today-pick.js` — 둘 다 모든 이용자가 담은 횟수를 합산한 Postgres 집계 함수 `top_saved_places(limit_count int)`(DDL은 `supabase/functions/top_saved_places.sql`, `SECURITY DEFINER`)를 RPC로 호출한다. `saved_places`는 RLS로 자기 것만 조회되므로 일반 select로는 전체 집계를 낼 수 없어서다. 이 함수는 `place_id`/가게 이름/카테고리/주소/좌표(`x`, `y`)/담긴 횟수만 반환하고 `user_id`는 절대 내보내지 않으며, RLS는 테이블에 그대로 켜져 있다(끄지 않음). `anon`/`authenticated` 모두 실행 권한이 있어 비로그인 방문자도 볼 수 있다. `popular-places.js`는 limit 5로 순위를 보여주고 각 카드에 `place_id` 기반 카카오맵 링크와, `x`/`y`로 `js/shared/place-photo.js`(아래 참고)를 통해 구글 Place Photos 사진을 붙인다. `today-pick.js`는 limit 20으로 더 넉넉한 후보군을 받아 `save_count`에 비례한 가중치로 클라이언트에서 무작위 추첨("가중치 랜덤 추천")하고, 모달로 결과 + 카카오맵 링크 + "다시 뽑기"(같은 후보군 재사용, 재요청 없음)를 보여준다.
- `index.html`의 "나를 위한 추천"(`#recommendations`, 로그인 시에만 노출) + `js/home/recommendations.js` — 내가 담은 가게들(`user_id` 필터 없이 RLS로 "내 것만" 조회)의 `category_name` 중 가장 자주 담은 카테고리를 뽑아, 카카오 로컬 API로 같은 카테고리의 다른 가게를 검색해 보여준다. 이미 담은 가게(`place_id`)는 결과에서 제외. 추천할 게 없으면(비로그인·담은 게 없음·검색 결과 없음) 섹션 자체를 숨겨 메인 화면을 어수선하게 만들지 않는다. 카카오 검색 결과에 이미 좌표(`x`/`y`)가 있으므로, 각 카드에 `js/shared/place-photo.js`를 통해 구글 Place Photos 사진도 붙인다.
- `js/shared/place-photo.js`(`window.HiddenGemPlacePhoto.attach(root, {name, lat, lng})`) — 카드에 구글 Place Photos 사진을 붙이는 공용 헬퍼. `search.html`의 검색 결과 카드(`js/search/kakao-search.js`), "나를 위한 추천"(`js/home/recommendations.js`), "인기 맛집"(`js/home/popular-places.js`), `my-page.html`의 맛집 주머니 카드(`js/my-page/my-page.js`) 네 곳이 공유한다 — 카드 마크업이 전부 `<img data-field="photo">`(기본 `class="hidden"`) + `[data-field="photo-placeholder"]`(회색 "사진" 텍스트) 계약을 따른다. `/api/place-photo?name=...&lat=...&lng=...&maxWidth=480`로 `img.src`를 세팅하면, 이 엔드포인트가 이름+좌표로 구글 장소를 찾아(`api/_lib/google-places.js`의 `findNearbyPlaceId` 재사용) 대표 사진의 실제 이미지 URL로 **302 리다이렉트**한다(리다이렉트 목적지는 키가 필요 없는 구글 CDN URL이라 `GOOGLE_PLACES_API_KEY`가 노출되지 않는다). 매칭 실패/사진 없음이면 404이고, `img`의 `error` 이벤트에서 플레이스홀더로 되돌아간다(`load` 이벤트에서 플레이스홀더를 숨기고 `img`를 보여줌). **주의**: `img`에 `loading="lazy"`를 절대 쓰지 말 것 — 사진이 로드되기 전까지 `hidden`(`display:none`)으로 감춰져 있는데, `display:none` 요소는 레이아웃 박스가 없어 lazy-loading의 뷰포트 판정이 영원히 통과하지 못해 요청 자체가 발생하지 않는 실제 버그가 있었다. 카드 개수만큼 Google API 호출이 추가로 발생하므로 비용/쿼터에 유의(검색 결과 최대 15개, 나를 위한 추천 4개, 인기 맛집 5개, 맛집 주머니는 사용자가 담은 전체 개수만큼).
- `index.html`의 "방금 다녀왔어요"(`#reviews`) + `js/home/recent-reviews.js` — `top_saved_places`와 동일한 이유·패턴으로, 전체 이용자의 `visit_reviews`를 최신순으로 합쳐 보여주는 Postgres 집계 함수 `recent_visit_reviews(limit_count int)`(DDL은 `supabase/functions/recent_visit_reviews.sql`, `SECURITY DEFINER`, `anon`/`authenticated` 실행 권한)를 RPC로 호출한다. 가게 정보 + 만족여부 + 한줄평 + 작성 시각만 반환하고 `user_id`는 내보내지 않는다. "만족"은 `open`, "불만족"은 `negative` 색상 배지로 표시하고, 작성 시각은 분전/시간전/어제/N일전/날짜로 클라이언트에서 상대 시간 변환한다.
- `supabase/tables/saved_places.sql` / `supabase/functions/top_saved_places.sql` / `supabase/seeds/seed_dummy_saved_places.sql` / `supabase/tables/visit_reviews.sql` / `supabase/functions/recent_visit_reviews.sql` / `supabase/seeds/seed_dummy_visit_reviews.sql` — Supabase SQL Editor에서 직접 실행하는 DDL·시드 스크립트 모음(이 저장소에는 마이그레이션 도구가 없어 실행은 항상 수동). 폴더는 성격별로 나뉘어 있다: `tables/`(테이블 DDL), `functions/`(RPC 집계 함수), `seeds/`(더미 데이터). `top_saved_places.sql`은 반환 컬럼이 바뀔 때(예: `place_id`/`category_name`/`address` 추가) `drop function if exists`부터 하고 다시 만든다 — Postgres는 함수 반환 타입이 달라지면 `create or replace`만으로 안 되기 때문. 이 파일은 여러 번 재실행해도 안전하니, 함수를 수정했다면 사용자에게 다시 실행해 달라고 안내할 것. `seed_dummy_saved_places.sql`은 인기 랭킹·추천 기능을 데이터 없이도 확인할 수 있도록 `saved_places`에 더미 100건을 채운다 — FK 때문에 실제 `auth.users`가 필요해 `dummy-user-%@hiddengem.test` 이메일의 로그인 불가능한 더미 계정 20개를 함께 만들고, 가게 15곳은 place_id/좌표를 지어내지 않고 카카오 로컬 API 검색 결과에서 그대로 옮겨 담았다(가짜 place_id/좌표를 썼던 예전 버전은 "카카오맵에서 보기" 링크가 존재하지 않는 페이지로 연결되고 `/api/place-photo`가 이름+좌표 매칭에 실패해 사진도 항상 플레이스홀더로 남는 문제가 있었다). 정리(삭제)는 place_id가 아니라 더미 계정(`user_id`) 기준으로 하며, 파일 하단에 주석으로 포함되어 있다. `seed_dummy_visit_reviews.sql`은 같은 더미 계정을 재사용해 `visit_reviews`에 더미 12건을 채우므로(먼저 `seed_dummy_saved_places.sql`을 실행해 두어야 함), "방금 다녀왔어요" 섹션도 바로 확인할 수 있다.
- `server.js` — 의존성 없는(Node 내장 모듈만 사용) 로컬 개발 서버. 정적 파일 서빙 + `/api/google-review`, `/api/kakao-config`, `/api/analyze-reviews`(POST 바디 파싱 포함), `/api/supabase-config` 처리를 한 프로세스에서 제공한다.

## 실행 / 미리보기

**항상 `server.js`로 실행하세요.** 카카오 검색과 구글 리뷰 기능 모두 `/api/kakao-config`, `/api/google-review` 엔드포인트에 의존하므로, `npx serve .` 같은 순수 정적 서빙으로는 두 기능 모두 동작하지 않습니다(랜딩 페이지 `index.html`만 볼 때는 정적 서빙도 무방). 린트나 테스트 명령은 따로 없습니다 — 브라우저에서 시각적으로 확인하며 검증하세요.

### 환경변수(.env) 설정 및 실행 방법

1. `.env.example`을 복사해 `.env`로 저장하고 `KAKAO_REST_API_KEY`, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 각각 실제 값으로 채웁니다(`.env`는 `.gitignore`에 등록되어 커밋되지 않음).
   - Supabase 값은 대시보드 > 프로젝트 선택 > Project Settings > API에서 확인합니다.
   - 로그인 기능을 쓰려면 Supabase 대시보드 > Authentication > Sign In / Providers > Email에서 **"Confirm email"을 꺼야** 회원가입 즉시 로그인까지 진행됩니다(이 설정은 MCP 도구로 변경할 수 없어 대시보드에서 직접 꺼야 함). 켜져 있으면 회원가입 시 확인 메일을 보내려다 무료 티어 이메일 발송 제한(rate limit)에 걸릴 수 있습니다.
2. **로컬 확인**: `node server.js` (또는 `npm run dev`)로 실행 후 `http://localhost:3000/search.html`에서 확인합니다. 정적 파일 서빙과 `/api/*` 처리를 같은 프로세스가 담당합니다.
   - 대안: `npx vercel dev`로 Vercel 서버리스 함수 실행 환경을 그대로 로컬에서 재현할 수도 있습니다(이 경우 Vercel CLI가 `.env`를 자동으로 읽지 않으므로 `vercel env pull`이나 CLI 프롬프트로 환경변수를 등록해야 함).
3. **Vercel 배포**: 이 저장소를 그대로 Vercel 프로젝트로 연결하면 정적 파일과 `api/` 폴더의 서버리스 함수가 자동으로 인식됩니다(별도 `vercel.json` 불필요). Vercel 프로젝트 설정 > Environment Variables에 `KAKAO_REST_API_KEY`, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 등록해야 배포 환경에서 기능이 모두 동작합니다.
4. 환경변수가 없으면: `GOOGLE_PLACES_API_KEY` 누락 시 `/api/google-review`가 500 에러를 반환하고 리뷰 모달에 "리뷰를 불러오지 못했습니다" 안내가 표시되며, `KAKAO_REST_API_KEY` 누락 시 `/api/kakao-config`가 빈 문자열을 내려줘 검색 결과 영역에 "카카오 API 키를 설정해주세요" 안내가 표시되고, `GEMINI_API_KEY` 누락 시 `/api/analyze-reviews`가 500 에러를 반환해 "AI 리뷰 분석" 영역에 "AI 분석 결과를 불러오지 못했습니다" 안내가 표시됩니다. `SUPABASE_URL`/`SUPABASE_ANON_KEY` 누락 시 로그인 버튼 클릭 시 안내 알림만 뜨고 다른 기능에는 영향이 없습니다.

### 참고: `hidden` 속성 + Tailwind display 유틸리티 동시 사용 주의

`#review-modal-backdrop[hidden]{display:none}`을 `<style>`에 id 선택자로 강제한 전례가 있습니다 — `hidden` 속성과 Tailwind의 `flex`(또는 `grid`) 유틸리티 클래스는 CSS 특이도가 동점이라, 같은 요소에 함께 쓰면 나중에 로드되는 Tailwind가 이겨서 `hidden`이 무시되는 버그가 생깁니다. `hidden`으로 토글하는 요소 자체에는 `flex`/`grid` 클래스를 두지 말고(자식 요소에만 사용), 부득이 함께 써야 한다면 이 파일처럼 id 선택자로 오버라이드를 추가하세요.

## 디자인 시스템 (`docs/DESIGN.md`가 기준)

세 페이지(`index.html`/`search.html`/`my-page.html`) 모두 `<head>`의 인라인 `tailwind.config` 스크립트 블록을 통해 `docs/DESIGN.md`의 토큰을 동일한 이름으로 구현합니다(카드 그리드·사진 중심의 에어비앤비 스타일, 코랄 강조색 — 예전의 테라코타 팔레트는 폐기됐습니다):

- 색상: `base` `#FFFFFF`, `surface` `#F7F7F7`(보조 배경), `ink` `#222222`, `coral` `#FF385C`(유일한 강조색), `coral-dark` `#E61E4D`(강조 hover/눌림), `open` `#00A66C`, `closed` `#767676`, `negative` `#D92D20`.
- 폰트: 단일 패밀리인 Pretendard(`orioncactus/pretendard` CDN에서 로드), `fontFamily.sans`에 매핑.
- 모서리 반경: `card` = 12px, 버튼/입력/뱃지는 pill(완전 라운드).
- 카드 elevation: `.card-shadow`(기본 `0 2px 8px rgba(34,34,34,.08)`, hover 시 `0 12px 28px rgba(34,34,34,.16)` + `translateY(-4px)`) 하나만 허용 — 다중 레이어/뉴모피즘 금지.
- 반응형 브레이크포인트: `tailwind.config`에 커스텀 `screens`로 `tablet: 768px` / `desktop: 1440px`을 추가해 사용(기본 `md`/`xl`/`2xl`이 `docs/DESIGN.md`의 기준과 맞지 않기 때문). 모바일 우선(Mobile First) 설계 원칙은 `docs/DESIGN.md`의 "9. 반응형 브레이크포인트" 참고.

**`docs/DESIGN.md`의 명시적 금지사항** — 새로 추가하기 전에 확인하세요:

- 배경/버튼에 그러데이션 금지.
- 다중 레이어 그림자·뉴모피즘 금지(단일 레이어 `card-shadow`만 허용).
- 글래스모피즘/블러 배경 금지.
- 다크모드를 기본값으로 사용 금지.
- 강조/CTA 색상으로 파란색 사용 금지 — 코랄(`#FF385C`)이 고정 강조색.
- 장식용 일러스트/마스코트 금지 — 사진이나 아이콘만 사용.
- 장식적 모션(회전, 바운스, 파티클) 금지 — 모션은 피드백 목적만, 약 100~150ms, `ease-out`.
- 폰트 역할은 2개(디스플레이/본문)만 — 현재 둘 다 Pretendard의 다른 굵기이며, 세 번째 폰트를 추가하지 말 것.
- 광고 배너/팝업 금지.

## `index.html` 페이지 구조

아래 순서로 섹션이 구성됩니다(괄호는 정적 목업인지 실제 동작 기능인지 표시):

1. 헤더 — 로고 + 로그인 컨트롤 + 퀵점프 칩 바(`#quick-nav`, 실제 동작. 위 `js/shared/quick-nav.js` 참고). `sticky top-0`이라 스크롤 중에도 항상 보인다.
2. 히어로 — 작은 강조 문구, 크고 굵은 헤드라인, 서브카피, CTA 2개(둘 다 실제 동작 — "오늘의 추천 받기"는 `js/home/today-pick.js`의 가중치 랜덤 추천 모달 / "근처 맛집 둘러보기"는 `search.html`로 이동).
3. `#recommendations` — "나를 위한 추천"(실제 동작, 로그인 + 담은 가게가 있을 때만 노출). 위 `js/home/recommendations.js` 참고.
4. `#popular` — "지금 뜨는 인기 맛집 TOP 5"(실제 동작): 순위 배지 + 가게 이름 + 담긴 횟수 카드. 위 `js/home/popular-places.js` 참고.
5. `#reviews` — "방금 다녀왔어요"(실제 동작): 만족/불만족 배지 + 한줄평 카드가 2열 그리드로 배치. 위 `js/home/recent-reviews.js` 참고. `my-page.html`의 "다녀왔어요" 버튼으로 남긴 후기가 여기 모인다.
6. 푸터 — 다크(`bg-ink`) 배경, 로고 + 내비게이션 + 저작권 문구.

(예전에 있던 "서비스 특징"(`#features`) 정적 카드 4개는 실제 기능과 연결되지 않는 저가치 콘텐츠라 판단해 섹션째로 제거했다 — 새로 비슷한 "왜 우리 서비스인지" 류 섹션을 추가하고 싶다면, 실제 데이터/기능과 연결할 수 있는지부터 검토할 것.)

새 섹션이나 식당/리뷰 데이터를 추가할 때는 새로운 레이아웃 원칙을 도입하기보다 이 카드/섹션 패턴을 그대로 따르세요. `search.html`/`my-page.html`도 헤더(로고 + 로그인 컨트롤 + `#quick-nav`)와 색상/버튼/카드 스타일은 동일하게 맞춰져 있습니다.

## 디자인 목업용 Stitch MCP

이 환경에는 `docs/DESIGN.md`로부터 다른 비주얼 목업을 생성할 수 있는 `mcp__stitch__*` MCP 도구가 있습니다. 이 프로젝트에서 사용한 흐름:

1. `create_project` — 새 Stitch 프로젝트 생성.
2. `upload_design_md`(base64로 인코딩한 `docs/DESIGN.md`) → `create_design_system_from_design_md` — `docs/DESIGN.md`를 재사용 가능한 Stitch 디자인 시스템 에셋으로 변환.
3. `generate_screen_from_text`에 해당 에셋을 `designSystem`으로 지정 — 팔레트/타이포그래피에 맞는 화면 생성.

`generate_screen_from_text` 호출은 몇 분씩 걸릴 수 있고, 서버 쪽에서는 생성이 성공했는데도 클라이언트 쪽에서 타임아웃으로 표시되는 경우가 잦습니다 — 무작정 재시도하지 말고, `list_screens`/`get_screen`으로 프로젝트를 폴링해 화면이 실제로 생성됐는지 확인한 뒤 `screenshot.downloadUrl`로 결과를 가져오세요.
