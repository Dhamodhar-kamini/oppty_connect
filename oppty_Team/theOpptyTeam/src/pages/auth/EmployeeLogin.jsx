import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { employeeDB } from "../../data/employees";
import AppLoader from "../../components/common/AppLoader";
import companyLogo from "../../assets/opptylogo.png";
import "./EmployeeLogin.css";

const FORGOT_STEPS = {
  EMAIL: "EMAIL",
  OTP: "OTP",
  RESET: "RESET",
  SUCCESS: "SUCCESS",
};

export default function EmployeeLogin() {
  const navigate = useNavigate();

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showForgotPopup, setShowForgotPopup] = useState(false);

  const [forgotStep, setForgotStep] = useState(FORGOT_STEPS.EMAIL);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [resetForm, setResetForm] = useState({
    password: "",
    confirmPassword: "",
  });

  const foundEmployee = useMemo(() => {
    return employeeDB.find(
      (emp) => emp.email.toLowerCase() === forgotEmail.trim().toLowerCase()
    );
  }, [forgotEmail]);

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setLoginError("");
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();

    const employee = employeeDB.find(
      (emp) =>
        emp.email.toLowerCase() === loginForm.email.trim().toLowerCase() &&
        emp.password === loginForm.password
    );

    if (!employee) {
      setLoginError("Invalid email or password.");
      return;
    }

    localStorage.setItem(
      "employeeAuth",
      JSON.stringify({
        isAuthenticated: true,
        employeeId: employee.id,
        email: employee.email,
        name: employee.name,
        role: employee.role,
      })
    );

    setIsLoggingIn(true);

    setTimeout(() => {
  window.location.href = "/chats";
}, 1800);
  };

  const openForgotPopup = () => {
    setShowForgotPopup(true);
    setForgotStep(FORGOT_STEPS.EMAIL);
    setForgotEmail("");
    setForgotError("");
    setForgotSuccessMsg("");
    setOtpValue("");
    setGeneratedOtp("");
    setResetForm({
      password: "",
      confirmPassword: "",
    });
  };

  const closeForgotPopup = () => {
    setShowForgotPopup(false);
    setForgotStep(FORGOT_STEPS.EMAIL);
    setForgotEmail("");
    setForgotError("");
    setForgotSuccessMsg("");
    setOtpValue("");
    setGeneratedOtp("");
    setResetForm({
      password: "",
      confirmPassword: "",
    });
  };

  const generateOtp = () => {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(otp);
  };

  const handleVerifyEmail = () => {
    if (!forgotEmail.trim()) {
      setForgotError("Please enter your email.");
      setForgotSuccessMsg("");
      return;
    }

    if (!foundEmployee) {
      setForgotError("Email not found in employee records.");
      setForgotSuccessMsg("");
      return;
    }

    generateOtp();
    setForgotError("");
    setForgotSuccessMsg("OTP has been sent successfully to your email.");
    setForgotStep(FORGOT_STEPS.OTP);
  };

  const handleResendOtp = () => {
    if (!foundEmployee) {
      setForgotError("Email not found in employee records.");
      setForgotSuccessMsg("");
      return;
    }

    generateOtp();
    setForgotError("");
    setForgotSuccessMsg("A new OTP has been sent to your email.");
    setOtpValue("");
  };

  const handleVerifyOtp = () => {
    if (!otpValue.trim()) {
      setForgotError("Please enter OTP.");
      setForgotSuccessMsg("");
      return;
    }

    if (otpValue !== generatedOtp) {
      setForgotError("Invalid OTP. Please try again.");
      setForgotSuccessMsg("");
      return;
    }

    setForgotError("");
    setForgotSuccessMsg("");
    setForgotStep(FORGOT_STEPS.RESET);
  };

  const handleResetPassword = () => {
    if (!resetForm.password || !resetForm.confirmPassword) {
      setForgotError("Please fill all password fields.");
      return;
    }

    if (resetForm.password.length < 6) {
      setForgotError("Password must be at least 6 characters.");
      return;
    }

    if (resetForm.password !== resetForm.confirmPassword) {
      setForgotError("Password and confirm password do not match.");
      return;
    }

    if (foundEmployee) {
      foundEmployee.password = resetForm.password;
    }

    setForgotError("");
    setForgotSuccessMsg("");
    setForgotStep(FORGOT_STEPS.SUCCESS);
  };

  return (
    <>
      <div className="employee-login-page">
        <div className="employee-login-card">
          <div className="employee-login-header">
            <div className="brandRow">
              <img src={companyLogo} alt="Company Logo" className="company-login-logo opptyLogo" />
            </div>
            <h1 className="sectionTitle">
             <span className="titleOrange">Connect</span>
            </h1>
            <p>Login to access your chat dashboard</p>
          </div>

          <form className="employee-login-form" onSubmit={handleLoginSubmit}>
            <div className="auth-input-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={loginForm.email}
                onChange={handleLoginChange}
                placeholder="Enter your email"
              />
            </div>

            <div className="auth-input-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={loginForm.password}
                onChange={handleLoginChange}
                placeholder="Enter your password"
              />
            </div>

            {loginError && <div className="auth-error-msg">{loginError}</div>}

            <button type="submit" className="auth-primary-btn" disabled={isLoggingIn}>
              Login
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

        {showForgotPopup && (
          <div className="auth-popup-overlay" onClick={closeForgotPopup}>
            <div
              className="auth-popup-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="auth-popup-top">
                <h2>Forgot Password</h2>
                <button
                  type="button"
                  className="auth-close-btn"
                  onClick={closeForgotPopup}
                >
                  ✕
                </button>
              </div>

              {forgotStep === FORGOT_STEPS.EMAIL && (
                <div className="auth-popup-body">
                  <p className="auth-popup-desc">
                    Enter your employee email to verify your account.
                  </p>

                  <div className="auth-input-group">
                    <label>Email Verification</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        setForgotError("");
                        setForgotSuccessMsg("");
                      }}
                      placeholder="Enter registered email"
                    />
                  </div>

                  {forgotError && <div className="auth-error-msg">{forgotError}</div>}
                  {forgotSuccessMsg && <div className="auth-success-msg">{forgotSuccessMsg}</div>}

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
                      onClick={handleVerifyEmail}
                    >
                      Verify Email
                    </button>
                  </div>
                </div>
              )}

              {forgotStep === FORGOT_STEPS.OTP && (
                <div className="auth-popup-body">
                  <p className="auth-popup-desc">
                    Enter the OTP sent to <strong>{forgotEmail}</strong>
                  </p>

                  <div className="auth-input-group">
                    <label>OTP Verification</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpValue}
                      onChange={(e) => {
                        setOtpValue(e.target.value);
                        setForgotError("");
                        setForgotSuccessMsg("");
                      }}
                      placeholder="Enter 6-digit OTP"
                    />
                  </div>

                  <button
                    type="button"
                    className="resend-otp-btn"
                    onClick={handleResendOtp}
                  >
                    Resend OTP
                  </button>

                  {forgotError && <div className="auth-error-msg">{forgotError}</div>}
                  {forgotSuccessMsg && <div className="auth-success-msg">{forgotSuccessMsg}</div>}

                  <div className="auth-popup-actions">
                    <button
                      type="button"
                      className="auth-secondary-btn"
                      onClick={() => {
                        setForgotStep(FORGOT_STEPS.EMAIL);
                        setForgotError("");
                        setForgotSuccessMsg("");
                      }}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="auth-primary-btn"
                      onClick={handleVerifyOtp}
                    >
                      Verify OTP
                    </button>
                  </div>
                </div>
              )}

              {forgotStep === FORGOT_STEPS.RESET && (
                <div className="auth-popup-body">
                  <p className="auth-popup-desc">
                    Set a new password for your account.
                  </p>

                  <div className="auth-input-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={resetForm.password}
                      onChange={(e) => {
                        setResetForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }));
                        setForgotError("");
                      }}
                      placeholder="Enter new password"
                    />
                  </div>

                  <div className="auth-input-group">
                    <label>Confirm Password</label>
                    <input
                      type="password"
                      value={resetForm.confirmPassword}
                      onChange={(e) => {
                        setResetForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }));
                        setForgotError("");
                      }}
                      placeholder="Confirm new password"
                    />
                  </div>

                  {forgotError && <div className="auth-error-msg">{forgotError}</div>}

                  <div className="auth-popup-actions">
                    <button
                      type="button"
                      className="auth-secondary-btn"
                      onClick={() => {
                        setForgotStep(FORGOT_STEPS.OTP);
                        setForgotError("");
                      }}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="auth-primary-btn"
                      onClick={handleResetPassword}
                    >
                      Set Password
                    </button>
                  </div>
                </div>
              )}

              {forgotStep === FORGOT_STEPS.SUCCESS && (
                <div className="auth-popup-body auth-success-body">
                  <div className="auth-success-icon">✓</div>
                  <h3>Password Updated Successfully</h3>
                  <p>Your password has been reset. Please login again.</p>

                  <div className="auth-popup-actions auth-popup-actions-center">
                    <button
                      type="button"
                      className="auth-primary-btn"
                      onClick={closeForgotPopup}
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

      {isLoggingIn && (
  <AppLoader
    title="Signing you in..."
    subtitle="Preparing your dashboard securely"
  />
)}
    </>
  );
}