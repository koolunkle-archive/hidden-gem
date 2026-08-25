// Hidden Gem - 로그인/회원가입 (Supabase Auth). 비밀번호 처리는 Supabase에 위임하고
// 이 스크립트는 모달/폼 UI와 헤더의 로그인↔로그아웃 전환만 담당한다.
// 다른 스크립트가 로그인 상태를 쓸 수 있도록 window.HiddenGemAuth와
// hiddengem:auth-changed CustomEvent를 제공한다.

(function () {
  "use strict";

  var supabaseClient = null;
  var listeners = [];
  var currentSession = null;

  function init() {
    var loginBtn = document.getElementById("auth-login-btn");
    var userStatusEl = document.getElementById("auth-user-status");
    var userNameEl = document.getElementById("auth-user-name");
    var logoutBtn = document.getElementById("auth-logout-btn");
    var backdrop = document.getElementById("auth-modal-backdrop");
    var closeBtn = document.getElementById("auth-modal-close");
    var form = document.getElementById("auth-form");
    var emailInput = document.getElementById("auth-email-input");
    var passwordInput = document.getElementById("auth-password-input");
    var loginSubmitBtn = document.getElementById("auth-login-submit-btn");
    var signupSubmitBtn = document.getElementById("auth-signup-submit-btn");
    var errorEl = document.getElementById("auth-error-message");

    // 이 페이지에 로그인 UI 마크업이 없으면 대상 페이지가 아니므로 조용히 종료.
    if (!loginBtn || !userStatusEl || !backdrop || !form) {
      return;
    }

    var url = window.SUPABASE_URL || "";
    var anonKey = window.SUPABASE_ANON_KEY || "";

    if (!url || !anonKey || !window.supabase) {
      loginBtn.addEventListener("click", function () {
        window.alert(
          "로그인 기능을 사용할 수 없습니다. Supabase 설정을 확인해주세요.",
        );
      });
      return;
    }

    supabaseClient = window.supabase.createClient(url, anonKey);
    window.HiddenGemAuth = createAuthApi();

    supabaseClient.auth.getSession().then(function (result) {
      handleSessionChange((result.data && result.data.session) || null);
    });

    supabaseClient.auth.onAuthStateChange(function (_event, session) {
      handleSessionChange(session);
    });

    loginBtn.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !backdrop.hidden) closeModal();
    });

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        supabaseClient.auth.signOut();
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submitAuth("login");
    });
    if (signupSubmitBtn) {
      signupSubmitBtn.addEventListener("click", function () {
        submitAuth("signup");
      });
    }

    function openModal() {
      showError("");
      form.reset();
      backdrop.hidden = false;
      if (emailInput) emailInput.focus();
    }

    function closeModal() {
      backdrop.hidden = true;
    }

    function showError(message) {
      if (!errorEl) return;
      errorEl.textContent = message || "";
      errorEl.hidden = !message;
    }

    function setBusy(busy) {
      if (loginSubmitBtn) loginSubmitBtn.disabled = busy;
      if (signupSubmitBtn) signupSubmitBtn.disabled = busy;
    }

    function submitAuth(mode) {
      var email = (emailInput && emailInput.value.trim()) || "";
      var password = (passwordInput && passwordInput.value) || "";

      if (!email || !password) {
        showError("이메일과 비밀번호를 모두 입력해주세요.");
        return;
      }

      showError("");
      setBusy(true);

      var request =
        mode === "signup"
          ? supabaseClient.auth.signUp({ email: email, password: password })
          : supabaseClient.auth.signInWithPassword({
              email: email,
              password: password,
            });

      request
        .then(function (result) {
          setBusy(false);
          var error = result.error;
          var data = result.data;

          if (error) {
            showError(mapErrorMessage(mode, error));
            return;
          }

          if (mode === "signup" && !data.session) {
            // Supabase는 이메일 열거 공격 방지를 위해 이미 가입된 이메일이어도
            // 에러 없이 성공 응답을 주는데, 이 경우 identities가 빈 배열로 온다.
            var alreadyRegistered =
              data.user &&
              Array.isArray(data.user.identities) &&
              data.user.identities.length === 0;

            showError(
              alreadyRegistered
                ? "이미 가입된 이메일입니다."
                : "이메일 인증이 필요합니다. 관리자에게 문의해주세요.",
            );
            return;
          }

          closeModal();
        })
        .catch(function () {
          setBusy(false);
          showError("요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        });
    }

    function handleSessionChange(session) {
      currentSession = session;
      var user = session && session.user;

      if (user) {
        userNameEl.textContent =
          (user.email && user.email.split("@")[0]) || "회원";
        userStatusEl.hidden = false;
        loginBtn.hidden = true;
      } else {
        userStatusEl.hidden = true;
        loginBtn.hidden = false;
      }

      document.dispatchEvent(
        new CustomEvent("hiddengem:auth-changed", {
          detail: { session: session, user: user || null },
        }),
      );
      listeners.forEach(function (cb) {
        cb(session, user || null);
      });
    }
  }

  function mapErrorMessage(mode, error) {
    var msg = (error && error.message) || "";

    if (/invalid login credentials/i.test(msg)) {
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    }
    if (/email not confirmed/i.test(msg)) {
      return "이메일 인증이 필요합니다.";
    }
    if (/password should be at least/i.test(msg)) {
      return "비밀번호는 6자 이상이어야 합니다.";
    }
    if (/unable to validate email|invalid.*email/i.test(msg)) {
      return "올바른 이메일 형식이 아닙니다.";
    }
    if (/user already registered/i.test(msg)) {
      return "이미 가입된 이메일입니다.";
    }
    if (/rate limit/i.test(msg)) {
      return "요청이 많아 잠시 후 다시 시도해주세요.";
    }

    return mode === "signup"
      ? "회원가입에 실패했습니다. 잠시 후 다시 시도해주세요."
      : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }

  // 다른 기능이 로그인 여부/사용자 정보를 가져다 쓰기 위한 최소 공개 API.
  function createAuthApi() {
    return {
      getSession: function () {
        return currentSession;
      },
      getUser: function () {
        return (currentSession && currentSession.user) || null;
      },
      onChange: function (callback) {
        if (typeof callback === "function") listeners.push(callback);
      },
      // "맛집 담기" 등 인증이 필요한 DB 접근 기능이 별도의 Supabase 클라이언트를
      // 새로 만들지 않고 같은 세션(localStorage)을 공유하는 이 클라이언트를 재사용하게 한다.
      getClient: function () {
        return supabaseClient;
      },
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
