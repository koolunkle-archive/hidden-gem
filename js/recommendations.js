// Hidden Gem - 메인 화면 "나를 위한 추천" (로그인 시에만 노출).
// 내가 담은 가게들(saved_places, user_id 필터 없이 RLS로 "내 것만" 조회)의
// category_name 중 가장 자주 담은 카테고리를 찾아, 카카오 로컬 API로 같은 카테고리의
// 다른 가게를 검색해서 보여준다. 이미 담은 가게(place_id)는 결과에서 제외한다.
// 추천할 게 없으면(비로그인, 담은 게 없음, 검색 결과 없음 등) 섹션 자체를 숨겨
// 메인 화면을 어수선하게 만들지 않는다.

(function () {
  "use strict";

  var CATEGORY_GROUP_FOOD = "FD6";
  var CATEGORY_GROUP_CAFE = "CE7";
  var KAKAO_API_BASE = "https://dapi.kakao.com/v2/local/search";
  var RESULT_LIMIT = 4;

  function init() {
    var sectionEl = document.getElementById("recommendations");

    // 이 페이지에 추천 영역이 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!sectionEl) {
      return;
    }

    var subtitleEl = document.getElementById("recommendations-subtitle");
    var listEl = document.getElementById("recommendations-list");
    var template = document.getElementById("recommendation-card-template");

    if (!window.HiddenGemAuth) {
      return;
    }

    document.addEventListener("hiddengem:auth-changed", function (e) {
      if (e.detail && e.detail.user) {
        load();
      } else {
        setSectionHidden(true);
      }
    });

    // js/auth.js의 초기 세션 조회는 비동기라, 이 리스너가 등록되기 전에 이미
    // hiddengem:auth-changed가 한 번 발생해 있을 수 있다 — 등록 시점의 현재
    // 상태를 한 번 더 확인해 둔다(자세한 이유는 js/my-page.js 참고).
    if (window.HiddenGemAuth.getUser()) {
      load();
    }

    function setSectionHidden(hidden) {
      sectionEl.hidden = hidden;
    }

    function load() {
      window.HiddenGemAuth.getClient()
        .from("saved_places")
        .select("place_id, category_name")
        .then(function (result) {
          if (result.error || !result.data || !result.data.length) {
            setSectionHidden(true);
            return;
          }

          var savedPlaceIds = {};
          var categoryCounts = {};
          result.data.forEach(function (row) {
            if (row.place_id) {
              savedPlaceIds[row.place_id] = true;
            }
            if (row.category_name) {
              categoryCounts[row.category_name] =
                (categoryCounts[row.category_name] || 0) + 1;
            }
          });

          var topCategory = pickTopCategory(categoryCounts);
          if (!topCategory || !hasValidApiKey()) {
            setSectionHidden(true);
            return;
          }

          searchByCategory(topCategory)
            .then(function (documents) {
              var recommended = (documents || []).filter(function (place) {
                return !savedPlaceIds[place.id];
              });
              if (!recommended.length) {
                setSectionHidden(true);
                return;
              }
              render(recommended.slice(0, RESULT_LIMIT), topCategory);
            })
            .catch(function (err) {
              console.error("[recommendations] 추천을 불러오지 못했습니다.", err);
              setSectionHidden(true);
            });
        });
    }

    function render(places, category) {
      listEl.innerHTML = "";

      if (subtitleEl) {
        subtitleEl.textContent =
          "'" +
          extractKeyword(category) +
          "'을(를) 자주 담으시네요. 이런 곳은 어때요?";
      }

      var fragment = document.createDocumentFragment();
      places.forEach(function (place) {
        fragment.appendChild(buildCard(place));
      });
      listEl.appendChild(fragment);
      setSectionHidden(false);
    }

    function buildCard(place) {
      var content = template.content
        ? template.content.cloneNode(true)
        : document.createDocumentFragment();

      setText(content, "place_name", place.place_name || "");
      setText(content, "category_name", place.category_name || "");
      setText(
        content,
        "address",
        place.road_address_name || place.address_name || "",
      );
      if (window.HiddenGemPlacePhoto) {
        window.HiddenGemPlacePhoto.attach(content, {
          name: place.place_name,
          lat: place.y,
          lng: place.x,
        });
      }

      var linkEl = content.querySelector('[data-field="place_url"]');
      if (linkEl) {
        if (place.place_url) {
          linkEl.href = place.place_url;
        } else {
          linkEl.removeAttribute("href");
        }
      }

      return content;
    }

    function searchByCategory(categoryName) {
      var keyword = extractKeyword(categoryName);
      var groupCode =
        categoryName.indexOf("카페") !== -1
          ? CATEGORY_GROUP_CAFE
          : CATEGORY_GROUP_FOOD;
      var url =
        KAKAO_API_BASE +
        "/keyword.json?query=" +
        encodeURIComponent(keyword) +
        "&category_group_code=" +
        encodeURIComponent(groupCode) +
        "&size=15";

      return fetch(url, {
        headers: { Authorization: "KakaoAK " + window.KAKAO_REST_API_KEY },
      })
        .then(function (res) {
          if (!res.ok) {
            throw new Error("카카오 API 응답 오류: " + res.status);
          }
          return res.json();
        })
        .then(function (data) {
          return data && data.documents ? data.documents : [];
        });
    }
  }

  function pickTopCategory(categoryCounts) {
    var top = null;
    var topCount = 0;
    Object.keys(categoryCounts).forEach(function (name) {
      if (categoryCounts[name] > topCount) {
        top = name;
        topCount = categoryCounts[name];
      }
    });
    return top;
  }

  // 카카오 category_name은 "음식점 > 한식 > 국밥"처럼 계층 구조라, 검색 키워드로 쓸
  // 가운데 세부 분류를 뽑아낸다(없으면 최상위 분류로 대체).
  function extractKeyword(categoryName) {
    var parts = categoryName.split(">").map(function (s) {
      return s.trim();
    });
    return parts[1] || parts[0] || categoryName;
  }

  function hasValidApiKey() {
    var key = window.KAKAO_REST_API_KEY;
    return !!(key && typeof key === "string" && key.trim());
  }

  function setText(root, field, text) {
    var el = root.querySelector('[data-field="' + field + '"]');
    if (el) {
      el.textContent = text;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
