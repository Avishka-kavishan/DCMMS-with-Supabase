"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { checkSessionStatus, logLogout } from "@/lib/security";

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

    const checkStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        // 1. Check if session was forced logout by admin
        const isForced = await checkSessionStatus(session.user.id);
        if (isForced) {
          await supabase.auth.signOut();
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
              await logLogout(session.user.id);
              await supabase.auth.signOut();
              localStorage.removeItem("dcmms_current_session_id");
              localStorage.removeItem("dcmms_last_activity");
              alert("Session Expired: You have been logged out due to inactivity (10 minutes).");
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
