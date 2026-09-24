"use client";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import { UserPlus, X, ToggleLeft, ToggleRight, Check, ShieldCheck, Lock, Shield, Mail, Hash, User, AlertCircle, RefreshCw } from "lucide-react";
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

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
  const openAddModal = () => {
    setFormEmployeeNo(`CC-${Date.now().toString().slice(-4)}`);
    setFormName("");
    setFormEmail("");
    setFormPassword("123456");
    setFormStatus("Active");
    setErrors({});
    setIsModalOpen(true);
  };

  // ── Save (Add) to register_officer_table ───────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSaving(true);

    const currentAdmin = await getCurrentProfile();

    const payload = {
      employee_no: formEmployeeNo.trim() || `CC-${Date.now().toString().slice(-4)}`,
      full_name: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      role: "Chief Clerk (ශාඛා ප්‍රධානී)",
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
          role: "Chief Clerk (ශාඛා ප්‍රධානී)",
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
        role: "Chief Clerk (ශාඛා ප්‍රධානී)",
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

  const filteredOfficers = officers.filter(
    (o) =>
      o.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.employeeNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                "Only Discipline Branch Administrators have the security privilege to register, assign, and manage Chief Clerk (ශාඛා ප්‍රධානී) accounts in the system."
              )}
            </p>
          </div>
        </div>

        <div style={{
          background: "#ffffff",
          border: "1px solid #bfdbfe",
          borderRadius: "8px",
          padding: "8px 16px",
          textAlign: "center",
          flexShrink: 0
        }}>
          <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>{lang === "si" ? "ලියාපදිංචි ප්‍රධානීන්" : "Total Chief Clerks"}</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1d4ed8" }}>{officers.length}</div>
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
              const headers = ["Employee No", "Full Name", "Email Address", "Assigned Role", "Status", "Date Created", "Authorized By"];
              const rows = dataToExport.map((o) => [
                o.employeeNo || "",
                o.fullName,
                o.email,
                "Chief Clerk (ශාඛා ප්‍රධානී)",
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
          
          <button className="btn-admin-add" onClick={openAddModal} style={{ background: "#1d4ed8" }}>
            <UserPlus size={18} />
            <span>{t("addChiefClerk", "Add Chief Clerk (ශාඛා ප්‍රධානී)")}</span>
          </button>
        </div>
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
                filteredOfficers.map((item) => (
                  <tr key={item.id} className="letter-table-row">
                    <td className="font-mono text-sm" style={{ fontWeight: 600, color: "#1e40af" }}>
                      {item.employeeNo || "—"}
                    </td>
                    <td className="admin-table-case-no font-semibold">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          background: "#dbeafe",
                          color: "#1d4ed8",
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
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            {lang === "si" ? "ශාඛා ප්‍රධානී" : "Branch Head Officer"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{item.email || "—"}</td>
                    <td>
                      <span style={{
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        border: "1px solid #bfdbfe",
                        padding: "3px 10px",
                        borderRadius: "14px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px"
                      }}>
                        <Shield size={13} />
                        {lang === "si" ? "ශාඛා ප්‍රධානී (Chief Clerk)" : "Chief Clerk (ශාඛා ප්‍රධානී)"}
                      </span>
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
                ))
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

      {/* ── Add Chief Clerk Modal (Admin Only) ── */}
      {isModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="admin-modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
            <div className="admin-modal-header" style={{ borderBottom: "1.5px solid #e2e8f0", paddingBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  background: "#dbeafe",
                  color: "#1d4ed8",
                  padding: "8px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="admin-modal-title" style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a" }}>
                    {lang === "si" ? "ශාඛා ප්‍රධානී (Chief Clerk) ලියාපදිංචි කිරීම" : "Register Chief Clerk (ශාඛා ප්‍රධානී)"}
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                    {lang === "si" ? "පරිපාලක විසින් පමණක් පත්කිරීමට අවසර ඇත" : "Authorized by Discipline Branch Admin only"}
                  </p>
                </div>
              </div>
              <button type="button" className="btn-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="admin-modal-form" style={{ marginTop: "16px" }}>
              {/* Employee ID */}
              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#334155" }}>
                  {lang === "si" ? "සේවක අංකය / කාර්ය මණ්ඩල හැඳුනුම් අංකය" : "Staff / Employee ID"} <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <Hash size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. CC-001 or EMP-1090"
                    style={{ paddingLeft: "36px" }}
                    value={formEmployeeNo}
                    onChange={(e) => setFormEmployeeNo(e.target.value)}
                  />
                </div>
                {errors.employeeNo && <span className="field-error-msg" style={{ color: "#ef4444", fontSize: "0.78rem" }}>{errors.employeeNo}</span>}
              </div>

              {/* Full Name */}
              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#334155" }}>
                  {lang === "si" ? "ශාඛා ප්‍රධානීගේ සම්පූර්ණ නම" : "Chief Clerk Full Name"} <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <User size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder={lang === "si" ? "උදා: කේ. ඒ. නිමල් පෙරේරා" : "e.g. K. A. Nimal Perera"}
                    style={{ paddingLeft: "36px" }}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                {errors.name && <span className="field-error-msg" style={{ color: "#ef4444", fontSize: "0.78rem" }}>{errors.name}</span>}
              </div>

              {/* Email Address */}
              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#334155" }}>
                  {t("emailAddress", "Official E-mail Address")} <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="e.g. chiefclerk.discipline@moe.gov.lk"
                    style={{ paddingLeft: "36px" }}
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>
                {errors.email && <span className="field-error-msg" style={{ color: "#ef4444", fontSize: "0.78rem" }}>{errors.email}</span>}
              </div>

              {/* Assigned Role (Pre-set to Chief Clerk) */}
              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#334155" }}>
                  {t("assignedSystemRole", "System Role")}
                </label>
                <div style={{
                  padding: "10px 14px",
                  background: "#f1f5f9",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Shield size={16} color="#1d4ed8" />
                    <span style={{ fontWeight: 700, color: "#1e3a8a", fontSize: "0.9rem" }}>
                      Chief Clerk (ශාඛා ප්‍රධානී)
                    </span>
                  </div>
                  <span style={{ fontSize: "0.75rem", background: "#e2e8f0", padding: "2px 8px", borderRadius: "10px", color: "#475569" }}>
                    {lang === "si" ? "විනය ශාඛාව" : "Discipline Branch"}
                  </span>
                </div>
              </div>

              {/* Temporary Password */}
              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#334155" }}>
                  {lang === "si" ? "ප්‍රවේශ මුරපදය (Default Password)" : "Initial Access Password"}
                </label>
                <div style={{ position: "relative" }}>
                  <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: "36px", fontFamily: "monospace" }}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                  />
                </div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px", display: "block" }}>
                  {lang === "si" ? "පළමු පිවිසුමෙන් පසු නිලධාරියාට මුරපදය වෙනස් කළ හැක." : "Officer can change password upon initial login."}
                </span>
              </div>

              {/* Account Status */}
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "#334155" }}>
                  {t("accountStatus", "Account Status")}
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.88rem" }}>
                    <input
                      type="radio"
                      name="chiefClerkStatus"
                      value="Active"
                      checked={formStatus === "Active"}
                      onChange={() => setFormStatus("Active")}
                    />
                    <span style={{ color: "#16a34a", fontWeight: 600 }}>{t("active", "Active")}</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.88rem" }}>
                    <input
                      type="radio"
                      name="chiefClerkStatus"
                      value="Inactive"
                      checked={formStatus === "Inactive"}
                      onChange={() => setFormStatus("Inactive")}
                    />
                    <span style={{ color: "#dc2626", fontWeight: 600 }}>{t("inactive", "Inactive")}</span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="admin-modal-actions" style={{ borderTop: "1.5px solid #e2e8f0", paddingTop: "14px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
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
                  style={{ background: "#1d4ed8", display: "inline-flex", alignItems: "center", gap: "6px" }}
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
              </div>
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
