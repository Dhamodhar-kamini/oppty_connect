// src/pages/auth/EmployeeLogin.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, ensureCsrfToken } from "../../utils/api";
import { setAuthUser, isAuthenticated } from "../../utils/auth";
import AppLoader from "../../components/common/AppLoader";
import companyLogo from "../../assets/opptylogo.png";
import "./EmployeeLogin.css";

export default function EmployeeLogin() {
  const navigate = useNavigate();

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/chats", { replace: true });
    }
    
    // Ensure CSRF token is available
    ensureCsrfToken();
  }, [navigate]);

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setLoginError("");
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    
    if (!loginForm.email || !loginForm.password) {
      setLoginError("Please enter email and password");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const user = await loginUser(loginForm.email, loginForm.password);
      
      // Store user data
      setAuthUser({
        id: user.id,
        employeeId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        about: user.about,
        status: user.status,
        avatarUrl: user.avatarUrl,
      });

      // Redirect after short delay for UX
      setTimeout(() => {
        window.location.href = "/chats";
      }, 1000);
      
    } catch (err) {
      console.error("Login error:", err);
      setLoginError(err.message || "Login failed. Please check your credentials.");
      setIsLoggingIn(false);
    }
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
                autoComplete="email"
                disabled={isLoggingIn}
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
                autoComplete="current-password"
                disabled={isLoggingIn}
              />
            </div>

            {loginError && <div className="auth-error-msg">{loginError}</div>}

            <button type="submit" className="auth-primary-btn" disabled={isLoggingIn}>
              {isLoggingIn ? "Signing in..." : "Login"}
            </button>
          </form>
          
          {/* Demo credentials hint */}
          {/* <div style={{ 
            marginTop: '20px', 
            padding: '12px', 
            background: '#f5f6f6', 
            borderRadius: '8px', 
            fontSize: '13px', 
            color: '#667781' 
          }}>
            <strong>Demo Credentials:</strong><br />
            Admin: admin@oppty.com / admin123<br />
            Employee: employee@oppty.com / 123456
          </div> */}
        </div>
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