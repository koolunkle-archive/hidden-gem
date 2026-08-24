// Hidden Gem - 카카오 로컬(Local) API를 이용한 맛집 검색 기능.
// search.html의 고정 계약(폼/셀렉트/버튼/로딩/빈결과/결과컨테이너/카드 템플릿) 위에서 동작한다.
// search.html이 아직 없거나 필요한 요소가 없으면 조용히 종료한다(콘솔 에러로 페이지를 깨뜨리지 않음).

(function () {
  "use strict";

  var CATEGORY_GROUP_FOOD = "FD6";
  var CATEGORY_GROUP_CAFE = "CE7";
  var FOOD_SUB_CATEGORIES = ["한식", "중식", "일식", "양식"];
  var DEFAULT_RADIUS_METERS = 2000;
  // 폴백 좌표: 서울 강남역
  var FALLBACK_COORDS = { x: "127.0276", y: "37.4979" };
  var KAKAO_API_BASE = "https://dapi.kakao.com/v2/local/search";

  function init() {
    var form = document.getElementById("search-form");
    var resultsEl = document.getElementById("search-results");
    var template = document.getElementById("restaurant-card-template");

    // 필수 요소가 없으면 아직 search.html 작업이 끝나지 않았거나 다른 페이지이므로 조용히 종료.
    if (!form || !resultsEl || !template) {
      return;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      handleSearch();
    });

    function handleSearch() {
      var keywordInput = document.getElementById("search-keyword-input");
      var categorySelect = document.getElementById("search-category-select");

      var keyword =
        keywordInput && keywordInput.value ? keywordInput.value.trim() : "";
      var category =
        categorySelect && categorySelect.value
          ? categorySelect.value.trim()
          : "";

      if (!hasValidApiKey()) {
        console.warn(
          "[kakao-search] KAKAO_REST_API_KEY가 설정되지 않았습니다. .env 파일에 KAKAO_REST_API_KEY를 입력해주세요(.env.example 참고).",
        );
        showEmptyState("카카오 API 키를 설정해주세요.");
        return;
      }

      setLoading(true);
      hideEmptyState();
      clearResults();

      resolveSearch(keyword, category)
        .then(function (documents) {
          renderResults(documents || []);
        })
        .catch(function (err) {
          console.error("[kakao-search] 검색 중 오류가 발생했습니다.", err);
          showEmptyState(
            "검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          );
        })
        .then(function () {
          setLoading(false);
        });
    }

    function resolveSearch(keyword, category) {
      if (category === "카페") {
        if (keyword) {
          return keywordSearch(keyword, CATEGORY_GROUP_CAFE);
        }
        return categorySearchAtCurrentLocation(CATEGORY_GROUP_CAFE);
      }

      if (FOOD_SUB_CATEGORIES.indexOf(category) !== -1) {
        var query = (keyword + " " + category).trim();
        return keywordSearch(query, CATEGORY_GROUP_FOOD);
      }

      // 카테고리 = 전체
      if (keyword) {
        return keywordSearch(keyword, CATEGORY_GROUP_FOOD);
      }

      return categorySearchAtCurrentLocation(CATEGORY_GROUP_FOOD);
    }

    function categorySearchAtCurrentLocation(categoryGroupCode) {
      return getCurrentCoords().then(function (coords) {
        return categorySearch(categoryGroupCode, coords.x, coords.y);
      });
    }

    function getCurrentCoords() {
      return new Promise(function (resolve) {
        if (!navigator.geolocation) {
          resolve(FALLBACK_COORDS);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          function (position) {
            resolve({
              x: String(position.coords.longitude),
              y: String(position.coords.latitude),
            });
          },
          function () {
            resolve(FALLBACK_COORDS);
          },
          { timeout: 5000 },
        );
      });
    }

    function keywordSearch(query, categoryGroupCode) {
      var url =
        KAKAO_API_BASE +
        "/keyword.json?query=" +
        encodeURIComponent(query) +
        "&category_group_code=" +
        encodeURIComponent(categoryGroupCode);
      return callKakaoApi(url);
    }

    function categorySearch(categoryGroupCode, x, y) {
      var url =
        KAKAO_API_BASE +
        "/category.json?category_group_code=" +
        encodeURIComponent(categoryGroupCode) +
        "&x=" +
        encodeURIComponent(x) +
        "&y=" +
        encodeURIComponent(y) +
        "&radius=" +
        DEFAULT_RADIUS_METERS;
      return callKakaoApi(url);
    }

    function callKakaoApi(url) {
      return fetch(url, {
        headers: {
          Authorization: "KakaoAK " + window.KAKAO_REST_API_KEY,
        },
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

    function renderResults(documents) {
      clearResults();

      if (!documents.length) {
        showEmptyState();
        return;
      }

      var fragment = document.createDocumentFragment();
      documents.forEach(function (place) {
        var card = buildCard(place);
        if (card) {
          fragment.appendChild(card);
        }
      });
      resultsEl.appendChild(fragment);
    }

    function buildCard(place) {
      var content = template.content ? template.content.cloneNode(true) : null;
      if (!content) {
        return null;
      }

      var articleEl = content.querySelector(".restaurant-card");
      if (articleEl) {
        // Google 리뷰 조회(js/google-review.js)가 이 카드를 식별하는 데 사용한다.
        articleEl.dataset.placeId = place.id || "";
        articleEl.dataset.placeName = place.place_name || "";
        articleEl.dataset.lat = place.y || "";
        articleEl.dataset.lng = place.x || "";
      }

      setField(content, "place_name", place.place_name || "");
      setField(content, "category_name", place.category_name || "");
      setPhoto(content, place);

      var address = place.road_address_name || place.address_name || "";
      setField(content, "address", address);

      var phoneEl = content.querySelector('[data-field="phone"]');
      if (phoneEl) {
        if (place.phone) {
          phoneEl.textContent = place.phone;
          phoneEl.hidden = false;
        } else {
          phoneEl.textContent = "";
          phoneEl.hidden = true;
        }
      }

      var distanceEl = content.querySelector('[data-field="distance"]');
      if (distanceEl) {
        if (place.distance) {
          distanceEl.textContent = place.distance + "m";
          distanceEl.hidden = false;
        } else {
          distanceEl.textContent = "";
          distanceEl.hidden = true;
        }
      }

      var linkEl = content.querySelector('[data-field="place_url"]');
      if (linkEl) {
        if (place.place_url) {
          linkEl.href = place.place_url;
          linkEl.target = "_blank";
          linkEl.rel = "noopener";
        } else {
          linkEl.removeAttribute("href");
        }
      }

      return content;
    }

    function setField(root, field, text) {
      var el = root.querySelector('[data-field="' + field + '"]');
      if (el) {
        el.textContent = text;
      }
    }

    // 카드 사진(구글 Place Photos) — js/place-photo.js의 공용 헬퍼(window.HiddenGemPlacePhoto)
    // 사용. 여러 카드 목록(검색 결과/나를 위한 추천/인기 맛집)이 이 헬퍼를 공유한다.
    function setPhoto(root, place) {
      if (!window.HiddenGemPlacePhoto) {
        return;
      }
      window.HiddenGemPlacePhoto.attach(root, {
        name: place.place_name,
        lat: place.y,
        lng: place.x,
      });
    }

    function clearResults() {
      resultsEl.innerHTML = "";
    }

    function setLoading(isLoading) {
      var loadingEl = document.getElementById("search-loading");
      if (loadingEl) {
        loadingEl.hidden = !isLoading;
      }
      var submitBtn = document.getElementById("search-submit-btn");
      if (submitBtn) {
        submitBtn.disabled = isLoading;
      }
    }

    function showEmptyState(message) {
      var emptyEl = document.getElementById("search-empty-state");
      if (!emptyEl) {
        return;
      }
      if (message) {
        emptyEl.textContent = message;
      }
      emptyEl.hidden = false;
    }

    function hideEmptyState() {
      var emptyEl = document.getElementById("search-empty-state");
      if (emptyEl) {
        emptyEl.hidden = true;
      }
    }

    function hasValidApiKey() {
      var key = window.KAKAO_REST_API_KEY;
      if (!key || typeof key !== "string") {
        return false;
      }
      var trimmed = key.trim();
      if (!trimmed) {
        return false;
      }
      if (
        trimmed.indexOf("여기에") !== -1 ||
        trimmed.toLowerCase().indexOf("your_") !== -1
      ) {
        return false;
      }
      return true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
