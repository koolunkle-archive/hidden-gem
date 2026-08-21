// SUPABASE_URL / SUPABASE_ANON_KEY 환경변수로부터 브라우저에서 바로 실행 가능한
// 스크립트 문자열을 만든다. Supabase의 anon(publishable) 키는 정책상 브라우저에
// 노출되도록 설계된 공개 키라 완전히 숨길 필요는 없지만, api/_lib/kakao-config.js와
// 동일한 이유로 정적 JS 파일에 실제 값을 하드코딩해 커밋하지 않기 위해 서버가
// 환경변수를 읽어 그때그때 스크립트를 만들어 응답한다.
"use strict";

function buildSupabaseConfigScript() {
  var url = process.env.SUPABASE_URL || "";
  var anonKey = process.env.SUPABASE_ANON_KEY || "";
  return (
    "window.SUPABASE_URL = " +
    JSON.stringify(url) +
    ";\n" +
    "window.SUPABASE_ANON_KEY = " +
    JSON.stringify(anonKey) +
    ";\n"
  );
}

module.exports = { buildSupabaseConfigScript: buildSupabaseConfigScript };
