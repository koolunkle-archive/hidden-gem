# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 저장소 개요

이 저장소(`hidden-gem`, GitHub 원격 저장소 `koolunkle/hidden-gem`)는 점심 맛집 리뷰 서비스 **Hidden Gem**의 토이/포트폴리오 프로젝트입니다("점심시간 12분, 고민은 지도 한 장으로 끝낸다"). 현재는 기획 문서와 정적 랜딩 페이지 프로토타입 하나만 있으며, 실제 애플리케이션 코드·빌드 시스템·`package.json`·테스트는 없습니다:

- `PRD.md` — 제품 요구사항: 한 줄 소개, 타깃 사용자 시나리오, 기능 목록(필수/선택), 그리고 **실제 목표 기술 스택**(Next.js(React) + TypeScript, Tailwind CSS, Supabase(Postgres/Auth/Storage), Kakao Map API, Vercel 배포).
- `DESIGN.md` — 비주얼 작업이 반드시 따라야 하는 디자인 가이드.
- `index.html` — 랜딩 페이지의 정적 Tailwind 목업. 어디까지나 디자인 프로토타입이며, PRD가 목표로 하는 Next.js/Supabase 스택으로 구현된 것이 **아닙니다**.

## 실행 / 미리보기

빌드 과정이 없습니다. `index.html`을 브라우저에서 바로 열거나, 정적으로 서빙하세요:

```bash
npx serve .
```

린트나 테스트 명령은 없습니다 — 브라우저에서 시각적으로 확인하며 검증하세요.

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
