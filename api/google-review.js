// Vercel 서버리스 함수: GET /api/google-review?name=...&lat=...&lng=...
// Google Places API(New) 키를 브라우저에 노출하지 않기 위해 서버에서만 호출한다.
// 실제 조회 로직은 로컬 개발 서버와 공유하는 api/_lib/google-places.js에 있다.
"use strict";

var findNearbyPlaceReviews =
  require("./_lib/google-places").findNearbyPlaceReviews;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET 요청만 지원합니다." });
    return;
  }

  var query = req.query || {};
  var name = typeof query.name === "string" ? query.name : "";
  var lat = Number(query.lat);
  var lng = Number(query.lng);

  try {
    var result = await findNearbyPlaceReviews({
      apiKey: process.env.GOOGLE_PLACES_API_KEY,
      name: name,
      lat: lat,
      lng: lng,
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(err && err.statusCode ? err.statusCode : 500).json({
      error: (err && err.message) || "알 수 없는 오류가 발생했습니다.",
    });
  }
};
