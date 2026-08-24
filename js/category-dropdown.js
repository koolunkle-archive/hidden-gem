// Hidden Gem - 맛집 검색(search.html)의 카테고리 드롭다운(#search-category-dropdown).
// 네이티브 <select>의 옵션 팝업은 브라우저마다 다른 OS 기본 스타일로 렌더링되어
// 나머지 pill/카드 UI와 톤이 어긋나므로, 버튼 + 커스텀 리스트박스(role="listbox")로
// 직접 구현한다. 실제 검색에 쓰이는 값은 화면에서 숨긴 <select id="search-category-select">가
// 그대로 들고 있어(js/kakao-search.js가 제출 시 .value를 읽어감), 검색 로직은 손대지 않는다.

(function () {
  "use strict";

  function init() {
    var dropdown = document.getElementById("search-category-dropdown");
    if (!dropdown) {
      return;
    }

    var trigger = document.getElementById("search-category-trigger");
    var triggerLabel = document.getElementById("search-category-trigger-label");
    var listbox = document.getElementById("search-category-listbox");
    var hiddenSelect = document.getElementById("search-category-select");
    var options = Array.prototype.slice.call(
      listbox.querySelectorAll('[role="option"]'),
    );

    function isOpen() {
      return trigger.getAttribute("aria-expanded") === "true";
    }

    function openDropdown() {
      listbox.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      var selected = options.filter(function (opt) {
        return opt.getAttribute("aria-selected") === "true";
      })[0];
      (selected || options[0]).focus();
    }

    function closeDropdown(focusTrigger) {
      listbox.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (focusTrigger) {
        trigger.focus();
      }
    }

    function selectOption(option) {
      options.forEach(function (opt) {
        opt.setAttribute("aria-selected", opt === option ? "true" : "false");
      });
      triggerLabel.textContent = option.textContent.trim();
      hiddenSelect.value = option.dataset.value;
      closeDropdown(true);
    }

    trigger.addEventListener("click", function () {
      if (isOpen()) {
        closeDropdown(false);
      } else {
        openDropdown();
      }
    });

    trigger.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen()) {
          openDropdown();
        }
      }
    });

    options.forEach(function (option, index) {
      option.addEventListener("click", function () {
        selectOption(option);
      });

      option.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          (options[index + 1] || options[0]).focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          (options[index - 1] || options[options.length - 1]).focus();
        } else if (e.key === "Home") {
          e.preventDefault();
          options[0].focus();
        } else if (e.key === "End") {
          e.preventDefault();
          options[options.length - 1].focus();
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeDropdown(true);
        } else if (e.key === "Tab") {
          closeDropdown(false);
        }
      });
    });

    document.addEventListener("click", function (e) {
      if (isOpen() && !dropdown.contains(e.target)) {
        closeDropdown(false);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
