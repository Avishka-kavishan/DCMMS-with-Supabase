"use client";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import { UserPlus, X, Edit, Trash2, Check } from "lucide-react";
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

export default function DailyMailOfficersPage() {
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // ── Fetch officers from register_officer_table ─────────────────────
  const fetchOfficers = async () => {
    setIsLoading(true);
    let result: Officer[] = [];

    // 1. Primary: Server Action querying register_officer_table
    try {
      const res = await getRegisterOfficersServer("Daily mail");
      if (res.success && res.data && res.data.length > 0) {
        result = res.data.map((p: any) => ({
          id: p.id,
          employeeNo: p.employee_no || "",
          fullName: p.full_name || "",
          email: p.email || "",
          role: "daily_mail",
          status: p.is_active === false ? "Inactive" : "Active",
          createdAt: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
        }));
      }
    } catch (err) {
      console.error("Failed to load daily mail officers via server action:", err);
    }

    // 2. Supabase fallback querying register_officer_table
    if (result.length === 0 && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("register_officer_table")
          .select("*")
          .or("role.eq.Daily mail officer,role.eq.daily_mail,role.ilike.%daily%mail%")
          .order("created_at", { ascending: false });

        if (!error && data) {
          result = data.map((p: any) => ({
            id: p.id,
            employeeNo: p.employee_no || "",
            fullName: p.full_name || "",
            email: p.email || "",
            role: "daily_mail",
            status: p.is_active === false ? "Inactive" : "Active",
            createdAt: (p.created_at || "").slice(0, 10),
          }));
        }
      } catch (err) {
        console.error("Failed to load daily mail officers from Supabase:", err);
      }
    }

    // 3. Fallback: Merge custom local profiles if any
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          const list = JSON.parse(stored) as Officer[];
          const localDailyMail = list.filter((o) => o.role === "daily_mail" || o.role === "Daily mail officer");
          const dbIds = new Set(result.map((o) => o.id));
          const dbEmails = new Set(result.map((o) => (o.email || "").toLowerCase()));
          localDailyMail.forEach((lo) => {
            if (!dbIds.has(lo.id) && !dbEmails.has((lo.email || "").toLowerCase())) {
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
        .channel("daily-mail-officers-realtime")
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

    const isNew = !isEditMode || !editingId;
    const targetId = isNew ? undefined : editingId!;

    const payload = {
      id: targetId,
      employee_no: formEmployeeNo.trim() || `EMP-${Date.now().toString().slice(-6)}`,
      full_name: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      role: "Daily mail officer",
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
          isEditMode ? "UPDATE_DAILY_MAIL_OFFICER" : "REGISTER_DAILY_MAIL_OFFICER",
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
          role: "Daily mail officer",
          is_active: payload.is_active,
        };
        if (payload.id && !payload.id.startsWith("dm-")) {
          supaPayload.id = payload.id;
        }
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
        id: payload.id || `dm-${Date.now()}`,
        employeeNo: payload.employee_no,
        fullName: payload.full_name,
        email: payload.email,
        role: "daily_mail",
        status: formStatus,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      list = list.filter((o: any) => o.id !== newObj.id);
      list.push(newObj);
      localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
      saveSuccess = true;
    }

    if (saveSuccess) {
      showToast(isEditMode ? "Officer updated successfully!" : t("officerAddedSuccess", "Officer registered successfully!"));
      setIsModalOpen(false);
      fetchOfficers();
    } else {
      showToast(`Error: ${errorMsg || "Failed to save officer"}`);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (officer: Officer) => {
    if (!confirm(t("confirmDeleteOfficer", "Are you sure you want to delete this officer?"))) return;

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
        if (!officer.id.startsWith("dm-")) {
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
      showToast(t("officerDeletedSuccess", "Officer deleted successfully."));
    } else {
      showToast(`Error: ${errorMsg || "Could not delete officer"}`);
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
        if (!officer.id.startsWith("dm-")) {
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
      o.employeeNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Render ─────────────────────────────────────────────────────────────────
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
            placeholder={t("searchUserPlaceholder", "Search by name, employee no, role, email…")}
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="btn-admin-add" onClick={openAddModal}>
          <UserPlus size={18} />
          {t("addDailyReporter", "Add Daily Reporter")}
        </button>
      </div>

      {/* Officers Table */}
      <section className="letters-list-section">
        <div className="table-responsive-container">
          <table className="letters-data-table">
            <thead>
              <tr>
                <th scope="col">Employee No</th>
                <th scope="col">{t("officerFullName", "Officer Full Name")}</th>
                <th scope="col">{t("emailAddress", "E-mail Address")}</th>
                <th scope="col">{t("assignedSystemRole", "Assigned System Role")}</th>
                <th scope="col">{t("accountStatus", "Account Status")}</th>
                <th scope="col" className="admin-table-header-center">{t("actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="admin-table-no-data table-no-data-padding">
                    {t("loadingData", "Loading officers from database…")}
                  </td>
                </tr>
              ) : filteredOfficers.length > 0 ? (
                filteredOfficers.map((item) => (
                  <tr key={item.id} className="letter-table-row">
                    <td className="font-mono text-sm">{item.employeeNo || "—"}</td>
                    <td className="admin-table-case-no font-semibold">{item.fullName}</td>
                    <td>{item.email || "—"}</td>
                    <td>{t("roleDailyMail", "Daily Mail Officer")}</td>
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
                      ? t("noOfficersInDatabase", "No daily mail officers found in register_officer_table.")
                      : t("noLettersFound", "No entries found matching search.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-card">
            <header className="modal-header">
              <h2 id="modal-title" className="modal-title">
                {isEditMode ? "Edit Daily Mail Officer Account" : t("addStaffAccountTitle", "Add Disciplinary Staff Account")}
              </h2>
              <button className="btn-modal-close" onClick={() => setIsModalOpen(false)} aria-label="Close modal">
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-field-group">
                  <label htmlFor="employeeNo" className="field-label">
                    Employee No / Staff ID <span className="required-star">*</span>
                  </label>
                  <input
                    id="employeeNo"
                    type="text"
                    placeholder="e.g. 200399100222"
                    value={formEmployeeNo}
                    onChange={(e) => setFormEmployeeNo(e.target.value)}
                    className={`field-input ${errors.employeeNo ? "field-input-invalid" : ""}`}
                  />
                  {errors.employeeNo && <span className="field-error-text">{errors.employeeNo}</span>}
                </div>

                <div className="form-field-group">
                  <label htmlFor="fullName" className="field-label">
                    {t("officerFullName", "Officer Full Name")} <span className="required-star">*</span>
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    placeholder={t("placeholderOfficerNameExample", "e.g. Nimal Silva")}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={`field-input ${errors.name ? "field-input-invalid" : ""}`}
                  />
                  {errors.name && <span className="field-error-text">{errors.name}</span>}
                </div>

                <div className="form-field-group">
                  <label htmlFor="email" className="field-label">
                    {t("emailAddress", "E-mail Address")} <span className="required-star">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder={t("placeholderEmailExample", "e.g. nimalsilva@gmail.com")}
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className={`field-input ${errors.email ? "field-input-invalid" : ""}`}
                  />
                  {errors.email && <span className="field-error-text">{errors.email}</span>}
                </div>

                <div className="form-field-group">
                  <label htmlFor="assignedRole" className="field-label">{t("assignedSystemRole", "Assigned System Role")}</label>
                  <input
                    id="assignedRole"
                    type="text"
                    disabled
                    value={t("roleDailyMail", "Daily Mail Officer")}
                    className="field-input disabled-input-custom"
                  />
                </div>

                <div className="form-field-group">
                  <label htmlFor="status" className="field-label">{t("status", "Status")}</label>
                  <select
                    id="status"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as "Active" | "Inactive")}
                    className="field-select"
                  >
                    <option value="Active">{t("active", "Active")}</option>
                    <option value="Inactive">{t("inactive", "Inactive")}</option>
                  </select>
                </div>
              </div>

              <footer className="modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>
                  {t("cancelBtn", "Cancel")}
                </button>
                <button type="submit" className="btn-modal-save">
                  {t("saveAccountBtn", "Save Account")}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
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
