"use client";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import "../admin.css";
import { UserPlus, X, ToggleLeft, ToggleRight, Check, ShieldCheck, Lock, Shield, Mail, Hash, User, AlertCircle, RefreshCw, ChevronDown } from "lucide-react";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { 
  getRegisterOfficersServer, 
  saveRegisterOfficerServer, 
  toggleRegisterOfficerStatusServer 
} from "@/lib/db-actions";
import { exportToExcel } from "@/lib/export-excel";
import { getCurrentProfile } from "@/lib/auth";

interface ChiefClerkOfficer {
  id: string;
  employeeNo: string;
  fullName: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  createdAt: string;
  createdByName?: string;
}

export default function ChiefClerksPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [searchQuery, setSearchQuery] = useState("");
  const [officers, setOfficers] = useState<ChiefClerkOfficer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formEmployeeNo, setFormEmployeeNo] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("123456");
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");
  const [formBranchType, setFormBranchType] = useState<"discipline" | "investigation">("discipline");
  const [branchFilter, setBranchFilter] = useState<"all" | "discipline" | "investigation">("all");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Helper to determine officer branch from role string
  const getOfficerBranch = (role: string): "discipline" | "investigation" => {
    const lower = (role || "").toLowerCase();
    if (lower.includes("investigation") || lower.includes("විමර්ශන") || lower.includes("inv")) {
      return "investigation";
    }
    return "discipline";
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // ── Fetch Chief Clerks from register_officer_table ─────────────────────────
  const fetchOfficers = async () => {
    setIsLoading(true);
    let result: ChiefClerkOfficer[] = [];

    // 1. Primary: Server Action querying register_officer_table
    try {
      const res = await getRegisterOfficersServer("chief");
      if (res.success && res.data && res.data.length > 0) {
        result = res.data.map((p: any) => ({
          id: p.id,
          employeeNo: p.employee_no || "",
          fullName: p.full_name || "",
          email: p.email || "",
          role: p.role || "Chief Clerk (ශාඛා ප්‍රධානී)",
          status: p.is_active === false ? "Inactive" : "Active",
          createdAt: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
          createdByName: p.created_by_name || "Discipline Branch Admin",
        }));
      }
    } catch (err) {
      console.error("Failed to load chief clerks via server action:", err);
    }

    // 2. Supabase fallback querying register_officer_table
    if (result.length === 0 && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("register_officer_table")
          .select("*")
          .or("role.eq.Chief Clerk,role.eq.chief_clerk,role.ilike.%chief%,role.ilike.%clerk%,role.ilike.%ශාඛා ප්‍රධානී%")
          .order("created_at", { ascending: false });

        if (!error && data) {
          result = data.map((p: any) => ({
            id: p.id,
            employeeNo: p.employee_no || "",
            fullName: p.full_name || "",
            email: p.email || "",
            role: p.role || "Chief Clerk (ශාඛා ප්‍රධානී)",
            status: p.is_active === false ? "Inactive" : "Active",
            createdAt: (p.created_at || "").slice(0, 10),
            createdByName: "Discipline Branch Admin",
          }));
        }
      } catch (err) {
        console.error("Failed to load chief clerks from Supabase:", err);
      }
    }

    // 3. Fallback: Merge custom local profiles if any
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          const list = JSON.parse(stored) as ChiefClerkOfficer[];
          const localChiefs = list.filter((o) => 
            (o.role || "").toLowerCase().includes("chief") || 
            (o.role || "").toLowerCase().includes("clerk") || 
            (o.role || "").includes("ශාඛා ප්‍රධානී")
          );
          if (localChiefs.length > 0) {
            const map = new Map<string, ChiefClerkOfficer>();
            result.forEach((o) => map.set(o.employeeNo || o.email, o));
            localChiefs.forEach((o) => {
              const key = o.employeeNo || o.email;
              if (!map.has(key)) map.set(key, o);
            });
            result = Array.from(map.values());
          }
        } catch (e) {
          console.error("Error reading local profiles:", e);
        }
      }
    }

    setOfficers(result);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOfficers();

    // Setup real-time Supabase listener
    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel("chief_clerks_live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "register_officer_table" },
          () => {
            fetchOfficers();
          }
        )
        .subscribe();
    }

    // Local storage event listener
    const handleLocalUpdate = () => fetchOfficers();
    window.addEventListener("storage", handleLocalUpdate);
    window.addEventListener("dcmms_data_updated", handleLocalUpdate);

    // Polling fallback
    const interval = setInterval(fetchOfficers, 15000);

    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener("storage", handleLocalUpdate);
      window.removeEventListener("dcmms_data_updated", handleLocalUpdate);
      clearInterval(interval);
    };
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formEmployeeNo.trim()) newErrors.employeeNo = "Employee Number / Staff ID is required.";
    if (!formName.trim()) newErrors.name = t("pleaseFillAllFields", "Please fill out all fields.");
    if (!formEmail.trim()) {
      newErrors.email = t("pleaseFillAllFields", "Please fill out all fields.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openAddModal = (defaultBranch: "discipline" | "investigation" = "discipline") => {
    setFormBranchType(defaultBranch);
    const prefix = defaultBranch === "investigation" ? "CC-INV" : "CC-DISC";
    setFormEmployeeNo(`${prefix}-${Date.now().toString().slice(-4)}`);
    setFormName("");
    setFormEmail("");
    setFormPassword("123456");
    setFormStatus("Active");
    setErrors({});
    setIsModalOpen(true);
  };

  const handleBranchChange = (branch: "discipline" | "investigation") => {
    setFormBranchType(branch);
    // If employee number is default generated or empty, update prefix
    if (!formEmployeeNo || formEmployeeNo.startsWith("CC-")) {
      const prefix = branch === "investigation" ? "CC-INV" : "CC-DISC";
      const numPart = formEmployeeNo.split("-").pop() || Date.now().toString().slice(-4);
      setFormEmployeeNo(`${prefix}-${numPart}`);
    }
  };

  // ── Save (Add) to register_officer_table ───────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSaving(true);

    const currentAdmin = await getCurrentProfile();

    const roleLabel = formBranchType === "investigation"
      ? "Chief Clerk - Investigation Branch (ශාඛා ප්‍රධානී - විමර්ශන අංශය)"
      : "Chief Clerk - Discipline Branch (ශාඛා ප්‍රධානී - විනය අංශය)";

    const defaultPrefix = formBranchType === "investigation" ? "CC-INV" : "CC-DISC";
    const payload = {
      employee_no: formEmployeeNo.trim() || `${defaultPrefix}-${Date.now().toString().slice(-4)}`,
      full_name: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      role: roleLabel,
      is_active: formStatus === "Active",
      password: formPassword.trim() || "123456",
      created_by: currentAdmin?.id || undefined,
    };

    let saveSuccess = false;
    let errorMsg = "";

    // 1. Save via Server Action to PostgreSQL register_officer_table
    try {
      const res = await saveRegisterOfficerServer(payload);
      if (res.success) {
        saveSuccess = true;
        await logAuditEvent(
          "REGISTER_CHIEF_CLERK",
          "register_officer_table",
          res.data?.id || "new",
          { name: payload.full_name, email: payload.email, employee_no: payload.employee_no, role: payload.role }
        );
      } else {
        errorMsg = res.error || "Failed to save Chief Clerk in PostgreSQL";
      }
    } catch (err: any) {
      console.error("Error saving chief clerk via server action:", err);
      errorMsg = err?.message || "Server error";
    }

    // 2. Dual write via Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const supaPayload: any = {
          employee_no: payload.employee_no,
          full_name: payload.full_name,
          email: payload.email,
          role: roleLabel,
          is_active: payload.is_active,
          password: payload.password,
        };
        const { error } = await supabase.from("register_officer_table").upsert(supaPayload);
        if (!error) saveSuccess = true;
      } catch (e) {
        console.error("Supabase upsert failed:", e);
      }
    }

    // 3. Fallback: Save locally if DB operations failed
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      let list: any[] = [];
      try { list = stored ? JSON.parse(stored) : []; } catch { list = []; }
      const newObj = {
        id: `cc-${Date.now()}`,
        employeeNo: payload.employee_no,
        fullName: payload.full_name,
        email: payload.email,
        role: roleLabel,
        status: formStatus,
        createdAt: new Date().toISOString().slice(0, 10),
        createdByName: currentAdmin?.full_name || "Discipline Branch Admin",
      };
      list = list.filter((o: any) => o.employeeNo !== newObj.employeeNo && o.email !== newObj.email);
      list.push(newObj);
      localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
      saveSuccess = true;
    }

    setIsSaving(false);

    if (saveSuccess) {
      showToast(t("chiefClerkAddedSuccess", "Chief Clerk registered successfully!"));
      setIsModalOpen(false);
      fetchOfficers();
    } else {
      showToast(`Error: ${errorMsg || "Failed to save Chief Clerk"}`);
    }
  };

  // ── Toggle Status ──────────────────────────────────────────────────────────
  const handleToggleStatus = async (officer: ChiefClerkOfficer) => {
    const newActive = officer.status !== "Active";
    const newStatusStr = newActive ? "Active" : "Inactive";

    try {
      await toggleRegisterOfficerStatusServer(officer.id, newActive);
    } catch (e) {}

    if (isSupabaseConfigured) {
      try {
        if (!officer.id.startsWith("cc-")) {
          await supabase
            .from("register_officer_table")
            .update({ is_active: newActive })
            .eq("id", officer.id);
        }
        if (officer.employeeNo) {
          await supabase
            .from("register_officer_table")
            .update({ is_active: newActive })
            .eq("employee_no", officer.employeeNo);
        }
      } catch (e) {}
    }

    // Update in localStorage as well
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          let list = JSON.parse(stored) as any[];
          list = list.map((o) => {
            if (
              o.id === officer.id ||
              (officer.employeeNo && o.employeeNo === officer.employeeNo) ||
              (officer.email && o.email?.toLowerCase() === officer.email?.toLowerCase())
            ) {
              return { ...o, status: newStatusStr };
            }
            return o;
          });
          localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
        } catch (e) {}
      }
      window.dispatchEvent(new Event("dcmms_data_updated"));
    }

    showToast(`Status of ${officer.fullName} updated to ${newStatusStr}.`);
    fetchOfficers();
  };

  const filteredOfficers = officers.filter((o) => {
    const matchesSearch =
      o.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.employeeNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.role.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (branchFilter === "discipline") {
      return getOfficerBranch(o.role) === "discipline";
    }
    if (branchFilter === "investigation") {
      return getOfficerBranch(o.role) === "investigation";
    }
    return true;
  });

  const disciplineCount = officers.filter((o) => getOfficerBranch(o.role) === "discipline").length;
  const investigationCount = officers.filter((o) => getOfficerBranch(o.role) === "investigation").length;

  return (
    <div className="admin-dashboard-container">
      {/* ── Admin Exclusive Security Notice Banner ── */}
      <div style={{
        background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
        border: "1.5px solid #93c5fd",
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        boxShadow: "0 2px 8px rgba(37, 99, 235, 0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            background: "#1d4ed8",
            color: "#ffffff",
            padding: "10px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e3a8a", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{lang === "si" ? "පරිපාලක විශේෂාධිකාරිය (Admin Exclusive Authority)" : "Admin Exclusive: Chief Clerk (ශාඛා ප්‍රධානී) Management"}</span>
              <span style={{
                background: "#2563eb",
                color: "#ffffff",
                fontSize: "0.7rem",
                padding: "2px 8px",
                borderRadius: "12px",
                fontWeight: 600,
                letterSpacing: "0.5px"
              }}>
                {lang === "si" ? "පරිපාලක පමණි" : "ONLY ADMIN CAN ADD"}
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#3b82f6", lineHeight: 1.4 }}>
              {t(
                "adminOnlyChiefClerkNotice",
                "Only Discipline Branch Administrators have the security privilege to register, assign, and manage Chief Clerk accounts for both Discipline Branch and Investigation Branch."
              )}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
          <div style={{
            background: "#ffffff",
            border: "1.5px solid #bfdbfe",
            borderRadius: "8px",
            padding: "8px 14px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "0.72rem", color: "#2563eb", fontWeight: 700 }}>
              {lang === "si" ? "විනය අංශය" : "Discipline"}
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1d4ed8" }}>{disciplineCount}</div>
          </div>
          <div style={{
            background: "#ffffff",
            border: "1.5px solid #ddd6fe",
            borderRadius: "8px",
            padding: "8px 14px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "0.72rem", color: "#7c3aed", fontWeight: 700 }}>
              {lang === "si" ? "විමර්ශන" : "Investigation"}
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#6d28d9" }}>{investigationCount}</div>
          </div>
          <div style={{
            background: "#1d4ed8",
            border: "1.5px solid #1e40af",
            borderRadius: "8px",
            padding: "8px 14px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "0.72rem", color: "#dbeafe", fontWeight: 700 }}>
              {lang === "si" ? "මුළු එකතුව" : "Total"}
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff" }}>{officers.length}</div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="admin-action-bar">
        <div className="search-box">
          <svg className="admin-search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={t("searchUserPlaceholder", "Search by name, employee no, role, email…")}
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="btn-export-excel"
            onClick={() => {
              const dataToExport = filteredOfficers.length > 0 ? filteredOfficers : officers;
              const headers = ["Employee No", "Full Name", "Email Address", "Assigned System Role", "Status", "Date Created", "Authorized By"];
              const rows = dataToExport.map((o) => [
                o.employeeNo || "",
                o.fullName,
                o.email,
                getOfficerBranch(o.role) === "investigation"
                  ? "Chief Clerk - Investigation Branch (ශාඛා ප්‍රධානී - විමර්ශන අංශය)"
                  : "Chief Clerk - Discipline Branch (ශාඛා ප්‍රධානී - විනය අංශය)",
                o.status,
                o.createdAt || "",
                o.createdByName || "Discipline Branch Admin"
              ]);
              exportToExcel(`DCMMS_Chief_Clerks_${new Date().toISOString().split("T")[0]}`, headers, rows);
            }}
            title="Export Chief Clerks to Excel"
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{t("exportExcel", "Export to Excel")}</span>
          </button>
          
          <button className="btn-admin-add" onClick={() => openAddModal("discipline")} style={{ background: "#1d4ed8" }}>
            <UserPlus size={18} />
            <span>{t("addChiefClerk", "Add Chief Clerk (ශාඛා ප්‍රධානී)")}</span>
          </button>
        </div>
      </div>

      {/* ── Branch Filter Tabs ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#64748b", marginRight: "4px" }}>
          {lang === "si" ? "අංශය අනුව පෙරන්න:" : "Filter by Branch:"}
        </span>
        <button
          type="button"
          onClick={() => setBranchFilter("all")}
          style={{
            padding: "6px 14px",
            borderRadius: "20px",
            fontSize: "0.82rem",
            fontWeight: 600,
            border: branchFilter === "all" ? "1.5px solid #2563eb" : "1px solid #cbd5e1",
            background: branchFilter === "all" ? "#eff6ff" : "#ffffff",
            color: branchFilter === "all" ? "#1d4ed8" : "#475569",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.15s ease"
          }}
        >
          <span>{lang === "si" ? "සියලු ශාඛා ප්‍රධානීන්" : "All Chief Clerks"}</span>
          <span style={{
            background: branchFilter === "all" ? "#2563eb" : "#e2e8f0",
            color: branchFilter === "all" ? "#ffffff" : "#475569",
            fontSize: "0.72rem",
            padding: "1px 6px",
            borderRadius: "10px"
          }}>
            {officers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setBranchFilter("discipline")}
          style={{
            padding: "6px 14px",
            borderRadius: "20px",
            fontSize: "0.82rem",
            fontWeight: 600,
            border: branchFilter === "discipline" ? "1.5px solid #2563eb" : "1px solid #cbd5e1",
            background: branchFilter === "discipline" ? "#eff6ff" : "#ffffff",
            color: branchFilter === "discipline" ? "#1d4ed8" : "#475569",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.15s ease"
          }}
        >
          <Shield size={14} color="#2563eb" />
          <span>{lang === "si" ? "විනය අංශය (Discipline Branch)" : "Discipline Branch"}</span>
          <span style={{
            background: branchFilter === "discipline" ? "#2563eb" : "#e2e8f0",
            color: branchFilter === "discipline" ? "#ffffff" : "#475569",
            fontSize: "0.72rem",
            padding: "1px 6px",
            borderRadius: "10px"
          }}>
            {disciplineCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setBranchFilter("investigation")}
          style={{
            padding: "6px 14px",
            borderRadius: "20px",
            fontSize: "0.82rem",
            fontWeight: 600,
            border: branchFilter === "investigation" ? "1.5px solid #7c3aed" : "1px solid #cbd5e1",
            background: branchFilter === "investigation" ? "#f5f3ff" : "#ffffff",
            color: branchFilter === "investigation" ? "#6d28d9" : "#475569",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.15s ease"
          }}
        >
          <ShieldCheck size={14} color="#7c3aed" />
          <span>{lang === "si" ? "විමර්ශන අංශය (Investigation Branch)" : "Investigation Branch"}</span>
          <span style={{
            background: branchFilter === "investigation" ? "#7c3aed" : "#e2e8f0",
            color: branchFilter === "investigation" ? "#ffffff" : "#475569",
            fontSize: "0.72rem",
            padding: "1px 6px",
            borderRadius: "10px"
          }}>
            {investigationCount}
          </span>
        </button>
      </div>

      {/* Chief Clerks Table */}
      <section className="letters-list-section">
        <div className="table-responsive-container">
          <table className="letters-data-table">
            <thead>
              <tr>
                <th scope="col">Staff / Employee ID</th>
                <th scope="col">{t("officerFullName", "Officer Full Name")}</th>
                <th scope="col">{t("emailAddress", "E-mail Address")}</th>
                <th scope="col">{t("assignedSystemRole", "Assigned System Role")}</th>
                <th scope="col">{lang === "si" ? "ලියාපදිංචි කළේ" : "Registered By"}</th>
                <th scope="col">{t("accountStatus", "Account Status")}</th>
                <th scope="col" className="admin-table-header-center">{t("actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="admin-table-no-data table-no-data-padding">
                    {t("loadingData", "Loading chief clerks from database…")}
                  </td>
                </tr>
              ) : filteredOfficers.length > 0 ? (
                filteredOfficers.map((item) => {
                  const isInv = getOfficerBranch(item.role) === "investigation";
                  return (
                    <tr key={item.id} className="letter-table-row">
                      <td className="font-mono text-sm" style={{ fontWeight: 600, color: isInv ? "#6d28d9" : "#1e40af" }}>
                        {item.employeeNo || "—"}
                      </td>
                      <td className="admin-table-case-no font-semibold">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            background: isInv ? "#ede9fe" : "#dbeafe",
                            color: isInv ? "#6d28d9" : "#1d4ed8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "0.8rem"
                          }}>
                            {item.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{item.fullName}</div>
                            <div style={{ fontSize: "0.75rem", color: isInv ? "#7c3aed" : "#64748b", fontWeight: 500 }}>
                              {isInv
                                ? (lang === "si" ? "ශාඛා ප්‍රධානී (විමර්ශන අංශය)" : "Chief Clerk (Investigation Branch)")
                                : (lang === "si" ? "ශාඛා ප්‍රධානී (විනය අංශය)" : "Chief Clerk (Discipline Branch)")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{item.email || "—"}</td>
                      <td>
                        {isInv ? (
                          <span style={{
                            background: "#f5f3ff",
                            color: "#6d28d9",
                            border: "1px solid #ddd6fe",
                            padding: "4px 10px",
                            borderRadius: "14px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px"
                          }}>
                            <ShieldCheck size={13} />
                            {lang === "si" ? "ශාඛා ප්‍රධානී (විමර්ශන)" : "Chief Clerk (Investigation)"}
                          </span>
                        ) : (
                          <span style={{
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            border: "1px solid #bfdbfe",
                            padding: "4px 10px",
                            borderRadius: "14px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px"
                          }}>
                            <Shield size={13} />
                            {lang === "si" ? "ශාඛා ප්‍රධානී (විනය)" : "Chief Clerk (Discipline)"}
                          </span>
                        )}
                      </td>
                    <td style={{ fontSize: "0.82rem", color: "#475569" }}>
                      {item.createdByName || "Discipline Branch Admin"}
                    </td>
                    <td>
                      <span className={item.status === "Active" ? "status-badge-active" : "status-badge-inactive"}>
                        {item.status === "Active" ? t("active", "Active") : t("inactive", "Inactive")}
                      </span>
                    </td>
                    <td className="admin-table-cell-center">
                      <button
                        type="button"
                        className={`btn-status-toggle ${item.status === "Active" ? "is-active" : "is-inactive"}`}
                        onClick={() => handleToggleStatus(item)}
                        title={item.status === "Active" ? t("clickToDeactivate", "Click to Deactivate") : t("clickToActivate", "Click to Activate")}
                      >
                        {item.status === "Active" ? (
                          <>
                            <ToggleRight size={18} className="status-toggle-icon" />
                            <span>{t("active", "Active")}</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={18} className="status-toggle-icon" />
                            <span>{t("inactive", "Inactive")}</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
              ) : (
                <tr>
                  <td colSpan={7} className="admin-table-no-data table-no-data-padding">
                    {officers.length === 0
                      ? t("noChiefClerksInDatabase", "No chief clerks found in register_officer_table. Click 'Add Chief Clerk' to register.")
                      : t("noLettersFound", "No entries found matching search.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Add Chief Clerk Modal (Popup Form) ── */}
      {isModalOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "560px", maxHeight: "90vh", overflowY: "auto" }}
          >
            <header className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  background: formBranchType === "investigation" ? "#ede9fe" : "#dbeafe",
                  color: formBranchType === "investigation" ? "#7c3aed" : "#1d4ed8",
                  padding: "9px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <UserPlus size={22} />
                </div>
                <div>
                  <h2 id="modal-title" className="modal-title" style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a" }}>
                    {lang === "si" ? "ශාඛා ප්‍රධානී (Chief Clerk) ලියාපදිංචි කිරීම" : "Register Chief Clerk (ශාඛා ප්‍රධානී)"}
                  </h2>
                  <p className="modal-subtitle" style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                    {lang === "si" ? "පරිපාලක විසින් පමණක් පත්කිරීමට අවසර ඇත" : "Authorized by Discipline Branch Admin only"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ gap: "14px" }}>
                {/* Employee ID */}
                <div className="form-field-group">
                  <label htmlFor="employeeNo" className="field-label">
                    {lang === "si" ? "සේවක අංකය / කාර්ය මණ්ඩල හැඳුනුම් අංකය" : "Staff / Employee ID"} <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <Hash size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      id="employeeNo"
                      type="text"
                      className="field-input"
                      placeholder={formBranchType === "investigation" ? "e.g. CC-INV-001" : "e.g. CC-DISC-001"}
                      style={{ paddingLeft: "36px", width: "100%" }}
                      value={formEmployeeNo}
                      onChange={(e) => setFormEmployeeNo(e.target.value)}
                    />
                  </div>
                  {errors.employeeNo && <span className="field-error-text">{errors.employeeNo}</span>}
                </div>

                {/* Full Name */}
                <div className="form-field-group">
                  <label htmlFor="fullName" className="field-label">
                    {lang === "si" ? "ශාඛා ප්‍රධානීගේ සම්පූර්ණ නම" : "Chief Clerk Full Name"} <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <User size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      id="fullName"
                      type="text"
                      className="field-input"
                      placeholder={lang === "si" ? "උදා: කේ. ඒ. නිමල් පෙරේරා" : "e.g. K. A. Nimal Perera"}
                      style={{ paddingLeft: "36px", width: "100%" }}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>
                  {errors.name && <span className="field-error-text">{errors.name}</span>}
                </div>

                {/* Email Address */}
                <div className="form-field-group">
                  <label htmlFor="emailAddress" className="field-label">
                    {t("emailAddress", "Official E-mail Address")} <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      id="emailAddress"
                      type="email"
                      className="field-input"
                      placeholder={formBranchType === "investigation" ? "e.g. chiefclerk.investigation@moe.gov.lk" : "e.g. chiefclerk.discipline@moe.gov.lk"}
                      style={{ paddingLeft: "36px", width: "100%" }}
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                    />
                  </div>
                  {errors.email && <span className="field-error-text">{errors.email}</span>}
                </div>

                {/* Assigned Role (Select Option: Discipline vs Investigation Branch) */}
                <div className="form-field-group">
                  <label htmlFor="chiefClerkBranchSelect" className="field-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{lang === "si" ? "ශාඛා ප්‍රධානී වර්ගය (Select Chief Clerk Type)" : "Chief Clerk Type / Assigned Branch"} <span style={{ color: "#ef4444" }}>*</span></span>
                    <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 400 }}>
                      {lang === "si" ? "අංශය තෝරන්න (Choose Branch)" : "Select branch to assign"}
                    </span>
                  </label>
                  
                  <div style={{ position: "relative" }}>
                    <Shield 
                      size={18} 
                      style={{ 
                        position: "absolute", 
                        left: "12px", 
                        top: "50%", 
                        transform: "translateY(-50%)", 
                        color: formBranchType === "investigation" ? "#7c3aed" : "#2563eb",
                        pointerEvents: "none"
                      }} 
                    />
                    <select
                      id="chiefClerkBranchSelect"
                      className="field-select"
                      value={formBranchType}
                      onChange={(e) => handleBranchChange(e.target.value as "discipline" | "investigation")}
                      style={{
                        paddingLeft: "38px",
                        paddingRight: "36px",
                        height: "44px",
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        color: formBranchType === "investigation" ? "#5b21b6" : "#1e40af",
                        backgroundColor: formBranchType === "investigation" ? "#fbfbfe" : "#f8faff",
                        border: formBranchType === "investigation" ? "1.5px solid #a78bfa" : "1.5px solid #93c5fd",
                        borderRadius: "8px",
                        cursor: "pointer",
                        width: "100%",
                        outline: "none"
                      }}
                    >
                      <option value="discipline">
                        {lang === "si" ? "1. විනය අංශය - Chief Clerk (Discipline Branch)" : "1. Discipline Branch - Chief Clerk (Discipline)"}
                      </option>
                      <option value="investigation">
                        {lang === "si" ? "2. විමර්ශන අංශය - Chief Clerk (Investigation Branch)" : "2. Investigation Branch - Chief Clerk (Investigation)"}
                      </option>
                    </select>
                    <ChevronDown 
                      size={18} 
                      style={{ 
                        position: "absolute", 
                        right: "12px", 
                        top: "50%", 
                        transform: "translateY(-50%)", 
                        color: "#64748b",
                        pointerEvents: "none"
                      }} 
                    />
                  </div>

                  {/* Branch Info Badge */}
                  <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{
                      fontSize: "0.74rem",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      background: formBranchType === "investigation" ? "#ede9fe" : "#dbeafe",
                      color: formBranchType === "investigation" ? "#6d28d9" : "#1e40af",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px"
                    }}>
                      {formBranchType === "investigation" ? (
                        <>
                          <ShieldCheck size={13} color="#6d28d9" />
                          {lang === "si" ? "විමර්ශන ලිපි හා පැමිණිලි පසු විපරම් (Inquiries & Investigations)" : "Inquiries & Investigations Management"}
                        </>
                      ) : (
                        <>
                          <Shield size={13} color="#1e40af" />
                          {lang === "si" ? "විනය ලිපි හා පසු විපරම් පාලනය (Discipline Letters & Tracking)" : "Discipline Letters & Tracking Management"}
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Temporary Password & Account Status in 2 Columns */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {/* Temporary Password */}
                  <div className="form-field-group">
                    <label htmlFor="tempPassword" className="field-label">
                      {lang === "si" ? "ප්‍රවේශ මුරපදය" : "Initial Password"}
                    </label>
                    <div style={{ position: "relative" }}>
                      <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                      <input
                        id="tempPassword"
                        type="text"
                        className="field-input"
                        style={{ paddingLeft: "36px", fontFamily: "monospace", width: "100%", height: "42px" }}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Account Status Select */}
                  <div className="form-field-group">
                    <label htmlFor="accountStatusSelect" className="field-label">
                      {t("accountStatus", "Account Status")}
                    </label>
                    <div style={{ position: "relative" }}>
                      <select
                        id="accountStatusSelect"
                        className="field-select"
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as "Active" | "Inactive")}
                        style={{
                          height: "42px",
                          paddingRight: "36px",
                          paddingLeft: "14px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          width: "100%",
                          fontWeight: 600,
                          color: formStatus === "Active" ? "#16a34a" : "#dc2626",
                          backgroundColor: formStatus === "Active" ? "#f0fdf4" : "#fef2f2",
                          border: formStatus === "Active" ? "1.5px solid #bbf7d0" : "1.5px solid #fecaca"
                        }}
                      >
                        <option value="Active">{t("active", "Active")} (ක්‍රියාකාරී)</option>
                        <option value="Inactive">{t("inactive", "Inactive")} (අක්‍රිය)</option>
                      </select>
                      <ChevronDown 
                        size={18} 
                        style={{ 
                          position: "absolute", 
                          right: "12px", 
                          top: "50%", 
                          transform: "translateY(-50%)", 
                          color: "#64748b",
                          pointerEvents: "none"
                        }} 
                      />
                    </div>
                  </div>
                </div>

                <span style={{ fontSize: "0.74rem", color: "#64748b", display: "block", marginTop: "-6px" }}>
                  {lang === "si" ? "පළමු පිවිසුමෙන් පසු නිලධාරියාට මුරපදය වෙනස් කළ හැක." : "Officer can change password upon initial login."}
                </span>
              </div>

              {/* Modal Footer / Actions */}
              <footer className="modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  {t("cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  className="btn-modal-save"
                  disabled={isSaving}
                  style={{
                    backgroundColor: formBranchType === "investigation" ? "#7c3aed" : "#2563eb",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>{t("saving", "Saving…")}</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{t("saveOfficer", "Save Chief Clerk")}</span>
                    </>
                  )}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="admin-toast-message">
          <Check size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
