"use client";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import { UserPlus, X, Edit, Trash2, Check, ShieldCheck } from "lucide-react";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { 
  getRegisterOfficersServer, 
  saveRegisterOfficerServer, 
  deleteRegisterOfficerServer, 
  toggleRegisterOfficerStatusServer 
} from "@/lib/db-actions";

interface Officer {
  id: string;
  employeeNo: string;
  fullName: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  createdAt: string;
}

export default function InvestigationOfficersPage() {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState("");
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formEmployeeNo, setFormEmployeeNo] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // ── Fetch Investigation Admins from register_officer_table ─────────────────
  const fetchOfficers = async () => {
    setIsLoading(true);
    let result: Officer[] = [];

    // 1. Primary: Server Action querying register_officer_table
    try {
      const res = await getRegisterOfficersServer("Investigation");
      if (res.success && res.data && res.data.length > 0) {
        result = res.data.map((p: any) => ({
          id: p.id,
          employeeNo: p.employee_no || "",
          fullName: p.full_name || "",
          email: p.email || "",
          role: "investigation_officer",
          status: p.is_active === false ? "Inactive" : "Active",
          createdAt: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
        }));
      }
    } catch (err) {
      console.error("Failed to load investigation admins via server action:", err);
    }

    // 2. Supabase fallback querying register_officer_table
    if (result.length === 0 && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("register_officer_table")
          .select("*")
          .or("role.eq.Investigation officer,role.eq.investigation_officer,role.ilike.%investigation%")
          .order("created_at", { ascending: false });

        if (!error && data) {
          result = data.map((p: any) => ({
            id: p.id,
            employeeNo: p.employee_no || "",
            fullName: p.full_name || "",
            email: p.email || "",
            role: "investigation_officer",
            status: p.is_active === false ? "Inactive" : "Active",
            createdAt: (p.created_at || "").slice(0, 10),
          }));
        }
      } catch (err) {
        console.error("Failed to load investigation admins from Supabase:", err);
      }
    }

    // 3. Fallback: Merge custom local profiles if any
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          const list = JSON.parse(stored) as Officer[];
          const localInvestigation = list.filter(
            (o) => o.role === "investigation_officer" || o.role === "Investigation officer" || (o.role && o.role.toLowerCase().includes("investigation"))
          );
          const dbIds = new Set(result.map((o) => o.id));
          const dbEmails = new Set(result.map((o) => (o.email || "").toLowerCase()).filter(Boolean));
          const dbEmpNos = new Set(result.map((o) => o.employeeNo).filter(Boolean));
          localInvestigation.forEach((lo) => {
            if (
              !dbIds.has(lo.id) &&
              (!lo.email || !dbEmails.has(lo.email.toLowerCase())) &&
              (!lo.employeeNo || !dbEmpNos.has(lo.employeeNo))
            ) {
              result.push(lo);
            }
          });
        } catch (e) {
          console.error("Failed to parse local profiles:", e);
        }
      }
    }

    setOfficers(result);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOfficers();

    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel("investigation-officers-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "register_officer_table" },
          () => fetchOfficers()
        )
        .subscribe();
    }

    const handleLocalUpdate = () => fetchOfficers();
    window.addEventListener("storage", handleLocalUpdate);
    window.addEventListener("dcmms_data_updated", handleLocalUpdate);

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
    if (!formEmployeeNo.trim()) newErrors.employeeNo = t("pleaseFillAllFields", "Employee Number / Staff ID is required.");
    if (!formName.trim()) newErrors.name = t("pleaseFillAllFields", "Administrator Full Name is required.");
    if (!formEmail.trim()) {
      newErrors.email = t("pleaseFillAllFields", "Email address is required.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormEmployeeNo("");
    setFormName("");
    setFormEmail("");
    setFormStatus("Active");
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (o: Officer) => {
    setIsEditMode(true);
    setEditingId(o.id);
    setFormEmployeeNo(o.employeeNo);
    setFormName(o.fullName);
    setFormEmail(o.email);
    setFormStatus(o.status);
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

    const payload = {
      id: targetId,
      employee_no: formEmployeeNo.trim() || `EMP-${Date.now().toString().slice(-6)}`,
      full_name: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      role: "Investigation officer",
      is_active: formStatus === "Active",
    };

    let saveSuccess = false;
    let errorMsg = "";

    // 1. Save via Server Action to PostgreSQL register_officer_table
    try {
      const res = await saveRegisterOfficerServer(payload);
      if (res.success) {
        saveSuccess = true;
        await logAuditEvent(
          isEditMode ? "UPDATE_INVESTIGATION_ADMIN" : "REGISTER_INVESTIGATION_ADMIN",
          "register_officer_table",
          res.data?.id || editingId || "new",
          { name: payload.full_name, email: payload.email, employee_no: payload.employee_no }
        );
      } else {
        errorMsg = res.error || "Failed to save officer in PostgreSQL";
      }
    } catch (err: any) {
      console.error("Error saving officer via server action:", err);
      errorMsg = err?.message || "Server error";
    }

    // 2. Dual write via Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const supaPayload: any = {
          employee_no: payload.employee_no,
          full_name: payload.full_name,
          email: payload.email,
          role: "Investigation officer",
          is_active: payload.is_active,
        };
        if (payload.id && !payload.id.startsWith("inv-")) {
          supaPayload.id = payload.id;
        }
        const { error } = await supabase.from("register_officer_table").upsert(supaPayload);
        if (!error) saveSuccess = true;
      } catch (e) {
        console.error("Supabase upsert failed:", e);
      }
    }

    // 3. Fallback / Sync locally
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      let list: any[] = [];
      if (stored) {
        try {
          list = JSON.parse(stored);
        } catch (e) {}
      }

      if (isEditMode && editingId) {
        list = list.map((o) => (o.id === editingId ? { ...o, ...payload, fullName: payload.full_name, employeeNo: payload.employee_no, status: formStatus } : o));
      } else {
        list.push({
          id: `inv-${Date.now()}`,
          employeeNo: payload.employee_no,
          fullName: payload.full_name,
          email: payload.email,
          role: "investigation_officer",
          status: formStatus,
          createdAt: new Date().toISOString().slice(0, 10),
        });
      }
      localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
      window.dispatchEvent(new Event("dcmms_data_updated"));
    }

    setIsSaving(false);
    showToast(isEditMode ? "Investigation Administrator updated successfully!" : "Investigation Administrator registered successfully!");
    setIsModalOpen(false);
    fetchOfficers();
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (officer: Officer) => {
    if (!confirm(`Are you sure you want to remove ${officer.fullName}?`)) return;

    let deleteSuccess = false;
    let errorMsg = "";

    try {
      const res = await deleteRegisterOfficerServer(officer.id);
      if (res.success) {
        deleteSuccess = true;
      } else {
        errorMsg = res.error || "Failed to delete";
      }
    } catch (e: any) {
      errorMsg = e?.message || "Server error";
    }

    if (isSupabaseConfigured) {
      try {
        if (!officer.id.startsWith("inv-")) {
          await supabase.from("register_officer_table").delete().eq("id", officer.id);
        }
        if (officer.employeeNo) {
          await supabase.from("register_officer_table").delete().eq("employee_no", officer.employeeNo);
        }
        if (officer.email) {
          await supabase.from("register_officer_table").delete().eq("email", officer.email);
        }
        deleteSuccess = true;
      } catch (err) {}
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          let list = JSON.parse(stored) as any[];
          list = list.filter(
            (o) =>
              o.id !== officer.id &&
              (!officer.employeeNo || o.employeeNo !== officer.employeeNo) &&
              (!officer.email || o.email?.toLowerCase() !== officer.email?.toLowerCase())
          );
          localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
          deleteSuccess = true;
        } catch (e) {}
      }
      window.dispatchEvent(new Event("dcmms_data_updated"));
    }

    setOfficers((prev) =>
      prev.filter(
        (o) =>
          o.id !== officer.id &&
          (!officer.employeeNo || o.employeeNo !== officer.employeeNo) &&
          (!officer.email || o.email?.toLowerCase() !== officer.email?.toLowerCase())
      )
    );

    if (deleteSuccess) {
      showToast("Investigation Administrator removed successfully.");
    } else {
      showToast(`Error: ${errorMsg || "Could not delete administrator"}`);
    }

    fetchOfficers();
  };

  // ── Toggle Status ──────────────────────────────────────────────────────────
  const handleToggleStatus = async (officer: Officer) => {
    const newActive = officer.status !== "Active";
    const newStatusStr = newActive ? "Active" : "Inactive";

    try {
      await toggleRegisterOfficerStatusServer(officer.id, newActive);
    } catch (e) {}

    if (isSupabaseConfigured) {
      try {
        if (!officer.id.startsWith("inv-")) {
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
      (o.employeeNo || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-dashboard-container">
      {/* Action Bar */}
      <div className="admin-action-bar">
        <div className="search-box">
          <svg className="admin-search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={t("searchInvestigationAdmin", "Search by name, employee no, email…")}
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="btn-admin-add" onClick={openAddModal}>
          <UserPlus size={18} />
          <span>{t("addInvestigationAdmin", "Register Investigation Administrator")}</span>
        </button>
      </div>

      {/* Officers Table */}
      <section className="letters-list-section">
        <div className="table-responsive-container">
          <table className="letters-data-table">
            <thead>
              <tr>
                <th scope="col">{t("employeeNo", "Employee No")}</th>
                <th scope="col">{t("officerFullName", "Administrator Full Name")}</th>
                <th scope="col">{t("emailAddress", "E-mail Address")}</th>
                <th scope="col">{t("assignedSystemRole", "Role")}</th>
                <th scope="col">{t("accountStatus", "Account Status")}</th>
                <th scope="col" className="admin-table-header-center">{t("actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="admin-table-no-data table-no-data-padding">
                    {t("loadingData", "Loading investigation administrators from database…")}
                  </td>
                </tr>
              ) : filteredOfficers.length > 0 ? (
                filteredOfficers.map((item) => (
                  <tr key={item.id} className="letter-table-row">
                    <td className="admin-table-case-no font-semibold">
                      <span style={{ fontSize: "12px", color: "#1e40af", backgroundColor: "#dbeafe", padding: "3px 8px", borderRadius: "6px", fontWeight: 700 }}>
                        {item.employeeNo || "N/A"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#4f46e5", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "12px" }}>
                          {item.fullName ? item.fullName.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "IA"}
                        </div>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>{item.fullName}</span>
                      </div>
                    </td>
                    <td style={{ color: "#475569" }}>{item.email || "—"}</td>
                    <td>
                      <span style={{ fontSize: "11px", backgroundColor: "#e0e7ff", color: "#3730a3", padding: "3px 10px", borderRadius: "12px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <ShieldCheck size={12} />
                        {t("roleInvestigation", "Investigation Administrator")}
                      </span>
                    </td>
                    <td>
                      <span className={item.status === "Active" ? "status-badge-active" : "status-badge-inactive"}>
                        {item.status === "Active" ? t("active", "Active") : t("inactive", "Inactive")}
                      </span>
                    </td>
                    <td className="admin-table-cell-center">
                      <div className="action-btn-row">
                        <button className="btn-table-edit" onClick={() => openEditModal(item)} title={t("edit", "Edit")}>
                          <Edit size={16} />
                        </button>
                        <button className="btn-table-toggle" onClick={() => handleToggleStatus(item)} title="Toggle Status">
                          <Check size={16} />
                        </button>
                        <button className="btn-table-delete" onClick={() => handleDelete(item)} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="admin-table-no-data table-no-data-padding">
                    {officers.length === 0
                      ? t("noOfficersInDatabase", "No investigation administrators registered yet.")
                      : t("noLettersFound", "No entries found matching search.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h2 id="modal-title" className="modal-title">
                  {isEditMode 
                    ? t("editInvestigationAdmin", "Edit Investigation Administrator") 
                    : t("addInvestigationAdmin", "Register Investigation Administrator")}
                </h2>
                <p className="modal-subtitle">
                  {t("investigationAdminSubtitle", "Manage branch access credentials for the investigation administrator")}
                </p>
              </div>
              <button className="btn-modal-close" onClick={() => setIsModalOpen(false)} aria-label="Close modal">
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                {/* Employee No */}
                <div className="form-field-group">
                  <label htmlFor="employeeNo" className="field-label">
                    {t("employeeNo", "Employee No / Staff ID")} <span className="required-star">*</span>
                  </label>
                  <input
                    id="employeeNo"
                    type="text"
                    placeholder="e.g. 200399100204"
                    value={formEmployeeNo}
                    onChange={(e) => setFormEmployeeNo(e.target.value)}
                    className={`field-input ${errors.employeeNo ? "field-input-invalid" : ""}`}
                  />
                  {errors.employeeNo && <span className="field-error-text">{errors.employeeNo}</span>}
                </div>

                {/* Full Name */}
                <div className="form-field-group">
                  <label htmlFor="name" className="field-label">
                    {t("officerFullName", "Officer Full Name")} <span className="required-star">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder={t("placeholderOfficerNameExample", "e.g. Sunil Fernando")}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={`field-input ${errors.name ? "field-input-invalid" : ""}`}
                  />
                  {errors.name && <span className="field-error-text">{errors.name}</span>}
                </div>

                {/* Email */}
                <div className="form-field-group">
                  <label htmlFor="email" className="field-label">
                    {t("emailAddress", "Email Address")} <span className="required-star">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder={t("placeholderEmailExample", "e.g. sunil.f@discipline.gov.lk")}
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className={`field-input ${errors.email ? "field-input-invalid" : ""}`}
                  />
                  {errors.email && <span className="field-error-text">{errors.email}</span>}
                </div>

                {/* Fixed Role & Status */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", alignItems: "start" }}>
                  <div className="form-field-group">
                    <label htmlFor="assignedRole" className="field-label">
                      {t("assignedSystemRole", "Assigned System Role")}
                    </label>
                    <div style={{ height: "42px", padding: "0 12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                      <ShieldCheck size={16} color="#4f46e5" />
                      <span>{t("roleInvestigation", "Investigation Administrator")}</span>
                    </div>
                  </div>

                  <div className="form-field-group">
                    <label htmlFor="status" className="field-label">{t("status", "Account Status")}</label>
                    <select
                      id="status"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as "Active" | "Inactive")}
                      className="field-select"
                      style={{ height: "42px" }}
                    >
                      <option value="Active">{t("active", "Active")}</option>
                      <option value="Inactive">{t("inactive", "Inactive")}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <footer className="modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>
                  {t("cancelBtn", "Cancel")}
                </button>
                <button type="submit" className="btn-modal-save" disabled={isSaving}>
                  {isSaving ? t("saving", "Saving...") : t("saveAccountBtn", "Save Account")}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <div className="toast-success-icon-container">
            <Check size={14} color="#fff" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
