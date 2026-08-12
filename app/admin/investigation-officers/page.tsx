"use client";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import { useRouter } from "next/navigation";
import { UserPlus, X, Edit, Trash2, Check, GraduationCap } from "lucide-react";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { 
  getRegisterOfficersServer, 
  saveRegisterOfficerServer, 
  deleteRegisterOfficerServer, 
  toggleRegisterOfficerStatusServer 
} from "@/lib/db-actions";

interface Officer {
  id: string;
  employeeNo?: string;
  fullName: string;
  nicNo?: string;
  officerRole?: "Chairman" | "Member";
  studiedSchools?: string[];
  childrenSchools?: string[];
  email: string;
  role: "investigation_officer";
  status: "Active" | "Inactive";
  createdAt: string;
}

export default function InvestigationOfficersPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formEmpNo, setFormEmpNo] = useState("");
  const [formName, setFormName] = useState("");
  const [formNic, setFormNic] = useState("");
  const [formOfficerRole, setFormOfficerRole] = useState<"Chairman" | "Member">("Member");
  const [formStudiedSchools, setFormStudiedSchools] = useState<string[]>([]);
  const [newStudiedInput, setNewStudiedInput] = useState("");
  const [formChildrenSchools, setFormChildrenSchools] = useState<string[]>([]);
  const [newChildrenInput, setNewChildrenInput] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleAddStudiedSchool = () => {
    const trimmed = newStudiedInput.trim();
    if (trimmed && !formStudiedSchools.includes(trimmed)) {
      setFormStudiedSchools((prev) => [...prev, trimmed]);
      setNewStudiedInput("");
    }
  };

  const handleRemoveStudiedSchool = (index: number) => {
    setFormStudiedSchools((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddChildrenSchool = () => {
    const trimmed = newChildrenInput.trim();
    if (trimmed && !formChildrenSchools.includes(trimmed)) {
      setFormChildrenSchools((prev) => [...prev, trimmed]);
      setNewChildrenInput("");
    }
  };

  const handleRemoveChildrenSchool = (index: number) => {
    setFormChildrenSchools((prev) => prev.filter((_, i) => i !== index));
  };

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
      const res = await getRegisterOfficersServer("Investigation");
      if (res.success && res.data && res.data.length > 0) {
        result = res.data.map((p: any) => ({
          id: p.id,
          employeeNo: p.employee_no || "",
          fullName: p.full_name || "",
          nicNo: p.nic_no || p.nic || "",
          officerRole: "Member",
          studiedSchools: [],
          childrenSchools: [],
          email: p.email || "",
          role: "investigation_officer",
          status: p.is_active === false ? "Inactive" : "Active",
          createdAt: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
        }));
      }
    } catch (err) {
      console.error("Failed to load investigation officers via server action:", err);
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
            nicNo: p.nic_no || p.nic || "",
            officerRole: "Member",
            studiedSchools: [],
            childrenSchools: [],
            email: p.email || "",
            role: "investigation_officer",
            status: p.is_active === false ? "Inactive" : "Active",
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
          const localInvestigation = list.filter((o) => o.role === "investigation_officer" || o.role === "Investigation officer");
          const dbIds = new Set(result.map((o) => o.id));
          localInvestigation.forEach((lo) => {
            if (!dbIds.has(lo.id)) {
              result.push({
                ...lo,
                studiedSchools: Array.isArray(lo.studiedSchools) ? lo.studiedSchools : [],
                childrenSchools: Array.isArray(lo.childrenSchools) ? lo.childrenSchools : [],
              });
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
    if (!formEmpNo.trim()) newErrors.empNo = "Employee No is required.";
    if (!formName.trim()) newErrors.name = t("pleaseFillAllFields", "Officer Name is required.");
    if (!formNic.trim()) newErrors.nic = "NIC No is required.";
    if (!formEmail.trim()) {
      newErrors.email = t("pleaseFillAllFields", "Email is required.");
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
    setFormEmpNo("");
    setFormName("");
    setFormNic("");
    setFormOfficerRole("Member");
    setFormStudiedSchools([]);
    setNewStudiedInput("");
    setFormChildrenSchools([]);
    setNewChildrenInput("");
    setFormEmail("");
    setFormStatus("Active");
    setErrors({});
    setIsModalOpen(true);
  };
  const openEditModal = (o: Officer) => {
    setIsEditMode(true);
    setEditingId(o.id);
    setFormEmpNo(o.employeeNo || "");
    setFormName(o.fullName);
    setFormNic(o.nicNo || "");
    setFormOfficerRole(o.officerRole || "Member");
    setFormStudiedSchools(Array.isArray(o.studiedSchools) ? [...o.studiedSchools] : []);
    setNewStudiedInput("");
    setFormChildrenSchools(Array.isArray(o.childrenSchools) ? [...o.childrenSchools] : []);
    setNewChildrenInput("");
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
      employee_no: formEmpNo.trim() || `EMP-${Date.now().toString().slice(-6)}`,
      full_name: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      role: "Investigation officer",
      is_active: formStatus === "Active",
    };

    // 1. Save via Server Action to PostgreSQL register_officer_table
    try {
      const res = await saveRegisterOfficerServer(payload);
      if (res.success) {
        await logAuditEvent(
          isEditMode ? "UPDATE_INVESTIGATION_OFFICER" : "REGISTER_INVESTIGATION_OFFICER",
          "register_officer_table",
          res.data?.id || editingId || "new",
          { name: payload.full_name, email: payload.email, employee_no: payload.employee_no }
        );
      }
    } catch (err) {
      console.error("Error saving officer via server action:", err);
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
        await supabase.from("register_officer_table").upsert(supaPayload);
      } catch (e) {
        console.error("Supabase upsert failed:", e);
      }
    }

    showToast(isEditMode ? "Officer updated successfully!" : t("officerAddedSuccess", "Officer registered successfully!"));
    setIsModalOpen(false);
    fetchOfficers();
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (officer: Officer) => {
    if (!confirm("Are you sure you want to delete this officer?")) return;

    try {
      await deleteRegisterOfficerServer(officer.id);
    } catch (e) {}

    if (isSupabaseConfigured && !officer.id.startsWith("inv-")) {
      try {
        await supabase.from("register_officer_table").delete().eq("id", officer.id);
      } catch (err) {}
    }

    showToast("Officer deleted successfully.");
    fetchOfficers();
  };

  // ── Toggle Status ──────────────────────────────────────────────────────────
  const handleToggleStatus = async (officer: Officer) => {
    const newActive = officer.status !== "Active";
    const newStatusStr = newActive ? "Active" : "Inactive";

    try {
      await toggleRegisterOfficerStatusServer(officer.id, newActive);
    } catch (e) {}

    if (isSupabaseConfigured && !officer.id.startsWith("inv-")) {
      try {
        await supabase
          .from("register_officer_table")
          .update({ is_active: newActive })
          .eq("id", officer.id);
      } catch (e) {}
    }

    showToast(`Status of ${officer.fullName} updated to ${newStatusStr}.`);
    fetchOfficers();
  };

  const filteredOfficers = officers.filter(
    (o) =>
      o.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.nicNo || "").toLowerCase().includes(searchQuery.toLowerCase())
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
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="btn-admin-add" onClick={() => router.push("/admin/investigation-officers/register")} style={{ backgroundColor: "#4f46e5", color: "#ffffff" }}>
            <UserPlus size={18} />
            <span>Register Officer (Separate Page)</span>
          </button>
          <button className="btn-admin-add" onClick={openAddModal} style={{ backgroundColor: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" }}>
            <UserPlus size={18} />
            <span>Quick Add Modal</span>
          </button>
        </div>
      </div>

      {/* Officers Table */}
      <section className="letters-list-section">
        <div className="table-responsive-container">
          <table className="letters-data-table">
            <thead>
              <tr>
                <th scope="col">Officer Name &amp; Credentials</th>
                <th scope="col">Studied Schools</th>
                <th scope="col">Children's Schools</th>
                <th scope="col">{t("emailAddress", "E-mail Address")}</th>
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
                    <td className="admin-table-case-no font-semibold">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>{item.fullName}</span>
                        <span style={{ fontSize: "11px", backgroundColor: item.officerRole === "Chairman" ? "#fef3c7" : "#e0e7ff", color: item.officerRole === "Chairman" ? "#92400e" : "#3730a3", padding: "1px 7px", borderRadius: "10px", fontWeight: 600 }}>
                          {item.officerRole || "Member"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap", alignItems: "center" }}>
                        {item.employeeNo && (
                          <span style={{ fontSize: "11px", color: "#1e40af", backgroundColor: "#dbeafe", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                            Emp No: {item.employeeNo}
                          </span>
                        )}
                        <span style={{ fontSize: "11px", color: "#475569", backgroundColor: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>
                          NIC: {item.nicNo || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td>
                      {item.studiedSchools && item.studiedSchools.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "200px" }}>
                          {item.studiedSchools.map((s, idx) => (
                            <span key={idx} style={{ fontSize: "11px", backgroundColor: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "12px", fontWeight: 500 }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td>
                      {item.childrenSchools && item.childrenSchools.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "200px" }}>
                          {item.childrenSchools.map((s, idx) => (
                            <span key={idx} style={{ fontSize: "11px", backgroundColor: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: "12px", fontWeight: 500 }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td>{item.email || "—"}</td>
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal-card" style={{ backgroundColor: "#ffffff", maxWidth: "780px", width: "95%", maxHeight: "92vh", borderRadius: "16px", overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)", padding: 0, display: "flex", flexDirection: "column" }}>
            
            {/* Header */}
            <header style={{ padding: "14px 20px", backgroundColor: "#1e1b4b", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserPlus size={20} style={{ color: "#818cf8" }} />
                </div>
                <div>
                  <h2 id="modal-title" style={{ color: "#ffffff", margin: 0, fontSize: "16px", fontWeight: 700 }}>
                    {isEditMode ? "Edit Investigation Officer" : t("addStaffAccountTitle", "Register Investigation Officer")}
                  </h2>
                  <p style={{ margin: 0, fontSize: "11px", color: "#cbd5e1" }}>
                    Fill out officer credentials &amp; school details below
                  </p>
                </div>
              </div>
              <button className="btn-modal-close" onClick={() => setIsModalOpen(false)} aria-label="Close modal" style={{ color: "#ffffff", backgroundColor: "rgba(255,255,255,0.1)", border: "none", padding: "6px", borderRadius: "50%", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleSave} style={{ padding: "16px 20px", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", overflowY: "auto" }}>

              {/* Live Preview Card Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#f8fafc", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: formOfficerRole === "Chairman" ? "#d97706" : "#4f46e5", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "15px", flexShrink: 0 }}>
                  {formName ? formName.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px", marginRight: "8px" }}>
                      {formName || "New Officer Name"}
                    </span>
                    <span style={{ fontSize: "11px", backgroundColor: formOfficerRole === "Chairman" ? "#fef3c7" : "#e0e7ff", color: formOfficerRole === "Chairman" ? "#92400e" : "#3730a3", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>
                      {formOfficerRole}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "10px", fontSize: "12px", color: "#64748b" }}>
                    <span>Emp No: <strong style={{ color: "#334155" }}>{formEmpNo || "N/A"}</strong></span>
                    <span>•</span>
                    <span>NIC: <strong style={{ color: "#334155" }}>{formNic || "N/A"}</strong></span>
                    <span>•</span>
                    <span>Status: <strong style={{ color: formStatus === "Active" ? "#16a34a" : "#dc2626" }}>{formStatus}</strong></span>
                  </div>
                </div>
              </div>

              {/* Side-by-Side 2-Column Main Form Grid (NO SCROLL NEEDED) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "start" }}>

                {/* LEFT COLUMN: Basic Details */}
                <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                    <UserPlus size={14} style={{ color: "#4f46e5" }} />
                    1. Basic Details
                  </h4>

                  {/* Officer Name */}
                  <div className="form-field-group">
                    <label htmlFor="fullName" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px" }}>
                      Officer Name <span className="required-star">*</span>
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      placeholder="e.g. Ranjith Bandara"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className={`field-input ${errors.name ? "field-input-invalid" : ""}`}
                      style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%", fontSize: "13px" }}
                    />
                    {errors.name && <span className="field-error-text" style={{ fontSize: "11px", color: "#ef4444" }}>{errors.name}</span>}
                  </div>

                  {/* Employee No & NIC No - 2 columns */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div className="form-field-group">
                      <label htmlFor="empNo" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px" }}>
                        Employee No <span className="required-star">*</span>
                      </label>
                      <input
                        id="empNo"
                        type="text"
                        placeholder="e.g. EMP-100234"
                        value={formEmpNo}
                        onChange={(e) => setFormEmpNo(e.target.value)}
                        className={`field-input ${errors.empNo ? "field-input-invalid" : ""}`}
                        style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%", fontSize: "13px" }}
                      />
                      {errors.empNo && <span className="field-error-text" style={{ fontSize: "11px", color: "#ef4444" }}>{errors.empNo}</span>}
                    </div>
                    <div className="form-field-group">
                      <label htmlFor="nicNo" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px" }}>
                        NIC No <span className="required-star">*</span>
                      </label>
                      <input
                        id="nicNo"
                        type="text"
                        placeholder="e.g. 198512345678"
                        value={formNic}
                        onChange={(e) => setFormNic(e.target.value)}
                        className={`field-input ${errors.nic ? "field-input-invalid" : ""}`}
                        style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%", fontSize: "13px" }}
                      />
                      {errors.nic && <span className="field-error-text" style={{ fontSize: "11px", color: "#ef4444" }}>{errors.nic}</span>}
                    </div>
                  </div>

                  {/* Role / Position & Status - 2 columns */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div className="form-field-group">
                      <label htmlFor="officerRoleSelect" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px" }}>
                        Role / Position <span className="required-star">*</span>
                      </label>
                      <select
                        id="officerRoleSelect"
                        value={formOfficerRole}
                        onChange={(e) => setFormOfficerRole(e.target.value as "Chairman" | "Member")}
                        className="field-select"
                        style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%", backgroundColor: "#ffffff", fontSize: "13px", fontWeight: 600 }}
                      >
                        <option value="Chairman">Chairman</option>
                        <option value="Member">Member</option>
                      </select>
                    </div>
                    <div className="form-field-group">
                      <label htmlFor="status" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px" }}>{t("status", "Account Status")}</label>
                      <select
                        id="status"
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as "Active" | "Inactive")}
                        className="field-select"
                        style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%", backgroundColor: "#ffffff", fontSize: "13px" }}
                      >
                        <option value="Active">{t("active", "Active")}</option>
                        <option value="Inactive">{t("inactive", "Inactive")}</option>
                      </select>
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="form-field-group">
                    <label htmlFor="email" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px" }}>
                      {t("emailAddress", "Email Address")} <span className="required-star">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="ranjith@moe.gov.lk"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className={`field-input ${errors.email ? "field-input-invalid" : ""}`}
                      style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%", fontSize: "13px" }}
                    />
                    {errors.email && <span className="field-error-text" style={{ fontSize: "11px", color: "#ef4444" }}>{errors.email}</span>}
                  </div>

                </div>

                {/* RIGHT COLUMN: School Background */}
                <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                    <GraduationCap size={15} style={{ color: "#0284c7" }} />
                    2. School Background
                  </h4>

                  {/* Studied Schools */}
                  <div className="form-field-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px", margin: 0 }}>
                        Studied Schools
                      </label>
                      <span style={{ fontSize: "10px", color: "#0284c7", fontWeight: 700, backgroundColor: "#e0f2fe", padding: "1px 6px", borderRadius: "8px" }}>
                        {formStudiedSchools.length} added
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="text"
                        placeholder="School name & Enter..."
                        value={newStudiedInput}
                        onChange={(e) => setNewStudiedInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddStudiedSchool();
                          }
                        }}
                        className="field-input"
                        style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: 1, fontSize: "12px" }}
                      />
                      <button type="button" onClick={handleAddStudiedSchool} style={{ padding: "7px 12px", borderRadius: "6px", backgroundColor: "#0284c7", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: "12px" }}>
                        + Add
                      </button>
                    </div>
                    {formStudiedSchools.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", backgroundColor: "#f8fafc", padding: "6px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", marginTop: "6px", maxHeight: "54px", overflowY: "auto" }}>
                        {formStudiedSchools.map((s, idx) => (
                          <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>
                            {s}
                            <button type="button" onClick={() => handleRemoveStudiedSchool(idx)} title="Remove" style={{ background: "none", border: "none", color: "#0369a1", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginTop: "3px", fontStyle: "italic" }}>No schools added yet.</span>
                    )}
                  </div>

                  {/* Children's Schools */}
                  <div className="form-field-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px", margin: 0 }}>
                        Children&apos;s Schools
                      </label>
                      <span style={{ fontSize: "10px", color: "#d97706", fontWeight: 700, backgroundColor: "#fef3c7", padding: "1px 6px", borderRadius: "8px" }}>
                        {formChildrenSchools.length} added
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="text"
                        placeholder="School name & Enter..."
                        value={newChildrenInput}
                        onChange={(e) => setNewChildrenInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddChildrenSchool();
                          }
                        }}
                        className="field-input"
                        style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: 1, fontSize: "12px" }}
                      />
                      <button type="button" onClick={handleAddChildrenSchool} style={{ padding: "7px 12px", borderRadius: "6px", backgroundColor: "#d97706", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: "12px" }}>
                        + Add
                      </button>
                    </div>
                    {formChildrenSchools.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", backgroundColor: "#f8fafc", padding: "6px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", marginTop: "6px", maxHeight: "54px", overflowY: "auto" }}>
                        {formChildrenSchools.map((s, idx) => (
                          <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>
                            {s}
                            <button type="button" onClick={() => handleRemoveChildrenSchool(idx)} title="Remove" style={{ background: "none", border: "none", color: "#b45309", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginTop: "3px", fontStyle: "italic" }}>No schools added yet.</span>
                    )}
                  </div>

                </div>

              </div>

              {/* Modal Footer Buttons */}
              <footer style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "8px 18px", borderRadius: "6px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "13px" }}
                >
                  {t("cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{ padding: "8px 24px", borderRadius: "6px", backgroundColor: "#4f46e5", color: "#ffffff", border: "none", fontWeight: 600, fontSize: "13px", boxShadow: "0 2px 4px rgba(79,70,229,0.2)" }}
                >
                  {isSaving ? t("saving", "Saving...") : (isEditMode ? "Update Officer" : t("createAccount", "Save Officer"))}
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
