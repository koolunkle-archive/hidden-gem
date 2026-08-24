// Hidden Gem - "맛집 주머니"(my-page.html) 기능.
// 로그인한 사용자가 담은 가게 목록을 saved_places 테이블에서 최신순으로 불러와
// 카드로 보여주고, 삭제(X)를 누르면 목록과 테이블에서 함께 제거한다.
// js/auth.js가 만든 Supabase 클라이언트를 그대로 재사용해 같은 로그인 세션으로 요청하며,
// user_id로 직접 필터링하지 않고 RLS("자기 것만")에 전적으로 위임한다.
//
// 지도 링크는 place_id 기반 카카오맵으로 통일한다(place_name+address로 추측 검색하는
// 구글맵보다 정확함) — 구글은 리뷰를 보는 용도로만 쓴다(js/my-page-review.js).
//
// 카드 article에 place_id/place_name/lat/lng를 dataset으로 심어 두는데, 이는
// js/my-page-review.js가 "구글 리뷰 보기" 클릭을 처리할 때 읽어간다
// (js/kakao-search.js가 search.html 카드에 하는 것과 동일한, DOM으로만 연결되는 패턴).
//
// 각 카드의 "다녀왔어요" 버튼은 만족/불만족 + 한줄평을 visit_reviews 테이블에 남긴다.
// 여기 남긴 후기는 메인 화면의 "방금 다녀왔어요"(js/recent-reviews.js, recent_visit_reviews
// 집계 함수)에 전체 이용자 것과 함께 모여 보인다.

(function () {
  "use strict";

  var TABLE = "saved_places";
  var VISIT_REVIEW_TABLE = "visit_reviews";

  function init() {
    var listEl = document.getElementById("saved-places-list");

    // 이 페이지에 목록 영역이 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!listEl) {
      return;
    }

    var loadingEl = document.getElementById("saved-places-loading");
    var errorEl = document.getElementById("saved-places-error");
    var emptyEl = document.getElementById("saved-places-empty");
    var loginRequiredEl = document.getElementById("saved-places-login-required");
    var loginBtn = document.getElementById("saved-places-login-btn");
    var cardTemplate = document.getElementById("saved-place-card-template");

    var visitReviewBackdrop = document.getElementById("visit-review-modal-backdrop");
    var visitReviewCloseBtn = document.getElementById("visit-review-modal-close");
    var visitReviewForm = document.getElementById("visit-review-form");
    var visitReviewCommentInput = document.getElementById("visit-review-comment-input");
    var visitReviewErrorEl = document.getElementById("visit-review-error-message");
    var visitReviewSubmitBtn = document.getElementById("visit-review-submit-btn");
    var visitReviewSatisfiedBtns = Array.prototype.slice.call(
      document.querySelectorAll(".visit-review-satisfied-btn"),
    );
    var currentVisitTarget = null;

    visitReviewSatisfiedBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        visitReviewSatisfiedBtns.forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
      });
    });

    if (visitReviewCloseBtn) {
      visitReviewCloseBtn.addEventListener("click", closeVisitReviewModal);
    }
    if (visitReviewBackdrop) {
      visitReviewBackdrop.addEventListener("click", function (e) {
        if (e.target === visitReviewBackdrop) {
          closeVisitReviewModal();
        }
      });
    }
    document.addEventListener("keydown", function (e) {
      if (
        e.key === "Escape" &&
        visitReviewBackdrop &&
        !visitReviewBackdrop.hidden
      ) {
        closeVisitReviewModal();
      }
    });
    if (visitReviewForm) {
      visitReviewForm.addEventListener("submit", function (e) {
        e.preventDefault();
        handleVisitReviewSubmit();
      });
    }

    function openVisitReviewModal(target) {
      currentVisitTarget = target;
      if (visitReviewForm) {
        visitReviewForm.reset();
      }
      visitReviewSatisfiedBtns.forEach(function (b) {
        b.classList.remove("active");
      });
      showVisitReviewError("");
      if (visitReviewBackdrop) {
        visitReviewBackdrop.hidden = false;
      }
      if (visitReviewCommentInput) {
        visitReviewCommentInput.focus();
      }
    }

    function closeVisitReviewModal() {
      if (visitReviewBackdrop) {
        visitReviewBackdrop.hidden = true;
      }
      currentVisitTarget = null;
    }

    function showVisitReviewError(message) {
      if (!visitReviewErrorEl) {
        return;
      }
      visitReviewErrorEl.textContent = message || "";
      visitReviewErrorEl.hidden = !message;
    }

    function handleVisitReviewSubmit() {
      if (!currentVisitTarget || visitReviewSubmitBtn.disabled) {
        return;
      }

      var selectedBtn = visitReviewSatisfiedBtns.filter(function (b) {
        return b.classList.contains("active");
      })[0];
      if (!selectedBtn) {
        showVisitReviewError("만족/불만족을 선택해주세요.");
        return;
      }

      var comment = visitReviewCommentInput
        ? visitReviewCommentInput.value.trim()
        : "";
      if (!comment) {
        showVisitReviewError("한 줄 후기를 입력해주세요.");
        return;
      }

      showVisitReviewError("");
      visitReviewSubmitBtn.disabled = true;

      window.HiddenGemAuth.getClient()
        .from(VISIT_REVIEW_TABLE)
        .insert({
          place_id: currentVisitTarget.place_id,
          place_name: currentVisitTarget.place_name,
          category_name: currentVisitTarget.category_name,
          address: currentVisitTarget.address,
          satisfied: selectedBtn.dataset.satisfied === "true",
          comment: comment,
        })
        .then(function (result) {
          visitReviewSubmitBtn.disabled = false;
          if (result.error) {
            console.error(
              "[my-page] 다녀왔어요 후기를 저장하지 못했습니다.",
              result.error,
            );
            showVisitReviewError(
              "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
            );
            return;
          }
          closeVisitReviewModal();
          window.alert("다녀온 후기가 등록됐어요. 메인 화면에서도 볼 수 있어요!");
        });
    }

    if (loginBtn) {
      loginBtn.addEventListener("click", function () {
        var authLoginBtn = document.getElementById("auth-login-btn");
        if (authLoginBtn) {
          authLoginBtn.click();
        }
      });
    }

    if (!window.HiddenGemAuth) {
      showState("error");
      if (errorEl) {
        errorEl.textContent =
          "맛집 주머니를 사용할 수 없습니다. Supabase 설정을 확인해주세요.";
      }
      return;
    }

    document.addEventListener("hiddengem:auth-changed", function (e) {
      var user = e.detail && e.detail.user;
      if (user) {
        load();
      } else {
        showState("login-required");
      }
    });

    // js/auth.js의 초기 세션 조회는 비동기라, 이 리스너가 등록되기 전에 이미
    // hiddengem:auth-changed가 한 번 발생해 있을 수 있다 — 놓치면 로그인 상태여도
    // "불러오는 중"에서 멈추므로, 등록 시점의 현재 상태를 한 번 더 확인해 둔다.
    if (window.HiddenGemAuth.getUser()) {
      load();
    } else {
      showState("login-required");
    }

    function load() {
      showState("loading");

      window.HiddenGemAuth.getClient()
        .from(TABLE)
        .select("id, place_id, place_name, category_name, address, x, y, created_at")
        .order("created_at", { ascending: false })
        .then(function (result) {
          if (result.error) {
            console.error(
              "[my-page] 맛집 주머니를 불러오지 못했습니다.",
              result.error,
            );
            showState("error");
            return;
          }
          renderList(result.data || []);
        });
    }

    function renderList(rows) {
      listEl.innerHTML = "";

      if (!rows.length) {
        showState("empty");
        return;
      }

      var fragment = document.createDocumentFragment();
      rows.forEach(function (row) {
        fragment.appendChild(buildCard(row));
      });
      listEl.appendChild(fragment);
      showState("content");
    }

    function buildCard(row) {
      var content = cardTemplate.content
        ? cardTemplate.content.cloneNode(true)
        : document.createDocumentFragment();

      var articleEl = content.querySelector(".saved-place-card");
      if (articleEl) {
        // js/my-page-review.js가 "구글 리뷰 보기" 클릭을 여기서 읽어간다
        // (js/kakao-search.js가 search.html 카드에 심어두는 것과 같은 패턴).
        articleEl.dataset.placeId = row.place_id || "";
        articleEl.dataset.placeName = row.place_name || "";
        articleEl.dataset.lat = row.y != null ? String(row.y) : "";
        articleEl.dataset.lng = row.x != null ? String(row.x) : "";
      }

      setText(content, "place_name", row.place_name || "");
      setText(content, "category_name", row.category_name || "");
      setText(content, "address", row.address || "");
      setText(content, "created_at", formatDate(row.created_at));

      var mapLinkEl = content.querySelector('[data-field="map_link"]');
      if (mapLinkEl) {
        if (row.place_id) {
          mapLinkEl.href = buildKakaoMapUrl(row.place_id);
        } else {
          mapLinkEl.hidden = true;
        }
      }

      var deleteBtn = content.querySelector(".saved-place-delete-btn");
      if (deleteBtn && articleEl) {
        deleteBtn.addEventListener("click", function () {
          handleDelete(row.id, articleEl, deleteBtn);
        });
      }

      var visitReviewBtn = content.querySelector(".visit-review-btn");
      if (visitReviewBtn) {
        visitReviewBtn.addEventListener("click", function () {
          openVisitReviewModal({
            place_id: row.place_id,
            place_name: row.place_name,
            category_name: row.category_name,
            address: row.address,
          });
        });
      }

      return content;
    }

    function handleDelete(id, cardEl, btn) {
      if (btn.disabled) {
        return;
      }
      btn.disabled = true;

      window.HiddenGemAuth.getClient()
        .from(TABLE)
        .delete()
        .eq("id", id)
        .then(function (result) {
          if (result.error) {
            btn.disabled = false;
            console.error("[my-page] 삭제 중 오류가 발생했습니다.", result.error);
            window.alert("삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            return;
          }
          if (cardEl.parentNode) {
            cardEl.parentNode.removeChild(cardEl);
          }
          if (!listEl.querySelector(".saved-place-card")) {
            showState("empty");
          }
        });
    }

    function showState(state) {
      loadingEl.hidden = state !== "loading";
      errorEl.hidden = state !== "error";
      loginRequiredEl.hidden = state !== "login-required";
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

  function formatDate(isoString) {
    var date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return "";
    }
    var pad = function (n) {
      return n < 10 ? "0" + n : "" + n;
    };
    return (
      date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate())
    );
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
