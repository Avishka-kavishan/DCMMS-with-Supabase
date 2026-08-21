"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getCurrentProfile, signOut } from "@/lib/auth";
import { checkSessionStatus, logLogout, logLogin } from "@/lib/security";
import { recordSessionLoginServer } from "@/lib/db-actions";

export function SessionMonitor() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If we're on login page or register page, do not monitor
    if (pathname === "/" || pathname === "/register") return;

    // Initialize last activity if not present
    if (typeof window !== "undefined" && !localStorage.getItem("dcmms_last_activity")) {
      localStorage.setItem("dcmms_last_activity", Date.now().toString());
    }

    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart", "click"];
    let lastSavedTime = Date.now();

    const updateActivity = () => {
      const now = Date.now();
      // Throttle localStorage updates to once every 5 seconds to reduce writes
      if (now - lastSavedTime > 5000) {
        if (typeof window !== "undefined") {
          localStorage.setItem("dcmms_last_activity", now.toString());
        }
        lastSavedTime = now;
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, updateActivity);
    });

    let hasCheckedInitialSession = false;

    const checkStatus = async () => {
      const profile = await getCurrentProfile();
      if (profile?.id) {
        // Auto-save active session to database on first check
        if (!hasCheckedInitialSession && typeof window !== "undefined") {
          hasCheckedInitialSession = true;
          let currentSessionId = localStorage.getItem("dcmms_current_session_id");
          if (!currentSessionId) {
            currentSessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
            localStorage.setItem("dcmms_current_session_id", currentSessionId);
          }
          await recordSessionLoginServer({
            id: currentSessionId,
            user_id: profile.id,
            username: profile.full_name,
            email: profile.email || `${profile.id}@moe.gov.lk`,
            login_time: new Date().toISOString(),
          });
        }

        // 1. Check if session was forced logout by admin
        const isForced = await checkSessionStatus(profile.id);
        if (isForced) {
          await signOut();
          if (typeof window !== "undefined") {
            localStorage.removeItem("dcmms_current_session_id");
            localStorage.removeItem("dcmms_last_activity");
            alert("Security Alert: Your session has been terminated by a system administrator.");
          }
          router.replace("/?reason=forced_logout");
          return;
        }

        // 2. Check for inactivity timeout (10 minutes)
        if (typeof window !== "undefined") {
          const lastActivity = localStorage.getItem("dcmms_last_activity");
          if (lastActivity) {
            const timeDiff = Date.now() - parseInt(lastActivity, 10);
            const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
            if (timeDiff > tenMinutes) {
              // Log the user out cleanly (ends session in security logs)
              await logLogout(profile.id);
              await signOut();
              localStorage.removeItem("dcmms_current_session_id");
              localStorage.removeItem("dcmms_last_activity");
              router.replace("/?reason=inactivity_timeout");
              return;
            }
          }
        }
      }
    };

    // Run initially
    checkStatus();

    // Poll every 5 seconds
    const interval = setInterval(checkStatus, 5000);

    return () => {
      clearInterval(interval);
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [pathname, router]);

  return null;
}
