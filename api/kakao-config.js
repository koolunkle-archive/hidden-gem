// Vercel 서버리스 함수: GET /api/kakao-config
// KAKAO_REST_API_KEY 환경변수 값을 담은 window.KAKAO_REST_API_KEY 할당 스크립트를 응답한다.
// search.html이 이 엔드포인트를 <script src="/api/kakao-config">로 그대로 불러 쓴다.
"use strict";

var buildKakaoConfigScript = require("./_lib/kakao-config").buildKakaoConfigScript;

module.exports = function handler(req, res) {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(buildKakaoConfigScript());
};
