// KAKAO_REST_API_KEY 환경변수로부터 브라우저에서 바로 실행 가능한 스크립트 문자열을 만든다.
// 카카오 REST API 키는 카카오 정책상 Authorization 헤더에 담아 브라우저에서 직접 호출하도록
// 설계되어 있어 Google 키처럼 서버 뒤에 완전히 숨길 필요는 없지만, 이 프로젝트는 빌드
// 시스템이 없는 정적 사이트라서 "정적 JS 파일에 실제 키를 하드코딩해서 커밋"하는 대신
// 서버(로컬 서버 / Vercel 서버리스 함수)가 환경변수를 읽어 그때그때 스크립트를 만들어
// 응답한다 — api/_lib/google-places.js와 동일한 로컬/Vercel 공유 패턴.
"use strict";

function buildKakaoConfigScript() {
  var key = process.env.KAKAO_REST_API_KEY || "";
  return "window.KAKAO_REST_API_KEY = " + JSON.stringify(key) + ";\n";
}

module.exports = { buildKakaoConfigScript: buildKakaoConfigScript };
