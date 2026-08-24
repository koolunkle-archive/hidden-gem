// Hidden Gem - 맛집 "담기" 기능 (Supabase saved_places 테이블 기반).
// search.html의 검색 결과 카드(.restaurant-card)마다 있는 .save-btn을 눌러
// 담기/취소를 토글한다. window.HiddenGemAuth(js/auth.js)가 만든 Supabase 클라이언트를
// 그대로 재사용해 같은 로그인 세션으로 요청한다.
//
// user_id는 saved_places 테이블의 컬럼 기본값(auth.uid())이 채우므로 여기서는 절대
// 보내지 않고, 조회/삭제도 RLS("자기 것만")에 맡기고 user_id로 직접 필터링하지 않는다.

(function () {
  "use strict";

  var TABLE = "saved_places";

  function init() {
    var resultsEl = document.getElementById("search-results");

    // 이 페이지에 검색 결과 영역이 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!resultsEl) {
      return;
    }

    var observer = new MutationObserver(function () {
      syncSavedState();
    });
    observer.observe(resultsEl, { childList: true });

    document.addEventListener("hiddengem:auth-changed", function () {
      syncSavedState();
    });

    resultsEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".save-btn");
      if (!btn) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      var card = btn.closest(".restaurant-card");
      if (card) {
        handleToggle(btn, card);
      }
    });

    function handleToggle(btn, card) {
      if (!window.HiddenGemAuth) {
        window.alert(
          "담기 기능을 사용할 수 없습니다. Supabase 설정을 확인해주세요.",
        );
        return;
      }

      var user = window.HiddenGemAuth.getUser();
      if (!user) {
        window.alert("담기 기능은 로그인 후 이용할 수 있습니다.");
        var loginBtn = document.getElementById("auth-login-btn");
        if (loginBtn) {
          loginBtn.click();
        }
        return;
      }

      var placeId = card.dataset.placeId || "";
      if (!placeId || btn.disabled) {
        return;
      }

      var client = window.HiddenGemAuth.getClient();
      if (!client) {
        return;
      }

      var wasSaved = btn.dataset.saved === "true";
      btn.disabled = true;

      var request = wasSaved
        ? client.from(TABLE).delete().eq("place_id", placeId)
        : client.from(TABLE).insert({
            place_id: placeId,
            place_name: card.dataset.placeName || "",
            category_name: getFieldText(card, "category_name"),
            address: getFieldText(card, "address"),
            x: parseCoord(card.dataset.lng),
            y: parseCoord(card.dataset.lat),
          });

      request
        .then(function (result) {
          btn.disabled = false;
          var error = result && result.error;
          if (error) {
            // 이미 담겨 있는데(다른 탭 등) 다시 담기를 시도한 경우 — UNIQUE 위반은
            // 실패가 아니라 "이미 담김"으로 취급해 화면 상태만 맞춰준다.
            if (!wasSaved && error.code === "23505") {
              setSaved(card, true);
              return;
            }
            console.error("[saved-places] 담기 처리 중 오류가 발생했습니다.", error);
            window.alert("처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            return;
          }
          setSaved(card, !wasSaved);
        })
        .catch(function (err) {
          btn.disabled = false;
          console.error("[saved-places] 담기 처리 중 오류가 발생했습니다.", err);
          window.alert("처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        });
    }

    function syncSavedState() {
      var cards = Array.prototype.slice.call(
        resultsEl.querySelectorAll(".restaurant-card"),
      );
      if (!cards.length) {
        return;
      }

      if (!window.HiddenGemAuth) {
        cards.forEach(function (card) {
          setSaved(card, false);
        });
        return;
      }

      var user = window.HiddenGemAuth.getUser();
      if (!user) {
        cards.forEach(function (card) {
          setSaved(card, false);
        });
        return;
      }

      var client = window.HiddenGemAuth.getClient();
      if (!client) {
        return;
      }

      var placeIds = cards
        .map(function (card) {
          return card.dataset.placeId;
        })
        .filter(Boolean);
      if (!placeIds.length) {
        return;
      }

      client
        .from(TABLE)
        .select("place_id")
        .in("place_id", placeIds)
        .then(function (result) {
          if (result.error) {
            console.error(
              "[saved-places] 담긴 상태를 불러오지 못했습니다.",
              result.error,
            );
            return;
          }
          var savedSet = {};
          (result.data || []).forEach(function (row) {
            savedSet[row.place_id] = true;
          });
          cards.forEach(function (card) {
            setSaved(card, !!savedSet[card.dataset.placeId]);
          });
        });
    }
  }

  function setSaved(card, isSaved) {
    var btn = card.querySelector(".save-btn");
    if (!btn) {
      return;
    }
    btn.dataset.saved = isSaved ? "true" : "false";
    btn.setAttribute("aria-pressed", isSaved ? "true" : "false");
    btn.textContent = isSaved ? "담김" : "담기";
  }

  function getFieldText(card, field) {
    var el = card.querySelector('[data-field="' + field + '"]');
    return el ? el.textContent : "";
  }

  function parseCoord(value) {
    var num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
