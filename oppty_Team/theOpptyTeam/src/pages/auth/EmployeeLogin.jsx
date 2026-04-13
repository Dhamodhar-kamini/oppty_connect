import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, ensureCsrfToken, apiFetch } from "../../utils/api";
import { setAuthUser, isAuthenticated } from "../../utils/auth";
import AppLoader from "../../components/common/AppLoader";
import companyLogo from "../../assets/opptylogo.png";
import "./EmployeeLogin.css";

const FORGOT_STEPS = {
  EMAIL: "EMAIL",
  OTP: "OTP",
  RESET: "RESET",
  SUCCESS: "SUCCESS",
};

// ── Password strength calculator ────────────────────────────────
function getPasswordStrength(password) {
  if (!password) return { score: 0, label: "", color: "" };
  const checks = [
    password.length >= 6,
    password.length >= 10,
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const map = [
    { label: "", color: "" },
    { label: "Weak", color: "#dc2626" },
    { label: "Fair", color: "#f59e0b" },
    { label: "Good", color: "#3b82f6" },
    { label: "Strong", color: "#10b981" },
    { label: "Very Strong", color: "#059669" },
  ];
  return { score, ...map[score] };
}

export default function EmployeeLogin() {
  const navigate = useNavigate();

  // ── Splash ───────────────────────────────────────────────────
  const [showSplash, setShowSplash] = useState(true);

  // ── Login ────────────────────────────────────────────────────
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  // ── Forgot password ──────────────────────────────────────────
  const [showForgotPopup, setShowForgotPopup] = useState(false);
  const [forgotStep, setForgotStep] = useState(FORGOT_STEPS.EMAIL);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [maskedMobile, setMaskedMobile] = useState("");
  const [employeeNameHint, setEmployeeNameHint] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetForm, setResetForm] = useState({ password: "", confirm: "" });
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ── Loading states ───────────────────────────────────────────
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResettingPwd, setIsResettingPwd] = useState(false);

  // ── OTP timer ────────────────────────────────────────────────
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpSentAt, setOtpSentAt] = useState(null);

  // ── Splash timer ─────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 5500);
    return () => clearTimeout(t);
  }, []);

  // ── Redirect if already authenticated ───────────────────────
  useEffect(() => {
    if (!showSplash && isAuthenticated()) {
      navigate("/chats", { replace: true });
    }
    ensureCsrfToken();
  }, [showSplash, navigate]);

  // ── OTP countdown timer ──────────────────────────────────────
  useEffect(() => {
    if (otpTimer <= 0) return;
    const id = setInterval(() => setOtpTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [otpTimer]);

  // ── Reset forgot state ───────────────────────────────────────
  const resetForgot = useCallback(() => {
    setForgotStep(FORGOT_STEPS.EMAIL);
    setForgotEmail("");
    setForgotError("");
    setForgotSuccess("");
    setMaskedMobile("");
    setEmployeeNameHint("");
    setOtpValue("");
    setResetToken("");
    setResetForm({ password: "", confirm: "" });
    setOtpTimer(0);
    setOtpSentAt(null);
    setShowResetPwd(false);
    setShowResetConfirm(false);
  }, []);

  const openForgotPopup = () => { resetForgot(); setShowForgotPopup(true); };
  const closeForgotPopup = () => { setShowForgotPopup(false); resetForgot(); };

  // ── LOGIN ────────────────────────────────────────────────────
  const handleLoginChange = (e) => {
    setLoginForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setLoginError("");
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginForm.email.trim()) { setLoginError("Please enter your email."); return; }
    if (!loginForm.password) { setLoginError("Please enter your password."); return; }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const user = await loginUser(loginForm.email.trim(), loginForm.password);
      setAuthUser({
        id: user.id,
        employeeId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        about: user.about,
        status: user.status,
        avatarUrl: user.avatarUrl,
        is_suspended: user.is_suspended,
      });
      setTimeout(() => { window.location.href = "/chats"; }, 1200);
    } catch (err) {
      setLoginError(err.message || "Invalid email or password.");
      setIsLoggingIn(false);
    }
  };

  // ── FORGOT STEP 1 — Check email ──────────────────────────────
  const handleCheckEmail = async () => {
    const email = forgotEmail.trim();
    if (!email) { setForgotError("Please enter your email address."); return; }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) { setForgotError("Please enter a valid email address."); return; }

    setIsCheckingEmail(true);
    setForgotError("");
    setForgotSuccess("");

    try {
      const res = await apiFetch("/api/auth/check-email/", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setForgotError(data.error || "Email not found.");
        return;
      }

      setMaskedMobile(data.masked_mobile || "");
      setEmployeeNameHint(data.employee_name || "");

      // Auto-send OTP
      await handleSendOtp(email);
    } catch {
      setForgotError("Network error. Please try again.");
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // ── FORGOT STEP 2 — Send / resend OTP ───────────────────────
  const handleSendOtp = async (emailOverride = null) => {
    const email = emailOverride || forgotEmail.trim();
    setIsSendingOtp(true);
    setForgotError("");
    setForgotSuccess("");

    try {
      const res = await apiFetch("/api/auth/send-otp/", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setForgotError(data.error || "Failed to send OTP.");
        return;
      }

      setOtpTimer(60);
      setOtpSentAt(new Date());
      setForgotSuccess(`OTP sent to your registered mobile number.`);
      if (!emailOverride) setOtpValue("");
      if (forgotStep === FORGOT_STEPS.EMAIL) setForgotStep(FORGOT_STEPS.OTP);
    } catch {
      setForgotError("Failed to send OTP. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ── FORGOT STEP 3 — Verify OTP ───────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) {
      setForgotError("Please enter the complete 6-digit OTP.");
      return;
    }

    setIsVerifyingOtp(true);
    setForgotError("");

    try {
      const res = await apiFetch("/api/auth/verify-otp/", {
        method: "POST",
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp: otpValue,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setForgotError(data.error || "Invalid OTP.");
        return;
      }

      setResetToken(data.reset_token);
      setForgotSuccess("OTP verified! Set your new password.");
      setForgotStep(FORGOT_STEPS.RESET);
    } catch {
      setForgotError("Network error. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ── FORGOT STEP 4 — Reset password ───────────────────────────
  const handleResetPassword = async () => {
    if (!resetForm.password) { setForgotError("Please enter a new password."); return; }
    if (resetForm.password.length < 6) { setForgotError("Password must be at least 6 characters."); return; }
    if (!resetForm.confirm) { setForgotError("Please confirm your password."); return; }
    if (resetForm.password !== resetForm.confirm) { setForgotError("Passwords do not match."); return; }
    if (!resetToken) { setForgotError("Session expired. Please start over."); return; }

    setIsResettingPwd(true);
    setForgotError("");

    try {
      const res = await apiFetch("/api/auth/reset-password/", {
        method: "POST",
        body: JSON.stringify({
          email: forgotEmail.trim(),
          new_password: resetForm.password,
          reset_token: resetToken,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setForgotError(data.error || "Failed to reset password.");
        return;
      }

      setForgotStep(FORGOT_STEPS.SUCCESS);
    } catch {
      setForgotError("Network error. Please try again.");
    } finally {
      setIsResettingPwd(false);
    }
  };

  const pwdStrength = getPasswordStrength(resetForm.password);

  // ── Step index for indicator ─────────────────────────────────
  const stepIndex = Object.keys(FORGOT_STEPS).indexOf(forgotStep);

  // ── SPLASH ───────────────────────────────────────────────────
  if (showSplash) {
    return (
      <div className="hollywood-bright-splash">
        <div className="hollywood-studio-lights" />
        <p className="hollywood-presents">Oppty Techhub Private Limited</p>
        <div className="hollywood-main-reveal">
          <div className="hollywood-logo-wrapper">
            <img src={companyLogo} alt="Oppty Logo" className="hollywood-logo" />
            <div className="hollywood-sun-glint" />
          </div>
          <div className="hollywood-title-wrapper">
            <h1 className="hollywood-title">Connect</h1>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN RENDER ──────────────────────────────────────────────
  return (
    <>
      <div className="employee-login-page">
        <div className="employee-login-card">
          {/* Header */}
          <div className="employee-login-header">
            <div className="brandRow">
              <img
                src={companyLogo}
                alt="Oppty Logo"
                className="company-login-logo opptyLogo"
              />
            </div>
            <h1 className="sectionTitle">
              <span className="titleOrange">Connect</span>
            </h1>
            <p>Login to access your chat dashboard</p>
          </div>

          {/* Login Form */}
          <form className="employee-login-form" onSubmit={handleLoginSubmit}>
            <div className="auth-input-group">
              <label htmlFor="l-email">Email</label>
              <input
                id="l-email"
                type="email"
                name="email"
                value={loginForm.email}
                onChange={handleLoginChange}
                placeholder="Enter your email"
                autoComplete="email"
                disabled={isLoggingIn}
              />
            </div>

            <div className="auth-input-group">
              <label htmlFor="l-pwd">Password</label>
              <div className="auth-password-wrapper">
                <input
                  id="l-pwd"
                  type={showLoginPwd ? "text" : "password"}
                  name="password"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isLoggingIn}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowLoginPwd((v) => !v)}
                  tabIndex={-1}
                  aria-label="Toggle password visibility"
                >
                  {showLoginPwd ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="auth-error-msg" role="alert">{loginError}</div>
            )}

            <button
              type="submit"
              className="auth-primary-btn"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Signing in…" : "Login"}
            </button>

            <button
              type="button"
              className="forgot-password-btn"
              onClick={openForgotPopup}
              disabled={isLoggingIn}
            >
              Forgot Password?
            </button>
          </form>
        </div>

        {/* ── Forgot Password Popup ─────────────────────────── */}
        {showForgotPopup && (
          <div
            className="auth-popup-overlay"
            onClick={closeForgotPopup}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="auth-popup-card"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Popup header */}
              <div className="auth-popup-top">
                <h2>
                  {forgotStep === FORGOT_STEPS.EMAIL && "Forgot Password"}
                  {forgotStep === FORGOT_STEPS.OTP && "Verify Mobile OTP"}
                  {forgotStep === FORGOT_STEPS.RESET && "New Password"}
                  {forgotStep === FORGOT_STEPS.SUCCESS && "All Done!"}
                </h2>
                <button
                  type="button"
                  className="auth-close-btn"
                  onClick={closeForgotPopup}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Step indicator */}
              {forgotStep !== FORGOT_STEPS.SUCCESS && (
                <div className="auth-step-indicator">
                  {["Email", "OTP", "Reset"].map((label, i) => {
                    const isActive = i === stepIndex;
                    const isDone = i < stepIndex;
                    return (
                      <React.Fragment key={label}>
                        <div
                          className={`auth-step-dot ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                          title={label}
                        >
                          {isDone ? "✓" : i + 1}
                        </div>
                        {i < 2 && (
                          <div className={`auth-step-line ${isDone ? "done" : ""}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* ── STEP 1: Email ── */}
              {forgotStep === FORGOT_STEPS.EMAIL && (
                <div className="auth-popup-body">
                  <div className="auth-info-banner">
                    <span className="auth-info-icon">📱</span>
                    <p>
                      Enter your registered email. We'll send an OTP to
                      your linked mobile number to verify your identity.
                    </p>
                  </div>

                  <div className="auth-input-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        setForgotError("");
                      }}
                      placeholder="Enter your registered email"
                      disabled={isCheckingEmail}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCheckEmail();
                      }}
                    />
                  </div>

                  {forgotError && (
                    <div className="auth-error-msg" role="alert">{forgotError}</div>
                  )}

                  <div className="auth-popup-actions">
                    <button
                      type="button"
                      className="auth-secondary-btn"
                      onClick={closeForgotPopup}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="auth-primary-btn"
                      onClick={handleCheckEmail}
                      disabled={isCheckingEmail || isSendingOtp || !forgotEmail.trim()}
                    >
                      {isCheckingEmail || isSendingOtp
                        ? "Sending OTP…"
                        : "Send OTP"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: OTP ── */}
              {forgotStep === FORGOT_STEPS.OTP && (
                <div className="auth-popup-body">
                  {/* Mobile hint card */}
                  <div className="auth-mobile-hint-card">
                    <div className="auth-mobile-hint-icon">📱</div>
                    <div>
                      {employeeNameHint && (
                        <div className="auth-mobile-hint-name">
                          Hi, {employeeNameHint}!
                        </div>
                      )}
                      <div className="auth-mobile-hint-text">
                        OTP sent to{" "}
                        <strong style={{ fontFamily: "monospace" }}>
                          {maskedMobile || "your mobile"}
                        </strong>
                      </div>
                      <div className="auth-mobile-hint-sub">
                        Valid for 10 minutes
                      </div>
                    </div>
                  </div>

                  {/* OTP input */}
                  <div className="auth-input-group">
                    <label>Enter 6-Digit OTP</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpValue}
                      onChange={(e) => {
                        setOtpValue(e.target.value.replace(/\D/g, ""));
                        setForgotError("");
                        setForgotSuccess("");
                      }}
                      placeholder="• • • • • •"
                      className="auth-otp-input"
                      disabled={isVerifyingOtp}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otpValue.length === 6) {
                          handleVerifyOtp();
                        }
                      }}
                    />
                  </div>

                  {/* OTP boxes visual */}
                  <div className="auth-otp-boxes">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`auth-otp-box ${
                          otpValue[i]
                            ? "auth-otp-box-filled"
                            : i === otpValue.length
                            ? "auth-otp-box-active"
                            : ""
                        }`}
                      >
                        {otpValue[i] || ""}
                      </div>
                    ))}
                  </div>

                  {/* Resend */}
                  <div className="auth-resend-row">
                    <span style={{ fontSize: "13px", color: "#667781" }}>
                      Didn't receive it?
                    </span>
                    <button
                      type="button"
                      className="resend-otp-btn"
                      onClick={() => handleSendOtp()}
                      disabled={otpTimer > 0 || isSendingOtp}
                    >
                      {isSendingOtp
                        ? "Sending…"
                        : otpTimer > 0
                        ? `Resend in ${otpTimer}s`
                        : "Resend OTP"}
                    </button>
                  </div>

                  {forgotError && (
                    <div className="auth-error-msg" role="alert">{forgotError}</div>
                  )}
                  {forgotSuccess && (
                    <div className="auth-success-msg">{forgotSuccess}</div>
                  )}

                  <div className="auth-popup-actions">
                    <button
                      type="button"
                      className="auth-secondary-btn"
                      onClick={() => {
                        setForgotStep(FORGOT_STEPS.EMAIL);
                        setForgotError("");
                        setForgotSuccess("");
                        setOtpValue("");
                      }}
                      disabled={isVerifyingOtp}
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      className="auth-primary-btn"
                      onClick={handleVerifyOtp}
                      disabled={otpValue.length !== 6 || isVerifyingOtp}
                    >
                      {isVerifyingOtp ? "Verifying…" : "Verify OTP"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Reset Password ── */}
              {forgotStep === FORGOT_STEPS.RESET && (
                <div className="auth-popup-body">
                  {forgotSuccess && (
                    <div className="auth-success-msg">{forgotSuccess}</div>
                  )}

                  <div className="auth-input-group">
                    <label>New Password</label>
                    <div className="auth-password-wrapper">
                      <input
                        type={showResetPwd ? "text" : "password"}
                        value={resetForm.password}
                        onChange={(e) => {
                          setResetForm((p) => ({ ...p, password: e.target.value }));
                          setForgotError("");
                        }}
                        placeholder="Minimum 6 characters"
                        disabled={isResettingPwd}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="auth-eye-btn"
                        onClick={() => setShowResetPwd((v) => !v)}
                        tabIndex={-1}
                      >
                        {showResetPwd ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>

                  {/* Strength meter */}
                  {resetForm.password && (
                    <div className="auth-password-strength">
                      <div className="auth-strength-bars">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className="auth-strength-bar"
                            style={{
                              background:
                                i <= pwdStrength.score
                                  ? pwdStrength.color
                                  : "#e9edef",
                            }}
                          />
                        ))}
                      </div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: pwdStrength.color,
                          fontWeight: 600,
                          minWidth: "70px",
                        }}
                      >
                        {pwdStrength.label}
                      </span>
                    </div>
                  )}

                  <div className="auth-input-group">
                    <label>Confirm Password</label>
                    <div className="auth-password-wrapper">
                      <input
                        type={showResetConfirm ? "text" : "password"}
                        value={resetForm.confirm}
                        onChange={(e) => {
                          setResetForm((p) => ({ ...p, confirm: e.target.value }));
                          setForgotError("");
                        }}
                        placeholder="Re-enter new password"
                        disabled={isResettingPwd}
                        style={{
                          borderColor:
                            resetForm.confirm && resetForm.password !== resetForm.confirm
                              ? "#dc2626"
                              : resetForm.confirm && resetForm.password === resetForm.confirm
                              ? "#10b981"
                              : undefined,
                        }}
                      />
                      <button
                        type="button"
                        className="auth-eye-btn"
                        onClick={() => setShowResetConfirm((v) => !v)}
                        tabIndex={-1}
                      >
                        {showResetConfirm ? "🙈" : "👁️"}
                      </button>
                    </div>
                    {resetForm.confirm && resetForm.password !== resetForm.confirm && (
                      <span style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}>
                        Passwords do not match
                      </span>
                    )}
                    {resetForm.confirm && resetForm.password === resetForm.confirm && (
                      <span style={{ fontSize: "12px", color: "#10b981", marginTop: "4px" }}>
                        ✓ Passwords match
                      </span>
                    )}
                  </div>

                  {forgotError && (
                    <div className="auth-error-msg" role="alert">{forgotError}</div>
                  )}

                  <div className="auth-popup-actions">
                    <button
                      type="button"
                      className="auth-secondary-btn"
                      onClick={() => {
                        setForgotStep(FORGOT_STEPS.OTP);
                        setForgotError("");
                        setOtpValue("");
                      }}
                      disabled={isResettingPwd}
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      className="auth-primary-btn"
                      onClick={handleResetPassword}
                      disabled={
                        isResettingPwd ||
                        !resetForm.password ||
                        !resetForm.confirm ||
                        resetForm.password !== resetForm.confirm
                      }
                    >
                      {isResettingPwd ? "Saving…" : "Reset Password"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 4: Success ── */}
              {forgotStep === FORGOT_STEPS.SUCCESS && (
                <div className="auth-popup-body auth-success-body">
                  <div className="auth-success-animation">
                    <div className="auth-success-circle">
                      <div className="auth-success-check">✓</div>
                    </div>
                  </div>
                  <h3 style={{ margin: "16px 0 8px", color: "#111b21", fontSize: "20px" }}>
                    Password Reset Successfully!
                  </h3>
                  <p style={{ color: "#667781", margin: "0 0 20px", fontSize: "14px", lineHeight: 1.5 }}>
                    Your password has been updated. You can now login
                    with your new credentials.
                  </p>
                  <button
                    type="button"
                    className="auth-primary-btn"
                    onClick={closeForgotPopup}
                    style={{ width: "100%", maxWidth: "200px" }}
                  >
                    Back to Login
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isLoggingIn && (
        <AppLoader
          title="Signing you in…"
          subtitle="Preparing your dashboard securely"
        />
      )}
    </>
  );
}