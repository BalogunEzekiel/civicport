import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  Building2,
  CheckCircle2,
} from "lucide-react";

import { api } from "../services/api";

export default function GovernmentLogin() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    if (!form.email.trim() || !form.password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const data = await api.governmentLogin(
        form.email.trim(),
        form.password
      );

      if (!data?.success || !data?.user) {
        throw new Error(
          data?.message ||
          "Invalid government credentials."
        );
      }

      /*
      * Government authentication succeeded.
      */

      sessionStorage.setItem(
        "governmentAuthenticated",
        "true"
      );

      sessionStorage.setItem(
        "governmentEmail",
        data.user.email
      );

      sessionStorage.setItem(
        "governmentRole",
        data.user.role
      );

      /*
      * Respect "Remember me" for this browser session.
      *
      * For now we continue using sessionStorage because
      * your protected route already uses sessionStorage.
      */

      navigate("/admin");

    } catch (err) {
      console.error(
        "Government login failed:",
        err
      );

      setError(
        err.message ||
        "Unable to sign in. Please try again."
      );

    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="government-login">

      {/* LEFT BRAND PANEL */}
      <section className="government-login-brand">

        <div className="government-brand-top">
          <div className="government-logo">
            <ShieldCheck size={23} />
          </div>

          <div>
            <div className="government-brand-name">
              CIVIC<span>PORT</span>
            </div>

            <div className="government-brand-label">
              CIVIC INTELLIGENCE PLATFORM
            </div>
          </div>
        </div>

        <div className="government-brand-content">

          <div className="government-eyebrow">
            <span />
            GOVERNMENT PORTAL
          </div>

          <h1>
            Turn civic reports
            <br />
            into <em>real action.</em>
          </h1>

          <p>
            A secure workspace for authorized
            government personnel to review,
            assign, monitor and resolve community
            issues.
          </p>

          <div className="government-features">

            <div>
              <CheckCircle2 size={18} />
              <span>
                Manage citizen reports
              </span>
            </div>

            <div>
              <CheckCircle2 size={18} />
              <span>
                Route issues to departments
              </span>
            </div>

            <div>
              <CheckCircle2 size={18} />
              <span>
                Monitor resolution progress
              </span>
            </div>

          </div>
        </div>

        <div className="government-brand-footer">
          <span>
            <LockKeyhole size={13} />
            Secure government access
          </span>

          <span>
            © CivicPort
          </span>
        </div>

      </section>


      {/* LOGIN PANEL */}
      <main className="government-login-panel">

        <Link
          to="/"
          className="government-back"
        >
          <ArrowLeft size={16} />
          Back to CivicPort
        </Link>

        <div className="government-login-card">

          <div className="government-mobile-logo">
            <div className="government-logo">
              <ShieldCheck size={22} />
            </div>

            <strong>
              CIVIC<span>PORT</span>
            </strong>
          </div>

          <div className="government-login-icon">
            <Building2 size={22} />
          </div>

          <div className="government-login-heading">
            <div className="government-login-kicker">
              GOVERNMENT ACCESS
            </div>

            <h2>
              Welcome back
            </h2>

            <p>
              Sign in to access your government workspace.
            </p>

            <div className="government-demo-credentials">
              <h3>Demo Government Access</h3>

              <div>
                <strong>Email:</strong>
                <span>admin@civicport.gov.ng</span>
              </div>

              <div>
                <strong>Password:</strong>
                <span>CivicPort@2026!</span>
              </div>
            </div>

          </div>

          {error && (
            <div className="government-login-error">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="government-login-form"
          >

            <label>
              Official email

              <div className="government-input">
                <Mail size={17} />

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateField}
                  placeholder="name@government.gov.ng"
                  autoComplete="email"
                />
              </div>
            </label>

            <label>
              Password

              <div className="government-input">
                <LockKeyhole size={17} />

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="password"
                  value={form.password}
                  onChange={updateField}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="government-password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>
            </label>

            <div className="government-login-options">

              <label className="government-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) =>
                    setRemember(e.target.checked)
                  }
                />

                <span>
                  Remember me
                </span>
              </label>

              <button
                type="button"
                className="government-forgot"
              >
                Forgot password?
              </button>

            </div>

            <button
              type="submit"
              className="government-signin"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign in to Government Portal"}
            </button>

          </form>

          <div className="government-security-note">
            <ShieldCheck size={17} />

            <div>
              <strong>
                Authorized access only
              </strong>

              <p>
                This portal is restricted to
                authorized government personnel.
                Access activity may be logged for
                security and accountability.
              </p>
            </div>
          </div>

          <div className="government-citizen-link">
            Not a government official?

            <Link to="/">
              Return to Citizen Portal
            </Link>
          </div>

        </div>

      </main>

    </div>
  );
}