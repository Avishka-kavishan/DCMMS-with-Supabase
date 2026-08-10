"use client";

import "../../i18n";
import "./register.css";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dashboardPath, UserRole, getCurrentProfile } from "@/lib/auth";
import { SiteFooter } from "@/components/SiteFooter";
import { saveRegisterOfficerServer } from "@/lib/db-actions";

export default function RegisterPage() {
  const router = useRouter();

  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Field-level validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "Register | DCMMS";
  }, []);

  // If already logged in, redirect to correct dashboard
  useEffect(() => {
    const checkRedirect = async () => {
      const profile = await getCurrentProfile();
      if (profile?.role) {
        router.replace(dashboardPath(profile.role));
      }
    };
    checkRedirect();
  }, [router]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = "Full name is required.";
    if (!email.trim()) newErrors.email = "Email is required.";
    if (!password) newErrors.password = "Password is required.";
    else if (password.length < 6) newErrors.password = "Password must be at least 6 characters.";
    if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match.";
    if (!role) newErrors.role = "Please select a role.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setIsLoading(true);
    try {
      // Map role to standard DB role label
      const dbRoleMap: Record<string, string> = {
        daily_mail: "Daily mail officer",
        subject_officer: "Subject officer",
        investigation_officer: "Investigation officer",
        admin: "Branch admin",
        system_admin: "System admin",
      };
      const dbRole = dbRoleMap[role] || role;
      const empNo = `200399${Math.floor(100000 + Math.random() * 900000)}`;

      // 1. Primary: Save to PostgreSQL register_officer_table via Server Action
      let pgSuccess = false;
      let pgError = "";
      let createdId = `user-${Date.now()}`;

      try {
        const pgRes = await saveRegisterOfficerServer({
          employee_no: empNo,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password: password,
          role: dbRole,
          is_active: true,
        });

        if (pgRes.success && pgRes.data) {
          pgSuccess = true;
          if (pgRes.data.id) createdId = pgRes.data.id;
        } else {
          pgError = pgRes.error || "Failed to save officer in PostgreSQL";
          console.warn("PostgreSQL save warning:", pgError);
        }
      } catch (err: any) {
        console.error("PostgreSQL saveRegisterOfficerServer error:", err);
        pgError = err?.message || "Server error";
      }

      // 2. Save session locally
      if (typeof window !== "undefined") {
        const newUser = {
          id: createdId,
          employee_no: empNo,
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          fullName: fullName.trim(),
          role,
        };

        const stored = localStorage.getItem("dcmms_custom_profiles");
        let list: any[] = [];
        if (stored) {
          try {
            list = JSON.parse(stored);
          } catch (e) {
            console.error(e);
          }
        }
        list.push(newUser);
        localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));

        // Set local session
        localStorage.setItem("dcmms_simulated_session", JSON.stringify(newUser));
        localStorage.setItem("dcmms_current_session_id", createdId);
      }

      setSuccess(true);
      setTimeout(() => router.replace(dashboardPath(role as UserRole)), 1500);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const roleOptions = [
    { value: "admin", label: "Administrator" },
    { value: "daily_mail", label: "Daily Mail Officer" },
    { value: "subject_officer", label: "Subject Officer" },
    { value: "investigation_officer", label: "Investigation Administrator" },
    { value: "system_admin", label: "System Administrator" },
  ];

  return (
    <div className="register-page" data-font-scale={fontScale}>
      <a href="#register-main" className="skip-link">Skip to main content</a>

      <main id="register-main" className="register-main">
        <div className="register-card">

          {/* Header */}
          <div className="register-card-header">
            <div className="register-logo">
              <div className="register-logo-icon" aria-hidden="true">D</div>
              <span className="register-logo-text">DCMMS</span>
            </div>
            <h1 className="register-card-title">Create Account</h1>
            <p className="register-card-subtitle">
              Register for the Discipline Case Management &amp; Monitoring System
            </p>
          </div>

          {/* Success State */}
          {success ? (
            <div className="register-success-banner" role="alert">
              <strong>✓ Account created successfully!</strong>
              <br />
              {`Redirecting to your dashboard…`}
              <br /><br />
              If not redirected, please check your email to confirm your account,
              then <Link href="/">sign in here</Link>.
            </div>
          ) : (
            <>
              {/* Error Banner */}
              {error && (
                <div className="register-error-banner" role="alert">
                  {error}
                </div>
              )}

              {/* Form */}
              <form className="register-form" onSubmit={handleSubmit} noValidate>

                {/* Full Name */}
                <div className="register-field">
                  <label htmlFor="reg-fullname" className="register-label">
                    Full Name <span className="required-star" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="reg-fullname"
                    type="text"
                    className={`register-input${errors.fullName ? " error" : ""}`}
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    autoComplete="name"
                    required
                    aria-required="true"
                    aria-describedby={errors.fullName ? "err-fullname" : undefined}
                    placeholder="e.g. Kamal Perera"
                  />
                  {errors.fullName && <p id="err-fullname" className="field-error">{errors.fullName}</p>}
                </div>

                {/* Email */}
                <div className="register-field">
                  <label htmlFor="reg-email" className="register-label">
                    Email Address <span className="required-star" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    className={`register-input${errors.email ? " error" : ""}`}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    aria-required="true"
                    aria-describedby={errors.email ? "err-email" : undefined}
                    placeholder="you@moe.gov.lk"
                  />
                  {errors.email && <p id="err-email" className="field-error">{errors.email}</p>}
                </div>

                {/* Password row */}
                <div className="form-row">
                  <div className="register-field">
                    <label htmlFor="reg-password" className="register-label">
                      Password <span className="required-star" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      className={`register-input${errors.password ? " error" : ""}`}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      aria-required="true"
                      aria-describedby={errors.password ? "err-password" : undefined}
                      placeholder="Min. 6 characters"
                    />
                    {errors.password && <p id="err-password" className="field-error">{errors.password}</p>}
                  </div>

                  <div className="register-field">
                    <label htmlFor="reg-confirm" className="register-label">
                      Confirm Password <span className="required-star" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="reg-confirm"
                      type="password"
                      className={`register-input${errors.confirmPassword ? " error" : ""}`}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      aria-required="true"
                      aria-describedby={errors.confirmPassword ? "err-confirm" : undefined}
                      placeholder="Repeat password"
                    />
                    {errors.confirmPassword && <p id="err-confirm" className="field-error">{errors.confirmPassword}</p>}
                  </div>
                </div>

                {/* Role */}
                <div className="register-field">
                  <label htmlFor="reg-role" className="register-label">
                    Role <span className="required-star" aria-hidden="true">*</span>
                  </label>
                  <select
                    id="reg-role"
                    className={`register-select${errors.role ? " error" : ""}`}
                    value={role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    required
                    aria-required="true"
                    aria-describedby={errors.role ? "err-role" : undefined}
                  >
                    <option value="" disabled>— Select your role —</option>
                    {roleOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {errors.role && <p id="err-role" className="field-error">{errors.role}</p>}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="register-submit-btn"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating Account…" : "Create Account"}
                </button>
              </form>
            </>
          )}

          {/* Login link */}
          <p className="register-login-link">
            Already have an account?{" "}
            <Link href="/">Sign in here</Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
