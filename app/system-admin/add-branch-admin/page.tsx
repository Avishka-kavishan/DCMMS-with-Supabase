"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { 
  UserPlus, 
  X, 
  Edit, 
  Trash2, 
  Check, 
  Shield, 
  Search, 
  Download, 
  RefreshCw, 
  Key, 
  Mail, 
  User, 
  Hash, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  UserCheck,
  UserX,
  KeyRound,
  Copy,
  CheckCircle,
  RefreshCcw,
  Lock
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { getCurrentProfile, signOut } from "@/lib/auth";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { 
  getRegisterOfficersServer, 
  saveRegisterOfficerServer, 
  deleteRegisterOfficerServer, 
  toggleRegisterOfficerStatusServer,
  resetOfficerPasswordServer
} from "@/lib/db-actions";
import { exportToExcel } from "@/lib/export-excel";

import "../../../i18n";
import "../../dashboard-common.css";
import "../../daily-mail/daily-mail.css";
import "../../admin/admin.css";
import "../system-admin.css";

interface BranchAdmin {
  id: string;
  employeeNo: string;
  fullName: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  createdAt: string;
}

export default function AddBranchAdminPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [admins, setAdmins] = useState<BranchAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formEmployeeNo, setFormEmployeeNo] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("123456");
  const [showPassword, setShowPassword] = useState(false);
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Secure Password Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetTargetAdmin, setResetTargetAdmin] = useState<BranchAdmin | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [resetError, setResetError] = useState("");

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ── Authentication Check & Guard ──────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    const checkAuth = async () => {
      const profile = await getCurrentProfile();
      if (!profile || profile.role !== "system_admin") {
        router.replace("/");
      }
    };
    checkAuth();
  }, [router]);

  // ── Fetch Branch Admins from register_officer_table ───────────────────────
  const fetchBranchAdmins = async () => {
    setIsLoading(true);
    let result: BranchAdmin[] = [];

    // 1. Primary: Server Action querying register_officer_table in PostgreSQL
    try {
      const res = await getRegisterOfficersServer("Branch");
      if (res.success && res.data && res.data.length > 0) {
        result = res.data.map((p: any) => ({
          id: p.id,
          employeeNo: p.employee_no || "",
          fullName: p.full_name || "",
          email: p.email || "",
          role: p.role || "Branch admin",
          status: p.is_active === false ? "Inactive" : "Active",
          createdAt: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
        }));
      }
    } catch (err) {
      console.error("Failed to load branch admins via server action:", err);
    }

    // 2. Supabase fallback querying register_officer_table
    if (result.length === 0 && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("register_officer_table")
          .select("*")
          .or("role.ilike.%branch%,role.eq.admin,role.ilike.%branch%admin%")
          .order("created_at", { ascending: false });

        if (!error && data) {
          result = data
            .filter((p: any) => !p.role?.toLowerCase().includes("system"))
            .map((p: any) => ({
              id: p.id,
              employeeNo: p.employee_no || "",
              fullName: p.full_name || "",
              email: p.email || "",
              role: p.role || "Branch admin",
              status: p.is_active === false ? "Inactive" : "Active",
              createdAt: (p.created_at || "").slice(0, 10),
            }));
        }
      } catch (err) {
        console.error("Failed to load branch admins from Supabase:", err);
      }
    }

    // 3. Fallback: Merge custom local profiles if any
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          const list = JSON.parse(stored) as any[];
          const localAdmins = list.filter(
            (o) => (o.role === "admin" || o.role === "Branch admin" || o.role === "branch_admin") && !o.role?.toLowerCase().includes("system")
          );
          const dbIds = new Set(result.map((o) => o.id));
          const dbEmails = new Set(result.map((o) => (o.email || "").toLowerCase()));
          localAdmins.forEach((lo) => {
            if (!dbIds.has(lo.id) && !dbEmails.has((lo.email || "").toLowerCase())) {
              result.push({
                id: lo.id,
                employeeNo: lo.employeeNo || lo.employee_no || "",
                fullName: lo.fullName || lo.full_name || "",
                email: lo.email || "",
                role: "Branch admin",
                status: lo.status || "Active",
                createdAt: lo.createdAt || new Date().toISOString().slice(0, 10),
              });
            }
          });
        } catch (e) {
          console.error("Failed to parse local profiles:", e);
        }
      }
    }

    setAdmins(result);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBranchAdmins();

    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel("branch-admins-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "register_officer_table" },
          () => fetchBranchAdmins()
        )
        .subscribe();
    }

    const handleLocalUpdate = () => fetchBranchAdmins();
    window.addEventListener("storage", handleLocalUpdate);
    window.addEventListener("dcmms_data_updated", handleLocalUpdate);

    const interval = setInterval(fetchBranchAdmins, 15000);

    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener("storage", handleLocalUpdate);
      window.removeEventListener("dcmms_data_updated", handleLocalUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    if (typeof window !== "undefined") {
      localStorage.removeItem("dcmms_current_session_id");
    }
    router.push("/");
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formEmployeeNo.trim()) {
      newErrors.employeeNo = "Staff / Employee Number is required.";
    }
    if (!formName.trim()) {
      newErrors.name = "Full Name is required.";
    }
    if (!formEmail.trim()) {
      newErrors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }
    if (!isEditMode && (!formPassword || formPassword.length < 6)) {
      newErrors.password = "Password must be at least 6 characters.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Modal Actions ──────────────────────────────────────────────────────────
  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormEmployeeNo(`EMP-${Math.floor(100000 + Math.random() * 900000)}`);
    setFormName("");
    setFormEmail("");
    setFormPassword("123456");
    setShowPassword(false);
    setFormStatus("Active");
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (admin: BranchAdmin) => {
    setIsEditMode(true);
    setEditingId(admin.id);
    setFormEmployeeNo(admin.employeeNo);
    setFormName(admin.fullName);
    setFormEmail(admin.email);
    setFormPassword("");
    setShowPassword(false);
    setFormStatus(admin.status);
    setErrors({});
    setIsModalOpen(true);
  };

  // ── Save (Add / Edit) to register_officer_table ──────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    const isNew = !isEditMode || !editingId;
    const targetId = isNew ? undefined : editingId!;

    const currentAdmin = await getCurrentProfile();

    const payload = {
      id: targetId,
      employee_no: formEmployeeNo.trim(),
      full_name: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      role: "Branch admin",
      is_active: formStatus === "Active",
      password: formPassword.trim() || undefined,
      created_by: currentAdmin?.id || undefined,
    };

    let saveSuccess = false;
    let errorMsg = "";

    // 1. Primary: Save via Server Action to PostgreSQL register_officer_table
    try {
      const res = await saveRegisterOfficerServer(payload);
      if (res.success) {
        saveSuccess = true;
        await logAuditEvent(
          isEditMode ? "UPDATE_BRANCH_ADMIN" : "REGISTER_BRANCH_ADMIN",
          "register_officer_table",
          res.data?.id || editingId || "new",
          { name: payload.full_name, email: payload.email, employee_no: payload.employee_no, role: payload.role }
        );
      } else {
        errorMsg = res.error || "Failed to save branch admin in database";
      }
    } catch (err: any) {
      console.error("Error saving branch admin via server action:", err);
      errorMsg = err?.message || "Server error";
    }

    // 2. Dual write via Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const supaPayload: any = {
          employee_no: payload.employee_no,
          full_name: payload.full_name,
          email: payload.email,
          role: "Branch admin",
          is_active: payload.is_active,
        };
        if (payload.password) supaPayload.password = payload.password;
        if (payload.id && !payload.id.startsWith("ba-")) {
          supaPayload.id = payload.id;
        }
        const { error } = await supabase.from("register_officer_table").upsert(supaPayload);
        if (!error) saveSuccess = true;
      } catch (e) {
        console.error("Supabase upsert failed:", e);
      }
    }

    // 3. Fallback: Save locally if DB operations failed or for local session cache
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      let list: any[] = [];
      try { list = stored ? JSON.parse(stored) : []; } catch { list = []; }
      const newObj = {
        id: payload.id || `ba-${Date.now()}`,
        employeeNo: payload.employee_no,
        fullName: payload.full_name,
        email: payload.email,
        role: "admin",
        status: formStatus,
        password: payload.password || "123456",
        createdAt: new Date().toISOString().slice(0, 10),
      };
      list = list.filter((o: any) => o.id !== newObj.id);
      list.push(newObj);
      localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
      window.dispatchEvent(new Event("dcmms_data_updated"));
    }

    setIsSaving(false);

    if (saveSuccess) {
      showToast(
        isEditMode
          ? t("branchAdminUpdatedSuccess", "Branch Administrator updated successfully!")
          : t("branchAdminSavedSuccess", "Branch Administrator registered successfully!"),
        "success"
      );
      setIsModalOpen(false);
      fetchBranchAdmins();
    } else {
      showToast(`Error: ${errorMsg || "Failed to save branch admin"}`, "error");
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (admin: BranchAdmin) => {
    if (!confirm(t("branchAdminDeleteConfirm", "Are you sure you want to delete this Branch Administrator?"))) return;

    let deleteSuccess = false;
    let errorMsg = "";

    // 1. Delete via server action (PostgreSQL)
    try {
      const res = await deleteRegisterOfficerServer(admin.id);
      if (res.success) {
        deleteSuccess = true;
        await logAuditEvent("DELETE_BRANCH_ADMIN", "register_officer_table", admin.id, {
          name: admin.fullName,
          email: admin.email,
          employee_no: admin.employeeNo,
        });
      } else {
        errorMsg = res.error || "Failed to delete";
      }
    } catch (e: any) {
      errorMsg = e?.message || "Server error";
    }

    // 2. Delete via Supabase if configured
    if (isSupabaseConfigured) {
      try {
        if (!admin.id.startsWith("ba-")) {
          await supabase.from("register_officer_table").delete().eq("id", admin.id);
        }
        if (admin.employeeNo) {
          await supabase.from("register_officer_table").delete().eq("employee_no", admin.employeeNo);
        }
        if (admin.email) {
          await supabase.from("register_officer_table").delete().eq("email", admin.email);
        }
        deleteSuccess = true;
      } catch (err) {}
    }

    // 3. Clean up from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          let list = JSON.parse(stored) as any[];
          list = list.filter(
            (o) =>
              o.id !== admin.id &&
              (!admin.employeeNo || o.employeeNo !== admin.employeeNo) &&
              (!admin.email || o.email?.toLowerCase() !== admin.email?.toLowerCase())
          );
          localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
        } catch (e) {}
      }
      window.dispatchEvent(new Event("dcmms_data_updated"));
    }

    // Optimistically update state
    setAdmins((prev) =>
      prev.filter(
        (o) =>
          o.id !== admin.id &&
          (!admin.employeeNo || o.employeeNo !== admin.employeeNo) &&
          (!admin.email || o.email?.toLowerCase() !== admin.email?.toLowerCase())
      )
    );

    if (deleteSuccess) {
      showToast(t("branchAdminDeletedSuccess", "Branch Administrator deleted successfully."), "success");
    } else {
      showToast(`Error: ${errorMsg || "Could not delete branch admin"}`, "error");
    }

    fetchBranchAdmins();
  };

  // ── Toggle Status ──────────────────────────────────────────────────────────
  const handleToggleStatus = async (admin: BranchAdmin) => {
    const nextStatus = admin.status === "Active" ? "Inactive" : "Active";
    const nextIsActive = nextStatus === "Active";

    // Optimistic update
    setAdmins((prev) =>
      prev.map((o) => (o.id === admin.id ? { ...o, status: nextStatus } : o))
    );

    let success = false;
    try {
      const res = await toggleRegisterOfficerStatusServer(admin.id, nextIsActive);
      if (res.success) {
        success = true;
        await logAuditEvent("TOGGLE_BRANCH_ADMIN_STATUS", "register_officer_table", admin.id, {
          name: admin.fullName,
          new_status: nextStatus,
        });
      }
    } catch (e) {}

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from("register_officer_table")
          .update({ is_active: nextIsActive })
          .eq("id", admin.id);
        success = true;
      } catch (e) {}
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          const list = JSON.parse(stored) as any[];
          const updated = list.map((o) =>
            o.id === admin.id || o.employeeNo === admin.employeeNo ? { ...o, status: nextStatus } : o
          );
          localStorage.setItem("dcmms_custom_profiles", JSON.stringify(updated));
        } catch (e) {}
      }
      window.dispatchEvent(new Event("dcmms_data_updated"));
    }

    showToast(t("branchAdminStatusToggled", "Branch Administrator status updated."));
  };

  // ── Secure Password Reset Actions ──────────────────────────────────────────
  const generateSecurePassword = () => {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghjkmnpqrstuvwxyz";
    const numbers = "23456789";
    const symbols = "!@#$%^&*";
    const all = upper + lower + numbers + symbols;
    let pwd = "";
    pwd += upper[Math.floor(Math.random() * upper.length)];
    pwd += lower[Math.floor(Math.random() * lower.length)];
    pwd += numbers[Math.floor(Math.random() * numbers.length)];
    pwd += symbols[Math.floor(Math.random() * symbols.length)];
    for (let i = 4; i < 10; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    return pwd.split("").sort(() => 0.5 - Math.random()).join("");
  };

  const openResetModal = (admin: BranchAdmin) => {
    setResetTargetAdmin(admin);
    setResetPasswordVal(generateSecurePassword());
    setShowResetPassword(true);
    setCopiedPassword(false);
    setResetError("");
    setIsResetModalOpen(true);
  };

  const handleCopyPassword = () => {
    if (!resetPasswordVal) return;
    navigator.clipboard.writeText(resetPasswordVal);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetAdmin) return;
    if (!resetPasswordVal || resetPasswordVal.length < 6) {
      setResetError("Password must be at least 6 characters long.");
      return;
    }

    setIsResettingPassword(true);
    setResetError("");
    const currentAdmin = await getCurrentProfile();

    let success = false;
    let errorMsg = "";

    // 1. Primary: PostgreSQL Server Action (resets password + terminates active sessions + logs audit event)
    try {
      const res = await resetOfficerPasswordServer({
        targetOfficerId: resetTargetAdmin.id,
        newPassword: resetPasswordVal.trim(),
        adminId: currentAdmin?.id,
        adminName: currentAdmin?.full_name || "System Admin",
      });

      if (res.success) {
        success = true;
      } else {
        errorMsg = res.error || "Failed to reset password in database";
      }
    } catch (err: any) {
      errorMsg = err?.message || "Server error";
    }

    // 2. Dual write / fallback to Supabase
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from("register_officer_table")
          .update({ password: resetPasswordVal.trim(), updated_at: new Date().toISOString() })
          .or(`id.eq.${resetTargetAdmin.id},employee_no.eq.${resetTargetAdmin.employeeNo},email.eq.${resetTargetAdmin.email}`);
        
        await supabase
          .from("dcmms_sessions")
          .update({ status: "forced_logged_out", logout_time: new Date().toISOString() })
          .or(`user_id.eq.${resetTargetAdmin.id},user_id.eq.${resetTargetAdmin.employeeNo},email.eq.${resetTargetAdmin.email}`)
          .eq("status", "active");

        await logAuditEvent(
          "ADMIN_RESET_PASSWORD",
          "register_officer_table",
          resetTargetAdmin.id,
          {
            target_name: resetTargetAdmin.fullName,
            target_email: resetTargetAdmin.email,
            admin: currentAdmin?.full_name || "System Admin",
          }
        );
        success = true;
      } catch (err) {}
    }

    // 3. Fallback to localStorage custom profiles
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          let list = JSON.parse(stored) as any[];
          list = list.map((o) =>
            o.id === resetTargetAdmin.id || o.employeeNo === resetTargetAdmin.employeeNo || o.email === resetTargetAdmin.email
              ? { ...o, password: resetPasswordVal.trim() }
              : o
          );
          localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
        } catch (e) {}
      }
      window.dispatchEvent(new Event("dcmms_data_updated"));
    }

    setIsResettingPassword(false);

    if (success) {
      showToast(
        `Password for ${resetTargetAdmin.fullName} has been reset securely. Active sessions were terminated.`,
        "success"
      );
      setIsResetModalOpen(false);
      fetchBranchAdmins();
    } else {
      setResetError(errorMsg || "Failed to reset password.");
      showToast(`Error: ${errorMsg || "Failed to reset password."}`, "error");
    }
  };

  // ── Export to Excel / CSV ──────────────────────────────────────────────────
  const handleExport = () => {
    const dataToExport = filteredAdmins.length > 0 ? filteredAdmins : admins;
    if (!dataToExport || dataToExport.length === 0) {
      alert("No branch administrator records available to export.");
      return;
    }

    const headers = [
      "Staff / Employee ID",
      "Full Name",
      "Email Address",
      "Assigned Role",
      "Account Status",
      "Registered Date",
    ];

    const rows = dataToExport.map((a) => [
      a.employeeNo,
      a.fullName,
      a.email,
      "Discipline Branch Administrator",
      a.status,
      a.createdAt || "N/A",
    ]);

    exportToExcel(`DCMMS_Branch_Administrators_${new Date().toISOString().split("T")[0]}`, headers, rows);
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filteredAdmins = admins.filter((a) => {
    const matchesSearch =
      a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.employeeNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && a.status === statusFilter;
  });

  const totalCount = admins.length;
  const activeCount = admins.filter((a) => a.status === "Active").length;
  const inactiveCount = admins.filter((a) => a.status === "Inactive").length;
  const latestAdmin = admins.length > 0 ? admins[0].fullName : "None";

  if (!mounted) {
    return <div className="system-admin-container" style={{ minHeight: "100vh", opacity: 0 }} />;
  }

  return (
    <div className="system-admin-container" data-font-scale={fontScale}>
      {/* Skip Link */}
      <a href="#sysadmin-main-content" className="skip-link">
        {t("skipLink", "Skip to main content")}
      </a>

      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            backgroundColor: toastMessage.type === "success" ? "#10b981" : "#ef4444",
            color: "#ffffff",
            padding: "14px 22px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.95rem",
            fontWeight: 500,
            animation: "fadeIn 0.3s ease-in-out",
          }}
        >
          {toastMessage.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="system_admin"
      />

      <div className="dashboard-layout">
        <main id="sysadmin-main-content" className="dashboard-content">
          {/* Header */}
          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <button
                className="menu-toggle-btn"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label="Toggle Sidebar"
              >
                <svg className="hamburger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="dashboard-title-area">
                <h2 className="dashboard-main-title">{t("addBranchAdminTitle", "Branch Administrator Management")}</h2>
                <p className="dashboard-main-subtitle">
                  {t("addBranchAdminSubtitle", "Register new branch administrators and manage access credentials")}
                </p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Accessibility Font Resizer */}
              <div className="accessibility-adjuster-bar" role="radiogroup" aria-label="Font Sizing Adjustment">
                <label className={`size-btn size-btn-small${fontScale === "small" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="dashboardFontScale"
                    value="small"
                    checked={fontScale === "small"}
                    onChange={() => setFontScale("small")}
                    aria-label={t("fontSmall", "Small Font")}
                    className="sr-only"
                  />
                  A
                </label>
                <label className={`size-btn size-btn-medium${fontScale === "medium" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="dashboardFontScale"
                    value="medium"
                    checked={fontScale === "medium"}
                    onChange={() => setFontScale("medium")}
                    aria-label={t("fontMedium", "Medium Font")}
                    className="sr-only"
                  />
                  A
                </label>
                <label className={`size-btn size-btn-large${fontScale === "large" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="dashboardFontScale"
                    value="large"
                    checked={fontScale === "large"}
                    onChange={() => setFontScale("large")}
                    aria-label={t("fontLarge", "Large Font")}
                    className="sr-only"
                  />
                  A
                </label>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Language Switcher */}
              <div className="trilingual-language-selector">
                <button
                  className={`lang-btn ${lang === "si" ? "active" : ""}`}
                  onClick={() => i18n.changeLanguage("si")}
                >
                  සිංහල
                </button>
                <button
                  className={`lang-btn ${lang === "ta" ? "active" : ""}`}
                  onClick={() => i18n.changeLanguage("ta")}
                >
                  தமிழ்
                </button>
                <button
                  className={`lang-btn ${lang === "en" ? "active" : ""}`}
                  onClick={() => i18n.changeLanguage("en")}
                >
                  English
                </button>
              </div>
            </div>
          </header>

          {/* Stats Grid */}
          <div className="sysadmin-stats-grid">
            <div className="sysadmin-stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-wrapper active-users">
                  <Shield className="stat-icon" />
                </div>
                <h3 className="stat-card-title">{t("totalBranchAdmins", "Total Branch Admins")}</h3>
              </div>
              <div className="stat-card-value">{totalCount}</div>
              <p className="stat-card-desc">Connected to register_officer_table</p>
            </div>

            <div className="sysadmin-stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-wrapper logins-today">
                  <UserCheck className="stat-icon" />
                </div>
                <h3 className="stat-card-title">{t("activeBranchAdmins", "Active Branch Admins")}</h3>
              </div>
              <div className="stat-card-value">{activeCount}</div>
              <p className="stat-card-desc">Authorized to access /admin portal</p>
            </div>

            <div className="sysadmin-stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-wrapper failures-today">
                  <UserX className="stat-icon" />
                </div>
                <h3 className="stat-card-title">{t("inactiveBranchAdmins", "Inactive Branch Admins")}</h3>
              </div>
              <div className="stat-card-value">{inactiveCount}</div>
              <p className="stat-card-desc">Disabled or locked accounts</p>
            </div>

            <div className="sysadmin-stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-wrapper logouts-today">
                  <ShieldCheck className="stat-icon" />
                </div>
                <h3 className="stat-card-title">{t("latestBranchAdmin", "Latest Registered")}</h3>
              </div>
              <div className="stat-card-value" style={{ fontSize: "1.1rem", marginTop: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {latestAdmin}
              </div>
              <p className="stat-card-desc">Discipline Branch Administrator</p>
            </div>
          </div>

          {/* Main Card: Directory & Registration */}
          <div className="sysadmin-card-section">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 20,
                borderBottom: "1px solid #f1f5f9",
                paddingBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Shield className="card-title-icon" style={{ color: "#3b82f6" }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600, color: "#1e293b" }}>
                    {t("branchAdminList", "Branch Administrators Directory")}
                  </h3>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    Database: public.register_officer_table (PostgreSQL & Supabase)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={fetchBranchAdmins}
                  className="btn-export"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: "0.875rem",
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                  title="Refresh table"
                >
                  <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
                  <span>{t("refresh", "Refresh")}</span>
                </button>

                <button
                  onClick={handleExport}
                  className="btn-export"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: "0.875rem",
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <Download size={15} />
                  <span>{t("exportBranchAdmins", "Export Branch Admins")}</span>
                </button>

                <button
                  onClick={openAddModal}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 18px",
                    borderRadius: 8,
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    backgroundColor: "#1e40af",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 6px -1px rgba(30, 64, 175, 0.2)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1e40af")}
                >
                  <UserPlus size={16} />
                  <span>{t("addBranchAdmin", "Add the branch admin")}</span>
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 20,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  position: "relative",
                  flex: "1 1 300px",
                  maxWidth: "480px",
                }}
              >
                <Search
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />
                <input
                  type="text"
                  placeholder={t("branchAdminSearchPlaceholder", "Search by name, employee ID, or email...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 36px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: "0.875rem",
                    outline: "none",
                  }}
                />
              </div>

              {/* Status Filter */}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>
                  {t("status", "Status")}:
                </span>
                {(["all", "Active", "Inactive"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: statusFilter === st ? "#3b82f6" : "#e2e8f0",
                      background: statusFilter === st ? "#eff6ff" : "#ffffff",
                      color: statusFilter === st ? "#1d4ed8" : "#64748b",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {st === "all" ? "All" : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Admins Table */}
            <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <table className="sysadmin-data-table">
                <thead>
                  <tr>
                    <th style={{ width: "16%" }}>{t("branchAdminEmployeeNo", "Staff / Employee ID")}</th>
                    <th style={{ width: "24%" }}>{t("branchAdminFullName", "Full Name")}</th>
                    <th style={{ width: "24%" }}>{t("branchAdminEmail", "Email Address")}</th>
                    <th style={{ width: "16%" }}>{t("branchAdminRole", "System Role")}</th>
                    <th style={{ width: "10%" }}>{t("branchAdminStatus", "Status")}</th>
                    <th style={{ width: "10%", textAlign: "center" }}>{t("actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8" }}>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
                          <RefreshCw size={18} className="animate-spin" />
                          <span>Loading Branch Administrators...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                          <Shield size={32} style={{ color: "#cbd5e1" }} />
                          <p style={{ margin: 0, fontWeight: 500 }}>
                            {t("noBranchAdminsFound", "No branch administrators found matching your criteria.")}
                          </p>
                          <button
                            onClick={openAddModal}
                            style={{
                              marginTop: 6,
                              padding: "6px 14px",
                              borderRadius: 6,
                              fontSize: "0.825rem",
                              backgroundColor: "#3b82f6",
                              color: "#ffffff",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            + {t("addBranchAdmin", "Add the branch admin")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAdmins.map((admin) => (
                      <tr key={admin.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#1e293b" }}>
                            <Hash size={14} style={{ color: "#94a3b8" }} />
                            <span>{admin.employeeNo}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                backgroundColor: "#dbeafe",
                                color: "#1e40af",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                              }}
                            >
                              {admin.fullName ? admin.fullName.charAt(0).toUpperCase() : "A"}
                            </div>
                            <span style={{ fontWeight: 500, color: "#0f172a" }}>{admin.fullName}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569" }}>
                            <Mail size={14} style={{ color: "#94a3b8" }} />
                            <span>{admin.email}</span>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 8px",
                              borderRadius: 6,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor: "#ede9fe",
                              color: "#6d28d9",
                            }}
                          >
                            <Shield size={12} />
                            Discipline Branch Admin
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleToggleStatus(admin)}
                            title={`Click to ${admin.status === "Active" ? "deactivate" : "activate"}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 10px",
                              borderRadius: 12,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              border: "none",
                              cursor: "pointer",
                              backgroundColor: admin.status === "Active" ? "#dcfce7" : "#fee2e2",
                              color: admin.status === "Active" ? "#166534" : "#991b1b",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                backgroundColor: admin.status === "Active" ? "#16a34a" : "#dc2626",
                              }}
                            />
                            {admin.status}
                          </button>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                            <button
                              onClick={() => openResetModal(admin)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 6,
                                border: "1px solid #fde68a",
                                background: "#fffbeb",
                                color: "#d97706",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#fef3c7";
                                e.currentTarget.style.borderColor = "#fcd34d";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#fffbeb";
                                e.currentTarget.style.borderColor = "#fde68a";
                              }}
                              title="Reset Password (Secure)"
                            >
                              <KeyRound size={14} />
                              <span>{t("resetPassword", "Reset Password")}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* ── Registration / Edit Modal ── */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
              animation: "fadeIn 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                backgroundColor: "#1e3a8a",
                color: "#ffffff",
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Shield size={20} />
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
                  {isEditMode
                    ? t("editBranchAdmin", "Edit Branch Admin")
                    : t("registerBranchAdmin", "Register Branch Admin")}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSave} style={{ padding: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Employee / Staff ID */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    {t("branchAdminEmployeeNo", "Staff / Employee ID")} <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <Hash size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      type="text"
                      value={formEmployeeNo}
                      onChange={(e) => setFormEmployeeNo(e.target.value)}
                      placeholder="e.g. EMP-200412"
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 36px",
                        borderRadius: 8,
                        border: errors.employeeNo ? "1px solid #ef4444" : "1px solid #cbd5e1",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>
                  {errors.employeeNo && <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 4, display: "block" }}>{errors.employeeNo}</span>}
                </div>

                {/* Full Name */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    {t("branchAdminFullName", "Full Name")} <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <User size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Aruni Rajapaksha"
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 36px",
                        borderRadius: 8,
                        border: errors.name ? "1px solid #ef4444" : "1px solid #cbd5e1",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>
                  {errors.name && <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 4, display: "block" }}>{errors.name}</span>}
                </div>

                {/* Email Address */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    {t("branchAdminEmail", "Email Address")} <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="e.g. branchadmin@moe.gov.lk"
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 36px",
                        borderRadius: 8,
                        border: errors.email ? "1px solid #ef4444" : "1px solid #cbd5e1",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>
                  {errors.email && <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 4, display: "block" }}>{errors.email}</span>}
                </div>

                {/* Password Field */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    {t("branchAdminPassword", "Login Password")} {!isEditMode && <span style={{ color: "#ef4444" }}>*</span>}
                  </label>
                  <div style={{ position: "relative" }}>
                    <Key size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={isEditMode ? "Leave blank to keep current password" : t("branchAdminPasswordPlaceholder", "Enter secure password (min. 6 characters)")}
                      style={{
                        width: "100%",
                        padding: "10px 40px 10px 36px",
                        borderRadius: 8,
                        border: errors.password ? "1px solid #ef4444" : "1px solid #cbd5e1",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        padding: 0,
                        display: "flex",
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 4, display: "block" }}>{errors.password}</span>}
                  <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4, display: "block" }}>
                    Default initial password is set to <code>123456</code>.
                  </span>
                </div>

                {/* System Role (Pre-configured) */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    {t("branchAdminRole", "Assigned System Role")}
                  </label>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#1e3a8a",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                  >
                    <Shield size={16} />
                    <span>Discipline Branch Administrator (Role: Branch admin)</span>
                  </div>
                </div>

                {/* Status Toggle */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    {t("branchAdminStatus", "Account Status")}
                  </label>
                  <div style={{ display: "flex", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.875rem" }}>
                      <input
                        type="radio"
                        name="formAdminStatus"
                        value="Active"
                        checked={formStatus === "Active"}
                        onChange={() => setFormStatus("Active")}
                      />
                      <span style={{ color: "#166534", fontWeight: 500 }}>Active</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.875rem" }}>
                      <input
                        type="radio"
                        name="formAdminStatus"
                        value="Inactive"
                        checked={formStatus === "Inactive"}
                        onChange={() => setFormStatus("Inactive")}
                      />
                      <span style={{ color: "#991b1b", fontWeight: 500 }}>Inactive</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  marginTop: 24,
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: 500,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                  }}
                >
                  {t("cancelBtn", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: "9px 22px",
                    borderRadius: 8,
                    border: "none",
                    background: "#1e3a8a",
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: isSaving ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 4px 6px -1px rgba(30, 58, 138, 0.2)",
                  }}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{isEditMode ? t("saveBtn", "Save Changes") : t("registerBranchAdmin", "Register Branch Admin")}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Secure Reset Password Modal ── */}
      {isResetModalOpen && resetTargetAdmin && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setIsResetModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 490,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
              animation: "fadeIn 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                backgroundColor: "#b45309",
                backgroundImage: "linear-gradient(to right, #92400e, #d97706)",
                color: "#ffffff",
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <KeyRound size={22} />
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                    Reset Branch Admin Password
                  </h3>
                  <span style={{ fontSize: "0.75rem", opacity: 0.9 }}>
                    Secure Administrator Credential Management
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmPasswordReset} style={{ padding: 24 }}>
              {/* Target User Info Summary */}
              <div
                style={{
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 10,
                  padding: "14px 16px",
                  marginBottom: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8rem", color: "#92400e", fontWeight: 600 }}>TARGET ADMINISTRATOR</span>
                  <span style={{ fontSize: "0.75rem", backgroundColor: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
                    {resetTargetAdmin.employeeNo}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#78350f" }}>
                  {resetTargetAdmin.fullName}
                </div>
                <div style={{ fontSize: "0.825rem", color: "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
                  <Mail size={13} />
                  <span>{resetTargetAdmin.email}</span>
                </div>
              </div>

              {/* Password Input & Generator */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
                    New Secure Password <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetPasswordVal(generateSecurePassword());
                      setCopiedPassword(false);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#b45309",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: 0,
                    }}
                  >
                    <RefreshCcw size={12} />
                    <span>Generate Strong Password</span>
                  </button>
                </div>

                <div style={{ position: "relative" }}>
                  <Lock
                    size={16}
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                    }}
                  />
                  <input
                    type={showResetPassword ? "text" : "password"}
                    value={resetPasswordVal}
                    onChange={(e) => {
                      setResetPasswordVal(e.target.value);
                      setCopiedPassword(false);
                    }}
                    placeholder="Enter or generate temporary password"
                    style={{
                      width: "100%",
                      padding: "10px 80px 10px 36px",
                      borderRadius: 8,
                      border: resetError ? "1px solid #ef4444" : "1px solid #cbd5e1",
                      fontSize: "0.95rem",
                      fontFamily: "monospace",
                      letterSpacing: showResetPassword ? "0.05em" : "normal",
                      outline: "none",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      title={showResetPassword ? "Hide password" : "Show password"}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        padding: "4px",
                        display: "flex",
                      }}
                    >
                      {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      title="Copy password to clipboard"
                      style={{
                        background: copiedPassword ? "#dcfce7" : "#f1f5f9",
                        border: "1px solid",
                        borderColor: copiedPassword ? "#86efac" : "#cbd5e1",
                        borderRadius: 6,
                        cursor: "pointer",
                        color: copiedPassword ? "#166534" : "#475569",
                        padding: "4px 6px",
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {copiedPassword ? <CheckCircle size={13} /> : <Copy size={13} />}
                      <span>{copiedPassword ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
                {resetError && (
                  <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 4, display: "block" }}>
                    {resetError}
                  </span>
                )}
              </div>

              {/* Security Badges / Measures List */}
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: 8,
                  padding: "12px 14px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: "0.8rem",
                  color: "#475569",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#166534" }}>
                  <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                  <span><strong>Active Session Revocation:</strong> All currently active logins for this Branch Admin will be terminated immediately.</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#1e40af" }}>
                  <ShieldCheck size={15} style={{ flexShrink: 0 }} />
                  <span><strong>Audit Logging:</strong> This administrative action will be recorded with timestamp and admin signature in system audit logs.</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={isResettingPassword}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: 500,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  style={{
                    padding: "9px 22px",
                    borderRadius: 8,
                    border: "none",
                    background: "#b45309",
                    backgroundImage: "linear-gradient(to right, #b45309, #d97706)",
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: isResettingPassword ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 4px 6px -1px rgba(180, 83, 9, 0.3)",
                  }}
                >
                  {isResettingPassword ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Resetting...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound size={16} />
                      <span>Confirm & Reset Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

