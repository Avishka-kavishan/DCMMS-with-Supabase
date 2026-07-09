"use client";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import { Search, UserPlus, X, Edit, Trash2, ShieldAlert, Check } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface Officer {
  id: string;
  fullName: string;
  email: string;
  role: "subject_officer" | "investigation_officer" | "daily_mail";
  status: "Active" | "Inactive";
  createdAt: string;
}

export default function SubjectOfficersPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  // Search & data states
  const [searchQuery, setSearchQuery] = useState("");
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [toastMessage, setToastMessage] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");

  // Error states
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Show Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Fetch Officers list
  const fetchOfficers = async () => {
    let dbOfficers: Officer[] = [];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("dcmms_profiles")
          .select("*")
          .eq("role", "subject_officer");

        if (!error && data) {
          dbOfficers = data.map((profile: any) => ({
            id: profile.id,
            fullName: profile.full_name,
            email: profile.email || `${profile.full_name.toLowerCase().replace(/\s+/g, "")}@gmail.com`,
            role: "subject_officer",
            status: profile.status || "Active",
            createdAt: profile.created_at || new Date().toISOString().split("T")[0],
          }));
        }
      } catch (err) {
        console.error("Error loading subject officers from database:", err);
      }
    }

    // Load custom officers from localStorage
    let localOfficers: Officer[] = [];
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          localOfficers = parsed.filter((o: Officer) => o.role === "subject_officer");
        } catch (e) {
          console.error("Error parsing custom profiles from localStorage:", e);
        }
      }
    }

    // Combine lists, preferring DB entry on ID conflicts
    const combinedMap = new Map<string, Officer>();
    
    // Add default templates if nothing is present
    const defaults: Officer[] = [
      {
        id: "default-sub-1",
        fullName: "Nathasha Sathsarani",
        email: "nathashasathsarani209@gmail.com",
        role: "subject_officer",
        status: "Active",
        createdAt: "2026-01-01"
      },
      {
        id: "default-sub-2",
        fullName: "Kamal Perera",
        email: "kamalperera@gmail.com",
        role: "subject_officer",
        status: "Active",
        createdAt: "2026-01-10"
      }
    ];

    defaults.forEach(d => combinedMap.set(d.id, d));
    localOfficers.forEach(l => combinedMap.set(l.id, l));
    dbOfficers.forEach(d => combinedMap.set(d.id, d));

    setOfficers(Array.from(combinedMap.values()));
  };

  useEffect(() => {
    fetchOfficers();
  }, []);

  // Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formName.trim()) {
      newErrors.name = t("pleaseFillAllFields", "Please fill out all fields.");
    }
    if (!formEmail.trim()) {
      newErrors.email = t("pleaseFillAllFields", "Please fill out all fields.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Open Modal Helpers
  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormName("");
    setFormEmail("");
    setFormStatus("Active");
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (officer: Officer) => {
    setIsEditMode(true);
    setEditingId(officer.id);
    setFormName(officer.fullName);
    setFormEmail(officer.email);
    setFormStatus(officer.status);
    setErrors({});
    setIsModalOpen(true);
  };

  // Save Form Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const savedOfficer: Officer = {
      id: isEditMode && editingId ? editingId : `sub-${Date.now()}`,
      fullName: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      role: "subject_officer",
      status: formStatus,
      createdAt: isEditMode && editingId
        ? officers.find(o => o.id === editingId)?.createdAt || new Date().toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    };

    // Save custom profiles in localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      let list: Officer[] = [];
      if (stored) {
        try {
          list = JSON.parse(stored);
        } catch (e) {
          list = [];
        }
      }

      if (isEditMode) {
        list = list.filter(o => o.id !== savedOfficer.id);
      }
      list.push(savedOfficer);
      localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
    }

    // Try DB upsert
    if (isSupabaseConfigured) {
      try {
        await supabase.from("dcmms_profiles").upsert({
          id: savedOfficer.id.startsWith("sub-") || savedOfficer.id.startsWith("default-") ? undefined : savedOfficer.id, // bypass UUID generation constraint on local mock IDs
          full_name: savedOfficer.fullName,
          role: "subject_officer",
        });
      } catch (err) {
        console.warn("Could not upsert to Supabase due to session constraints. Falling back fully to local persistence.", err);
      }
    }

    showToast(isEditMode ? "Officer updated successfully!" : t("officerAddedSuccess", "Officer registered successfully!"));
    setIsModalOpen(false);
    fetchOfficers();
  };

  // Delete Handler
  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this officer?")) return;

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          let list = JSON.parse(stored);
          list = list.filter((o: Officer) => o.id !== id);
          localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
        } catch (e) {
          console.error(e);
        }
      }
    }
    showToast("Officer deleted successfully.");
    fetchOfficers();
  };

  // Toggle Status Handler
  const handleToggleStatus = (officer: Officer) => {
    const newStatus: "Active" | "Inactive" = officer.status === "Active" ? "Inactive" : "Active";
    const updated: Officer = { ...officer, status: newStatus };

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      let list: Officer[] = [];
      if (stored) {
        try {
          list = JSON.parse(stored);
        } catch (e) {
          list = [];
        }
      }
      list = list.filter(o => o.id !== officer.id);
      list.push(updated);
      localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
    }

    showToast(`Status of ${officer.fullName} updated to ${newStatus}`);
    fetchOfficers();
  };

  // Filter list by search query
  const filteredOfficers = officers.filter(o =>
    o.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.email.toLowerCase().includes(searchQuery.toLowerCase())
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
            placeholder={t("searchUserPlaceholder", "Search by name, role, email...")}
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="btn-admin-add" onClick={openAddModal}>
          <UserPlus size={18} />
          {t("addSubjectOfficer", "Add Subject officer")}
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
              {filteredOfficers.length > 0 ? (
                filteredOfficers.map((item) => (
                  <tr key={item.id} className="letter-table-row">
                    <td className="admin-table-case-no font-semibold">{item.fullName}</td>
                    <td>{item.email}</td>
                    <td>{t("roleSubject", "Subject officer")}</td>
                    <td>
                      <span className={item.status === "Active" ? "status-badge-active" : "status-badge-inactive"}>
                        {item.status === "Active" ? t("active", "Active") : t("inactive", "Inactive")}
                      </span>
                    </td>
                    <td className="admin-table-cell-center">
                      <div className="action-btn-row">
                        <button className="btn-table-edit" onClick={() => openEditModal(item)} title={t("view", "Edit")}>
                          <Edit size={16} />
                        </button>
                        <button className="btn-table-toggle" onClick={() => handleToggleStatus(item)} title="Toggle Status">
                          <Check size={16} />
                        </button>
                        <button className="btn-table-delete" onClick={() => handleDelete(item.id)} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="admin-table-no-data table-no-data-padding">
                    {t("noLettersFound", "No entries found matching search")}
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
                {isEditMode ? "Edit Subject Officer Account" : t("addStaffAccountTitle", "Add Disciplinary Staff Account")}
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
                    type="text"
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
                    value={t("roleSubject", "Subject officer")}
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
