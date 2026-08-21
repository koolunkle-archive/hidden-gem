// Gemini API를 이용해 구글 리뷰 목록을 분석하는 공용 로직.
// Vercel 서버리스 함수(api/analyze-reviews.js)와 로컬 개발 서버(local-server.js)가
// 이 모듈을 그대로 공유한다 — api/_lib/google-places.js와 동일한 패턴.
"use strict";

var GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

// gemini-2.5-flash는 신규 사용자에게 더 이상 제공되지 않는다는 것을 실제 호출 에러로
// 확인했고(Google이 models/gemini-3.6-flash로 이전을 안내), 이후 또 모델이 바뀌면
// GEMINI_MODEL 환경변수로 즉시 오버라이드할 수 있다.
var DEFAULT_MODEL = "gemini-3.6-flash";

var MAX_REVIEW_TEXT_LENGTH = 600;
var MAX_KEYWORDS = 12;

var SENTIMENT_VALUES = ["positive", "neutral", "negative"];

var RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    reviewSentiments: {
      type: "ARRAY",
      items: { type: "STRING", enum: SENTIMENT_VALUES },
    },
    keywords: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          word: { type: "STRING" },
          score: { type: "INTEGER" },
          context: { type: "STRING", enum: ["positive", "negative"] },
        },
        required: ["word", "score", "context"],
      },
    },
    summary: { type: "STRING" },
  },
  required: ["reviewSentiments", "keywords", "summary"],
};

function makeError(message, statusCode) {
  var err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

// 리뷰 원본에서 author 등 불필요한 정보는 제외하고 {rating, text}만 남긴다.
function normalizeReviews(reviews) {
  if (!Array.isArray(reviews)) return [];
  return reviews
    .map(function (r) {
      var text = r && typeof r.text === "string" ? r.text.trim() : "";
      if (text.length > MAX_REVIEW_TEXT_LENGTH) {
        text = text.slice(0, MAX_REVIEW_TEXT_LENGTH);
      }
      return {
        rating: r && typeof r.rating === "number" ? r.rating : null,
        text: text,
      };
    })
    .filter(function (r) {
      return r.text.length > 0;
    });
}

function buildPrompt(placeName, reviews) {
  var reviewLines = reviews
    .map(function (r, i) {
      var ratingLabel = r.rating != null ? r.rating + "/5" : "평점 없음";
      return i + 1 + ". (별점 " + ratingLabel + ") " + r.text;
    })
    .join("\n");

  return [
    '너는 한국어 맛집 리뷰를 분석하는 도우미야. 아래는 "' +
      placeName +
      '"이라는 음식점의 구글 리뷰 ' +
      reviews.length +
      "개다.",
    "",
    "[리뷰 목록]",
    reviewLines,
    "",
    "다음을 수행해줘:",
    "1. 위 리뷰 " +
      reviews.length +
      "개를 순서대로 하나도 빠짐없이 긍정(positive)/보통(neutral)/부정(negative) 중 하나로 분류.",
    "2. 리뷰에서 반복적으로 언급되는 핵심 단어(음식 이름, 맛, 분위기, 서비스, 가격 등)를 최대 " +
      MAX_KEYWORDS +
      "개까지 뽑아, 각 단어의 중요도를 1~10 정수 점수로, 그 단어가 주로 좋은 맥락(positive)인지 나쁜 맥락(negative)인지 판단.",
    "3. 전체 리뷰를 종합한 한국어 한 문장 요약(60자 내외, 정중한 존댓말).",
    "반드시 지정된 JSON 스키마 형식으로만 응답해.",
  ].join("\n");
}

function clampScore(value) {
  var n = Math.round(Number(value));
  if (Number.isNaN(n)) n = 5;
  return Math.max(1, Math.min(10, n));
}

// 모델이 스키마를 어겨도 항상 유효한 shape을 반환하도록 방어적으로 보정한다.
function normalizeAnalysis(parsed, reviewCount) {
  var rawSentiments = Array.isArray(parsed.reviewSentiments)
    ? parsed.reviewSentiments
    : [];
  var sentiments = [];
  for (var i = 0; i < reviewCount; i++) {
    var value =
      typeof rawSentiments[i] === "string"
        ? rawSentiments[i].toLowerCase()
        : "";
    sentiments.push(SENTIMENT_VALUES.indexOf(value) !== -1 ? value : "neutral");
  }

  var counts = { positive: 0, neutral: 0, negative: 0 };
  sentiments.forEach(function (s) {
    counts[s]++;
  });

  var seenWords = {};
  var rawKeywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
  var keywords = [];
  for (var j = 0; j < rawKeywords.length && keywords.length < MAX_KEYWORDS; j++) {
    var k = rawKeywords[j];
    var word = k && typeof k.word === "string" ? k.word.trim() : "";
    if (!word) continue;
    var dedupeKey = word.toLowerCase();
    if (seenWords[dedupeKey]) continue;
    seenWords[dedupeKey] = true;

    var context =
      k.context === "negative" || k.context === "positive"
        ? k.context
        : "positive";

    keywords.push({
      word: word,
      score: clampScore(k.score),
      context: context,
    });
  }

  var summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";

  return { sentiment: counts, keywords: keywords, summary: summary };
}

// placeName + reviews([{rating, text}])로 Gemini에게 감정 분류/키워드/요약을 요청한다.
async function analyzeReviews(params) {
  var apiKey = params.apiKey;
  var placeName = params.placeName;
  var reviews = normalizeReviews(params.reviews);

  if (!apiKey) {
    throw makeError(
      "GEMINI_API_KEY가 설정되지 않았습니다. 서버 환경변수를 확인해주세요.",
      500,
    );
  }
  if (!reviews.length) {
    throw makeError("분석할 리뷰 내용이 없습니다.", 400);
  }

  var model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  var url = GEMINI_API_BASE + encodeURIComponent(model) + ":generateContent";

  var res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: buildPrompt(placeName, reviews) }] },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    var errBody = await safeJson(res);
    throw makeError(
      "Gemini 리뷰 분석 요청이 실패했습니다: " +
        (errBody && errBody.error && errBody.error.message
          ? errBody.error.message
          : res.status),
      502,
    );
  }

  var data = await res.json();
  var candidate =
    data && Array.isArray(data.candidates) ? data.candidates[0] : null;
  var text =
    candidate &&
    candidate.content &&
    Array.isArray(candidate.content.parts) &&
    candidate.content.parts[0]
      ? candidate.content.parts[0].text
      : null;

  if (!text) {
    throw makeError("AI가 리뷰 분석 응답을 생성하지 못했습니다.", 502);
  }

  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw makeError("AI 분석 응답을 해석하지 못했습니다.", 502);
  }

  return normalizeAnalysis(parsed, reviews.length);
}

module.exports = {
  analyzeReviews: analyzeReviews,
  DEFAULT_MODEL: DEFAULT_MODEL,
};
