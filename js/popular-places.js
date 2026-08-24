// Hidden Gem - 메인 화면의 "지금 뜨는 인기 맛집 TOP 5" 랭킹.
// saved_places는 RLS로 자기 것만 조회할 수 있어서, 전체 이용자가 담은 횟수를
// 집계하는 Postgres 함수 top_saved_places(Supabase, DDL은 supabase/top_saved_places.sql)를
// RPC로 호출한다. 이 함수는 가게 정보(이름/카테고리/주소/place_id)와 담긴 횟수만 반환하고
// 누가 담았는지는 절대 내보내지 않으므로, RLS를 끄지 않고도 안전하게 전체 집계를 보여줄 수 있다.
// 로그인 여부와 무관하게(anon도 실행 권한이 있음) 누구나 볼 수 있다.
// 지도 링크는(구글맵 대신) 카카오맵으로 통일한다 — place_id가 실제 카카오 장소 ID라서
// 별도 검색 없이 place.map.kakao.com/{place_id}로 바로 연결할 수 있어 가장 정확하다.

(function () {
  "use strict";

  var RPC_NAME = "top_saved_places";
  var RANK_LIMIT = 5;

  function init() {
    var listEl = document.getElementById("popular-places-list");

    // 이 페이지에 랭킹 영역이 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!listEl) {
      return;
    }

    var loadingEl = document.getElementById("popular-places-loading");
    var errorEl = document.getElementById("popular-places-error");
    var emptyEl = document.getElementById("popular-places-empty");
    var template = document.getElementById("popular-place-card-template");

    if (!window.HiddenGemAuth) {
      showState("error");
      return;
    }

    load();

    function load() {
      showState("loading");

      window.HiddenGemAuth.getClient()
        .rpc(RPC_NAME, { limit_count: RANK_LIMIT })
        .then(function (result) {
          if (result.error) {
            console.error(
              "[popular-places] 인기 맛집을 불러오지 못했습니다.",
              result.error,
            );
            showState("error");
            return;
          }
          render(result.data || []);
        });
    }

    function render(rows) {
      listEl.innerHTML = "";

      if (!rows.length) {
        showState("empty");
        return;
      }

      var fragment = document.createDocumentFragment();
      rows.forEach(function (row, index) {
        fragment.appendChild(buildCard(row, index + 1));
      });
      listEl.appendChild(fragment);
      showState("content");
    }

    function buildCard(row, rank) {
      var content = template.content
        ? template.content.cloneNode(true)
        : document.createDocumentFragment();

      setText(content, "place_name", row.place_name || "");
      setText(
        content,
        "save_count",
        String(row.save_count != null ? row.save_count : 0),
      );
      if (window.HiddenGemPlacePhoto) {
        window.HiddenGemPlacePhoto.attach(content, {
          name: row.place_name,
          lat: row.y,
          lng: row.x,
        });
      }

      var rankEl = content.querySelector('[data-field="rank"]');
      if (rankEl) {
        rankEl.textContent = String(rank);
      }

      var mapLinkEl = content.querySelector('[data-field="map_link"]');
      if (mapLinkEl) {
        if (row.place_id) {
          mapLinkEl.href = buildKakaoMapUrl(row.place_id);
        } else {
          mapLinkEl.hidden = true;
        }
      }

      return content;
    }

    function showState(state) {
      loadingEl.hidden = state !== "loading";
      errorEl.hidden = state !== "error";
      emptyEl.hidden = state !== "empty";
      listEl.hidden = state !== "content";
    }
  }

  function setText(root, field, text) {
    var el = root.querySelector('[data-field="' + field + '"]');
    if (el) {
      el.textContent = text;
    }
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
