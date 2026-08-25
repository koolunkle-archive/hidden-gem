// Hidden Gem - 히어로 "오늘의 추천 받기".
// top_saved_places를 넉넉한 개수(POOL_SIZE)로 호출해 후보군을 받고, save_count에 비례한
// 가중치로 클라이언트에서 무작위 추첨한다. "다시 뽑기"는 같은 후보군을 재사용해 재요청 없음.

(function () {
  "use strict";

  var RPC_NAME = "top_saved_places";
  var POOL_SIZE = 20;

  function init() {
    var triggerBtn = document.getElementById("today-pick-btn");
    var backdrop = document.getElementById("today-pick-modal-backdrop");

    // 이 페이지에 버튼/모달이 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!triggerBtn || !backdrop) {
      return;
    }

    var closeBtn = document.getElementById("today-pick-modal-close");
    var loadingEl = document.getElementById("today-pick-loading");
    var errorEl = document.getElementById("today-pick-error");
    var contentEl = document.getElementById("today-pick-content");
    var nameEl = document.getElementById("today-pick-name");
    var categoryEl = document.getElementById("today-pick-category");
    var addressEl = document.getElementById("today-pick-address");
    var mapLinkEl = document.getElementById("today-pick-map-link");
    var rerollBtn = document.getElementById("today-pick-reroll-btn");

    var pool = null; // 한 번 불러온 뒤 재뽑기에 재사용

    triggerBtn.addEventListener("click", open);
    if (closeBtn) {
      closeBtn.addEventListener("click", close);
    }
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) {
        close();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !backdrop.hidden) {
        close();
      }
    });
    if (rerollBtn) {
      rerollBtn.addEventListener("click", function () {
        if (pool && pool.length) {
          renderPick(weightedPick(pool));
        }
      });
    }

    function open() {
      backdrop.hidden = false;
      showState("loading");

      if (pool) {
        renderPick(weightedPick(pool));
        return;
      }

      if (!window.HiddenGemAuth) {
        showState("error");
        return;
      }

      window.HiddenGemAuth.getClient()
        .rpc(RPC_NAME, { limit_count: POOL_SIZE })
        .then(function (result) {
          if (result.error || !result.data || !result.data.length) {
            if (result.error) {
              console.error(
                "[today-pick] 오늘의 추천을 불러오지 못했습니다.",
                result.error,
              );
            }
            showState("error");
            return;
          }
          pool = result.data;
          renderPick(weightedPick(pool));
        });
    }

    function close() {
      backdrop.hidden = true;
    }

    function renderPick(place) {
      nameEl.textContent = place.place_name || "";
      categoryEl.textContent = place.category_name || "";
      addressEl.textContent = place.address || "";
      if (place.place_id) {
        mapLinkEl.href = buildKakaoMapUrl(place.place_id);
        mapLinkEl.hidden = false;
      } else {
        mapLinkEl.hidden = true;
      }
      showState("content");
    }

    function showState(state) {
      loadingEl.hidden = state !== "loading";
      errorEl.hidden = state !== "error";
      contentEl.hidden = state !== "content";
    }
  }

  // save_count에 비례한 가중치 랜덤 추첨(뽑기 확률이 담긴 횟수에 비례).
  function weightedPick(rows) {
    var total = rows.reduce(function (sum, row) {
      return sum + (row.save_count > 0 ? row.save_count : 0);
    }, 0);

    if (total <= 0) {
      return rows[Math.floor(Math.random() * rows.length)];
    }

    var target = Math.random() * total;
    var cumulative = 0;
    for (var i = 0; i < rows.length; i++) {
      cumulative += rows[i].save_count > 0 ? rows[i].save_count : 0;
      if (target < cumulative) {
        return rows[i];
      }
    }
    return rows[rows.length - 1];
  }

  function buildKakaoMapUrl(placeId) {
    return "https://place.map.kakao.com/" + encodeURIComponent(placeId);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
