# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 저장소 개요

이 저장소(`hidden-gem`, GitHub 원격 저장소 `koolunkle/hidden-gem`)는 점심 맛집 리뷰 서비스 **Hidden Gem**의 토이/포트폴리오 프로젝트입니다("점심시간 12분, 고민은 지도 한 장으로 끝낸다"). PRD가 목표로 하는 Next.js/Supabase 스택으로 완전히 구현되어 있지는 않지만(여전히 빌드 시스템·프레임워크 없이 정적 HTML/바닐라 JS 기반), 카카오 로컬 API 맛집 검색과 구글 리뷰 조회는 실제로 동작합니다:

- `PRD.md` — 제품 요구사항: 한 줄 소개, 타깃 사용자 시나리오, 기능 목록(필수/선택), 그리고 **실제 목표 기술 스택**(Next.js(React) + TypeScript, Tailwind CSS, Supabase(Postgres/Auth/Storage), Kakao Map API, Vercel 배포).
- `DESIGN.md` — 비주얼 작업이 반드시 따라야 하는 디자인 가이드.
- `index.html` — 랜딩 페이지의 정적 Tailwind 목업(에어비앤비 스타일).
- `search.html` + `js/kakao-search.js` — 카카오 로컬(Local) API로 맛집을 검색하고 카드 목록으로 보여주는 실제 동작 기능. `KAKAO_REST_API_KEY`는 카카오 정책상 브라우저에 그대로 노출되는 구조(REST 키를 클라이언트에서 직접 호출)라 서버에서 완전히 숨길 필요는 없지만, 정적 JS 파일에 실제 키를 하드코딩해 커밋하지 않도록 `/api/kakao-config` 엔드포인트로 내려받는다(아래 "환경변수(.env) 설정" 절 참고).
- `search.html`의 검색 결과 카드 + `js/google-review.js` — 카드를 클릭하면 구글 리뷰(평점/리뷰 개수/리뷰 내용/구글맵 링크)를 모달로 보여주는 기능. Google API 키는 브라우저에 노출하지 않고 서버(로컬 서버 또는 Vercel 서버리스 함수)를 거쳐서만 사용한다.
- `api/google-review.js` + `api/_lib/google-places.js` — Google Places API(New)를 호출하는 서버 로직. `api/google-review.js`는 Vercel 서버리스 함수 엔트리포인트, `api/_lib/google-places.js`는 실제 검색/상세조회/거리계산 로직으로 로컬 서버와 공유된다.
- `api/kakao-config.js` + `api/_lib/kakao-config.js` — `KAKAO_REST_API_KEY` 환경변수를 읽어 `window.KAKAO_REST_API_KEY = "..."` 한 줄짜리 스크립트를 응답하는 엔드포인트. `search.html`이 `<script src="/api/kakao-config">`로 그대로 불러 쓴다. Google 쪽과 동일하게 로컬 서버와 Vercel 함수가 `api/_lib/kakao-config.js` 로직을 공유한다.
- 리뷰 모달의 "AI 리뷰 분석" 영역(`#review-ai-section`) + `js/google-review-analysis.js` — 구글 리뷰가 렌더링되면(리뷰가 1개 이상 있을 때만) Gemini API로 감정 분류(긍정/보통/부정 비율 막대)·핵심 키워드(CSS 태그 클라우드, 중요도=글자크기·맥락=색상)·한 줄 요약(말풍선)을 자동으로 분석해 보여준다. `js/google-review.js`와는 직접 호출 없이 `hiddengem:review-modal-opening`/`hiddengem:google-review-rendered` CustomEvent로만 연동된다(느슨한 결합 — 기존 IIFE들이 DOM으로만 결합되는 스타일 유지). 분석 결과는 `localStorage`(`hiddenGem:googleReviewAI:v1:` 접두사, placeId 기준)에 캐싱되어 같은 가게를 재클릭해도 재호출하지 않는다.
- `api/analyze-reviews.js` + `api/_lib/gemini-review-analysis.js` — Gemini API(REST, SDK 미사용)를 호출해 리뷰를 분석하는 서버 로직. `responseSchema`로 구조화된 JSON 응답을 강제하고, 감정 개수는 모델이 아니라 서버가 리뷰별 라벨을 세어 집계한다(모델의 산술 오류 방지). Gemini 키(`GEMINI_API_KEY`)도 Google Places 키와 마찬가지로 서버 전용 — 브라우저에 노출하지 않는다.
- `search.html` 헤더의 로그인 버튼/모달 + `js/auth.js` — Supabase Auth(이메일/비밀번호) 기반 로그인·회원가입 기능. 비밀번호 처리는 전부 Supabase에 위임한다. 회원가입은 Supabase 프로젝트의 "Confirm email"이 꺼져 있어야 이메일 인증 대기 없이 즉시 로그인까지 이어진다(Supabase 대시보드 > Authentication > Sign In / Providers > Email에서 직접 꺼야 함 — MCP 도구로는 변경 불가). 로그인 상태는 `supabase-js`가 자동으로 `localStorage`에 세션을 저장해 새로고침해도 유지된다. 로그인하지 않아도 카카오 검색/구글 리뷰 조회 등 기존 기능은 그대로 누구나 쓸 수 있다 — 로그인은 추후 추가될 "맛집 담기" 등 회원 전용 기능을 위한 기반이다. 다른 기능이 로그인 여부/사용자 정보를 가져다 쓸 수 있도록 `window.HiddenGemAuth`(`getSession`/`getUser`/`onChange`)와 `hiddengem:auth-changed` CustomEvent를 함께 제공한다(기존 스크립트들과 동일한 느슨한 결합 스타일).
- `api/supabase-config.js` + `api/_lib/supabase-config.js` — `SUPABASE_URL`/`SUPABASE_ANON_KEY` 환경변수를 읽어 `window.SUPABASE_URL`/`window.SUPABASE_ANON_KEY` 스크립트를 응답하는 엔드포인트. 카카오 REST 키와 동일한 이유(정적 JS 파일에 실제 값을 하드코딩해 커밋하지 않기 위함)로 `api/kakao-config.js`와 같은 패턴을 따른다. `search.html`은 이 엔드포인트로 값을 받은 뒤 `@supabase/supabase-js`(CDN)로 클라이언트를 만든다.
- `local-server.js` — 의존성 없는(Node 내장 모듈만 사용) 로컬 개발 서버. 정적 파일 서빙 + `/api/google-review`, `/api/kakao-config`, `/api/analyze-reviews`(POST 바디 파싱 포함), `/api/supabase-config` 처리를 한 프로세스에서 제공한다.

## 실행 / 미리보기

**항상 `local-server.js`로 실행하세요.** 카카오 검색과 구글 리뷰 기능 모두 `/api/kakao-config`, `/api/google-review` 엔드포인트에 의존하므로, `npx serve .` 같은 순수 정적 서빙으로는 두 기능 모두 동작하지 않습니다(랜딩 페이지 `index.html`만 볼 때는 정적 서빙도 무방). 린트나 테스트 명령은 따로 없습니다 — 브라우저에서 시각적으로 확인하며 검증하세요.

### 환경변수(.env) 설정 및 실행 방법

1. `.env.example`을 복사해 `.env`로 저장하고 `KAKAO_REST_API_KEY`, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 각각 실제 값으로 채웁니다(`.env`는 `.gitignore`에 등록되어 커밋되지 않음).
   - Supabase 값은 대시보드 > 프로젝트 선택 > Project Settings > API에서 확인합니다.
   - 로그인 기능을 쓰려면 Supabase 대시보드 > Authentication > Sign In / Providers > Email에서 **"Confirm email"을 꺼야** 회원가입 즉시 로그인까지 진행됩니다(이 설정은 MCP 도구로 변경할 수 없어 대시보드에서 직접 꺼야 함). 켜져 있으면 회원가입 시 확인 메일을 보내려다 무료 티어 이메일 발송 제한(rate limit)에 걸릴 수 있습니다.
2. **로컬 확인**: `node local-server.js` (또는 `npm run dev`)로 실행 후 `http://localhost:3000/search.html`에서 확인합니다. 정적 파일 서빙과 `/api/*` 처리를 같은 프로세스가 담당합니다.
   - 대안: `npx vercel dev`로 Vercel 서버리스 함수 실행 환경을 그대로 로컬에서 재현할 수도 있습니다(이 경우 Vercel CLI가 `.env`를 자동으로 읽지 않으므로 `vercel env pull`이나 CLI 프롬프트로 환경변수를 등록해야 함).
3. **Vercel 배포**: 이 저장소를 그대로 Vercel 프로젝트로 연결하면 정적 파일과 `api/` 폴더의 서버리스 함수가 자동으로 인식됩니다(별도 `vercel.json` 불필요). Vercel 프로젝트 설정 > Environment Variables에 `KAKAO_REST_API_KEY`, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 등록해야 배포 환경에서 기능이 모두 동작합니다.
4. 환경변수가 없으면: `GOOGLE_PLACES_API_KEY` 누락 시 `/api/google-review`가 500 에러를 반환하고 리뷰 모달에 "리뷰를 불러오지 못했습니다" 안내가 표시되며, `KAKAO_REST_API_KEY` 누락 시 `/api/kakao-config`가 빈 문자열을 내려줘 검색 결과 영역에 "카카오 API 키를 설정해주세요" 안내가 표시되고, `GEMINI_API_KEY` 누락 시 `/api/analyze-reviews`가 500 에러를 반환해 "AI 리뷰 분석" 영역에 "AI 분석 결과를 불러오지 못했습니다" 안내가 표시됩니다. `SUPABASE_URL`/`SUPABASE_ANON_KEY` 누락 시 로그인 버튼 클릭 시 안내 알림만 뜨고 다른 기능에는 영향이 없습니다.

### 참고: `hidden` 속성 + Tailwind display 유틸리티 동시 사용 주의

`#review-modal-backdrop[hidden]{display:none}`을 `<style>`에 id 선택자로 강제한 전례가 있습니다 — `hidden` 속성과 Tailwind의 `flex`(또는 `grid`) 유틸리티 클래스는 CSS 특이도가 동점이라, 같은 요소에 함께 쓰면 나중에 로드되는 Tailwind가 이겨서 `hidden`이 무시되는 버그가 생깁니다. `hidden`으로 토글하는 요소 자체에는 `flex`/`grid` 클래스를 두지 말고(자식 요소에만 사용), 부득이 함께 써야 한다면 이 파일처럼 id 선택자로 오버라이드를 추가하세요.

## 디자인 시스템 (`DESIGN.md`가 기준)

`index.html`은 `<head>`의 인라인 `tailwind.config` 스크립트 블록을 통해 `DESIGN.md`의 토큰을 문서와 동일한 이름으로 그대로 구현합니다:

- 색상: `base` `#FAF8F5`, `ink` `#2B2825`, `terracotta` `#C96F4A`(유일한 강조색), `open` `#6B8F71`, `closed` `#B5544A`.
- 폰트: 단일 패밀리인 Pretendard(`orioncactus/pretendard` CDN에서 로드), `fontFamily.sans`에 매핑.
- 모서리 반경: `card` = 8px.
- 여백은 의도적으로 넉넉함(일반 대비 약 2배): 카드 내부 padding 32px, 섹션 간 간격 96px.
- 반응형 브레이크포인트: 모바일 375px / 태블릿 768px / 데스크탑 1440px, 모바일 우선(Mobile First)으로 설계. 자세한 원칙(컬럼 수 확장, 여백/타이포 축소 규칙)은 `DESIGN.md`의 "9. 반응형 브레이크포인트" 참고. 참고로 Tailwind 기본 브레이크포인트 중 `md`(768px)는 태블릿 기준과 일치하지만, 데스크탑 기준(1440px)은 기본 `xl`(1280px)/`2xl`(1536px)과 맞지 않으므로 정확히 맞추려면 `tailwind.config`에 커스텀 `screens` 값을 추가해야 함.

**`DESIGN.md`의 명시적 금지사항** — `index.html`에 무언가 새로 추가하기 전에 확인하세요:

- 배경/버튼에 그러데이션 금지.
- 다중 레이어 그림자·뉴모피즘 금지(미세한 `card-shadow` 유틸리티 하나만 허용).
- 글래스모피즘/블러 배경 금지.
- 다크모드를 기본값으로 사용 금지.
- 강조/CTA 색상으로 파란색 사용 금지 — 테라코타(`#C96F4A`)가 고정 강조색.
- 장식용 일러스트/마스코트 금지 — 사진이나 아이콘만 사용.
- 장식적 모션(회전, 바운스, 파티클) 금지 — 모션은 피드백 목적만, 약 100~150ms, `ease-out`.
- 폰트 역할은 2개(디스플레이/본문)만 — 현재 둘 다 Pretendard의 다른 굵기이며, 세 번째 폰트를 추가하지 말 것.
- 광고 배너/팝업 금지.

## `index.html` 페이지 구조

`DESIGN.md`가 지정한 흐름(빠른 추천 → 직접 탐색)에 맞춰 아래 순서로 섹션이 구성됩니다:

1. 헤더 — 로고 + 내비게이션 링크(`#popular`, `#reviews`, `#features`) + CTA 버튼.
2. 히어로 — 작은 강조 문구, 크고 굵은 헤드라인, 서브카피, CTA 2개("오늘의 추천 받기" / "근처 맛집 둘러보기").
3. `#popular` — "지금 뜨는 인기 맛집": 식당 카드 그리드(사진 placeholder, 이름, `open`/`closed` 색상을 쓴 영업 상태 뱃지, 카테고리+도보 거리, 별점).
4. `#reviews` — "방금 올라온 리뷰": 한 줄 리뷰가 2열 그리드로 배치.
5. `#features` — "Hidden Gem이 다른 이유": 번호(01~04)가 매겨진 테라코타 강조 카드 4개.
6. 푸터 — 다크(`bg-ink`) 배경, 로고 + 내비게이션 + 저작권 문구.

새 섹션이나 식당/리뷰 데이터를 추가할 때는 새로운 레이아웃 원칙을 도입하기보다 이 카드/섹션 패턴을 그대로 따르세요.

## 디자인 목업용 Stitch MCP

이 환경에는 `DESIGN.md`로부터 다른 비주얼 목업을 생성할 수 있는 `mcp__stitch__*` MCP 도구가 있습니다. 이 프로젝트에서 사용한 흐름:

1. `create_project` — 새 Stitch 프로젝트 생성.
2. `upload_design_md`(base64로 인코딩한 `DESIGN.md`) → `create_design_system_from_design_md` — `DESIGN.md`를 재사용 가능한 Stitch 디자인 시스템 에셋으로 변환.
3. `generate_screen_from_text`에 해당 에셋을 `designSystem`으로 지정 — 팔레트/타이포그래피에 맞는 화면 생성.

`generate_screen_from_text` 호출은 몇 분씩 걸릴 수 있고, 서버 쪽에서는 생성이 성공했는데도 클라이언트 쪽에서 타임아웃으로 표시되는 경우가 잦습니다 — 무작정 재시도하지 말고, `list_screens`/`get_screen`으로 프로젝트를 폴링해 화면이 실제로 생성됐는지 확인한 뒤 `screenshot.downloadUrl`로 결과를 가져오세요.
