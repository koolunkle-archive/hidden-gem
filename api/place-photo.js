// Vercel 서버리스 함수: GET /api/place-photo?name=...&lat=...&lng=...&maxWidth=480
// <img src="/api/place-photo?...">로 그대로 쓸 수 있도록, 찾은 사진의 실제 URL로
// 302 리다이렉트한다(Google Places 키를 브라우저에 노출하지 않기 위해 서버에서만
// 호출 — 리다이렉트 목적지는 키가 필요 없는 구글 CDN URL). 실제 조회 로직은 로컬
// 개발 서버와 공유하는 api/_lib/google-place-photo.js에 있다.
"use strict";

var findPlacePhoto = require("./_lib/google-place-photo").findPlacePhoto;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET 요청만 지원합니다." });
    return;
  }

  var query = req.query || {};
  var name = typeof query.name === "string" ? query.name : "";
  var lat = Number(query.lat);
  var lng = Number(query.lng);
  var maxWidthPx = query.maxWidth;

  try {
    var result = await findPlacePhoto({
      apiKey: process.env.GOOGLE_PLACES_API_KEY,
      name: name,
      lat: lat,
      lng: lng,
      maxWidthPx: maxWidthPx,
    });
    if (!result.found) {
      res.status(404).json({ error: "사진을 찾지 못했습니다." });
      return;
    }
    res.redirect(302, result.photoUri);
  } catch (err) {
    res.status(err && err.statusCode ? err.statusCode : 500).json({
      error: (err && err.message) || "알 수 없는 오류가 발생했습니다.",
    });
  }
};
