// Hidden Gem - 헤더의 퀵점프 칩 내비게이션(#quick-nav).
// index.html / search.html / my-page.html 세 페이지의 헤더에 공통으로 있는
// "주요 기능 바로가기" 칩 바를 다룬다:
//   1) 같은 페이지 안의 섹션(#popular 등)을 스크롤 중일 때 해당 칩을 활성 표시(스크롤 스파이).
//      대상 섹션이 이 페이지에 없으면(= index.html이 아니면) 조용히 건너뛴다.
//   2) "맛집 주머니" 칩(#quick-nav-saved)은 비로그인 상태에서도 항상 보이게 두고,
//      클릭 시에만 로그인 여부를 확인해 안내 후 로그인 모달을 연다 — "담기" 버튼과
//      동일한 패턴(기능이 있다는 사실 자체는 숨기지 않는다).
//   3) 칩이 화면 밖으로 잘려 가로 스크롤이 더 있다는 걸 알 수 있도록 오른쪽에 페이드를 보여준다.
// js/recommendations.js가 "나를 위한 추천" 칩(#quick-nav-recommendations)의 노출 여부는
// 자신이 직접 관리한다(이 스크립트는 관여하지 않음).

(function () {
  "use strict";

  function init() {
    var navEl = document.getElementById("quick-nav");

    // 이 페이지에 퀵점프 칩 바가 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!navEl) {
      return;
    }

    setupScrollSpy();
    setupSavedPlacesChip();
    setupOverflowFade();
    setupHashReanchor();

    function setupScrollSpy() {
      var chips = Array.prototype.slice.call(
        navEl.querySelectorAll("[data-quick-nav-target]"),
      );
      if (!chips.length) {
        return;
      }

      var chipByTarget = {};
      var sections = []; // 문서 순서 유지 — "현재 보이는 것 중 제일 위" 판정에 씀
      chips.forEach(function (chip) {
        var targetId = chip.dataset.quickNavTarget;
        var sectionEl = document.getElementById(targetId);
        if (!sectionEl) {
          return;
        }
        chipByTarget[targetId] = chip;
        sections.push(sectionEl);
      });
      if (!sections.length) {
        return;
      }

      var headerEl = navEl.closest("header") || navEl;
      var visible = {}; // targetId -> true (현재 관찰 영역과 겹치는 섹션들)
      var observer = null;

      // 헤더가 sticky라 섹션이 그 밑에 딱 붙어 스크롤되면 제목이 헤더에 가려진다
      // (앵커로 바로 점프했을 때 특히 심함) — 헤더 높이만큼 scroll-margin-top을
      // 줘서 항상 헤더 아래에 여유를 두고 멈추게 한다. 로그인 여부/화면 폭에 따라
      // 헤더 높이가 바뀔 수 있어 리사이즈 때마다 다시 측정한다.
      function applyScrollMargin() {
        var headerHeight = Math.ceil(headerEl.getBoundingClientRect().height);
        sections.forEach(function (sectionEl) {
          sectionEl.style.scrollMarginTop = headerHeight + 16 + "px";
        });
        return headerHeight;
      }

      function setupObserver() {
        if (observer) {
          observer.disconnect();
        }
        var headerHeight = applyScrollMargin();

        observer = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              visible[entry.target.id] = entry.isIntersecting;
            });
            applyActiveChip();
          },
          {
            rootMargin: "-" + (headerHeight + 24) + "px 0px -60% 0px",
            threshold: 0,
          },
        );
        sections.forEach(function (sectionEl) {
          observer.observe(sectionEl);
        });
      }

      // 여러 섹션이 한 번에 관찰 영역과 겹칠 수 있어(entries가 배치로 옴), 매번
      // "현재 보이는 것 중 문서상 가장 위에 있는 섹션" 하나로 다시 계산한다 —
      // 스크롤을 빠져나간 섹션도 여기서 자연스럽게 비활성화된다. 아무것도 안
      // 보이면(예: 페이지 맨 아래 푸터) 마지막 상태를 그대로 둔다(깜빡임 방지).
      function applyActiveChip() {
        var activeId = null;
        for (var i = 0; i < sections.length; i++) {
          if (visible[sections[i].id]) {
            activeId = sections[i].id;
            break;
          }
        }
        if (!activeId) {
          return;
        }
        chips.forEach(function (c) {
          c.classList.toggle("active", chipByTarget[activeId] === c);
        });
      }

      // 다른 페이지에서 앵커(#popular 등)로 막 도착했을 때, IntersectionObserver의
      // 첫 콜백을 기다리지 않고 URL 해시로 바로 활성 칩을 맞춰 둔다 — 관찰자가
      // 따라잡을 때까지의 "칩이 안 켜져 있는" 틈을 없앤다.
      var initialTargetId = (location.hash || "").slice(1);
      if (chipByTarget[initialTargetId]) {
        visible[initialTargetId] = true;
        applyActiveChip();
      }

      setupObserver();

      var resizeTimer = null;
      window.addEventListener("resize", function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(setupObserver, 150);
      });
    }

    // 다른 페이지에서 앵커(index.html#popular 등)로 막 도착했을 때, 브라우저가 처음
    // 위치를 잡는 시점엔 #recommendations/#popular/#reviews가 아직 "불러오는 중" 상태라
    // 키가 작다 — 그 뒤 데이터가 로드되며 카드들이 들어차 페이지가 길어지면, 이미 스크롤을
    // 마친 위치가 목표 섹션에서 어긋나 버린다("칩을 눌렀는데 엉뚱한 데서 멈춘 것처럼" 보임).
    //
    // 이전엔 ResizeObserver로 document.body 높이 변화를 감시하다 바뀔 때마다 재보정했는데,
    // scrollIntoView() 자체가 레이아웃에 영향을 줘 ResizeObserver를 다시 건드리는
    // 피드백 루프가 생겨 화면이 계속 들썩였다(실제 버그였음). 대신 정해진 시각 몇 번만
    // 다시 스크롤하는 단순한 타이머로 바꾸고, 사용자가 그 사이에 직접 스크롤/터치/키
    // 입력을 하면 즉시 포기한다(사용자가 이미 다른 곳을 보고 있는데 억지로 되돌리지 않도록).
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
