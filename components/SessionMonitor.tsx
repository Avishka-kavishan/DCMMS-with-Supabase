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

    // Ensure activity timestamp is fresh on mount
    if (typeof window !== "undefined") {
      const existingActivity = localStorage.getItem("dcmms_last_activity");
      if (!existingActivity || isNaN(parseInt(existingActivity, 10))) {
        localStorage.setItem("dcmms_last_activity", Date.now().toString());
      }
    }

    const events = ["mousemove", "mousedown", "keypress", "keydown", "scroll", "touchstart", "click", "focus"];
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
          if (typeof window !== "undefined") {
            localStorage.removeItem("dcmms_simulated_session");
            localStorage.removeItem("dcmms_username");
            localStorage.removeItem("dcmms_user_role");
            localStorage.removeItem("dcmms_current_user");
            localStorage.removeItem("dcmms_current_session_id");
            localStorage.removeItem("dcmms_last_activity");
            alert("Security Alert: Your session has been terminated by a system administrator.");
          }
          await signOut();
          router.replace("/?reason=forced_logout");
          return;
        }

        // 2. Check for inactivity timeout (30 minutes)
        if (typeof window !== "undefined") {
          const lastActivity = localStorage.getItem("dcmms_last_activity");
          if (lastActivity) {
            const parsedActivity = parseInt(lastActivity, 10);
            if (!isNaN(parsedActivity)) {
              const timeDiff = Date.now() - parsedActivity;
              const thirtyMinutes = 30 * 60 * 1000;
              if (timeDiff > thirtyMinutes) {
                localStorage.removeItem("dcmms_simulated_session");
                localStorage.removeItem("dcmms_username");
                localStorage.removeItem("dcmms_user_role");
                localStorage.removeItem("dcmms_current_user");
                localStorage.removeItem("dcmms_current_session_id");
                localStorage.removeItem("dcmms_last_activity");
                await logLogout(profile.id);
                await signOut();
                router.replace("/?reason=inactivity_timeout");
                return;
              }
            } else {
              localStorage.setItem("dcmms_last_activity", Date.now().toString());
            }
          } else {
            localStorage.setItem("dcmms_last_activity", Date.now().toString());
          }
        }
      }
    };

    // Poll every 30 seconds for forced logout / inactivity
    const interval = setInterval(checkStatus, 30000);

    return () => {
      clearInterval(interval);
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [pathname, router]);

  return null;
}
