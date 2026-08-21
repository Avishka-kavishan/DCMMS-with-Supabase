"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminOfficerRegistrationPage() {
  const router = useRouter();

  useEffect(() => {
    // Branch Admin only manages Investigation Admin accounts, not Chairman/Members.
    router.replace("/admin/investigation-officers");
  }, [router]);

  return null;
}
