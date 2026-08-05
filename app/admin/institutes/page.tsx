"use client";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import { Search, Plus, X, Edit, Trash2, Check } from "lucide-react";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";

interface Institute {
  id: string;
  name: string;
  code: string;
  regionProvince: string;
  status: "Active" | "Inactive";
  createdAt: string;
}

export default function EducationalInstitutesPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  // Search & data states
  const [searchQuery, setSearchQuery] = useState("");
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [toastMessage, setToastMessage] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formRegion, setFormRegion] = useState("Western");
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");

  // Error states
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Show Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Fetch Institutes list
  const fetchInstitutes = async () => {
    let dbInstitutes: Institute[] = [];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("dcmms_institutes")
          .select("*");

        if (!error && data) {
          dbInstitutes = data.map((item: any) => ({
            id: item.id,
            name: item.name,
            code: item.code,
            regionProvince: item.region_province || item.regionProvince || "Western",
            status: item.status === "inactive" ? "Inactive" : "Active",
            createdAt: item.created_at || new Date().toISOString().split("T")[0],
          }));
        }
      } catch (err) {
        console.error("Error loading institutes from database:", err);
      }
    }

    // Load custom institutes from localStorage
    let localInstitutes: Institute[] = [];
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_institutes");
      if (stored) {
        try {
          localInstitutes = JSON.parse(stored);
        } catch (e) {
          console.error("Error parsing custom institutes from localStorage:", e);
        }
      }
    }

    // Combine lists, preferring DB entry on ID conflicts
    const combinedMap = new Map<string, Institute>();
    
    // Add default templates if nothing is present
    const defaults: Institute[] = [
      {
        id: "default-inst-1",
        name: "Zonal Office - Kandy",
        code: "ZONE-KD",
        regionProvince: "Central",
        status: "Active",
        createdAt: "2026-01-01"
      },
      {
        id: "default-inst-2",
        name: "Royal College, Colombo 07",
        code: "RC-COL",
        regionProvince: "Western",
        status: "Active",
        createdAt: "2026-01-10"
      },
      {
        id: "default-inst-3",
        name: "Zonal Education Office, Jaffna",
        code: "ZONE-JA",
        regionProvince: "Northern",
        status: "Active",
        createdAt: "2026-01-20"
      }
    ];

    defaults.forEach(d => combinedMap.set(d.id, d));
    localInstitutes.forEach(l => combinedMap.set(l.id, l));
    dbInstitutes.forEach(d => combinedMap.set(d.id, d));

    setInstitutes(Array.from(combinedMap.values()));
  };

  useEffect(() => {
    fetchInstitutes();

    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel("institutes-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "dcmms_institutes" },
          () => fetchInstitutes()
        )
        .subscribe();
    }

    const handleLocalUpdate = () => fetchInstitutes();
    window.addEventListener("storage", handleLocalUpdate);
    window.addEventListener("dcmms_data_updated", handleLocalUpdate);

    const interval = setInterval(fetchInstitutes, 2500);

    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener("storage", handleLocalUpdate);
      window.removeEventListener("dcmms_data_updated", handleLocalUpdate);
      clearInterval(interval);
    };
  }, []);


  // Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formName.trim()) {
      newErrors.name = t("pleaseFillAllFields", "Please fill out all fields.");
    }
    if (!formCode.trim()) {
      newErrors.code = t("pleaseFillAllFields", "Please fill out all fields.");
    } else if (
      institutes.some(
        inst => inst.code.toUpperCase() === formCode.trim().toUpperCase() && inst.id !== editingId
      )
    ) {
      newErrors.code = "Institute code must be unique.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Open Modal Helpers
  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormName("");
    setFormCode("");
    setFormRegion("Western");
    setFormStatus("Active");
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (inst: Institute) => {
    setIsEditMode(true);
    setEditingId(inst.id);
    setFormName(inst.name);
    setFormCode(inst.code);
    setFormRegion(inst.regionProvince);
    setFormStatus(inst.status);
    setErrors({});
    setIsModalOpen(true);
  };

  // Save Form Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const savedInst: Institute = {
      id: isEditMode && editingId ? editingId : `inst-${Date.now()}`,
      name: formName.trim(),
      code: formCode.trim().toUpperCase(),
      regionProvince: formRegion,
      status: formStatus,
      createdAt: isEditMode && editingId
        ? institutes.find(o => o.id === editingId)?.createdAt || new Date().toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    };

    // Save custom institutes in localStorage
    if (typeof window !== "undefined") {
      let list = institutes.filter(o => o.id !== savedInst.id);
      list.push(savedInst);
      // Filter out base templates so we only store custom ones in localStorage
      const onlyCustom = list.filter(o => o.id.startsWith("inst-"));
      localStorage.setItem("dcmms_institutes", JSON.stringify(onlyCustom));
    }

    // Try DB upsert
    if (isSupabaseConfigured) {
      try {
        await supabase.from("dcmms_institutes").upsert({
          id: savedInst.id.startsWith("inst-") || savedInst.id.startsWith("default-") ? undefined : savedInst.id,
          name: savedInst.name,
          code: savedInst.code,
          region_province: savedInst.regionProvince,
          status: savedInst.status.toLowerCase(),
        });

        await logAuditEvent(
          isEditMode ? "UPDATE_INSTITUTE" : "ADD_INSTITUTE",
          "dcmms_institutes",
          savedInst.code,
          { name: savedInst.name, region: savedInst.regionProvince }
        );
      } catch (err) {
        console.warn("Could not upsert to Supabase. Falling back fully to localStorage.", err);
      }
    }

    showToast(isEditMode ? "Institute updated successfully!" : t("instituteAddedSuccess", "Institute added successfully!"));
    setIsModalOpen(false);
    fetchInstitutes();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("dcmms_data_updated"));
  };

  // Delete Handler
  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this institute?")) return;

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_institutes");
      if (stored) {
        try {
          let list = JSON.parse(stored);
          list = list.filter((o: Institute) => o.id !== id);
          localStorage.setItem("dcmms_institutes", JSON.stringify(list));
        } catch (e) {
          console.error(e);
        }
      }
    }
    showToast("Institute deleted successfully.");
    fetchInstitutes();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("dcmms_data_updated"));
  };

  // Toggle Status Handler
  const handleToggleStatus = (inst: Institute) => {
    const newStatus: "Active" | "Inactive" = inst.status === "Active" ? "Inactive" : "Active";
    const updated: Institute = { ...inst, status: newStatus };

    if (typeof window !== "undefined") {
      let list = institutes.filter(o => o.id !== inst.id);
      list.push(updated);
      const onlyCustom = list.filter(o => o.id.startsWith("inst-"));
      localStorage.setItem("dcmms_institutes", JSON.stringify(onlyCustom));
    }

    showToast(`Status of ${inst.name} updated to ${newStatus}`);
    fetchInstitutes();
  };

  // Filter list by search query
  const filteredInstitutes = institutes.filter(o =>
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.regionProvince.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const regionOptions = [
    { value: "Western", labelKey: "provinceWestern" },
    { value: "Central", labelKey: "provinceCentral" },
    { value: "Southern", labelKey: "provinceSouthern" },
    { value: "Northern", labelKey: "provinceNorthern" },
    { value: "Eastern", labelKey: "provinceEastern" },
    { value: "North Western", labelKey: "provinceNorthWestern" },
    { value: "North Central", labelKey: "provinceNorthCentral" },
    { value: "Uva", labelKey: "provinceUva" },
    { value: "Sabaragamuwa", labelKey: "provinceSabaragamuwa" },
  ];

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
            placeholder={t("searchKeywordPlaceholder", "Search Ref, Subject, Officer...")}
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="btn-admin-add" onClick={openAddModal}>
          <Plus size={18} />
          {t("addInstitute", "Add Institute")}
        </button>
      </div>

      {/* Institutes Table */}
      <section className="letters-list-section">
        <div className="table-responsive-container">
          <table className="letters-data-table">
            <thead>
              <tr>
                <th scope="col">{t("nameOfInstitute", "Name of Institute")}</th>
                <th scope="col">{t("instituteCode", "Institute Code")}</th>
                <th scope="col">{t("provinceRegion", "Province/Region")}</th>
                <th scope="col">{t("accountStatus", "Account Status")}</th>
                <th scope="col" className="admin-table-header-center">{t("actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstitutes.length > 0 ? (
                filteredInstitutes.map((item) => (
                  <tr key={item.id} className="letter-table-row">
                    <td className="admin-table-case-no font-semibold">{item.name}</td>
                    <td>{item.code}</td>
                    <td>
                      {t(
                        regionOptions.find(r => r.value === item.regionProvince)?.labelKey || "",
                        item.regionProvince
                      )}
                    </td>
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
                {isEditMode ? "Edit Educational Institute" : t("addNewInstituteTitle", "Add New Educational Institute")}
              </h2>
              <button className="btn-modal-close" onClick={() => setIsModalOpen(false)} aria-label="Close modal">
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-field-group">
                  <label htmlFor="instituteName" className="field-label">
                    {t("nameOfInstitute", "Name of Institute")} <span className="required-star">*</span>
                  </label>
                  <input
                    id="instituteName"
                    type="text"
                    placeholder={t("placeholderInstNameExample", "e.g. Zonal Office - Kandy")}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={`field-input ${errors.name ? "field-input-invalid" : ""}`}
                  />
                  {errors.name && <span className="field-error-text">{errors.name}</span>}
                </div>

                <div className="form-field-group">
                  <label htmlFor="instituteCode" className="field-label">
                    {t("instituteCode", "Institute Code")} <span className="required-star">*</span>
                  </label>
                  <input
                    id="instituteCode"
                    type="text"
                    placeholder={t("placeholderInstCodeExample", "e.g. ZONE-KD")}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className={`field-input ${errors.code ? "field-input-invalid" : ""}`}
                  />
                  {errors.code && <span className="field-error-text">{errors.code}</span>}
                </div>

                <div className="form-field-group">
                  <label htmlFor="regionProvince" className="field-label">
                    {t("provinceRegion", "Province/Region")}
                  </label>
                  <select
                    id="regionProvince"
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                    className="field-select"
                  >
                    {regionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey, opt.value)}
                      </option>
                    ))}
                  </select>
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
                  {t("saveInstituteBtn", "Save Institute")}
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
