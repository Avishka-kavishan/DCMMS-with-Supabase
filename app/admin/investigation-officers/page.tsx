"use client";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import { UserPlus, X, Edit, Trash2, Check } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface Officer {
  id: string;
  fullName: string;
  email: string;
  role: "investigation_officer";
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

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // ── Fetch officers — DB primary, localStorage fallback ─────────────────────
  const fetchOfficers = async () => {
    setIsLoading(true);
    let result: Officer[] = [];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("dcmms_profiles")
          .select("id, full_name, email, status, created_at")
          .eq("role", "investigation_officer")
          .order("created_at", { ascending: false });

        if (!error && data) {
          result = data.map((p: any) => ({
            id: p.id,
            fullName: p.full_name || "",
            email: p.email || "",
            role: "investigation_officer",
            status: (p.status === "Inactive" ? "Inactive" : "Active") as "Active" | "Inactive",
            createdAt: (p.created_at || "").slice(0, 10),
          }));
        }
      } catch (err) {
        console.error("Failed to load investigation officers from Supabase:", err);
      }
    }

    // Merge any locally-created officers that aren't in the DB yet
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          const list = JSON.parse(stored) as Officer[];
          const localInvestigation = list.filter((o) => o.role === "investigation_officer");
          const dbIds = new Set(result.map((o) => o.id));
          localInvestigation.forEach((lo) => {
            if (!dbIds.has(lo.id)) result.push(lo);
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
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
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
    setFormName("");
    setFormEmail("");
    setFormStatus("Active");
    setErrors({});
    setIsModalOpen(true);
  };
  const openEditModal = (o: Officer) => {
    setIsEditMode(true);
    setEditingId(o.id);
    setFormName(o.fullName);
    setFormEmail(o.email);
    setFormStatus(o.status);
    setErrors({});
    setIsModalOpen(true);
  };

  // ── Save (Add / Edit) ──────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const now = new Date().toISOString();
    const isNew = !isEditMode || !editingId;
    const newId = isNew ? `inv-${Date.now()}` : editingId!;

    const officer: Officer = {
      id: newId,
      fullName: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      role: "investigation_officer",
      status: formStatus,
      createdAt: isNew
        ? now.slice(0, 10)
        : officers.find((o) => o.id === editingId)?.createdAt || now.slice(0, 10),
    };

    // 1. Write to Supabase (primary)
    if (isSupabaseConfigured) {
      try {
        const payload: any = {
          full_name: officer.fullName,
          email: officer.email,
          role: "investigation_officer",
          status: officer.status,
        };
        // Only include `id` for real UUID edits (not temp local ids starting with "inv-")
        if (!isNew && !officer.id.startsWith("inv-")) {
          payload.id = officer.id;
        }

        const { error } = await supabase.from("dcmms_profiles").upsert(payload);
        if (error) throw error;

        showToast(isEditMode ? "Officer updated successfully!" : t("officerAddedSuccess", "Officer registered successfully!"));
        setIsModalOpen(false);
        fetchOfficers();
        return;
      } catch (err: any) {
        console.error("Supabase upsert failed:", err?.message ?? err);
      }
    }

    // 2. Fallback: localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      let list: Officer[] = [];
      try {
        list = stored ? JSON.parse(stored) : [];
      } catch {
        list = [];
      }
      list = list.filter((o) => o.id !== officer.id);
      list.push(officer);
      localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
    }

    showToast(isEditMode ? "Officer updated successfully!" : t("officerAddedSuccess", "Officer registered successfully!"));
    setIsModalOpen(false);
    fetchOfficers();
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (officer: Officer) => {
    if (!confirm("Are you sure you want to delete this officer?")) return;

    // 1. Delete from Supabase if it has a real (non-temp) id
    if (isSupabaseConfigured && !officer.id.startsWith("inv-")) {
      try {
        const { error } = await supabase.from("dcmms_profiles").delete().eq("id", officer.id);
        if (error) throw error;
      } catch (err: any) {
        console.error("Supabase delete failed:", err?.message ?? err);
      }
    }

    // 2. Remove from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          let list = JSON.parse(stored) as Officer[];
          list = list.filter((o) => o.id !== officer.id);
          localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
        } catch {
          /* ignore */
        }
      }
    }

    showToast("Officer deleted successfully.");
    fetchOfficers();
  };

  // ── Toggle Status ──────────────────────────────────────────────────────────
  const handleToggleStatus = async (officer: Officer) => {
    const newStatus: "Active" | "Inactive" = officer.status === "Active" ? "Inactive" : "Active";

    // 1. Update in Supabase
    if (isSupabaseConfigured && !officer.id.startsWith("inv-")) {
      try {
        const { error } = await supabase
          .from("dcmms_profiles")
          .update({ status: newStatus })
          .eq("id", officer.id);
        if (error) throw error;
      } catch (err: any) {
        console.error("Supabase status update failed:", err?.message ?? err);
      }
    }

    // 2. Update localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      let list: Officer[] = [];
      try {
        list = stored ? JSON.parse(stored) : [];
      } catch {
        list = [];
      }
      list = list.filter((o) => o.id !== officer.id);
      list.push({ ...officer, status: newStatus });
      localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
    }

    showToast(`Status of ${officer.fullName} updated to ${newStatus}.`);
    fetchOfficers();
  };

  const filteredOfficers = officers.filter(
    (o) =>
      o.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.email.toLowerCase().includes(searchQuery.toLowerCase())
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
            placeholder={t("searchUserPlaceholder", "Search by name, role, email…")}
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="btn-admin-add" onClick={openAddModal}>
          <UserPlus size={18} />
          {t("addInvestigationOfficer", "Add Investigation Officer")}
        </button>
      </div>

      {/* Officers Table */}
      <section className="letters-list-section">
        <div className="table-responsive-container">
          <table className="letters-data-table">
            <thead>
              <tr>
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
                  <td colSpan={5} className="admin-table-no-data table-no-data-padding">
                    {t("loadingData", "Loading officers from database…")}
                  </td>
                </tr>
              ) : filteredOfficers.length > 0 ? (
                filteredOfficers.map((item) => (
                  <tr key={item.id} className="letter-table-row">
                    <td className="admin-table-case-no font-semibold">{item.fullName}</td>
                    <td>{item.email || "—"}</td>
                    <td>{t("roleInvestigation", "Investigation Officer")}</td>
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
                  <td colSpan={5} className="admin-table-no-data table-no-data-padding">
                    {officers.length === 0
                      ? t("noOfficersInDatabase", "No investigation officers found in the database.")
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
                {isEditMode ? "Edit Investigation Officer Account" : t("addStaffAccountTitle", "Add Disciplinary Staff Account")}
              </h2>
              <button className="btn-modal-close" onClick={() => setIsModalOpen(false)} aria-label="Close modal">
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-field-group">
                  <label htmlFor="fullName" className="field-label">
                    {t("officerFullName", "Officer Full Name")} <span className="required-star">*</span>
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    placeholder={t("placeholderOfficerNameExample", "e.g. Ranjith Bandara")}
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
                    placeholder={t("placeholderEmailExample", "e.g. ranjithbandara@gmail.com")}
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
                    value={t("roleInvestigation", "Investigation Officer")}
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
