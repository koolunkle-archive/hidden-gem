// Hidden Gem - 구글 리뷰 모달(공용 모듈, search.html + my-page.html 공유).
// 컨테이너 존재 여부로 현재 페이지를 판별해 트리거 방식만 다르게 연결한다
// (카드 전체 클릭 vs ".google-review-btn" 클릭). 모달 UI/API 호출/캐시/이벤트는 공통.

(function () {
  "use strict";

  var CACHE_PREFIX = "hiddenGem:googleReview:v1:";
  var API_ENDPOINT = "/api/google-review";

  // 페이지마다 카드를 찾는 방법과 클릭 트리거 방식이 다르다.
  var PAGE_CONFIGS = [
    {
      // search.html: 카드 전체가 트리거 — 카카오맵 링크/담기 버튼 클릭은 제외.
      containerId: "search-results",
      cardSelector: ".restaurant-card",
      isTriggerTarget: function (target) {
        return !target.closest("a") && !target.closest(".save-btn");
      },
      supportsKeyboard: true,
    },
    {
      // my-page.html: ".google-review-btn" 클릭만 트리거 — 카드 전체는 아니다.
      containerId: "saved-places-list",
      cardSelector: ".saved-place-card",
      isTriggerTarget: function (target) {
        return !!target.closest(".google-review-btn");
      },
      supportsKeyboard: false,
    },
  ];

  function init() {
    var backdrop = document.getElementById("review-modal-backdrop");
    var itemTemplate = document.getElementById("google-review-item-template");
    if (!backdrop || !itemTemplate) {
      return;
    }

    var pageConfig = null;
    var listEl = null;
    for (var i = 0; i < PAGE_CONFIGS.length; i++) {
      var candidate = document.getElementById(PAGE_CONFIGS[i].containerId);
      if (candidate) {
        pageConfig = PAGE_CONFIGS[i];
        listEl = candidate;
        break;
      }
    }

    // 이 페이지에 검색 결과/맛집 주머니 목록이 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!pageConfig) {
      return;
    }

    var closeBtn = document.getElementById("review-modal-close");
    var titleEl = document.getElementById("review-modal-title");
    var loadingEl = document.getElementById("review-modal-loading");
    var errorEl = document.getElementById("review-modal-error");
    var contentEl = document.getElementById("review-modal-content");
    var ratingEl = document.getElementById("review-modal-rating");
    var countEl = document.getElementById("review-modal-count");
    var reviewListEl = document.getElementById("review-modal-list");
    var moreLinkEl = document.getElementById("review-modal-more-link");

    var currentRequestToken = 0;

    listEl.addEventListener("click", function (e) {
      if (!pageConfig.isTriggerTarget(e.target)) {
        return;
      }
      var card = e.target.closest(pageConfig.cardSelector);
      if (card) {
        openReviewModal(card);
      }
    });

    if (pageConfig.supportsKeyboard) {
      listEl.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") {
          return;
        }
        if (!pageConfig.isTriggerTarget(e.target)) {
          return;
        }
        var card = e.target.closest(pageConfig.cardSelector);
        if (!card) {
          return;
        }
        e.preventDefault();
        openReviewModal(card);
      });
    }

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

      // google-review-analysis.js가 새 가게로 전환됐음을 알고 상태를 리셋하도록 알린다.
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
          console.error("[review-modal] 리뷰를 불러오지 못했습니다.", err);
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

      reviewListEl.innerHTML = "";
      var reviews = Array.isArray(data.reviews) ? data.reviews : [];
      if (!reviews.length) {
        var emptyLi = document.createElement("li");
        emptyLi.className = "text-sm text-ink/50";
        emptyLi.textContent = "등록된 리뷰 내용이 없습니다.";
        reviewListEl.appendChild(emptyLi);
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
          reviewListEl.appendChild(node);
        });
      }

      if (data.googleMapsUri) {
        moreLinkEl.href = data.googleMapsUri;
        moreLinkEl.hidden = false;
      } else {
        moreLinkEl.hidden = true;
      }

      // showState는 이벤트 발송보다 먼저 호출해야 한다 — 캐시 적중 시 동기 실행되는
      // 워드클라우드 배치가 숨겨진 상태(크기 0)에서 일어나면 단어가 한 점에 뭉친다.
      showState("content");

      // google-review-analysis.js가 결과를 이어받아 분석을 시작(또는 숨김)한다.
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
