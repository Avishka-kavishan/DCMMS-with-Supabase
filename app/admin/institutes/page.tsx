"use client";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import { Search, Plus, X, Edit, Trash2, Check } from "lucide-react";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { getInstitutesServer, saveInstituteServer, deleteInstituteServer } from "@/lib/db-actions";

interface Institute {
  id: string;
  name: string;
  code?: string;
  address: string;
  province: string;
  regionProvince?: string;
  district: string;
  zone: string;
  status: "Active" | "Inactive";
  createdAt: string;
}

interface LocationStructure {
  [province: string]: {
    [district: string]: string[];
  };
}

const LOCATION_DATA: LocationStructure = {
  Western: {
    Colombo: ["Colombo", "Homagama", "Piliyandala", "Sri Jayewardenepura"],
    Gampaha: ["Gampaha", "Minuwangoda", "Negombo", "Kelaniya"],
    Kalutara: ["Kalutara", "Horana", "Mathugama"],
  },
  Central: {
    Kandy: ["Kandy", "Katugastota", "Denuwara", "Teldeniya", "Wattegama", "Gampola"],
    Matale: ["Matale", "Galewela", "Naula", "Wilgamuwa"],
    "Nuwara Eliya": ["Nuwara Eliya", "Hatton", "Walapane", "Hanguranketha"],
  },
  Southern: {
    Galle: ["Galle", "Elpitiya", "Udugama"],
    Matara: ["Matara", "Akuressa", "Mulatiyana"],
    Hambantota: ["Hambantota", "Tangalle", "Walasmulla"],
  },
  Northern: {
    Jaffna: ["Jaffna", "Islands", "Thenmaradchy", "Vadamaradchy"],
    Kilinochchi: ["Kilinochchi"],
    Mannar: ["Mannar", "Madhu"],
    Mullaitivu: ["Mullaitivu", "Thunukkai"],
    Vavuniya: ["Vavuniya South", "Vavuniya North"],
  },
  Eastern: {
    Batticaloa: ["Batticaloa", "Batticaloa Central", "Batticaloa West", "Kalkudah", "Paddiruppu"],
    Ampara: ["Ampara", "Kalmunai", "Sammanthurai", "Mahaoya", "Dehiattakandiya"],
    Trincomalee: ["Trincomalee", "Trincomalee Town", "Kantale", "Kinniya", "Muttur"],
  },
  "North Western": {
    Kurunegala: ["Kurunegala", "Ibbagamuwa", "Kuliyapitiya", "Giriulla", "Maho", "Nikaweratiya"],
    Puttalam: ["Puttalam", "Chilaw"],
  },
  "North Central": {
    Anuradhapura: ["Anuradhapura", "Kekirawa", "Galenbindunuwewa", "Tambuttegama", "Kebithigollewa"],
    Polonnaruwa: ["Polonnaruwa", "Dimbulagala", "Hingurakgoda"],
  },
  Uva: {
    Badulla: ["Badulla", "Bandarawela", "Mahiyanganaya", "Welimada", "Passara"],
    Monaragala: ["Monaragala", "Wellawaya", "Bibile"],
  },
  Sabaragamuwa: {
    Ratnapura: ["Ratnapura", "Balangoda", "Nivithigala", "Embilipitiya"],
    Kegalle: ["Kegalle", "Mawanella", "Dehiowita"],
  },
};

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
  const [formAddress, setFormAddress] = useState("");
  const [formProvince, setFormProvince] = useState("Western");
  const [formDistrict, setFormDistrict] = useState("Colombo");
  const [formZone, setFormZone] = useState("Colombo");
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");

  // Error states
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic dropdown options
  const districtsForSelectedProvince = formProvince && LOCATION_DATA[formProvince]
    ? Object.keys(LOCATION_DATA[formProvince])
    : [];

  const zonesForSelectedDistrict = formProvince && formDistrict && LOCATION_DATA[formProvince]?.[formDistrict]
    ? LOCATION_DATA[formProvince][formDistrict]
    : [];

  // Dropdown change handlers
  const handleProvinceChange = (newProvince: string) => {
    setFormProvince(newProvince);
    const districts = LOCATION_DATA[newProvince] ? Object.keys(LOCATION_DATA[newProvince]) : [];
    const defaultDistrict = districts[0] || "";
    setFormDistrict(defaultDistrict);
    const zones = defaultDistrict && LOCATION_DATA[newProvince]?.[defaultDistrict]
      ? LOCATION_DATA[newProvince][defaultDistrict]
      : [];
    setFormZone(zones[0] || "");
  };

  const handleDistrictChange = (newDistrict: string) => {
    setFormDistrict(newDistrict);
    const zones = formProvince && LOCATION_DATA[formProvince]?.[newDistrict]
      ? LOCATION_DATA[formProvince][newDistrict]
      : [];
    setFormZone(zones[0] || "");
  };

  // Show Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Fetch Institutes list
  const fetchInstitutes = async () => {
    let dbInstitutes: Institute[] = [];

    // 1. Load from PostgreSQL institute_table
    try {
      const res = await getInstitutesServer();
      if (res && res.success && Array.isArray(res.data)) {
        dbInstitutes = res.data.map((item: any) => ({
          id: String(item.id),
          name: item.name || item.institute_name || "",
          code: "",
          address: item.address || "",
          province: item.province || "Western",
          regionProvince: item.province || "Western",
          district: item.district || "Colombo",
          zone: item.zone || "Colombo",
          status: "Active",
          createdAt: item.created_at ? new Date(item.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        }));
      }
    } catch (err) {
      console.error("Error loading institutes from PostgreSQL database:", err);
    }

    // 2. Load from Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("dcmms_institutes")
          .select("*");

        if (!error && data) {
          const supabaseInsts = data.map((item: any) => ({
            id: String(item.id),
            name: item.name,
            code: item.code || "",
            address: item.address || "",
            province: item.province || item.region_province || item.regionProvince || "Western",
            regionProvince: item.province || item.region_province || item.regionProvince || "Western",
            district: item.district || "Colombo",
            zone: item.zone || "Colombo",
            status: item.status === "inactive" ? ("Inactive" as const) : ("Active" as const),
            createdAt: item.created_at || new Date().toISOString().split("T")[0],
          }));
          dbInstitutes = [...dbInstitutes, ...supabaseInsts];
        }
      } catch (err) {
        console.error("Error loading institutes from Supabase:", err);
      }
    }

    // 3. Load custom institutes from localStorage
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
        name: "Zonal Education Office - Kandy",
        code: "ZONE-KD",
        address: "William Gopallawa Mawatha, Kandy",
        province: "Central",
        regionProvince: "Central",
        district: "Kandy",
        zone: "Kandy",
        status: "Active",
        createdAt: "2026-01-01"
      },
      {
        id: "default-inst-2",
        name: "Royal College",
        code: "RC-COL",
        address: "Rajakeeya Mawatha, Colombo 07",
        province: "Western",
        regionProvince: "Western",
        district: "Colombo",
        zone: "Colombo",
        status: "Active",
        createdAt: "2026-01-10"
      },
      {
        id: "default-inst-3",
        name: "Zonal Education Office, Jaffna",
        code: "ZONE-JA",
        address: "Main Street, Jaffna",
        province: "Northern",
        regionProvince: "Northern",
        district: "Jaffna",
        zone: "Jaffna",
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

    const interval = setInterval(fetchInstitutes, 15000);


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
    if (!formAddress.trim()) {
      newErrors.address = t("pleaseFillAllFields", "Please fill out all fields.");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Open Modal Helpers
  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormName("");
    setFormAddress("");
    setFormProvince("Western");
    setFormDistrict("Colombo");
    setFormZone("Colombo");
    setFormStatus("Active");
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (inst: Institute) => {
    setIsEditMode(true);
    setEditingId(inst.id);
    setFormName(inst.name || "");
    setFormAddress(inst.address || "");
    const prov = inst.province || inst.regionProvince || "Western";
    setFormProvince(prov);
    const validDistricts = LOCATION_DATA[prov] ? Object.keys(LOCATION_DATA[prov]) : [];
    const dist = inst.district && validDistricts.includes(inst.district) ? inst.district : (validDistricts[0] || "");
    setFormDistrict(dist);
    const validZones = dist && LOCATION_DATA[prov]?.[dist] ? LOCATION_DATA[prov][dist] : [];
    const z = inst.zone && validZones.includes(inst.zone) ? inst.zone : (validZones[0] || "");
    setFormZone(z);
    setFormStatus(inst.status || "Active");
    setErrors({});
    setIsModalOpen(true);
  };

  // Save Form Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // 1. Save directly into PostgreSQL institute_table database
    try {
      const dbRes = await saveInstituteServer({
        id: isEditMode && editingId ? editingId : undefined,
        name: formName.trim(),
        institute_name: formName.trim(),
        address: formAddress.trim(),
        province: formProvince,
        district: formDistrict,
        zone: formZone,
        status: formStatus,
      });

      if (!dbRes.success) {
        console.error("Database save failed:", dbRes.error);
      }
    } catch (dbErr) {
      console.error("Error saving institute to PostgreSQL institute_table:", dbErr);
    }

    const savedInst: Institute = {
      id: isEditMode && editingId ? editingId : `inst-${Date.now()}`,
      name: formName.trim(),
      address: formAddress.trim(),
      province: formProvince,
      regionProvince: formProvince,
      district: formDistrict,
      zone: formZone,
      status: formStatus,
      createdAt: isEditMode && editingId
        ? institutes.find(o => o.id === editingId)?.createdAt || new Date().toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    };

    // Save custom institutes in localStorage fallback
    if (typeof window !== "undefined") {
      let list = institutes.filter(o => o.id !== savedInst.id);
      list.push(savedInst);
      const onlyCustom = list.filter(o => o.id.startsWith("inst-"));
      localStorage.setItem("dcmms_institutes", JSON.stringify(onlyCustom));
    }

    // Try Supabase fallback upsert if configured
    if (isSupabaseConfigured) {
      try {
        await supabase.from("dcmms_institutes").upsert({
          id: savedInst.id.startsWith("inst-") || savedInst.id.startsWith("default-") ? undefined : savedInst.id,
          name: savedInst.name,
          address: savedInst.address,
          province: savedInst.province,
          region_province: savedInst.province,
          district: savedInst.district,
          zone: savedInst.zone,
          status: savedInst.status.toLowerCase(),
        });

        await logAuditEvent(
          isEditMode ? "UPDATE_INSTITUTE" : "ADD_INSTITUTE",
          "dcmms_institutes",
          savedInst.id,
          { name: savedInst.name, province: savedInst.province, district: savedInst.district, zone: savedInst.zone }
        );
      } catch (err) {
        console.warn("Could not upsert to Supabase.", err);
      }
    }

    showToast(isEditMode ? "Institute updated successfully!" : t("instituteAddedSuccess", "Institute added successfully!"));
    setIsModalOpen(false);
    fetchInstitutes();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("dcmms_data_updated"));
  };

  // Delete Handler
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this institute?")) return;

    // Delete from PostgreSQL institute_table database
    try {
      await deleteInstituteServer(id);
    } catch (e) {
      console.error("Error deleting from institute_table:", e);
    }

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
    (o.name && o.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (o.address && o.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (o.province && o.province.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (o.district && o.district.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (o.zone && o.zone.toLowerCase().includes(searchQuery.toLowerCase()))
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
                <th scope="col">{t("instituteName", "Institute Name")}</th>
                <th scope="col">{t("address", "Address")}</th>
                <th scope="col">{t("province", "Province")}</th>
                <th scope="col">{t("district", "District")}</th>
                <th scope="col">{t("zone", "Zone")}</th>
                <th scope="col">{t("accountStatus", "Account Status")}</th>
                <th scope="col" className="admin-table-header-center">{t("actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstitutes.length > 0 ? (
                filteredInstitutes.map((item) => (
                  <tr key={item.id} className="letter-table-row">
                    <td className="admin-table-case-no font-semibold">{item.name}</td>
                    <td>{item.address || "N/A"}</td>
                    <td>{item.province || item.regionProvince || "N/A"}</td>
                    <td>{item.district || "N/A"}</td>
                    <td>{item.zone || "N/A"}</td>
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
                  <td colSpan={7} className="admin-table-no-data table-no-data-padding">
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
                {/* 1. Institute name - text */}
                <div className="form-field-group">
                  <label htmlFor="instituteName" className="field-label">
                    {t("instituteName", "Institute Name")} <span className="required-star">*</span>
                  </label>
                  <input
                    id="instituteName"
                    type="text"
                    placeholder={t("placeholderInstNameExample", "e.g. Royal College, Colombo 07")}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={`field-input ${errors.name ? "field-input-invalid" : ""}`}
                  />
                  {errors.name && <span className="field-error-text">{errors.name}</span>}
                </div>

                {/* 2. Address - text */}
                <div className="form-field-group">
                  <label htmlFor="instituteAddress" className="field-label">
                    {t("address", "Address")} <span className="required-star">*</span>
                  </label>
                  <input
                    id="instituteAddress"
                    type="text"
                    placeholder={t("placeholderAddressExample", "e.g. Rajakeeya Mawatha, Colombo 07")}
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className={`field-input ${errors.address ? "field-input-invalid" : ""}`}
                  />
                  {errors.address && <span className="field-error-text">{errors.address}</span>}
                </div>

                {/* 3. Province - dropdown */}
                <div className="form-field-group">
                  <label htmlFor="instituteProvince" className="field-label">
                    {t("province", "Province")} <span className="required-star">*</span>
                  </label>
                  <select
                    id="instituteProvince"
                    value={formProvince}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                    className="field-select"
                  >
                    {Object.keys(LOCATION_DATA).map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. District - dropdown */}
                <div className="form-field-group">
                  <label htmlFor="instituteDistrict" className="field-label">
                    {t("district", "District")} <span className="required-star">*</span>
                  </label>
                  <select
                    id="instituteDistrict"
                    value={formDistrict}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="field-select"
                  >
                    {districtsForSelectedProvince.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Zone - dropdown */}
                <div className="form-field-group">
                  <label htmlFor="instituteZone" className="field-label">
                    {t("zone", "Zone")} <span className="required-star">*</span>
                  </label>
                  <select
                    id="instituteZone"
                    value={formZone}
                    onChange={(e) => setFormZone(e.target.value)}
                    className="field-select"
                  >
                    {zonesForSelectedDistrict.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status - dropdown */}
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
