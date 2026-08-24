// Hidden Gem - 카드에 Google Place Photos 사진을 붙이는 공용 헬퍼(window.HiddenGemPlacePhoto).
// 검색 결과 카드(js/kakao-search.js), "나를 위한 추천"(js/recommendations.js),
// "인기 맛집"(js/popular-places.js)이 모두 같은 카드 마크업 계약을 쓴다 —
// 카드 루트 안에 <img data-field="photo">(기본 class="hidden")와
// [data-field="photo-placeholder"](회색 "사진" 플레이스홀더)가 있어야 한다.
// 이름+좌표로 구글 장소를 찾아 대표 사진을 붙이는 /api/place-photo를 그대로 재사용한다
// (api/_lib/google-places.js의 findNearbyPlaceId 기반, 서버 쪽 상세 내용은 CLAUDE.md 참고).
//
// 주의: img에는 절대 loading="lazy"를 쓰지 말 것 — 사진이 로드되기 전까지는 hidden
// (display:none)으로 감춰져 있는데, display:none 요소는 레이아웃 박스가 없어서
// lazy-loading의 뷰포트 판정이 영원히 통과하지 못해 요청 자체가 발생하지 않는 실제
// 버그가 있었다.
(function () {
  "use strict";

  var DEFAULT_MAX_WIDTH = 480;

  // root: 카드 루트 요소(또는 DocumentFragment). place: { name, lat, lng, maxWidth? }.
  // name/lat/lng 중 하나라도 없으면(예: 좌표를 모르는 더미 데이터) 조용히 아무것도
  // 하지 않고 회색 플레이스홀더가 그대로 보인다.
  function attach(root, place) {
    var imgEl = root.querySelector('[data-field="photo"]');
    var placeholderEl = root.querySelector('[data-field="photo-placeholder"]');
    if (!imgEl || !placeholderEl) {
      return;
    }
    if (!place || !place.name || !place.lat || !place.lng) {
      return;
    }

    imgEl.alt = place.name;
    imgEl.addEventListener("load", function () {
      imgEl.classList.remove("hidden");
      placeholderEl.hidden = true;
    });
    imgEl.addEventListener("error", function () {
      imgEl.classList.add("hidden");
      placeholderEl.hidden = false;
    });
    imgEl.src =
      "/api/place-photo?name=" +
      encodeURIComponent(place.name) +
      "&lat=" +
      encodeURIComponent(place.lat) +
      "&lng=" +
      encodeURIComponent(place.lng) +
      "&maxWidth=" +
      (place.maxWidth || DEFAULT_MAX_WIDTH);
  }

  window.HiddenGemPlacePhoto = { attach: attach };
})();
