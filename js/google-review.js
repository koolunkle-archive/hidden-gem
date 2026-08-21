// Hidden Gem - 구글 리뷰 보기 기능.
// search.html의 검색 결과 카드(.restaurant-card)를 클릭하면 /api/google-review를 호출해
// 해당 가게의 구글 평점/리뷰 요약을 모달로 보여준다.
// 한 번 조회한 가게는 localStorage에 캐싱해 재클릭 시 재요청하지 않는다.

(function () {
  "use strict";

  var CACHE_PREFIX = "hiddenGem:googleReview:v1:";
  var API_ENDPOINT = "/api/google-review";

  function init() {
    var resultsEl = document.getElementById("search-results");
    var backdrop = document.getElementById("review-modal-backdrop");
    var closeBtn = document.getElementById("review-modal-close");
    var titleEl = document.getElementById("review-modal-title");
    var loadingEl = document.getElementById("review-modal-loading");
    var errorEl = document.getElementById("review-modal-error");
    var contentEl = document.getElementById("review-modal-content");
    var ratingEl = document.getElementById("review-modal-rating");
    var countEl = document.getElementById("review-modal-count");
    var listEl = document.getElementById("review-modal-list");
    var moreLinkEl = document.getElementById("review-modal-more-link");
    var itemTemplate = document.getElementById("google-review-item-template");

    // 이 페이지에 검색 결과/모달 요소가 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!resultsEl || !backdrop || !itemTemplate) {
      return;
    }

    var currentRequestToken = 0;

    resultsEl.addEventListener("click", function (e) {
      // 카카오맵 링크 클릭은 새 탭 이동만 하고 모달을 열지 않는다.
      if (e.target.closest("a")) {
        return;
      }
      var card = e.target.closest(".restaurant-card");
      if (card) {
        openReviewModal(card);
      }
    });

    resultsEl.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") {
        return;
      }
      var card = e.target.closest(".restaurant-card");
      if (!card) {
        return;
      }
      e.preventDefault();
      openReviewModal(card);
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) {
        closeModal();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !backdrop.hidden) {
        closeModal();
      }
    });

    function closeModal() {
      backdrop.hidden = true;
    }

    function openReviewModal(card) {
      var placeId = card.dataset.placeId || "";
      var placeName = card.dataset.placeName || "";
      var lat = card.dataset.lat || "";
      var lng = card.dataset.lng || "";

      if (!placeName || !lat || !lng) {
        return;
      }

      titleEl.textContent = placeName;
      backdrop.hidden = false;
      showState("loading");

      // AI 리뷰 분석(js/google-review-analysis.js)이 새 가게로 전환됐음을 알고
      // 자신의 상태를 리셋할 수 있게 알린다.
      document.dispatchEvent(
        new CustomEvent("hiddengem:review-modal-opening", {
          detail: { placeId: placeId },
        }),
      );

      var cacheKey =
        CACHE_PREFIX + (placeId || placeName + "|" + lat + "|" + lng);
      var cached = readCache(cacheKey);
      if (cached) {
        renderResult(cached, placeId);
        return;
      }

      var token = ++currentRequestToken;
      var url =
        API_ENDPOINT +
        "?name=" +
        encodeURIComponent(placeName) +
        "&lat=" +
        encodeURIComponent(lat) +
        "&lng=" +
        encodeURIComponent(lng);

      fetch(url)
        .then(function (res) {
          if (!res.ok) {
            return res
              .json()
              .catch(function () {
                return null;
              })
              .then(function (body) {
                throw new Error(
                  (body && body.error) || "요청 실패: " + res.status,
                );
              });
          }
          return res.json();
        })
        .then(function (data) {
          if (token !== currentRequestToken) {
            return;
          }
          writeCache(cacheKey, data);
          renderResult(data, placeId);
        })
        .catch(function (err) {
          if (token !== currentRequestToken) {
            return;
          }
          console.error("[google-review] 리뷰를 불러오지 못했습니다.", err);
          showState(
            "error",
            "리뷰를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
          );
        });
    }

    function renderResult(data, placeId) {
      if (!data || !data.found) {
        // 못 찾은 경우에도 AI 분석 스크립트가 자신을 숨길 수 있게 알린다.
        document.dispatchEvent(
          new CustomEvent("hiddengem:google-review-rendered", {
            detail: {
              placeId: placeId,
              placeName: (data && data.name) || titleEl.textContent || "",
              found: false,
              reviews: [],
            },
          }),
        );
        showState(
          "error",
          "이 가게는 구글 지도에서 리뷰 정보를 찾을 수 없어요.",
        );
        return;
      }

      ratingEl.textContent =
        typeof data.rating === "number" ? data.rating.toFixed(1) : "평점 없음";
      countEl.textContent = "리뷰 " + (data.reviewCount || 0) + "개";

      listEl.innerHTML = "";
      var reviews = Array.isArray(data.reviews) ? data.reviews : [];
      if (!reviews.length) {
        var emptyLi = document.createElement("li");
        emptyLi.className = "text-sm text-ink/50";
        emptyLi.textContent = "등록된 리뷰 내용이 없습니다.";
        listEl.appendChild(emptyLi);
      } else {
        reviews.forEach(function (review) {
          var node = itemTemplate.content.cloneNode(true);
          setText(node, "author", review.author || "익명");
          setText(
            node,
            "rating",
            review.rating != null ? "★ " + review.rating : "",
          );
          setText(node, "date", review.relativeTime || "");
          setText(node, "text", review.text || "");
          listEl.appendChild(node);
        });
      }

      if (data.googleMapsUri) {
        moreLinkEl.href = data.googleMapsUri;
        moreLinkEl.hidden = false;
      } else {
        moreLinkEl.hidden = true;
      }

      // #review-ai-section은 review-modal-content의 자손이므로, AI 분석 스크립트가
      // (캐시 적중 시 동기적으로) 워드클라우드 크기를 재기 전에 이 컨테이너부터 먼저
      // 화면에 보이게 해야 한다. 순서가 바뀌면 숨겨진 상태에서 span 크기가 0으로
      // 측정되어 단어들이 한 지점에 뭉쳐 보이는 버그가 생긴다.
      showState("content");

      // AI 리뷰 분석 스크립트가 이 결과를 이어받아 분석을 시작(또는 자신을 숨김)할 수 있게 알린다.
      document.dispatchEvent(
        new CustomEvent("hiddengem:google-review-rendered", {
          detail: {
            placeId: placeId,
            placeName: (data && data.name) || titleEl.textContent || "",
            found: true,
            reviews: reviews,
          },
        }),
      );
    }

    function setText(root, field, text) {
      var el = root.querySelector('[data-field="' + field + '"]');
      if (el) {
        el.textContent = text;
      }
    }

    function showState(state, message) {
      loadingEl.hidden = state !== "loading";
      errorEl.hidden = state !== "error";
      contentEl.hidden = state !== "content";
      if (state === "error") {
        errorEl.textContent = message || "";
      }
    }

    function readCache(key) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function writeCache(key, data) {
      try {
        window.localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        // 저장 공간 부족 등 캐싱 실패는 무시 — 기능 자체는 계속 동작해야 한다.
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
