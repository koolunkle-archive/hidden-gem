// Hidden Gem 로컬 개발 서버.
// 정적 파일(index.html, search.html, js/*)을 서빙하면서 동시에 /api/google-review를
// Vercel 서버리스 함수와 동일한 로직(api/_lib/google-places.js)으로 처리한다.
// 별도 패키지 설치 없이 Node 내장 모듈 + 전역 fetch(Node 18+)만 사용한다.
//
// 실행: node local-server.js
// 사전 준비: 프로젝트 루트에 .env 파일을 만들고 GOOGLE_PLACES_API_KEY=실제키 를 입력
//           (.env.example 참고)
"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");
var URL = require("url").URL;

loadDotEnvFile();

var findNearbyPlaceReviews =
  require("./api/_lib/google-places").findNearbyPlaceReviews;
var buildKakaoConfigScript =
  require("./api/_lib/kakao-config").buildKakaoConfigScript;
var analyzeReviews =
  require("./api/_lib/gemini-review-analysis").analyzeReviews;
var buildSupabaseConfigScript =
  require("./api/_lib/supabase-config").buildSupabaseConfigScript;

var PORT = Number(process.env.PORT) || 3000;
var ROOT_DIR = __dirname;

var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

var server = http.createServer(function (req, res) {
  var requestUrl;
  try {
    requestUrl = new URL(req.url, "http://localhost");
  } catch (e) {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }

  if (requestUrl.pathname === "/api/google-review") {
    handleGoogleReviewRequest(req, requestUrl, res);
    return;
  }

  if (requestUrl.pathname === "/api/kakao-config") {
    handleKakaoConfigRequest(res);
    return;
  }

  if (requestUrl.pathname === "/api/analyze-reviews") {
    handleAnalyzeReviewsRequest(req, res);
    return;
  }

  if (requestUrl.pathname === "/api/supabase-config") {
    handleSupabaseConfigRequest(res);
    return;
  }

  serveStaticFile(requestUrl.pathname, res);
});

function handleKakaoConfigRequest(res) {
  var body = buildKakaoConfigScript();
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function handleSupabaseConfigRequest(res) {
  var body = buildSupabaseConfigScript();
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function handleGoogleReviewRequest(req, requestUrl, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "GET 요청만 지원합니다." });
    return;
  }

  var name = requestUrl.searchParams.get("name") || "";
  var lat = Number(requestUrl.searchParams.get("lat"));
  var lng = Number(requestUrl.searchParams.get("lng"));

  findNearbyPlaceReviews({
    apiKey: process.env.GOOGLE_PLACES_API_KEY,
    name: name,
    lat: lat,
    lng: lng,
  })
    .then(function (result) {
      sendJson(res, 200, result);
    })
    .catch(function (err) {
      sendJson(res, (err && err.statusCode) || 500, {
        error: (err && err.message) || "알 수 없는 오류가 발생했습니다.",
      });
    });
}

function handleAnalyzeReviewsRequest(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "POST 요청만 지원합니다." });
    return;
  }

  readJsonBody(req)
    .then(function (body) {
      var name = typeof body.name === "string" ? body.name : "";
      var reviews = Array.isArray(body.reviews) ? body.reviews : [];
      return analyzeReviews({
        apiKey: process.env.GEMINI_API_KEY,
        placeName: name,
        reviews: reviews,
      });
    })
    .then(function (result) {
      sendJson(res, 200, result);
    })
    .catch(function (err) {
      if (err instanceof SyntaxError) {
        sendJson(res, 400, { error: "요청 본문(JSON)을 해석하지 못했습니다." });
        return;
      }
      sendJson(res, (err && err.statusCode) || 500, {
        error: (err && err.message) || "알 수 없는 오류가 발생했습니다.",
      });
    });
}

// POST 요청 본문을 모아 JSON으로 파싱한다(내장 http 서버는 자동 파싱을 해주지 않음).
function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (chunk) {
      chunks.push(chunk);
    });
    req.on("end", function () {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, data) {
  var body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function serveStaticFile(pathname, res) {
  if (pathname === "/") {
    pathname = "/index.html";
  }

  // 상위 디렉터리 접근(../) 방지.
  var safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  var filePath = path.join(ROOT_DIR, safePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found: " + pathname);
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    });
    res.end(data);
  });
}

// dotenv 패키지 없이 .env 파일(KEY=VALUE)을 읽어 process.env에 채워 넣는다.
function loadDotEnvFile() {
  var envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  var content = fs.readFileSync(envPath, "utf8");
  content.split(/\r?\n/).forEach(function (line) {
    var trimmed = line.trim();
    if (!trimmed || trimmed.indexOf("#") === 0) return;
    var eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;
    var key = trimmed.slice(0, eqIndex).trim();
    var value = trimmed
      .slice(eqIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  });
}

server.listen(PORT, function () {
  console.log("Hidden Gem 로컬 서버 실행 중: http://localhost:" + PORT);
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.warn(
      "[경고] GOOGLE_PLACES_API_KEY가 설정되지 않았습니다. " +
        ".env 파일을 만들거나(.env.example 참고) 환경변수로 지정해주세요.",
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn(
      "[경고] GEMINI_API_KEY가 설정되지 않았습니다. " +
        ".env 파일을 만들거나(.env.example 참고) 환경변수로 지정해주세요. " +
        "(다른 기능에는 영향 없음 — AI 리뷰 분석 섹션만 비활성화됩니다.)",
    );
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.warn(
      "[경고] SUPABASE_URL / SUPABASE_ANON_KEY가 설정되지 않았습니다. " +
        ".env 파일을 만들거나(.env.example 참고) 환경변수로 지정해주세요. " +
        "(다른 기능에는 영향 없음 — 로그인 기능만 비활성화됩니다.)",
    );
  }
});
