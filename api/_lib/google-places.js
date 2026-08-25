// Google Places API (New)를 이용해 "식당 이름 + 좌표"로 해당 가게를 찾고
// 별점/리뷰 요약 정보를 가져오는 공용 로직.
// Vercel 서버리스 함수(api/google-review.js)와 로컬 개발 서버(server.js)가
// 이 모듈을 그대로 공유한다 — 두 실행 환경에서 동일한 동작을 보장하기 위함.
"use strict";

var TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
var PLACE_DETAILS_BASE_URL = "https://places.googleapis.com/v1/places";

// "걸어서 2분 거리(약 150m)" 이내인 가게만 동일 가게로 인정한다.
var MAX_DISTANCE_METERS = 150;

// 후보를 찾기 위한 검색 단계 필드마스크(최소 정보만 요청 — id/좌표).
var SEARCH_FIELD_MASK = "places.id,places.location";

// 화면에서 바로 쓰는 5개 정보로 제한: 가게 이름 / 별점 / 리뷰 개수 / 리뷰 내용 / 구글맵 링크.
var DETAILS_FIELD_MASK =
  "displayName,rating,userRatingCount,reviews,googleMapsUri";

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = toRad(lat2 - lat1);
  var dLng = toRad(lng2 - lng1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

function validateParams(apiKey, name, lat, lng) {
  if (!apiKey) {
    throw makeError(
      "GOOGLE_PLACES_API_KEY가 설정되지 않았습니다. 서버 환경변수를 확인해주세요.",
      500,
    );
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    throw makeError("가게 이름(name)이 필요합니다.", 400);
  }
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    Number.isNaN(lat) ||
    Number.isNaN(lng)
  ) {
    throw makeError("유효한 좌표(lat, lng)가 필요합니다.", 400);
  }
}

// 검색 결과는 관련도순으로 오므로, 그중 반경 150m 이내인 첫 후보를 채택한다.
// (동일한 이름의 다른 지점과 혼동하지 않기 위한 좌표 검증)
function pickNearbyMatch(searchData, lat, lng) {
  var candidates =
    searchData && Array.isArray(searchData.places) ? searchData.places : [];
  for (var i = 0; i < candidates.length; i++) {
    var place = candidates[i];
    if (!place.location) continue;
    var d = distanceMeters(
      lat,
      lng,
      place.location.latitude,
      place.location.longitude,
    );
    if (d <= MAX_DISTANCE_METERS) {
      return place;
    }
  }
  return null;
}

// name/lat/lng으로 구글맵에서 가게를 찾아 place id를 반환한다(못 찾으면 null).
// findNearbyPlaceReviews와 api/_lib/google-place-photo.js가 함께 쓰는 첫 단계 —
// "이름 텍스트 검색 → 반경 150m 이내 후보로 검증" 로직을 중복시키지 않기 위함.
async function findNearbyPlaceId(params) {
  var apiKey = params.apiKey;
  var name = params.name;
  var lat = params.lat;
  var lng = params.lng;

  validateParams(apiKey, name, lat, lng);

  var searchRes = await fetch(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: name,
      languageCode: "ko",
      maxResultCount: 5,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: MAX_DISTANCE_METERS,
        },
      },
    }),
  });

  if (!searchRes.ok) {
    var searchErrBody = await safeJson(searchRes);
    throw makeError(
      "Google 장소 검색 요청이 실패했습니다: " +
        (searchErrBody && searchErrBody.error && searchErrBody.error.message
          ? searchErrBody.error.message
          : searchRes.status),
      502,
    );
  }

  var searchData = await searchRes.json();
  var match = pickNearbyMatch(searchData, lat, lng);
  return match ? match.id : null;
}

// name/lat/lng으로 구글맵에서 가게를 찾아 정리된 리뷰 요약을 반환한다.
// 반경 150m 이내에서 못 찾으면 { found: false }를 반환한다.
async function findNearbyPlaceReviews(params) {
  var apiKey = params.apiKey;
  var name = params.name;

  var placeId = await findNearbyPlaceId(params);
  if (!placeId) {
    return { found: false };
  }

  var detailsRes = await fetch(
    PLACE_DETAILS_BASE_URL +
      "/" +
      encodeURIComponent(placeId) +
      "?languageCode=ko",
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
    },
  );

  if (!detailsRes.ok) {
    var detailsErrBody = await safeJson(detailsRes);
    throw makeError(
      "Google 장소 상세 정보 요청이 실패했습니다: " +
        (detailsErrBody && detailsErrBody.error && detailsErrBody.error.message
          ? detailsErrBody.error.message
          : detailsRes.status),
      502,
    );
  }

  var details = await detailsRes.json();
  var reviews = Array.isArray(details.reviews) ? details.reviews : [];

  return {
    found: true,
    name: (details.displayName && details.displayName.text) || name,
    rating: typeof details.rating === "number" ? details.rating : null,
    reviewCount:
      typeof details.userRatingCount === "number" ? details.userRatingCount : 0,
    googleMapsUri: details.googleMapsUri || null,
    reviews: reviews.map(function (review) {
      return {
        author:
          (review.authorAttribution && review.authorAttribution.displayName) ||
          "익명",
        rating: typeof review.rating === "number" ? review.rating : null,
        relativeTime: review.relativePublishTimeDescription || "",
        publishTime: review.publishTime || null,
        text:
          (review.text && review.text.text) ||
          (review.originalText && review.originalText.text) ||
          "",
      };
    }),
  };
}

module.exports = {
  findNearbyPlaceReviews: findNearbyPlaceReviews,
  findNearbyPlaceId: findNearbyPlaceId,
  distanceMeters: distanceMeters,
  MAX_DISTANCE_METERS: MAX_DISTANCE_METERS,
  makeError: makeError,
  safeJson: safeJson,
};
