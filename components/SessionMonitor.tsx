"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { checkSessionStatus } from "@/lib/security";

export function SessionMonitor() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If we're on login page or register page, do not monitor
    if (pathname === "/" || pathname === "/register") return;

    const checkStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const isForced = await checkSessionStatus(session.user.id);
        if (isForced) {
          // Log out the user
          await supabase.auth.signOut();
          if (typeof window !== "undefined") {
            localStorage.removeItem("dcmms_current_session_id");
            alert("Security Alert: Your session has been terminated by a system administrator.");
          }
          router.replace("/?reason=forced_logout");
        }
      }
    };

    // Run initially
    checkStatus();

    // Poll every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [pathname, router]);

  return null;
}
