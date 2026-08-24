// Hidden Gem - "맛집 주머니"(my-page.html) 카드의 "구글 리뷰 보기" 기능.
// js/google-review.js(search.html)와 같은 UI(#review-modal-backdrop)·같은 /api/google-review
// 호출·같은 localStorage 캐시 키(hiddenGem:googleReview:v1:)를 그대로 재사용하지만,
// 이 페이지의 카드는 클릭 대상이 카드 전체가 아니라 ".google-review-btn" 버튼이라 별도
// 파일로 둔다(느슨한 결합 — js/my-page.js가 카드에 심어둔 dataset만 DOM으로 읽어간다).
// 캐시가 search.html과 공유되므로 같은 가게를 다른 페이지에서 봤다면 재요청하지 않는다.
// hiddengem:review-modal-opening / hiddengem:google-review-rendered 이벤트를 그대로 쏘므로
// js/google-review-analysis.js(AI 리뷰 분석)도 수정 없이 이 페이지에서 함께 동작한다.

(function () {
  "use strict";

  var CACHE_PREFIX = "hiddenGem:googleReview:v1:";
  var API_ENDPOINT = "/api/google-review";

  function init() {
    var listEl = document.getElementById("saved-places-list");
    var backdrop = document.getElementById("review-modal-backdrop");
    var closeBtn = document.getElementById("review-modal-close");
    var titleEl = document.getElementById("review-modal-title");
    var loadingEl = document.getElementById("review-modal-loading");
    var errorEl = document.getElementById("review-modal-error");
    var contentEl = document.getElementById("review-modal-content");
    var ratingEl = document.getElementById("review-modal-rating");
    var countEl = document.getElementById("review-modal-count");
    var listElReviews = document.getElementById("review-modal-list");
    var moreLinkEl = document.getElementById("review-modal-more-link");
    var itemTemplate = document.getElementById("google-review-item-template");

    // 이 페이지에 목록/모달 요소가 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!listEl || !backdrop || !itemTemplate) {
      return;
    }

    var currentRequestToken = 0;

    listEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".google-review-btn");
      if (!btn) {
        return;
      }
      var card = btn.closest(".saved-place-card");
      if (card) {
        openReviewModal(card);
      }
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
          console.error("[my-page-review] 리뷰를 불러오지 못했습니다.", err);
          showState(
            "error",
            "리뷰를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
          );
        });
    }

    function renderResult(data, placeId) {
      if (!data || !data.found) {
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

      listElReviews.innerHTML = "";
      var reviews = Array.isArray(data.reviews) ? data.reviews : [];
      if (!reviews.length) {
        var emptyLi = document.createElement("li");
        emptyLi.className = "text-sm text-ink/50";
        emptyLi.textContent = "등록된 리뷰 내용이 없습니다.";
        listElReviews.appendChild(emptyLi);
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
          listElReviews.appendChild(node);
        });
      }

      if (data.googleMapsUri) {
        moreLinkEl.href = data.googleMapsUri;
        moreLinkEl.hidden = false;
      } else {
        moreLinkEl.hidden = true;
      }

      showState("content");

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
