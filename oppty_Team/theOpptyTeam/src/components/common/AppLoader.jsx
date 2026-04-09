import React from "react";
import companyLogo from "../../assets/opptylogo.png";
import "./AppLoader.css";

export default function AppLoader({
  title = "Loading...",
  subtitle = "Please wait",
}) {
  return (
    <div className="app-loader-overlay">
      <div className="app-loader-box">
        <div className="logo-spinner-wrap">
          <div className="logo-ring-spinner">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div className="logo-spinner-center">
            <img src={companyLogo} alt="Company Logo" className="app-loader-logo" />
          </div>
        </div>

        <h3 className="app-loader-title">{title}</h3>
        <p className="app-loader-text">{subtitle}</p>
      </div>
    </div>
  );
}