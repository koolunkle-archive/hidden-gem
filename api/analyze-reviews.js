// Vercel 서버리스 함수: POST /api/analyze-reviews
// body: { name: string, reviews: [{rating, text}] }
// Gemini API 키를 브라우저에 노출하지 않기 위해 서버에서만 호출한다.
// 실제 분석 로직은 로컬 개발 서버와 공유하는 api/_lib/gemini-review-analysis.js에 있다.
"use strict";

var analyzeReviews = require("./_lib/gemini-review-analysis").analyzeReviews;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 지원합니다." });
    return;
  }

  var body = req.body || {};
  var name = typeof body.name === "string" ? body.name : "";
  var reviews = Array.isArray(body.reviews) ? body.reviews : [];

  try {
    var result = await analyzeReviews({
      apiKey: process.env.GEMINI_API_KEY,
      placeName: name,
      reviews: reviews,
    });
    res.status(200).json(result);
  } catch (err) {
    res
      .status(err && err.statusCode ? err.statusCode : 500)
      .json({ error: (err && err.message) || "알 수 없는 오류가 발생했습니다." });
  }
};
