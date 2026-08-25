// Hidden Gem - 카드에 Google Place Photos 사진을 붙이는 공용 헬퍼(window.HiddenGemPlacePhoto).
// 카드 마크업 계약: <img data-field="photo" class="hidden"> + [data-field="photo-placeholder"].
// /api/place-photo가 이름+좌표로 장소를 찾아 사진 URL로 리다이렉트한다.
//
// 주의: img에 loading="lazy"를 쓰지 말 것 — hidden(display:none) 상태에는 레이아웃 박스가
// 없어 lazy 로딩의 뷰포트 판정이 통과하지 못하고 요청 자체가 발생하지 않는다.

(function () {
  "use strict";

  var DEFAULT_MAX_WIDTH = 480;

  // name/lat/lng 중 하나라도 없으면 조용히 아무것도 하지 않고 플레이스홀더를 유지한다.
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
