import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  loginUser,
  ensureCsrfToken,
  forgotCheckEmail,
  forgotVerifyOtp,
  forgotResetPassword,
} from "../../utils/api";
import { setAuthUser, isAuthenticated } from "../../utils/auth";
import AppLoader from "../../components/common/AppLoader";
import companyLogo from "../../assets/opptylogo.png";
import "./EmployeeLogin.css";

// ── Constants ─────────────────────────────────────────────────
const FORGOT_STEPS = {
  EMAIL: "EMAIL",
  OTP: "OTP",
  RESET: "RESET",
  SUCCESS: "SUCCESS",
};

// ── Password Strength ─────────────────────────────────────────
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

  // ── Splash ────────────────────────────────────────────────
  const [showSplash, setShowSplash] = useState(true);

  // ── Login ─────────────────────────────────────────────────
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  // ── Forgot Password ───────────────────────────────────────
  const [showForgotPopup, setShowForgotPopup] = useState(false);
  const [forgotStep, setForgotStep] = useState(FORGOT_STEPS.EMAIL);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [maskedMobile, setMaskedMobile] = useState("");
  const [employeeNameHint, setEmployeeNameHint] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [resetForm, setResetForm] = useState({ password: "", confirm: "" });
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ── Loading States ────────────────────────────────────────
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResettingPwd, setIsResettingPwd] = useState(false);

  // ── OTP Timer ─────────────────────────────────────────────
  const [otpTimer, setOtpTimer] = useState(0);

  // ── Splash Timer ──────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 5500);
    return () => clearTimeout(t);
  }, []);

  // ── Auth Redirect ─────────────────────────────────────────
  useEffect(() => {
    if (!showSplash && isAuthenticated()) {
      navigate("/chats", { replace: true });
    }
    ensureCsrfToken();
  }, [showSplash, navigate]);

  // ── OTP Countdown ─────────────────────────────────────────
  useEffect(() => {
    if (otpTimer <= 0) return;
    const id = setInterval(
      () => setOtpTimer((t) => (t > 0 ? t - 1 : 0)),
      1000
    );
    return () => clearInterval(id);
  }, [otpTimer]);

  // ── Reset Forgot State ────────────────────────────────────
  const resetForgot = useCallback(() => {
    setForgotStep(FORGOT_STEPS.EMAIL);
    setForgotEmail("");
    setForgotError("");
    setForgotSuccess("");
    setMaskedMobile("");
    setEmployeeNameHint("");
    setOtpValue("");
    setResetForm({ password: "", confirm: "" });
    setOtpTimer(0);
    setShowResetPwd(false);
    setShowResetConfirm(false);
  }, []);

  const openForgotPopup = () => {
    resetForgot();
    setShowForgotPopup(true);
  };

  const closeForgotPopup = () => {
    setShowForgotPopup(false);
    resetForgot();
  };

  // ═══════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════
  const handleLoginChange = (e) => {
    setLoginForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setLoginError("");
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginForm.email.trim()) {
      setLoginError("Please enter your email.");
      return;
    }
    if (!loginForm.password) {
      setLoginError("Please enter your password.");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const user = await loginUser(
        loginForm.email.trim(),
        loginForm.password
      );
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
      setTimeout(() => {
        window.location.href = "/chats";
      }, 1200);
    } catch (err) {
      setLoginError(err.message || "Invalid email or password.");
      setIsLoggingIn(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // FORGOT — STEP 1
  // Calls: POST /api/employee/verify-email/
  // Body:  { email }
  // This verifies email exists AND sends OTP in one call
  // ═══════════════════════════════════════════════════════════
  const handleCheckEmail = async () => {
    const email = forgotEmail.trim();

    if (!email) {
      setForgotError("Please enter your email address.");
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      setForgotError("Please enter a valid email address.");
      return;
    }

    setIsCheckingEmail(true);
    setForgotError("");
    setForgotSuccess("");

    try {
      const result = await forgotCheckEmail(email);

      // Store whatever your backend returns
      setMaskedMobile(result.masked_mobile || "");
      setEmployeeNameHint(result.employee_name || "");

      // OTP already sent by verify-email
      setOtpTimer(60);
      setForgotSuccess("OTP sent to your registered email.");
      setForgotStep(FORGOT_STEPS.OTP);
    } catch (err) {
      setForgotError(
        err.message || "Email not found in our records."
      );
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // FORGOT — RESEND OTP
  // Calls: POST /api/employee/verify-email/ (same endpoint)
  // ═══════════════════════════════════════════════════════════
  const handleResendOtp = async () => {
    const email = forgotEmail.trim();

    setIsSendingOtp(true);
    setForgotError("");
    setForgotSuccess("");

    try {
      await forgotCheckEmail(email);

      setOtpTimer(60);
      setOtpValue("");
      setForgotSuccess("OTP resent successfully!");

      // Clear success after 3s — matches vanilla JS behaviour
      setTimeout(() => setForgotSuccess(""), 3000);
    } catch (err) {
      setForgotError(
        err.message || "Failed to resend OTP. Please try again."
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // FORGOT — STEP 2
  // Calls: POST /api/verify-otp/
  // Body:  { email, otp }
  // ═══════════════════════════════════════════════════════════
  const handleVerifyOtp = async () => {
    if (!otpValue.trim()) {
      setForgotError("Please enter the OTP.");
      return;
    }
    if (otpValue.length !== 6) {
      setForgotError("Please enter the complete 6-digit OTP.");
      return;
    }

    setIsVerifyingOtp(true);
    setForgotError("");
    setForgotSuccess("");

    try {
      await forgotVerifyOtp(forgotEmail.trim(), otpValue);

      setForgotSuccess("OTP verified! Set your new password.");
      setForgotStep(FORGOT_STEPS.RESET);
    } catch (err) {
      setForgotError(err.message || "Invalid or expired OTP.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // FORGOT — STEP 3
  // Calls: PATCH /api/employee/reset-password/
  // Body:  { email, new_password }
  // ═══════════════════════════════════════════════════════════
  const handleResetPassword = async () => {
    const { password, confirm } = resetForm;

    if (!password) {
      setForgotError("Please enter a new password.");
      return;
    }
    if (password.length < 6) {
      setForgotError("Password must be at least 6 characters.");
      return;
    }
    if (!confirm) {
      setForgotError("Please confirm your password.");
      return;
    }
    if (password !== confirm) {
      setForgotError("Passwords do not match.");
      return;
    }

    setIsResettingPwd(true);
    setForgotError("");

    try {
      await forgotResetPassword(forgotEmail.trim(), password);

      setForgotStep(FORGOT_STEPS.SUCCESS);

      // Auto close after 2.5s — matches vanilla JS behaviour
      setTimeout(() => {
        closeForgotPopup();
      }, 2500);
    } catch (err) {
      setForgotError(err.message || "Failed to update password.");
    } finally {
      setIsResettingPwd(false);
    }
  };

  const pwdStrength = getPasswordStrength(resetForm.password);
  const stepIndex = Object.keys(FORGOT_STEPS).indexOf(forgotStep);

  // ── Splash Screen ─────────────────────────────────────────
  if (showSplash) {
    return (
      <div className="hollywood-bright-splash">
        <div className="hollywood-studio-lights" />
        <p className="hollywood-presents">
          Oppty Techhub Private Limited
        </p>
        <div className="hollywood-main-reveal">
          <div className="hollywood-logo-wrapper">
            <img
              src={companyLogo}
              alt="Oppty Logo"
              className="hollywood-logo"
            />
            <div className="hollywood-sun-glint" />
          </div>
          <div className="hollywood-title-wrapper">
            <h1 className="hollywood-title">Connect</h1>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Render ───────────────────────────────────────────
  return (
    <>
      <div className="employee-login-page">
        <div className="employee-login-card">

          {/* ── Header ────────────────────────────────────── */}
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

          {/* ── Login Form ─────────────────────────────────── */}
          <form
            className="employee-login-form"
            onSubmit={handleLoginSubmit}
            noValidate
          >
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
              <div className="auth-error-msg" role="alert">
                {loginError}
              </div>
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

        {/* ══════════════════════════════════════════════════
            FORGOT PASSWORD POPUP
            ══════════════════════════════════════════════════ */}
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
              {/* ── Popup Header ───────────────────────────── */}
              <div className="auth-popup-top">
                <h2>
                  {forgotStep === FORGOT_STEPS.EMAIL &&
                    "Forgot Password"}
                  {forgotStep === FORGOT_STEPS.OTP &&
                    "Verify OTP"}
                  {forgotStep === FORGOT_STEPS.RESET &&
                    "Set New Password"}
                  {forgotStep === FORGOT_STEPS.SUCCESS &&
                    "All Done!"}
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

              {/* ── Step Indicator ─────────────────────────── */}
              {forgotStep !== FORGOT_STEPS.SUCCESS && (
                <div className="auth-step-indicator">
                  {["Email", "OTP", "Reset"].map((label, i) => {
                    const isActive = i === stepIndex;
                    const isDone = i < stepIndex;
                    return (
                      <React.Fragment key={label}>
                        <div
                          className={`auth-step-dot${
                            isActive ? " active" : ""
                          }${isDone ? " done" : ""}`}
                          title={label}
                        >
                          {isDone ? "✓" : i + 1}
                        </div>
                        {i < 2 && (
                          <div
                            className={`auth-step-line${
                              isDone ? " done" : ""
                            }`}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* ════════════════════════════════════════════
                  STEP 1 — EMAIL
                  POST /api/employee/verify-email/
                  ════════════════════════════════════════════ */}
              {forgotStep === FORGOT_STEPS.EMAIL && (
                <div className="auth-popup-body">
                  <p className="auth-popup-desc">
                    Enter your registered email address. We'll
                    send an OTP to verify your identity.
                  </p>

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
                        if (e.key === "Enter")
                          handleCheckEmail();
                      }}
                    />
                  </div>

                  {forgotError && (
                    <div className="auth-error-msg" role="alert">
                      {forgotError}
                    </div>
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
                      disabled={
                        isCheckingEmail || !forgotEmail.trim()
                      }
                    >
                      {isCheckingEmail
                        ? "Checking…"
                        : "Verify Email"}
                    </button>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════════
                  STEP 2 — OTP
                  POST /api/verify-otp/
                  Resend: POST /api/employee/verify-email/
                  ════════════════════════════════════════════ */}
              {forgotStep === FORGOT_STEPS.OTP && (
                <div className="auth-popup-body">
                  {/* Greeting + hint */}
                  <div>
                    {employeeNameHint && (
                      <p
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#111b21",
                          margin: "0 0 4px",
                        }}
                      >
                        Hi, {employeeNameHint}!
                      </p>
                    )}
                    <p
                      className="auth-popup-desc"
                      style={{ margin: "0 0 4px" }}
                    >
                      OTP sent to{" "}
                      <strong style={{ fontFamily: "monospace" }}>
                        {maskedMobile || forgotEmail}
                      </strong>
                      . Valid for 10 minutes.
                    </p>
                  </div>

                  {/* OTP Input */}
                  <div className="auth-input-group">
                    <label>Enter 6-Digit OTP</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpValue}
                      onChange={(e) => {
                        setOtpValue(
                          e.target.value.replace(/\D/g, "")
                        );
                        setForgotError("");
                        setForgotSuccess("");
                      }}
                      placeholder="• • • • • •"
                      style={{
                        letterSpacing: "0.3em",
                        fontSize: 20,
                        fontWeight: 700,
                        textAlign: "center",
                        fontFamily: "'Courier New', monospace",
                      }}
                      disabled={isVerifyingOtp}
                      autoFocus
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          otpValue.length === 6
                        )
                          handleVerifyOtp();
                      }}
                    />
                  </div>

                  {/* Resend Row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{ fontSize: 13, color: "#667781" }}
                    >
                      Didn't receive it?
                    </span>
                    <button
                      type="button"
                      className="resend-otp-btn"
                      onClick={handleResendOtp}
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
                    <div className="auth-error-msg" role="alert">
                      {forgotError}
                    </div>
                  )}
                  {forgotSuccess && (
                    <div className="auth-success-msg">
                      {forgotSuccess}
                    </div>
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
                      disabled={
                        otpValue.length !== 6 || isVerifyingOtp
                      }
                    >
                      {isVerifyingOtp
                        ? "Verifying…"
                        : "Verify OTP"}
                    </button>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════════
                  STEP 3 — RESET PASSWORD
                  PATCH /api/employee/reset-password/
                  Body: { email, new_password }
                  ════════════════════════════════════════════ */}
              {forgotStep === FORGOT_STEPS.RESET && (
                <div className="auth-popup-body">
                  {forgotSuccess && (
                    <div className="auth-success-msg">
                      {forgotSuccess}
                    </div>
                  )}

                  <p className="auth-popup-desc">
                    Create a strong password for your account.
                  </p>

                  {/* New Password */}
                  <div className="auth-input-group">
                    <label>New Password</label>
                    <div className="auth-password-wrapper">
                      <input
                        type={showResetPwd ? "text" : "password"}
                        value={resetForm.password}
                        onChange={(e) => {
                          setResetForm((p) => ({
                            ...p,
                            password: e.target.value,
                          }));
                          setForgotError("");
                        }}
                        placeholder="Minimum 6 characters"
                        disabled={isResettingPwd}
                        autoFocus
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="auth-eye-btn"
                        onClick={() =>
                          setShowResetPwd((v) => !v)
                        }
                        tabIndex={-1}
                      >
                        {showResetPwd ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>

                  {/* Strength Meter */}
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
                          fontSize: 12,
                          color: pwdStrength.color,
                          fontWeight: 600,
                          minWidth: 70,
                        }}
                      >
                        {pwdStrength.label}
                      </span>
                    </div>
                  )}

                  {/* Confirm Password */}
                  <div className="auth-input-group">
                    <label>Confirm Password</label>
                    <div className="auth-password-wrapper">
                      <input
                        type={
                          showResetConfirm ? "text" : "password"
                        }
                        value={resetForm.confirm}
                        onChange={(e) => {
                          setResetForm((p) => ({
                            ...p,
                            confirm: e.target.value,
                          }));
                          setForgotError("");
                        }}
                        placeholder="Re-enter new password"
                        disabled={isResettingPwd}
                        autoComplete="new-password"
                        style={{
                          borderColor:
                            resetForm.confirm &&
                            resetForm.password !==
                              resetForm.confirm
                              ? "#dc2626"
                              : resetForm.confirm &&
                                resetForm.password ===
                                  resetForm.confirm
                              ? "#10b981"
                              : undefined,
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            handleResetPassword();
                        }}
                      />
                      <button
                        type="button"
                        className="auth-eye-btn"
                        onClick={() =>
                          setShowResetConfirm((v) => !v)
                        }
                        tabIndex={-1}
                      >
                        {showResetConfirm ? "🙈" : "👁️"}
                      </button>
                    </div>
                    {resetForm.confirm &&
                      resetForm.password !==
                        resetForm.confirm && (
                        <span
                          style={{
                            fontSize: 12,
                            color: "#dc2626",
                            marginTop: 4,
                            display: "block",
                          }}
                        >
                          Passwords do not match
                        </span>
                      )}
                    {resetForm.confirm &&
                      resetForm.password ===
                        resetForm.confirm && (
                        <span
                          style={{
                            fontSize: 12,
                            color: "#10b981",
                            marginTop: 4,
                            display: "block",
                          }}
                        >
                          ✓ Passwords match
                        </span>
                      )}
                  </div>

                  {forgotError && (
                    <div className="auth-error-msg" role="alert">
                      {forgotError}
                    </div>
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
                      {isResettingPwd
                        ? "Updating…"
                        : "Update Password"}
                    </button>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════════
                  STEP 4 — SUCCESS
                  Auto closes after 2.5s
                  ════════════════════════════════════════════ */}
              {forgotStep === FORGOT_STEPS.SUCCESS && (
                <div className="auth-popup-body auth-success-body">
                  <div className="auth-success-icon">✓</div>
                  <h3
                    style={{
                      margin: "12px 0 6px",
                      color: "#111b21",
                      fontSize: 20,
                      fontWeight: 800,
                    }}
                  >
                    Password Updated!
                  </h3>
                  <p
                    style={{
                      color: "#667781",
                      margin: "0 0 20px",
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    Your password has been updated successfully.
                    You can now login with your new credentials.
                  </p>
                  <div className="auth-popup-actions auth-popup-actions-center">
                    <button
                      type="button"
                      className="auth-primary-btn"
                      onClick={closeForgotPopup}
                      style={{ maxWidth: 200 }}
                    >
                      Back to Login
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── App Loader ────────────────────────────────────── */}
      {isLoggingIn && (
        <AppLoader
          title="Signing you in…"
          subtitle="Preparing your dashboard securely"
        />
      )}
    </>
  );
}