// Hidden Gem - 메인 화면 "방금 다녀왔어요"(#reviews) 목록.
// visit_reviews는 RLS로 자기 것만 조회할 수 있어서, 전체 이용자의 방문 후기를 최신순으로
// 집계하는 Postgres 함수 recent_visit_reviews(Supabase, DDL은 supabase/recent_visit_reviews.sql)를
// RPC로 호출한다. 이 함수는 가게 정보 + 만족여부 + 한줄평 + 작성 시각만 반환하고 누가
// 남겼는지는 절대 내보내지 않으므로, RLS를 끄지 않고도 안전하게 전체 목록을 보여줄 수 있다.
// 로그인 여부와 무관하게(anon도 실행 권한이 있음) 누구나 볼 수 있다.

(function () {
  "use strict";

  var RPC_NAME = "recent_visit_reviews";
  var RESULT_LIMIT = 8;

  function init() {
    var listEl = document.getElementById("recent-reviews-list");

    // 이 페이지에 리뷰 목록 영역이 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!listEl) {
      return;
    }

    var loadingEl = document.getElementById("recent-reviews-loading");
    var errorEl = document.getElementById("recent-reviews-error");
    var emptyEl = document.getElementById("recent-reviews-empty");
    var template = document.getElementById("recent-review-card-template");

    if (!window.HiddenGemAuth) {
      showState("error");
      return;
    }

    load();

    function load() {
      showState("loading");

      window.HiddenGemAuth.getClient()
        .rpc(RPC_NAME, { limit_count: RESULT_LIMIT })
        .then(function (result) {
          if (result.error) {
            console.error(
              "[recent-reviews] 최근 리뷰를 불러오지 못했습니다.",
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
      rows.forEach(function (row) {
        fragment.appendChild(buildCard(row));
      });
      listEl.appendChild(fragment);
      showState("content");
    }

    function buildCard(row) {
      var content = template.content
        ? template.content.cloneNode(true)
        : document.createDocumentFragment();

      setText(content, "place_name", row.place_name || "");
      setText(content, "category_name", row.category_name || "");
      setText(content, "comment", row.comment || "");
      setText(content, "relative_time", formatRelativeTime(row.created_at));

      var badgeEl = content.querySelector('[data-field="satisfied_badge"]');
      if (badgeEl) {
        if (row.satisfied) {
          badgeEl.textContent = "만족";
          badgeEl.className =
            "text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap text-open bg-open/10";
        } else {
          badgeEl.textContent = "불만족";
          badgeEl.className =
            "text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap text-negative bg-negative/10";
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

  function formatRelativeTime(isoString) {
    var then = new Date(isoString).getTime();
    if (isNaN(then)) {
      return "";
    }
    var diffMinutes = Math.floor((Date.now() - then) / 60000);
    if (diffMinutes < 1) {
      return "방금 전";
    }
    if (diffMinutes < 60) {
      return diffMinutes + "분 전";
    }
    var diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return diffHours + "시간 전";
    }
    var diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return "어제";
    }
    if (diffDays < 7) {
      return diffDays + "일 전";
    }
    var date = new Date(isoString);
    var pad = function (n) {
      return n < 10 ? "0" + n : "" + n;
    };
    return (
      date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate())
    );
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
