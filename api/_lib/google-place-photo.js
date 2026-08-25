// Google Places API (New)의 Photos를 이용해 "식당 이름 + 좌표"에 해당하는 가게의
// 대표 사진 URL을 가져오는 공용 로직. 가게를 찾는 첫 단계(텍스트 검색 → 반경 150m
// 이내 후보 검증)는 api/_lib/google-places.js의 findNearbyPlaceId를 그대로 재사용한다.
// Vercel 서버리스 함수(api/place-photo.js)와 로컬 개발 서버(server.js)가
// 이 모듈을 그대로 공유한다.
"use strict";

var googlePlaces = require("./google-places");
var findNearbyPlaceId = googlePlaces.findNearbyPlaceId;
var makeError = googlePlaces.makeError;
var safeJson = googlePlaces.safeJson;

var PLACE_DETAILS_BASE_URL = "https://places.googleapis.com/v1/places";
var PHOTOS_FIELD_MASK = "photos";
var DEFAULT_MAX_WIDTH_PX = 480;
var MIN_MAX_WIDTH_PX = 100;
var MAX_MAX_WIDTH_PX = 1600;

function clampMaxWidthPx(value) {
  var n = Number(value);
  if (!n || Number.isNaN(n)) {
    return DEFAULT_MAX_WIDTH_PX;
  }
  return Math.max(MIN_MAX_WIDTH_PX, Math.min(MAX_MAX_WIDTH_PX, Math.round(n)));
}

// name/lat/lng으로 구글맵에서 가게를 찾아 대표 사진의 실제 이미지 URL(photoUri)을
// 반환한다. 가게를 못 찾았거나 사진이 없으면 { found: false }를 반환한다.
async function findPlacePhoto(params) {
  var apiKey = params.apiKey;
  var maxWidthPx = clampMaxWidthPx(params.maxWidthPx);

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
        "X-Goog-FieldMask": PHOTOS_FIELD_MASK,
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
  var photos = Array.isArray(details.photos) ? details.photos : [];
  if (!photos.length || !photos[0].name) {
    return { found: false };
  }

  var mediaRes = await fetch(
    "https://places.googleapis.com/v1/" +
      photos[0].name +
      "/media?maxWidthPx=" +
      maxWidthPx +
      "&skipHttpRedirect=true",
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
      },
    },
  );

  if (!mediaRes.ok) {
    var mediaErrBody = await safeJson(mediaRes);
    throw makeError(
      "Google 사진 요청이 실패했습니다: " +
        (mediaErrBody && mediaErrBody.error && mediaErrBody.error.message
          ? mediaErrBody.error.message
          : mediaRes.status),
      502,
    );
  }

  var media = await mediaRes.json();
  if (!media.photoUri) {
    return { found: false };
  }

  return { found: true, photoUri: media.photoUri };
}

module.exports = {
  findPlacePhoto: findPlacePhoto,
};
