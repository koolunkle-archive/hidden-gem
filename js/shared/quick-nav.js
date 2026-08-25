// Hidden Gem - 헤더 퀵점프 칩 내비게이션(#quick-nav, 세 페이지 공통).
// 칩은 "홈"/"맛집 검색"/"맛집 주머니" 페이지 단위 링크뿐이다. 활성 표시는 각 HTML의
// 정적 마크업(현재 페이지=class="active" <span>, 그 외=<a>)으로만 결정되며 이 스크립트는
// 활성 상태를 계산하거나 바꾸지 않는다.

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

    // 외부에 남아 있는 index.html#popular/#reviews 같은 해시 링크로 도착했을 때를 대비한
    // 하위 호환 처리. 도착 시점엔 대상 섹션이 "불러오는 중" 상태로 낮아, 데이터 로드 후
    // 카드가 들어차면 이미 스크롤한 위치가 어긋난다 — 정해진 시각(300/800/1600ms)에
    // scrollIntoView를 재시도해 보정한다. 사용자가 직접 스크롤/터치/키 입력을 하면 즉시 포기.
    //
    // 주의: ResizeObserver로 body 높이를 감시하며 재보정하면 scrollIntoView 자체가
    // 레이아웃을 바꿔 다시 옵저버를 트리거하는 피드백 루프가 생긴다 — 반드시 고정 타이머로.
    //
    // scroll-margin-top은 sticky 헤더에 섹션 제목이 가려지지 않도록 헤더 높이만큼 확보한다.
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

    // 가로 스크롤 칩 바는 페이지 로드마다 맨 왼쪽으로 초기화되므로 활성 칩을 보이는 위치로 맞춘다.
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
