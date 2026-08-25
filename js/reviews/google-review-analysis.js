// Hidden Gem - AI 리뷰 분석. review-modal.js가 쏘는 CustomEvent를 구독해 Gemini 기반
// 감정 분류/핵심 키워드/한줄 요약을 모달에 이어서 보여준다. 두 스크립트는 직접 호출하지 않는다.

(function () {
  "use strict";

  var CACHE_PREFIX = "hiddenGem:googleReviewAI:v1:";
  var API_ENDPOINT = "/api/analyze-reviews";

  function init() {
    var sectionEl = document.getElementById("review-ai-section");
    var loadingEl = document.getElementById("review-ai-loading");
    var errorEl = document.getElementById("review-ai-error");
    var contentEl = document.getElementById("review-ai-content");
    var summaryEl = document.getElementById("review-ai-summary");
    var barPositiveEl = document.getElementById("review-ai-bar-positive");
    var barNeutralEl = document.getElementById("review-ai-bar-neutral");
    var barNegativeEl = document.getElementById("review-ai-bar-negative");
    var countPositiveEl = document.getElementById("review-ai-count-positive");
    var countNeutralEl = document.getElementById("review-ai-count-neutral");
    var countNegativeEl = document.getElementById("review-ai-count-negative");
    var keywordsEl = document.getElementById("review-ai-keywords");

    // 이 페이지에 AI 분석 마크업이 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!sectionEl || !loadingEl || !contentEl || !keywordsEl) {
      return;
    }

    var currentRequestToken = 0;

    document.addEventListener("hiddengem:review-modal-opening", function () {
      currentRequestToken++; // 진행 중이던 분석 요청의 응답은 무시한다.
      sectionEl.hidden = true;
      showState("loading");
    });

    document.addEventListener(
      "hiddengem:google-review-rendered",
      function (e) {
        var detail = e.detail || {};
        var reviews = Array.isArray(detail.reviews) ? detail.reviews : [];

        if (!detail.found || reviews.length === 0) {
          sectionEl.hidden = true;
          return;
        }

        sectionEl.hidden = false;
        startAnalysis(detail.placeId, detail.placeName, reviews);
      },
    );

    function startAnalysis(placeId, placeName, reviews) {
      var cacheKey = CACHE_PREFIX + (placeId || placeName);
      var cached = readCache(cacheKey);
      if (cached) {
        renderAnalysis(cached);
        return;
      }

      showState("loading");

      var token = ++currentRequestToken;
      var payload = {
        name: placeName,
        reviews: reviews.map(function (r) {
          return { rating: r.rating, text: r.text };
        }),
      };

      fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
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
          if (token !== currentRequestToken) return;
          writeCache(cacheKey, data);
          renderAnalysis(data);
        })
        .catch(function (err) {
          if (token !== currentRequestToken) return;
          console.error("[google-review-analysis] 분석 실패", err);
          showState("error");
        });
    }

    function renderAnalysis(data) {
      var sentiment = (data && data.sentiment) || {
        positive: 0,
        neutral: 0,
        negative: 0,
      };
      var positive = sentiment.positive || 0;
      var neutral = sentiment.neutral || 0;
      var negative = sentiment.negative || 0;
      var total = positive + neutral + negative;

      barPositiveEl.style.width = (total ? (positive / total) * 100 : 0) + "%";
      barNeutralEl.style.width = (total ? (neutral / total) * 100 : 0) + "%";
      barNegativeEl.style.width = (total ? (negative / total) * 100 : 0) + "%";
      countPositiveEl.textContent = String(positive);
      countNeutralEl.textContent = String(neutral);
      countNegativeEl.textContent = String(negative);

      summaryEl.textContent =
        (data && data.summary) || "AI 요약을 생성하지 못했어요.";

      // 워드클라우드는 span의 실제 렌더링 크기를 측정해서 배치하므로,
      // 컨테이너가 화면에 보인 뒤(hidden 해제 후)에 그려야 폭을 정확히 잰다.
      showState("content");
      renderKeywordCloud((data && data.keywords) || []);
    }

    function renderKeywordCloud(keywords) {
      keywordsEl.innerHTML = "";
      keywordsEl.style.height = "";

      if (!keywords.length) {
        var emptySpan = document.createElement("span");
        emptySpan.className = "text-xs text-ink/40";
        emptySpan.textContent = "핵심 키워드를 찾지 못했어요.";
        keywordsEl.appendChild(emptySpan);
        return;
      }

      // 점수가 높은(중요한) 단어부터 배치해야 구름 중심에 자리잡는다.
      var sorted = keywords.slice().sort(function (a, b) {
        return (Number(b.score) || 0) - (Number(a.score) || 0);
      });

      var spans = sorted.map(function (kw) {
        var span = document.createElement("span");
        var score = Math.max(1, Math.min(10, Number(kw.score) || 1));
        var fontSizeRem = 0.75 + ((score - 1) * (1.75 - 0.75)) / 9;
        span.style.position = "absolute";
        span.style.whiteSpace = "nowrap";
        span.style.fontSize = fontSizeRem.toFixed(2) + "rem";
        span.className =
          "font-bold leading-none " +
          (kw.context === "negative" ? "text-negative" : "text-open");
        span.textContent = kw.word || "";
        keywordsEl.appendChild(span);
        return span;
      });

      var containerWidth = keywordsEl.clientWidth || 260;
      var placed = [];
      var GAP = 6;

      spans.forEach(function (span) {
        var w = span.offsetWidth + GAP;
        var h = span.offsetHeight + GAP;
        var pos = findSpiralSpot(w, h, placed);
        placed.push({ x: pos.x, y: pos.y, w: w, h: h, span: span });
      });

      // 배치된 단어들 전체의 경계를 구해 컨테이너 폭 기준 가운데로 옮기고,
      // 위쪽 여백 없이 붙도록 오프셋을 보정한다.
      var minX = Math.min.apply(
        null,
        placed.map(function (p) {
          return p.x;
        }),
      );
      var maxX = Math.max.apply(
        null,
        placed.map(function (p) {
          return p.x + p.w;
        }),
      );
      var minY = Math.min.apply(
        null,
        placed.map(function (p) {
          return p.y;
        }),
      );
      var maxY = Math.max.apply(
        null,
        placed.map(function (p) {
          return p.y + p.h;
        }),
      );

      var offsetX = (containerWidth - (maxX - minX)) / 2 - minX;
      var offsetY = -minY;

      placed.forEach(function (p) {
        p.span.style.left = p.x + offsetX + GAP / 2 + "px";
        p.span.style.top = p.y + offsetY + GAP / 2 + "px";
      });

      keywordsEl.style.height = maxY - minY + "px";
    }

    // 중심에서 아르키메데스 나선을 그리며 겹치지 않는 첫 위치를 찾는다 —
    // 먼저 배치되는(점수가 큰) 단어일수록 중심에 가깝게 모인다.
    function findSpiralSpot(w, h, placed) {
      var t = 0;
      var step = 0.25;
      var growth = 3.2;
      for (var i = 0; i < 4000; i++) {
        var r = growth * t;
        var x = r * Math.cos(t) - w / 2;
        var y = r * Math.sin(t) * 0.72 - h / 2; // 가로로 넓은 태그 모양에 맞춰 세로는 살짝 압축
        if (!overlaps(x, y, w, h, placed)) {
          return { x: x, y: y };
        }
        t += step;
      }
      return { x: -w / 2, y: -h / 2 };
    }

    function overlaps(x, y, w, h, placed) {
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i];
        if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) {
          return true;
        }
      }
      return false;
    }

    function showState(state) {
      loadingEl.hidden = state !== "loading";
      if (errorEl) errorEl.hidden = state !== "error";
      contentEl.hidden = state !== "content";
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
