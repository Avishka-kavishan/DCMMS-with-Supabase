"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

/**
 * Public registration is disabled for security reasons.
 * Unauthorized visitors are redirected to the login page.
 * Authenticated System Admins are redirected to the secure portal.
 */
export default function PublicRegisterGuard() {
  const router = useRouter();

  useEffect(() => {
    const handleRedirect = async () => {
      const profile = await getCurrentProfile();
      if (profile && profile.role === "system_admin") {
        router.replace("/system-admin/officer-registration");
      } else {
        router.replace("/");
      }
    };
    handleRedirect();
  }, [router]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      fontFamily: "system-ui, sans-serif",
      backgroundColor: "#0f172a",
      color: "#f8fafc",
      textAlign: "center",
      padding: "24px"
    }}>
      <div style={{
        maxWidth: "420px",
        padding: "32px",
        borderRadius: "16px",
        backgroundColor: "rgba(30, 41, 59, 0.8)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)"
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "16px" }}>🔒</div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "8px" }}>
          Access Restricted
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "20px" }}>
          Public user registration is disabled on this government portal. Only authorized System Administrators may provision accounts.
        </p>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "10px 20px",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Return to Login
        </button>
      </div>
    </div>
  );
}
