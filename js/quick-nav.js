// Hidden Gem - 헤더의 퀵점프 칩 내비게이션(#quick-nav).
// index.html / search.html / my-page.html 세 페이지의 헤더에 공통으로 있는
// "주요 기능 바로가기" 칩 바를 다룬다. 칩은 "둘러보기"(index.html) / "맛집 검색"
// (search.html) / "맛집 주머니"(my-page.html) 3개뿐이고, 전부 페이지 단위 링크다 —
// 활성 표시는 각 페이지 HTML에 미리 박아둔 정적 마크업(현재 페이지 = 클래스
// "active"가 붙은 <span>, 다른 페이지 = <a> 링크)으로만 결정되고 이 스크립트는
// 활성 상태를 계산하거나 바꾸지 않는다 — 예전엔 index.html 안의 세 섹션(나를 위한
// 추천/인기 맛집/최근 리뷰)마다 별도 칩이 있어서 "지금 어느 섹션을 보고 있는지"를
// 스크롤 위치로 추적해야 했는데, 그 로직이 반복적으로 버그의 원인이었다 — 세 칩을
// "둘러보기" 하나로 합치면서 그 추적 로직 자체를 통째로 없앴다.
// 이 스크립트가 처리하는 것:
//   1) "맛집 주머니" 칩(#quick-nav-saved)은 비로그인 상태에서도 항상 보이게 두고,
//      클릭 시에만 로그인 여부를 확인해 안내 후 로그인 모달을 연다 — "담기" 버튼과
//      동일한 패턴(기능이 있다는 사실 자체는 숨기지 않는다).
//   2) 칩이 화면 밖으로 잘려 가로 스크롤이 더 있다는 걸 알 수 있도록 오른쪽에 페이드를 보여준다.
//   3) index.html 안의 #recommendations/#popular/#reviews로 가는 다른 링크(푸터 등)가
//      아직 남아 있어, 그 앵커로 막 도착했을 때 비동기로 로드되는 콘텐츠 때문에
//      스크롤 위치가 어긋나는 문제를 보정한다(setupHashReanchor).

(function () {
  "use strict";

  function init() {
    var navEl = document.getElementById("quick-nav");

    // 이 페이지에 퀵점프 칩 바가 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!navEl) {
      return;
    }

    setupSavedPlacesChip();
    setupOverflowFade();
    setupHashReanchor();
    scrollActiveChipIntoView();

    // 푸터 등에 남아 있는 index.html#popular/#reviews 같은 앵커 링크로 다른 페이지에서
    // 막 도착했을 때, 브라우저가 처음 위치를 잡는 시점엔 #recommendations/#popular/#reviews가
    // 아직 "불러오는 중" 상태라 키가 작다 — 그 뒤 데이터가 로드되며 카드들이 들어차
    // 페이지가 길어지면, 이미 스크롤을
    // 마친 위치가 목표 섹션에서 어긋나 버린다("칩을 눌렀는데 엉뚱한 데서 멈춘 것처럼" 보임).
    //
    // 이전엔 ResizeObserver로 document.body 높이 변화를 감시하다 바뀔 때마다 재보정했는데,
    // scrollIntoView() 자체가 레이아웃에 영향을 줘 ResizeObserver를 다시 건드리는
    // 피드백 루프가 생겨 화면이 계속 들썩였다(실제 버그였음). 대신 정해진 시각 몇 번만
    // 다시 스크롤하는 단순한 타이머로 바꾸고, 사용자가 그 사이에 직접 스크롤/터치/키
    // 입력을 하면 즉시 포기한다(사용자가 이미 다른 곳을 보고 있는데 억지로 되돌리지 않도록).
    //
    // 헤더가 sticky라 섹션이 그 밑에 딱 붙어 스크롤되면 제목이 헤더에 가려지는 문제도
    // 함께 해결한다 — 헤더 높이만큼 scroll-margin-top을 줘서 항상 헤더 아래에 여유를
    // 두고 멈추게 한다.
    function setupHashReanchor() {
      var targetId = (location.hash || "").slice(1);
      if (!targetId) {
        return;
      }
      var target = document.getElementById(targetId);
      if (!target) {
        return;
      }

      var headerEl = navEl.closest("header") || navEl;
      target.style.scrollMarginTop =
        Math.ceil(headerEl.getBoundingClientRect().height) + 16 + "px";

      var cancelled = false;
      function cancel() {
        cancelled = true;
      }
      ["wheel", "touchstart", "pointerdown", "keydown"].forEach(function (evt) {
        window.addEventListener(evt, cancel, { once: true, passive: true });
      });

      // #recommendations/#popular/#reviews의 데이터 요청이 보통 끝나는 시점에 맞춘
      // 고정된 재시도 3회 — 관찰이 아니라 정해진 시각에만 움직이므로 스스로를
      // 다시 트리거할 수 없다.
      [300, 800, 1600].forEach(function (delay) {
        window.setTimeout(function () {
          if (cancelled) {
            return;
          }
          target.scrollIntoView({ block: "start" });
        }, delay);
      });
    }

    function setupSavedPlacesChip() {
      var savedChip = document.getElementById("quick-nav-saved");
      if (!savedChip) {
        return;
      }

      savedChip.addEventListener("click", function (e) {
        if (!window.HiddenGemAuth) {
          return;
        }
        var user = window.HiddenGemAuth.getUser();
        if (user) {
          return;
        }
        e.preventDefault();
        window.alert("맛집 주머니는 로그인 후 이용할 수 있습니다.");
        var loginBtn = document.getElementById("auth-login-btn");
        if (loginBtn) {
          loginBtn.click();
        }
      });
    }

    // 좁은 화면에서는 칩 바가 가로 스크롤되는데(#quick-nav-scroll), 매 페이지 로드마다
    // 스크롤 위치가 맨 왼쪽으로 초기화된다 — 로드 시 활성 칩을 가로 스크롤 컨테이너
    // 안에서 보이는 위치로 맞춰준다(세로 스크롤에는 영향 없도록 block: "nearest").
    function scrollActiveChipIntoView() {
      var activeChip = navEl.querySelector(".quick-nav-chip.active");
      if (activeChip) {
        activeChip.scrollIntoView({ inline: "nearest", block: "nearest" });
      }
    }

    function setupOverflowFade() {
      var scrollEl = document.getElementById("quick-nav-scroll");
      var fadeEl = navEl.querySelector(".quick-nav-fade");
      if (!scrollEl || !fadeEl) {
        return;
      }

      function updateFade() {
        var hasOverflow =
          scrollEl.scrollWidth - scrollEl.clientWidth > 4 &&
          scrollEl.scrollLeft + scrollEl.clientWidth < scrollEl.scrollWidth - 4;
        fadeEl.classList.toggle("visible", hasOverflow);
      }

      updateFade();
      scrollEl.addEventListener("scroll", updateFade);
      window.addEventListener("resize", updateFade);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
