"use client";

import "../../../i18n";
import "../daily-mail.css";
import "./register.css";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { getCurrentProfile } from "@/lib/auth";
import { saveDailyMailRecordServer, saveDailyMailToNewTableServer, logAuditEventServer, getSubjectOfficersServer, getInstitutesServer, getDailyMailRecordsServer } from "@/lib/db-actions";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const mapRegionProvince = (val?: string): "province" | "region" | null => {
  if (!val) return null;
  const lower = val.toLowerCase().trim();
  if (lower === "province" || lower === "region") return lower as any;
  if (
    lower.includes("province") ||
    lower.includes("western") ||
    lower.includes("central") ||
    lower.includes("southern") ||
    lower.includes("northern") ||
    lower.includes("eastern") ||
    lower.includes("uva") ||
    lower.includes("sabaragamuwa")
  ) {
    return "province";
  }
  if (lower.includes("region") || lower.includes("zone")) return "region";
  return "province";
};


function RegisterComplaintForm() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const receiptModes = [
    { value: "Post", labelKey: "receiptPost" },
    { value: "Hand", labelKey: "receiptHand" },
    { value: "Email", labelKey: "receiptEmail" },
    { value: "Fax", labelKey: "receiptFax" },
    { value: "Other", labelKey: "receiptOther" }
  ];

  const letterNatures = [
    { value: "Complaint", labelKey: "natureComplaint" },
    { value: "Inquiry", labelKey: "natureInquiry" },
    { value: "Appeal", labelKey: "natureAppeal" },
    { value: "Request", labelKey: "natureRequest" },
    { value: "Notification", labelKey: "natureNotification" },
    { value: "Other", labelKey: "natureOther" }
  ];

  const letterClassifications = [
    { value: "Anonymous/Nominal", labelKey: "classAnonymousNominal" },
    { value: "Public Service Commission", labelKey: "classPublicService" },
    { value: "Education Service Committee", labelKey: "classEdServices" },
    { value: "Ministry of Public Administration", labelKey: "classMinistryPublicAdmin" },
    { value: "Internal Branches", labelKey: "classHomeAffairs" },
    { value: "Presidential Secretariat", labelKey: "classPresidentsSec" },
    { value: "Ministry Minister/Secretary", labelKey: "classMinistryMinisterSec" },
    { value: "Police Stations", labelKey: "classPolice" },
    { value: "By Principals", labelKey: "classByPrincipals" },
    { value: "By Zonal Offices", labelKey: "classByRegionalOffices" },
    { value: "Bribery Commission", labelKey: "classBriberyCorruption" },
    { value: "Human Rights", labelKey: "classHumanRights" },
    { value: "Old Boys Association", labelKey: "classOldStudentsAssoc" },
    { value: "Provincial Departments/Ministries", labelKey: "classProvincialDept" }
  ];

  // Accessibility & language state
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubsequentMode, setIsSubsequentMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [currentCaseDetails, setCurrentCaseDetails] = useState<{
    letterNo: string;
    officerName: string;
    refNo: string;
    priority: string;
    receivedDate: string;
    letterType: string;
  } | null>(null);
  const [subjectActions, setSubjectActions] = useState<any[]>([]);
  const [previousLetters, setPreviousLetters] = useState<any[]>([]);

  const [initialOfficerName, setInitialOfficerName] = useState<string>("");
  const [officerOptions, setOfficerOptions] = useState<string[]>([]);
  const [officerSearchQuery, setOfficerSearchQuery] = useState("");
  const [isOfficerDropdownOpen, setIsOfficerDropdownOpen] = useState(false);
  const officerDropdownRef = useRef<HTMLDivElement>(null);

  // Close officer searchable dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (officerDropdownRef.current && !officerDropdownRef.current.contains(event.target as Node)) {
        setIsOfficerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [instituteOptions, setInstituteOptions] = useState<string[]>([
    "Zonal Office - Kandy",
    "Royal College, Colombo 07",
    "Zonal Education Office, Jaffna",
  ]);

  // Mobile sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Form State
  const [formState, setFormState] = useState({
    id: "",
    letterNo: "",
    senderName: "",
    letterType: "",
    officerName: "",
    subjectCategory: "", // Prefilled selector
    instituteName: "",
    refNo: "",
    letterDate: "",
    subject: "", // maps to Letter Title
    regionProvince: "",
    receivedDate: "",
    priority: "medium" as "high" | "medium" | "low",
    status: "registered" as "registered" | "assigned" | "pending",
    isAnswerLetter: false as boolean | string,
    documentUrl: "",
    documentName: "",
  });

  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const isOfficerLocked = Boolean(isEditMode || initialOfficerName);

  // Sync document properties
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${isEditMode ? t("editLetterTitle", "Edit Letter") : isSubsequentMode ? t("registerLetterForCurrentComplaintTitle", "Register New Letter for Current Complaint") : t("registerComplaintTitle")} | DCMMS`;
  }, [lang, t, isEditMode, isSubsequentMode]);

  // Load subject officers and institutes on mount
  useEffect(() => {
    const loadOfficers = async () => {
      const namesSet = new Set<string>();

      // 1. Load from PostgreSQL via Prisma Server Action (register_officer_table filtered by subject officer role)
      try {
        const res = await getSubjectOfficersServer();
        if (res.success && res.data && res.data.length > 0) {
          res.data.forEach((name: string) => {
            if (name && name.trim()) namesSet.add(name.trim());
          });
        }
      } catch (e) {
        console.error("Failed to load subject officers from PostgreSQL", e);
      }

      // 2. Load from Supabase profiles (role = subject_officer)
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("dcmms_profiles")
            .select("full_name")
            .ilike("role", "%subject%");
          if (!error && data) {
            data.forEach((d: any) => {
              if (d.full_name) namesSet.add(d.full_name);
            });
          }
        } catch (e) {
          console.error("Failed to load subject officers from Supabase", e);
        }

        // Also fetch from dcmms_subject_assignments
        try {
          const { data, error } = await supabase
            .from("dcmms_subject_assignments")
            .select("subject_officer_name");
          if (!error && data) {
            data.forEach((d: any) => {
              if (d.subject_officer_name) namesSet.add(d.subject_officer_name);
            });
          }
        } catch (e) {}
      }

      // 3. Load from localStorage custom profiles (role = subject_officer)
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("dcmms_custom_profiles");
        if (stored) {
          try {
            const list = JSON.parse(stored);
            list
              .filter((p: any) => !p.role || p.role.toLowerCase().includes("subject"))
              .forEach((p: any) => {
                if (p.fullName) namesSet.add(p.fullName);
              });
          } catch (e) {
            console.error("Failed to load custom profiles from localStorage", e);
          }
        }

        // Also load from localStorage subject assignments
        const storedAsgns = localStorage.getItem("dcmms_subject_assignments");
        if (storedAsgns) {
          try {
            const list = JSON.parse(storedAsgns);
            if (Array.isArray(list)) {
              list.forEach((a: any) => {
                if (a.subjectOfficerName) namesSet.add(a.subjectOfficerName);
              });
            }
          } catch (e) {}
        }
      }

      setOfficerOptions(Array.from(namesSet));
    };

    const loadInstitutes = async () => {
      const namesSet = new Set<string>([
        "Zonal Office - Kandy",
        "Royal College, Colombo 07",
        "Zonal Education Office, Jaffna",
      ]);

      // 1. Load from PostgreSQL institute_table
      try {
        const res = await getInstitutesServer();
        if (res && res.success && Array.isArray(res.data)) {
          res.data.forEach((inst: any) => {
            const name = inst.name || inst.institute_name;
            if (name) namesSet.add(name);
          });
        }
      } catch (e) {
        console.error("Failed to load institutes from institute_table", e);
      }

      // 2. Load from Supabase
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("dcmms_institutes")
            .select("name");
          if (!error && data) {
            data.forEach((d: any) => {
              if (d.name) namesSet.add(d.name);
            });
          }
        } catch (e) {
          console.error("Failed to load institutes from Supabase", e);
        }
      }

      // 3. Load from localStorage custom institutes
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("dcmms_institutes");
        if (stored) {
          try {
            const list = JSON.parse(stored);
            list.forEach((inst: any) => {
              if (inst.name) namesSet.add(inst.name);
            });
          } catch (e) {
            console.error("Failed to load custom institutes from localStorage", e);
          }
        }
      }

      setInstituteOptions(Array.from(namesSet));
    };

    loadOfficers();
    loadInstitutes();
  }, []);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
  };

  useEffect(() => {
    const id = searchParams.get("id");
    const caseNo = searchParams.get("caseNo");
    const subsequent = searchParams.get("subsequent") === "true";

    // Auto-calculate next letterNo (අනු අංකය) starting from 1 if this is a new letter/entry (not edit mode)
    if (!id) {
      const calculateNextLetterNo = async () => {
        let maxNo = 0;
        if (isSupabaseConfigured) {
          try {
            const { data, error } = await supabase
              .from("dcmms_daily_mail")
              .select("letter_no");
            if (!error && data) {
              data.forEach((d: any) => {
                if (d.letter_no) {
                  const match = String(d.letter_no).match(/\d+/);
                  const no = match ? parseInt(match[0], 10) : 0;
                  if (no > maxNo) maxNo = no;
                }
              });
            }
          } catch (e) {
            console.error("Failed to fetch letter numbers from Supabase", e);
          }
        }

        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("dcmms_letters");
          if (stored) {
            try {
              const list = JSON.parse(stored);
              list.forEach((item: any) => {
                const letterVal = item.letterNo || item.letter_no;
                if (letterVal) {
                  const match = String(letterVal).match(/\d+/);
                  const no = match ? parseInt(match[0], 10) : 0;
                  if (no > maxNo) maxNo = no;
                }
              });
            } catch (e) {
              console.error("Failed to parse local letters", e);
            }
          }
        }

        setFormState((prev) => ({
          ...prev,
          letterNo: (maxNo + 1).toString(),
        }));
      };

      calculateNextLetterNo();
    }

    if (subsequent && caseNo) {
      setIsSubsequentMode(true);
      setFormState((prev) => ({
        ...prev,
        refNo: caseNo,
      }));

      const fetchCurrentCase = async () => {
        let currentOfficerName = "";

        if (isSupabaseConfigured) {
          try {
            const { data, error } = await supabase
              .from("dcmms_daily_mail")
              .select("*")
              .eq("ref_no", caseNo)
              .order("created_at", { ascending: true });

            if (!error && data && data.length > 0) {
              const originalMail = data[0];
              currentOfficerName = originalMail.officer_name || originalMail.officerName || "";
              setCurrentCaseDetails({
                letterNo: originalMail.letter_no || "—",
                officerName: currentOfficerName || "—",
                refNo: originalMail.ref_no || "—",
                priority: originalMail.priority || "medium",
                receivedDate: originalMail.received_date || "—",
                letterType: originalMail.letter_type || "—",
              });
              if (currentOfficerName && currentOfficerName !== "—") {
                setFormState((prev) => ({ ...prev, officerName: currentOfficerName }));
              }
            }
          } catch (e) {
            console.error("Failed to load current case details from Supabase", e);
          }

          // Fetch subject officer actions (dcmms_subject_details)
          try {
            const { data: actionsData, error: actionsError } = await supabase
              .from("dcmms_subject_details")
              .select("*")
              .eq("case_no", caseNo)
              .order("received_date", { ascending: false });

            if (!actionsError && actionsData) {
              setSubjectActions(actionsData.map((d: any) => ({
                id: d.id,
                caseNo: d.case_no,
                receivedDate: d.received_date,
                reportState: d.report_state,
                specialNotes: d.special_notes,
                subjectOfficerName: d.subject_officer_name,
                stepTaken: d.step_taken,
              })));
            }
          } catch (e) {
            console.error("Failed to fetch subject actions from Supabase", e);
          }

          // Fetch previous subsequent mails (dcmms_subsequent_mails)
          try {
            const { data: mailsData, error: mailsError } = await supabase
              .from("dcmms_subsequent_mails")
              .select("*")
              .eq("case_no", caseNo);

            if (!mailsError && mailsData) {
              setPreviousLetters(mailsData.map((d: any) => ({
                id: d.id,
                caseNo: d.case_no,
                officerName: d.mail_officer_name,
                senderName: d.sender_name,
                subject: d.letter_title,
                letterType: d.letter_type,
                letterDate: d.mail_date,
                receivedDate: d.received_date,
                isAnswerLetter: d.is_answer_letter,
              })));
            }
          } catch (e) {
            console.error("Failed to fetch subsequent mails from Supabase", e);
          }

          return;
        }

        // Fallback to localStorage
        if (typeof window !== "undefined") {
          try {
            const stored = localStorage.getItem("dcmms_letters");
            if (stored) {
              const list = JSON.parse(stored);
              const matchingMails = list.filter((item: any) => item.refNo === caseNo);
              if (matchingMails.length > 0) {
                const originalMail = matchingMails[matchingMails.length - 1];
                currentOfficerName = originalMail.officerName || originalMail.officer_name || "";
                setCurrentCaseDetails({
                  letterNo: originalMail.letterNo || "—",
                  officerName: currentOfficerName || "—",
                  refNo: originalMail.refNo || "—",
                  priority: originalMail.priority || "medium",
                  receivedDate: originalMail.receivedDate || "—",
                  letterType: originalMail.letterType || "—",
                });
                if (currentOfficerName && currentOfficerName !== "—") {
                  setFormState((prev) => ({ ...prev, officerName: currentOfficerName }));
                }
              }
            }
          } catch (e) {
            console.error("Failed to parse local storage letters", e);
          }

          // Local storage fallback for subject actions
          const storedActions = localStorage.getItem("dcmms_new_letter_current_case");
          if (storedActions) {
            try {
              const actionsList = JSON.parse(storedActions);
              if (Array.isArray(actionsList)) {
                const found = actionsList.filter((a: any) => a.caseNo === caseNo);
                setSubjectActions(found);
              }
            } catch (e) {
              console.error("Failed to parse local storage actions", e);
            }
          }

          // Local storage fallback for previous letters
          const storedMails = localStorage.getItem("dcmms_new_mail_current_case");
          if (storedMails) {
            try {
              const mailsList = JSON.parse(storedMails);
              if (Array.isArray(mailsList)) {
                const found = mailsList.filter((m: any) => m.caseNo === caseNo);
                setPreviousLetters(found.map((m: any) => ({
                  id: m.id,
                  caseNo: m.caseNo,
                  officerName: m.mailOfficerName || m.officerName,
                  senderName: m.senderName,
                  subject: m.letterTitle || m.subject,
                  letterType: m.letterType,
                  letterDate: m.mailDate || m.letterDate,
                  receivedDate: m.receivedDate,
                  isAnswerLetter: m.isAnswerLetter,
                })));
              }
            } catch (e) {
              console.error("Failed to parse local storage subsequent mails", e);
            }
          }
        }
      };

      fetchCurrentCase();
      return;
    }

    if (!id) return;

    const loadLetter = async () => {
      setIsEditMode(true);

      const formatFormDate = (d?: any) => {
        if (!d) return "";
        try {
          const parsed = new Date(d);
          if (isNaN(parsed.getTime())) return String(d);
          return parsed.toISOString().split("T")[0];
        } catch (e) {
          return String(d);
        }
      };

      const populateForm = (found: any) => {
        const priorityVal = found.priority ? String(found.priority).toLowerCase() : "medium";
        const validPriority = priorityVal.includes("high") ? "high" : priorityVal.includes("low") ? "low" : "medium";
        const loadedOfficer = found.action_officer || found.officer_name || found.officerName || "";
        if (loadedOfficer) {
          setInitialOfficerName(loadedOfficer);
        }

        setFormState({
          id: String(found.id || id),
          letterNo: found.letter_no || found.letterNo || found.letter_number || "",
          senderName: found.sender || found.sender_name || found.senderName || found.senders_party || found.sender_party || "",
          letterType: found.method || found.mode_of_receipt || found.type || found.letterType || found.nature_of_letter || "",
          officerName: loadedOfficer,
          subjectCategory: found.classification || found.subject_category || found.subjectCategory || "Other",
          instituteName: found.institute_name || found.instituteName || "",
          refNo: found.serial_no || found.ref_no || found.refNo || found.ref_number || found.received_letter_number || "",
          letterDate: formatFormDate(found.submitted_date || found.date_letter_handover_discipline || found.letter_date || found.letterDate),
          subject: found.subject || found.subject_of_letter || "",
          regionProvince: found.type || found.nature_of_letter || found.region_province || found.regionProvince || "",
          receivedDate: formatFormDate(found.received_date || found.date_received_by_add_secretary || found.receivedDate),
          priority: validPriority as any,
          status: found.status || "registered",
          isAnswerLetter: found.is_answer_letter === true || String(found.is_answer_letter) === "true",
          documentUrl: found.document_url || found.documentUrl || "",
          documentName: found.document_name || found.documentName || "",
        });
      };

      // 1. Try PostgreSQL via Server Action (handles daily_mail_letter_table, daily_mail, & dcmms_daily_mail)
      try {
        const res = await getDailyMailRecordsServer();
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const match = res.data.find(
            (item: any) =>
              String(item.id) === String(id) ||
              String(item.serial_no) === String(id) ||
              String(item.letter_no) === String(id) ||
              String(item.refNo) === String(id) ||
              String(item.letterNo) === String(id)
          );
          if (match) {
            populateForm(match);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to load letter from PostgreSQL server action:", e);
      }

      // 2. Try Supabase
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("dcmms_daily_mail")
            .select("*")
            .or(`id.eq.${id},ref_no.eq.${id},letter_no.eq.${id}`);

          if (!error && data && data.length > 0) {
            populateForm(data[0]);
            return;
          }
        } catch (err) {
          console.error("Failed to load letter for edit from Supabase:", err);
        }
      }

      // 3. Fallback to localStorage
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("dcmms_letters");
        if (stored) {
          try {
            const list = JSON.parse(stored);
            const found = list.find(
              (item: any) =>
                String(item.id) === String(id) ||
                String(item.refNo) === String(id) ||
                String(item.letterNo) === String(id) ||
                String(item.serial_no) === String(id)
            );
            if (found) {
              populateForm(found);
              return;
            }
          } catch (err) {
            console.error("Failed to parse stored letters for edit:", err);
          }
        }
      }
    };

    loadLetter();
  }, [searchParams]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enforce required fields validation
    if (!formState.refNo) {
      alert(
        lang === "si"
          ? "කරුණාකර යොමු අංකය ඇතුළත් කරන්න."
          : lang === "ta"
          ? "தயவுசெய்து குறிப்பு எண்ணை உள்ளிடவும்."
          : "Please fill in the Reference Number."
      );
      return;
    }

    if (!formState.subject || !formState.subject.trim()) {
      alert(
        lang === "si"
          ? "කරුණාකර ලිපියේ විෂය / කරුණ ඇතුළත් කරන්න."
          : lang === "ta"
          ? "தயவுசெய்து கடிதத்தின் விடயத்தை உள்ளிடவும்."
          : "Please fill in the Subject / Matter of the letter."
      );
      return;
    }

    if (!formState.receivedDate) {
      alert(
        lang === "si"
          ? "කරුණාකර අතිරේක ලේකම් වෙත ලැබුණු දිනය ඇතුළත් කරන්න."
          : lang === "ta"
          ? "தயவுசெய்து மேலதிக செயலாளரால் பெறப்பட்ட திகதியை உள்ளிடவும்."
          : "Please select the Date received by additional secretary."
      );
      return;
    }

    if (!formState.letterDate) {
      alert(
        lang === "si"
          ? "කරුණාකර විනය ශාඛාවට භාරදුන් දිනය ඇතුළත් කරන්න."
          : lang === "ta"
          ? "தயவுசெய்து ஒழுக்காற்றுப் பிரிவிடம் ஒப்படைக்கப்பட்ட திகதியை உள்ளிடவும்."
          : "Please select the Date letter handed over to disciplinary branch."
      );
      return;
    }

    if (!formState.officerName || !formState.officerName.trim()) {
      alert(
        lang === "si"
          ? "කරුණාකර විෂයභාර නිලධාරියා තෝරන්න."
          : lang === "ta"
          ? "தயவுசெய்து விடய உத்தியோகத்தரைத் தேர்ந்தெடுக்கவும்."
          : "Please select a Subject Officer before submitting."
      );
      return;
    }

    let uploadedUrl = formState.documentUrl || "";
    let uploadedName = formState.documentName || "";

    // 1. Upload PDF if selected
    if (selectedPdf) {
      setIsUploadingPdf(true);
      try {
        const uploadData = new FormData();
        uploadData.append("file", selectedPdf);
        uploadData.append("refNo", formState.refNo || formState.letterNo || "daily-mail");

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadData,
        });

        const uploadJson = await uploadRes.json();
        if (uploadJson.success) {
          uploadedUrl = uploadJson.documentUrl;
          uploadedName = uploadJson.documentName;
        } else {
          alert(`PDF upload warning: ${uploadJson.error || "Failed to upload document"}`);
        }
      } catch (err: any) {
        console.error("PDF upload error:", err);
      } finally {
        setIsUploadingPdf(false);
      }
    }

    const newLetter = {
      id: formState.id || Date.now().toString(),
      refNo: formState.refNo,
      senderName: formState.senderName,
      senderAddress: "N/A", // Default
      letterDate: formState.letterDate || new Date().toISOString().split("T")[0],
      receivedDate: formState.receivedDate || new Date().toISOString().split("T")[0],
      subject: formState.subject || "N/A", // maps to subject / title
      priority: formState.priority,
      status: formState.officerName ? ("assigned" as const) : ("registered" as const),
      // Extra fields captured
      letterNo: formState.letterNo,
      letterType: formState.letterType,
      officerName: formState.officerName,
      subjectCategory: formState.subjectCategory,
      instituteName: formState.instituteName,
      regionProvince: formState.regionProvince,
      isAnswerLetter: formState.isAnswerLetter,
      documentUrl: uploadedUrl,
      documentName: uploadedName,
    };

    // Always save directly to PostgreSQL database tables (dcmms_daily_mail, daily_mail, daily_mail_letter_table)
    try {
      await saveDailyMailRecordServer({
        id: newLetter.id,
        serial_no: newLetter.refNo,
        received_date: newLetter.receivedDate,
        letter_no: newLetter.letterNo,
        submitted_date: newLetter.letterDate,
        subject: newLetter.subject,
        sender: newLetter.senderName,
        method: "Post",
        type: newLetter.letterType,
        classification: newLetter.subjectCategory,
        action_officer: newLetter.officerName,
        status: newLetter.status || "Pending",
        document_url: uploadedUrl,
        document_name: uploadedName,
      });
    } catch (pgErr) {
      console.error("Failed to save daily mail to PostgreSQL database:", pgErr);
    }

    if (isSubsequentMode) {
      const isAnswer = formState.isAnswerLetter === "true" || formState.isAnswerLetter === true;
      if (isSupabaseConfigured) {
        try {
          // Ensure/update the case row in dcmms_subject with proper status
          const caseStatus = isAnswer ? "assigned answer letter" : "In Progress";
          const casePayload: any = {
            id: `case-${newLetter.refNo}`,
            case_no: newLetter.refNo,
            assigned_date: newLetter.receivedDate,
            subject: newLetter.subject || null,
            priority: newLetter.priority || "medium",
            status: caseStatus,
          };
          if (newLetter.officerName) {
            casePayload.officer_name = newLetter.officerName;
          }

          const { error: caseUpsertError } = await supabase
            .from("dcmms_subject")
            .upsert(casePayload, { onConflict: "case_no" });

          if (caseUpsertError) {
            console.warn("Case upsert warning (may already exist):", caseUpsertError.message);
          }

          // If subject officer is specified, also upsert into dcmms_subject_assignments
          if (newLetter.officerName) {
            try {
              await supabase
                .from("dcmms_subject_assignments")
                .upsert({
                  id: `asgn-${newLetter.refNo}`,
                  case_no: newLetter.refNo,
                  subject_officer_name: newLetter.officerName,
                  assigned_officers: newLetter.officerName,
                  assigned_date: newLetter.receivedDate,
                  status: caseStatus,
                }, { onConflict: "case_no" });
            } catch (asgnErr) {
              console.warn("Assignment upsert warning:", asgnErr);
            }
          }

          let subMailPayload: any = {
            id: newLetter.id,
            case_no: newLetter.refNo,
            mail_officer_name: newLetter.officerName || null,
            sender_name: newLetter.senderName,
            letter_title: newLetter.subject,
            letter_type: newLetter.letterType || null,
            mail_date: newLetter.letterDate,
            received_date: newLetter.receivedDate,
            is_answer_letter: isAnswer,
          };

          const { error } = await supabase
            .from("dcmms_subsequent_mails")
            .insert(subMailPayload);

          if (error) {
            if (error.code === "42703" || (error.message && error.message.includes("is_answer_letter"))) {
              console.warn("Column is_answer_letter missing in DB, retrying insert without column");
              delete subMailPayload.is_answer_letter;
              const { error: retryError } = await supabase
                .from("dcmms_subsequent_mails")
                .insert(subMailPayload);
              if (retryError) throw retryError;
            } else {
              throw error;
            }
          }

          // Also insert into dcmms_daily_mail so that it displays in the daily mail recent add/list ledger
          const dailyMailPayload: any = {
            id: newLetter.id,
            ref_no: newLetter.refNo,
            sender_name: newLetter.senderName,
            sender_address: newLetter.senderAddress || "N/A",
            letter_date: newLetter.letterDate,
            received_date: newLetter.receivedDate,
            subject: newLetter.subject,
            priority: newLetter.priority || "medium",
            status: isAnswer ? "assigned answer letter" : "registered",
            letter_no: newLetter.letterNo || null,
            letter_type: newLetter.letterType || null,
            officer_name: newLetter.officerName || null,
            subject_category: newLetter.subjectCategory || null,
            institute_name: newLetter.instituteName || null,
            region_province: mapRegionProvince(newLetter.regionProvince),
            is_answer_letter: isAnswer,
          };

          let { error: mailError } = await supabase
            .from("dcmms_daily_mail")
            .insert(dailyMailPayload);

          if (mailError && (mailError.code === "42703" || (mailError.message && mailError.message.includes("is_answer_letter")))) {
            console.warn("Column is_answer_letter missing in dcmms_daily_mail DB, retrying insert without column");
            delete dailyMailPayload.is_answer_letter;
            const { error: retryMailError } = await supabase
              .from("dcmms_daily_mail")
              .insert(dailyMailPayload);
            mailError = retryMailError;
          }

          if (mailError) {
            console.error("Error inserting subsequent mail to dcmms_daily_mail:", mailError.message || mailError.details || JSON.stringify(mailError) || mailError);
          }

          localStorage.setItem("show_register_success", "true");
          if (typeof window !== "undefined") window.dispatchEvent(new Event("dcmms_data_updated"));
          router.push("/daily-mail");
          return;
        } catch (err: any) {
          console.error("Failed to save subsequent mail to Supabase", err);
        }
      }


      // Local storage fallback for subsequent mails
      if (typeof window !== "undefined") {
        const isAnswer = formState.isAnswerLetter === "true" || formState.isAnswerLetter === true;
        // 1. Save to dcmms_new_mail_current_case
        const stored = localStorage.getItem("dcmms_new_mail_current_case") || "[]";
        let list = [];
        try { list = JSON.parse(stored); } catch (e) {}
        list.push({
          id: newLetter.id,
          caseNo: newLetter.refNo,
          mailOfficerName: newLetter.officerName,
          senderName: newLetter.senderName,
          letterTitle: newLetter.subject,
          letterType: newLetter.letterType,
          mailDate: newLetter.letterDate,
          receivedDate: newLetter.receivedDate,
          isAnswerLetter: formState.isAnswerLetter,
        });
        localStorage.setItem("dcmms_new_mail_current_case", JSON.stringify(list));

        // 2. Update dcmms_cases status if isAnswer is true
        if (isAnswer) {
          try {
            const storedCases = localStorage.getItem("dcmms_cases") || "[]";
            let casesList = JSON.parse(storedCases);
            const idx = casesList.findIndex((c: any) => String(c.caseNo || c.refNo || "").trim() === String(newLetter.refNo).trim());
            if (idx >= 0) {
              casesList[idx].status = "assigned answer letter";
              if (newLetter.officerName) casesList[idx].officerName = newLetter.officerName;
            } else {
              casesList.push({
                id: `case-${newLetter.refNo}`,
                caseNo: newLetter.refNo,
                subject: newLetter.subject,
                assignedDate: newLetter.receivedDate,
                officerName: newLetter.officerName,
                status: "assigned answer letter",
                priority: newLetter.priority || "medium",
              });
            }
            localStorage.setItem("dcmms_cases", JSON.stringify(casesList));
          } catch (e) {}

          if (newLetter.officerName) {
            try {
              const storedAsgns = localStorage.getItem("dcmms_subject_assignments") || "[]";
              let asgnsList = JSON.parse(storedAsgns);
              const aIdx = asgnsList.findIndex((a: any) => String(a.caseNo || a.case_no || "").trim() === String(newLetter.refNo).trim());
              if (aIdx >= 0) {
                asgnsList[aIdx].mailOfficerName = newLetter.officerName;
                asgnsList[aIdx].officerName = newLetter.officerName;
                asgnsList[aIdx].status = "assigned answer letter";
              } else {
                asgnsList.push({
                  id: `asgn-${newLetter.refNo}`,
                  caseNo: newLetter.refNo,
                  mailOfficerName: newLetter.officerName,
                  officerName: newLetter.officerName,
                  status: "assigned answer letter",
                  assignedDate: newLetter.receivedDate,
                });
              }
              localStorage.setItem("dcmms_subject_assignments", JSON.stringify(asgnsList));
            } catch (e) {}
          }
        }

        // 3. Also save to dcmms_letters so it displays in the homepage list fallback
        const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
        let lettersList = [];
        try { lettersList = JSON.parse(storedLetters); } catch (e) {}
        lettersList.push(newLetter);
        localStorage.setItem("dcmms_letters", JSON.stringify(lettersList));

        localStorage.setItem("show_register_success", "true");
        if (typeof window !== "undefined") window.dispatchEvent(new Event("dcmms_data_updated"));
      }

      router.push("/daily-mail");
      return;
    }

    if (isSupabaseConfigured) {
      console.log("[DMMS Debug] isSupabaseConfigured:", isSupabaseConfigured);
      try {
        const dailyMailUpsertPayload: any = {
          id: newLetter.id,
          ref_no: newLetter.refNo,
          sender_name: newLetter.senderName,
          sender_address: newLetter.senderAddress,
          letter_date: newLetter.letterDate,
          received_date: newLetter.receivedDate,
          subject: newLetter.subject,
          priority: newLetter.priority,
          status: newLetter.status,
          letter_no: newLetter.letterNo || null,
          letter_type: newLetter.letterType || null,
          officer_name: newLetter.officerName || null,
          subject_category: newLetter.subjectCategory || null,
          institute_name: newLetter.instituteName || null,
          region_province: mapRegionProvince(newLetter.regionProvince),
          is_answer_letter: formState.isAnswerLetter === "true",
        };

        let { data: upserted, error } = await supabase
          .from("dcmms_daily_mail")
          .upsert(dailyMailUpsertPayload)
          .select();

        if (error && (error.code === "42703" || (error.message && error.message.includes("is_answer_letter")))) {
          console.warn("Column is_answer_letter missing in dcmms_daily_mail DB, retrying upsert without column");
          delete dailyMailUpsertPayload.is_answer_letter;
          const { data: retryUpserted, error: retryError } = await supabase
            .from("dcmms_daily_mail")
            .upsert(dailyMailUpsertPayload)
            .select();
          upserted = retryUpserted;
          error = retryError;
        }

        if (error) {
          console.error("Supabase letters write error:", error?.message || error?.details || JSON.stringify(error) || error);
          throw error;
        }

        // Also write corresponding case to dcmms_subject so it displays for the subject officer
        const { error: caseError } = await supabase
          .from("dcmms_subject")
          .upsert({
            id: `case-${newLetter.refNo}`,
            case_no: newLetter.refNo,
            assigned_date: newLetter.receivedDate,
            subject: newLetter.subject,
            priority: newLetter.priority,
            officer_name: newLetter.officerName || null,
            status: "In Progress",
          });

        if (caseError) {
          console.error("Supabase cases write error:", caseError?.message || caseError?.details || JSON.stringify(caseError) || caseError);
          throw caseError;
        }

        // Also write assignment entry to dcmms_subject_assignments if an officer is assigned
        if (newLetter.officerName) {
          await supabase.from("dcmms_subject_assignments").upsert({
            id: `asgn-${newLetter.refNo}`,
            case_no: newLetter.refNo,
            officer_name: newLetter.officerName,
            assigned_at: newLetter.receivedDate,
            status: "Assigned",
          });
        }

        // Log audit event
        await logAuditEvent(
          "REGISTER_DAILY_MAIL",
          "dcmms_daily_mail",
          newLetter.refNo,
          { sender: newLetter.senderName, subject: newLetter.subject, officer: newLetter.officerName }
        );

        // success
        console.debug("Supabase upsert returned:", upserted);

        localStorage.setItem("show_register_success", "true");
        if (typeof window !== "undefined") window.dispatchEvent(new Event("dcmms_data_updated"));
        const nextUrl = "/daily-mail";
        router.push(nextUrl);
        return;
      } catch (err: any) {
        const errCode = err?.code ?? "";
        const errMsg = err?.message ?? JSON.stringify(err);
        console.error("Supabase save failed:", errCode, errMsg);
        if (typeof window !== "undefined") {
          alert(`Supabase save failed (${errCode || "error"}): ${errMsg}\n\nData has been saved locally as a fallback.`);
        }
      }
    }

    // Local storage fallback
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_letters");
      let lettersList = [];
      if (stored) {
        try {
          lettersList = JSON.parse(stored);
        } catch (err) {
          console.error("Failed to parse letters list", err);
        }
      }
      const updatedLetters = lettersList.filter((item: any) => item.id !== newLetter.id);
      localStorage.setItem("dcmms_letters", JSON.stringify([newLetter, ...updatedLetters]));

      // Also write case to dcmms_cases in localStorage fallback
      const storedCases = localStorage.getItem("dcmms_cases") || "[]";
      let casesList = [];
      try {
        casesList = JSON.parse(storedCases);
      } catch (err) {
        console.error("Failed to parse cases list", err);
      }
      const newCase = {
        id: `case-${newLetter.refNo}`,
        caseNo: newLetter.refNo,
        assignedDate: newLetter.receivedDate,
        subject: newLetter.subject,
        priority: newLetter.priority,
        status: "In Progress",
        assignedTo: newLetter.officerName || "",
      };
      const updatedCases = casesList.filter((item: any) => item.caseNo !== newCase.caseNo);
      localStorage.setItem("dcmms_cases", JSON.stringify([newCase, ...updatedCases]));

      if (newLetter.officerName) {
        const storedAsgns = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let asgnsList = [];
        try { asgnsList = JSON.parse(storedAsgns); } catch (e) {}
        const newAsgn = {
          id: `asgn-${newLetter.refNo}`,
          caseNo: newLetter.refNo,
          subjectOfficerName: newLetter.officerName.trim(),
          status: "Step 1: Officers Assigned",
        };
        const updatedAsgns = asgnsList.filter((a: any) => a.caseNo !== newLetter.refNo);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify([newAsgn, ...updatedAsgns]));
      }

      localStorage.setItem("show_register_success", "true");
    }

    const nextUrl = "/daily-mail";
    router.push(nextUrl);
  };

  // Save draft Handler
  const handleSaveDraft = async (e: React.MouseEvent) => {
    e.preventDefault();

    // Draft requires at least Reference number to identify it
    if (!formState.refNo) {
      alert("Please fill in the Reference Number to save as draft.");
      return;
    }

    const draftLetter = {
      id: formState.id || Date.now().toString(),
      refNo: formState.refNo,
      senderName: formState.senderName || "Unknown Sender",
      senderAddress: "N/A",
      letterDate: formState.letterDate || new Date().toISOString().split("T")[0],
      receivedDate: formState.receivedDate || new Date().toISOString().split("T")[0],
      subject: formState.subject || "Draft Complaint",
      priority: formState.priority,
      status: "pending" as const,
      // Extra fields
      letterNo: formState.letterNo,
      letterType: formState.letterType,
      officerName: formState.officerName,
      subjectCategory: formState.subjectCategory,
      instituteName: formState.instituteName,
      regionProvince: formState.regionProvince,
    };

    if (isSupabaseConfigured) {
      try {
        const { data: upsertedDraft, error } = await supabase
          .from("dcmms_daily_mail")
          .upsert({
            id: draftLetter.id,
            ref_no: draftLetter.refNo,
            sender_name: draftLetter.senderName,
            sender_address: draftLetter.senderAddress,
            letter_date: draftLetter.letterDate,
            received_date: draftLetter.receivedDate,
            subject: draftLetter.subject,
            priority: draftLetter.priority,
            status: draftLetter.status,
            letter_no: draftLetter.letterNo || null,
            letter_type: draftLetter.letterType || null,
            officer_name: draftLetter.officerName || null,
            subject_category: draftLetter.subjectCategory || null,
            institute_name: draftLetter.instituteName || null,
            region_province: mapRegionProvince(draftLetter.regionProvince),
          })
          .select();

        if (error) {
          console.error("Supabase draft write error", error);
          throw error;
        }

        console.debug("Supabase draft upsert returned:", upsertedDraft);
        localStorage.setItem("show_register_success", "true");
        router.push("/daily-mail");
        return;
      } catch (err: any) {
        const errCode = err?.code ?? "";
        const errMsg = err?.message ?? JSON.stringify(err);
        console.error("Supabase draft save failed:", errCode, errMsg);
        if (typeof window !== "undefined") {
          alert(`Supabase draft save failed (${errCode || "error"}): ${errMsg}\n\nDraft saved locally as fallback.`);
        }
      }
    }

    // Local storage fallback
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_letters");
      let lettersList = [];
      if (stored) {
        try {
          lettersList = JSON.parse(stored);
        } catch (err) {
          console.error("Failed to parse letters list", err);
        }
      }
      const updatedLetters = lettersList.filter((item: any) => item.id !== draftLetter.id);
      localStorage.setItem("dcmms_letters", JSON.stringify([draftLetter, ...updatedLetters]));
      localStorage.setItem("show_register_success", "true");
    }

    router.push("/daily-mail");
  };

  // Close sidebar on Escape key press (A11y compliance)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  if (!mounted) {
    return <div className="dashboard-container" style={{ minHeight: "100vh", opacity: 0 }}></div>;
  }

  return (
    <div className="dashboard-container" data-font-scale={fontScale}>
      {/* Skip Link (A11y) */}
      <a href="#dashboard-main-content" className="skip-link">
        {t("skipLink")}
      </a>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          
          {/* Top App Bar Header */}
          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <button 
                className="menu-toggle-btn" 
                aria-label="Toggle Sidebar Menu"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                {...(isSidebarOpen ? { "aria-expanded": "true" } : { "aria-expanded": "false" })}
              >
                <svg className="hamburger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="dashboard-title-area">
                <h2 className="dashboard-main-title">{t("dailyMailReporter")}</h2>
                <p className="dashboard-main-subtitle">{t("registerLettersDesc")}</p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Date display badge */}
              <div className="date-badge">
                <svg className="date-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span suppressHydrationWarning>
                  {new Date().toLocaleDateString(
                    lang === "si" ? "si-LK" : lang === "ta" ? "ta-LK" : "en-US",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </span>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Accessibility Scale Radio Group */}
              <div className="accessibility-adjuster-bar" role="radiogroup" aria-label="Font Sizing Adjustment">
                <label className={`size-btn size-btn-small${fontScale === "small" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="dashboardFontScale"
                    value="small"
                    checked={fontScale === "small"}
                    onChange={() => setFontScale("small")}
                    aria-label={t("fontSmall")}
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
                    aria-label={t("fontMedium")}
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
                    aria-label={t("fontLarge")}
                    className="sr-only"
                  />
                  A
                </label>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Translation controls */}
              <div className="trilingual-language-selector" role="radiogroup" aria-label="Translate Dashboard Language">
                <label className={`lang-btn${lang === "si" ? " active" : ""}`} lang="si">
                  <input
                    type="radio"
                    name="dashboardLang"
                    value="si"
                    checked={lang === "si"}
                    onChange={() => changeLanguage("si")}
                    aria-label="Switch dashboard language to Sinhala"
                    className="sr-only"
                  />
                  සිංහල
                </label>
                <label className={`lang-btn${lang === "ta" ? " active" : ""}`} lang="ta">
                  <input
                    type="radio"
                    name="dashboardLang"
                    value="ta"
                    checked={lang === "ta"}
                    onChange={() => changeLanguage("ta")}
                    aria-label="Switch dashboard language to Tamil"
                    className="sr-only"
                  />
                  தமிழ்
                </label>
                <label className={`lang-btn${lang === "en" ? " active" : ""}`} lang="en">
                  <input
                    type="radio"
                    name="dashboardLang"
                    value="en"
                    checked={lang === "en"}
                    onChange={() => changeLanguage("en")}
                    aria-label="Switch dashboard language to English"
                    className="sr-only"
                  />
                  English
                </label>
              </div>
            </div>
          </header>

          {/* Standalone register complaint container */}
          <section className="register-page-wrapper">
            <div className="register-card">
              
              {/* Layout title area */}
              <div className="register-header-container">
                <div className="register-header-left">
                  <h1 className="register-title">
                    {isEditMode 
                      ? (lang === "si" ? "පූර්වයෙන් යොමු කළ ලිපි විස්තර නැරඹීම" : t("viewSubmittedLetterTitle", "View Submitted Letter Details")) 
                      : isSubsequentMode 
                        ? t("registerLetterForCurrentComplaintTitle", "Register New Letter for Current Complaint") 
                        : t("registerComplaintTitle")}
                  </h1>
                  <p className="register-subtitle">
                    {isEditMode 
                      ? (lang === "si" ? "පූර්වයෙන් ඇතුළත් කළ ලිපි දත්ත කියවීම සඳහා පමණි (වෙනස් කළ නොහැක)." : t("viewSubmittedLetterDesc", "Previously submitted letter data is read-only and cannot be modified.")) 
                      : t("registerComplaintDesc")}
                  </p>
                </div>
                <div className="register-header-right-btns">
                  <Link href="/daily-mail" className="btn-back-home">
                    <svg className="btn-back-home-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("backToHome")}
                  </Link>
                  {!isEditMode && (
                    <button
                      type="button"
                      className="btn-action-draft"
                      onClick={handleSaveDraft}
                      title={t("saveAsDraft")}
                      aria-label={t("saveAsDraft")}
                    >
                      <svg
                        className="btn-action-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        width="20"
                        height="20"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8l-4-4H8z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20v-8M9 12h6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Case details summary box for subsequent mail */}
              {isSubsequentMode && currentCaseDetails && (
                <div className="current-case-details-card">
                  <div className="case-details-grid">
                    <div className="case-details-column">
                      <div className="case-detail-item">
                        <span className="detail-label">{t("caseNoLabel", "Case No. :")}</span>
                        <span className="detail-value">{currentCaseDetails.letterNo}</span>
                      </div>
                      <div className="case-detail-item">
                        <span className="detail-label">{t("priorityLabel", "Priority :")}</span>
                        <span className="detail-value">
                          {t(`priority${currentCaseDetails.priority.charAt(0).toUpperCase() + currentCaseDetails.priority.slice(1)}`, currentCaseDetails.priority)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="case-details-column">
                      <div className="case-detail-item">
                        <span className="detail-label">{t("officerNameLabel", "Name of Subject Officer :")}</span>
                        <span className="detail-value">{currentCaseDetails.officerName}</span>
                      </div>
                      <div className="case-detail-item">
                        <span className="detail-label">{t("receivedDateLabel", "Received Date :")}</span>
                        <span className="detail-value">{currentCaseDetails.receivedDate}</span>
                      </div>
                    </div>
                    
                    <div className="case-details-column">
                      <div className="case-detail-item">
                        <span className="detail-label">{t("refNoLabel", "Reference Number :")}</span>
                        <span className="detail-value">{currentCaseDetails.refNo}</span>
                      </div>
                      <div className="case-detail-item">
                        <span className="detail-label">{t("letterTypeLabel", "Letter Type :")}</span>
                        <span className="detail-value">{currentCaseDetails.letterType}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subject Officer Actions History — visible in subsequent mode */}
              {isSubsequentMode && (
                <div className="subsequent-letters-table-card">
                  <h2 className="card-title-header">
                    <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t("subjectOfficerActionsTitle", "Subject Officer Actions History")}
                  </h2>
                  {subjectActions.length > 0 ? (
                    <div className="table-responsive-container">
                      <table className="letters-data-table subsequent-table">
                        <thead>
                          <tr>
                            <th scope="col">{t("nameOfOfficer", "Subject Officer")}</th>
                            <th scope="col">{t("reportState", "Report State")}</th>
                            <th scope="col">{t("receivedDate", "Received Date")}</th>
                            <th scope="col">{t("stepTaken", "Step Taken")}</th>
                            <th scope="col">{t("specialNotes", "Special Notes")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjectActions.map((action: any, index: number) => (
                            <tr key={action.id || index} className="letter-table-row">
                              <td className="font-semibold text-primary">{action.subjectOfficerName || "—"}</td>
                              <td>
                                <span className={`badge-badge ${
                                  action.reportState === "Closed" ? "badge-status-closed" :
                                  action.reportState === "In Progress" ? "badge-status-inprogress" : "badge-status-pending"
                                }`}>
                                  {action.reportState || "—"}
                                </span>
                              </td>
                              <td>{action.receivedDate || "—"}</td>
                              <td className="subject-cell">{action.stepTaken || "—"}</td>
                              <td className="subject-cell">{action.specialNotes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty-actions-text">{t("noActionsYet", "No actions recorded yet")}</p>
                  )}
                </div>
              )}

              {/* Previous Letters for this Case — visible in subsequent mode */}
              {isSubsequentMode && previousLetters.length > 0 && (
                <div className="subsequent-letters-table-card">
                  <h2 className="card-title-header">
                    <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5" />
                    </svg>
                    {t("previousLettersForCase", "Previous Letters for This Case")}
                  </h2>
                  <div className="table-responsive-container">
                    <table className="letters-data-table subsequent-table">
                      <thead>
                        <tr>
                          <th scope="col">{t("senderName", "Sender Name")}</th>
                          <th scope="col">{t("letterType", "Letter Type")}</th>
                          <th scope="col">{t("letterDate", "Letter Date")}</th>
                          <th scope="col">{t("receivedDate", "Received Date")}</th>
                          <th scope="col">{t("nameOfOfficer", "Mail Officer")}</th>
                          <th scope="col">{t("answerLetterColumn", "Answer Letter")}</th>
                          <th scope="col">{t("letterTitle", "Subject")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previousLetters.map((mail: any, index: number) => (
                          <tr key={mail.id || index} className="letter-table-row">
                            <td className="font-semibold text-primary">{mail.senderName || "—"}</td>
                            <td>{mail.letterType || "—"}</td>
                            <td>{mail.letterDate || mail.mailDate || "—"}</td>
                            <td>{mail.receivedDate || "—"}</td>
                            <td>{mail.officerName || mail.mailOfficerName || "—"}</td>
                            <td>
                              <span className={`badge-badge ${mail.isAnswerLetter === "true" || mail.isAnswerLetter === true ? "badge-status-closed" : "badge-status-inprogress"}`}>
                                {mail.isAnswerLetter === "true" || mail.isAnswerLetter === true ? t("yes", "Yes") : t("no", "No")}
                              </span>
                            </td>
                            <td className="subject-cell">{mail.subject || mail.letterTitle || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Form entries section */}
              <div className="entries-container">
                {isEditMode && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    backgroundColor: "#eff6ff",
                    color: "#1e40af",
                    border: "1px solid #bfdbfe",
                    padding: "14px 18px",
                    borderRadius: "10px",
                    marginBottom: "20px",
                    fontWeight: 600,
                    fontSize: "13.5px"
                  }}>
                    <svg style={{ width: "22px", height: "22px", flexShrink: 0, color: "#2563eb" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>
                      {lang === "si"
                        ? "පූර්වයෙන් යොමු කළ ලිපි විස්තර (කියවීම සඳහා පමණි - වෙනස් කළ නොහැක)"
                        : lang === "ta"
                        ? "முன்பு சமர்ப்பிக்கப்பட்ட கடித விவரங்கள் (வாசிக்க மட்டுமே - திருத்த முடியாது)"
                        : "Previously submitted letter details (Read-Only mode: Previously submitted data cannot be edited)"}
                    </span>
                  </div>
                )}

                <h2 className="entries-header">
                  <svg className="entries-header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t("letterEntries")}
                </h2>

                <form onSubmit={handleSubmit} className="register-grid-form">

                  {/* ── Card 1: Letter Reference Information (ලිපි යොමු තොරතුරු) ── */}
                  <div className="register-step-card">
                    <h3 className="register-step-title">{t("stepLetterReference", "Letter Reference Information")}</h3>
                    <div className="register-step-grid">

                      {/* Serial / Letter Number */}
                      <div className="form-field-group">
                        <label htmlFor="letterNo" className="field-label">{t("letterNo")}</label>
                        <input
                          id="letterNo"
                          type="text"
                          disabled={isEditMode}
                          readOnly={isEditMode}
                          value={formState.letterNo}
                          onChange={(e) => setFormState({ ...formState, letterNo: e.target.value })}
                          placeholder={t("placeholderLetterNo")}
                          className="field-input"
                          style={isEditMode ? { backgroundColor: "#f8fafc", cursor: "not-allowed", opacity: 0.85, fontWeight: 600 } : {}}
                        />
                      </div>

                      {/* Reference Number * */}
                      <div className="form-field-group">
                        <label htmlFor="refNo" className="field-label">{t("refNo")} <span className="required-star">*</span></label>
                        <input
                          id="refNo"
                          type="text"
                          required
                          disabled={isEditMode || isSubsequentMode}
                          readOnly={isEditMode || isSubsequentMode}
                          value={formState.refNo}
                          onChange={(e) => setFormState({ ...formState, refNo: e.target.value })}
                          placeholder={t("refPlaceholder")}
                          className="field-input"
                          style={(isEditMode || isSubsequentMode) ? { backgroundColor: "#f8fafc", cursor: "not-allowed", opacity: 0.85, fontWeight: 600 } : {}}
                        />
                      </div>

                      {/* Mode of Receipt */}
                      <div className="form-field-group">
                        <label htmlFor="letterType" className="field-label">{t("letterType")}</label>
                        <select
                          id="letterType"
                          disabled={isEditMode}
                          value={formState.letterType}
                          onChange={(e) => setFormState({ ...formState, letterType: e.target.value })}
                          className="field-select"
                          style={isEditMode ? { backgroundColor: "#f8fafc", cursor: "not-allowed", opacity: 0.85, fontWeight: 600 } : {}}
                        >
                          <option value="">{t("placeholderLetterType")}</option>
                          {receiptModes.map((mode) => (
                            <option key={mode.value} value={mode.value}>
                              {t(mode.labelKey)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Is Answer Letter (Only in Register New Letter for Current Complaint form) */}
                      {isSubsequentMode && (
                        <div className="form-field-group">
                          <label className="field-label">{t("isAnswerLetter", "Is this an answer letter?")}</label>
                          <div className="radio-group-container">
                            <label
                              id="labelIsAnswerYes"
                              className="radio-option-item"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                cursor: isEditMode ? "not-allowed" : "pointer",
                                userSelect: "none"
                              }}
                            >
                              <input
                                id="isAnswerYes"
                                type="radio"
                                name="isAnswerLetterRadio"
                                disabled={isEditMode}
                                value="true"
                                checked={String(formState.isAnswerLetter) === "true"}
                                onChange={() => setFormState((prev) => ({ ...prev, isAnswerLetter: "true" }))}
                                style={{ width: "18px", height: "18px", accentColor: "#0e162f", cursor: isEditMode ? "not-allowed" : "pointer" }}
                              />
                              <span style={{ fontWeight: 700, color: "#0e162f", fontSize: "13px" }}>{t("yes", "Yes")}</span>
                            </label>

                            <label
                              id="labelIsAnswerNo"
                              className="radio-option-item"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                cursor: isEditMode ? "not-allowed" : "pointer",
                                userSelect: "none"
                              }}
                            >
                              <input
                                id="isAnswerNo"
                                type="radio"
                                name="isAnswerLetterRadio"
                                disabled={isEditMode}
                                value="false"
                                checked={String(formState.isAnswerLetter) !== "true"}
                                onChange={() => setFormState((prev) => ({ ...prev, isAnswerLetter: "false" }))}
                                style={{ width: "18px", height: "18px", accentColor: "#0e162f", cursor: isEditMode ? "not-allowed" : "pointer" }}
                              />
                              <span style={{ fontWeight: 700, color: "#0e162f", fontSize: "13px" }}>{t("no", "No")}</span>
                            </label>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* ── Card 2: Sender Details (යවන පාර්ශ්වයේ තොරතුරු) ── */}
                  <div className="register-step-card">
                    <h3 className="register-step-title">{t("stepSenderDetails", "Sender Details")}</h3>
                    <div className="register-step-grid">

                      {/* Sender's Party */}
                      <div className="form-field-group">
                        <label htmlFor="senderName" className="field-label">{t("senderName")}</label>
                        <input
                          id="senderName"
                          type="text"
                          disabled={isEditMode}
                          readOnly={isEditMode}
                          value={formState.senderName}
                          onChange={(e) => setFormState({ ...formState, senderName: e.target.value })}
                          placeholder={t("senderPlaceholder")}
                          className="field-input"
                          style={isEditMode ? { backgroundColor: "#f8fafc", cursor: "not-allowed", opacity: 0.85, fontWeight: 600 } : {}}
                        />
                      </div>

                      {/* Nature of the Letter */}
                      <div className="form-field-group">
                        <label htmlFor="regionProvince" className="field-label">{t("regionProvince")}</label>
                        <select
                          id="regionProvince"
                          disabled={isEditMode}
                          value={formState.regionProvince}
                          onChange={(e) => setFormState({ ...formState, regionProvince: e.target.value })}
                          className="field-select"
                          style={isEditMode ? { backgroundColor: "#f8fafc", cursor: "not-allowed", opacity: 0.85, fontWeight: 600 } : {}}
                        >
                          <option value="">{t("selectClassification")}</option>
                          {letterNatures.map((nature) => (
                            <option key={nature.value} value={nature.value}>
                              {t(nature.labelKey)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Letter Classification */}
                      <div className="form-field-group">
                        <label htmlFor="subjectCategory" className="field-label">{t("subjectCategory")}</label>
                        <select
                          id="subjectCategory"
                          disabled={isEditMode}
                          value={formState.subjectCategory}
                          onChange={(e) => setFormState({ ...formState, subjectCategory: e.target.value })}
                          className="field-select"
                          style={isEditMode ? { backgroundColor: "#f8fafc", cursor: "not-allowed", opacity: 0.85, fontWeight: 600 } : {}}
                        >
                          <option value="">{t("selectCategory", "Select category...")}</option>
                          {letterClassifications.map((item) => (
                            <option key={item.value} value={item.value}>
                              {t(item.labelKey)}
                            </option>
                          ))}
                        </select>
                      </div>

                    </div>
                  </div>

                  {/* ── Card 3: Letter Subject & Dates (ලිපි විෂය සහ දින) ── */}
                  <div className="register-step-card">
                    <h3 className="register-step-title">{t("stepLetterSubjectDates", "Letter Subject & Dates")}</h3>
                    <div className="register-step-grid">

                      {/* Subject / Matter of the Letter * */}
                      <div className="form-field-group">
                        <label htmlFor="subject" className="field-label">{t("letterTitle")} <span className="required-star">*</span></label>
                        <input
                          id="subject"
                          type="text"
                          required
                          disabled={isEditMode}
                          readOnly={isEditMode}
                          value={formState.subject}
                          onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                          placeholder={t("subjectPlaceholder")}
                          className="field-input"
                          style={isEditMode ? { backgroundColor: "#f8fafc", cursor: "not-allowed", opacity: 0.85, fontWeight: 600 } : {}}
                        />
                      </div>

                      {/* Date Received by Additional Secretary * */}
                      <div className="form-field-group">
                        <label htmlFor="receivedDate" className="field-label">{t("receivedDate")} <span className="required-star">*</span></label>
                        <div className="input-icon-wrapper">
                          <input
                            id="receivedDate"
                            type="date"
                            required
                            disabled={isEditMode}
                            readOnly={isEditMode}
                            value={formState.receivedDate}
                            onChange={(e) => setFormState({ ...formState, receivedDate: e.target.value })}
                            className="field-input input-with-right-icon"
                            style={isEditMode ? { backgroundColor: "#f8fafc", cursor: "not-allowed", opacity: 0.85, fontWeight: 600 } : {}}
                          />
                          <div className="input-right-icons">
                            <svg className="input-right-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Date Letter Handed Over to Disciplinary Branch * */}
                      <div className="form-field-group">
                        <label htmlFor="letterDate" className="field-label">{t("letterDate")} <span className="required-star">*</span></label>
                        <div className="input-icon-wrapper">
                          <input
                            id="letterDate"
                            type="date"
                            required
                            disabled={isEditMode}
                            readOnly={isEditMode}
                            value={formState.letterDate}
                            onChange={(e) => setFormState({ ...formState, letterDate: e.target.value })}
                            className="field-input input-with-right-icon"
                            style={isEditMode ? { backgroundColor: "#f8fafc", cursor: "not-allowed", opacity: 0.85, fontWeight: 600 } : {}}
                          />
                          <div className="input-right-icons">
                            <svg className="input-right-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* ── Card 4: Assignment Details (පැවරීම් තොරතුරු) ── */}
                  <div className="register-step-card">
                    <h3 className="register-step-title">{t("stepAssignmentDetails", "Assignment Details")}</h3>
                    <div className="register-step-grid">

                      {/* Subject Officer Name (Searchable & Filterable Select) */}
                      <div className="form-field-group" ref={officerDropdownRef}>
                        <label htmlFor="officerNameInput" className="field-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span>{t("nameOfOfficer")} <span className="required-star">*</span></span>
                          {isOfficerLocked && (
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e40af", backgroundColor: "#dbeafe", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <svg style={{ width: "12px", height: "12px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              {lang === "si" ? "වෙනස් කළ නොහැක (Locked)" : lang === "ta" ? "பூட்டப்பட்டது (Locked)" : "Locked"}
                            </span>
                          )}
                        </label>
                        <div className="searchable-select-wrapper">
                          <div className="searchable-select-input-container">
                            <input
                              id="officerNameInput"
                              type="text"
                              readOnly
                              disabled={isOfficerLocked}
                              value={formState.officerName || ""}
                              onClick={() => {
                                if (!isOfficerLocked) setIsOfficerDropdownOpen(!isOfficerDropdownOpen);
                              }}
                              placeholder={t("selectSubjectOfficer")}
                              className="field-input searchable-select-input"
                              style={isOfficerLocked ? { backgroundColor: "#f1f5f9", cursor: "not-allowed", opacity: 0.9, fontWeight: 700, borderColor: "#cbd5e1" } : {}}
                            />
                            <div className="searchable-select-icons">
                              {formState.officerName && !isOfficerLocked && (
                                <button
                                  type="button"
                                  className="searchable-select-clear-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFormState((prev) => ({ ...prev, officerName: "" }));
                                    setOfficerSearchQuery("");
                                  }}
                                  title="Clear selection"
                                >
                                  <svg style={{ width: "16px", height: "16px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isOfficerLocked}
                                className="searchable-select-arrow-btn"
                                onClick={() => {
                                  if (!isOfficerLocked) setIsOfficerDropdownOpen(!isOfficerDropdownOpen);
                                }}
                                style={isOfficerLocked ? { cursor: "not-allowed", opacity: 0.6 } : {}}
                              >
                                {isOfficerLocked ? (
                                  <svg style={{ width: "16px", height: "16px", color: "#64748b" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                ) : (
                                  <svg
                                    className="select-arrow-icon"
                                    style={{
                                      width: "16px",
                                      height: "16px",
                                      transform: isOfficerDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                                      transition: "transform 0.2s ease"
                                    }}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>

                          {!isOfficerLocked && isOfficerDropdownOpen && (
                            <div className="searchable-select-dropdown">
                              <div className="searchable-select-search-box">
                                <input
                                  type="text"
                                  value={officerSearchQuery}
                                  onChange={(e) => setOfficerSearchQuery(e.target.value)}
                                  placeholder={lang === "si" ? "විෂය ලිපිකරු සොයන්න..." : lang === "ta" ? "தேடுக..." : "Search subject officer..."}
                                  className="searchable-select-filter-input"
                                  autoFocus
                                />
                              </div>
                              <div className="searchable-select-options-list">
                                <div
                                  className={`searchable-select-option ${!formState.officerName ? "selected" : ""}`}
                                  onClick={() => {
                                    setFormState((prev) => ({ ...prev, officerName: "" }));
                                    setOfficerSearchQuery("");
                                    setIsOfficerDropdownOpen(false);
                                  }}
                                >
                                  <span style={{ color: "#64748b", fontStyle: "italic" }}>{t("selectSubjectOfficer")}</span>
                                </div>
                                {officerOptions.filter((opt) =>
                                  opt.toLowerCase().includes(officerSearchQuery.toLowerCase())
                                ).length > 0 ? (
                                  officerOptions
                                    .filter((opt) => opt.toLowerCase().includes(officerSearchQuery.toLowerCase()))
                                    .map((opt) => (
                                      <div
                                        key={opt}
                                        className={`searchable-select-option ${formState.officerName === opt ? "selected" : ""}`}
                                        onClick={() => {
                                          setFormState((prev) => ({ ...prev, officerName: opt }));
                                          setOfficerSearchQuery("");
                                          setIsOfficerDropdownOpen(false);
                                        }}
                                      >
                                        <span>{opt}</span>
                                        {formState.officerName === opt && (
                                          <svg style={{ width: "16px", height: "16px", color: "#2563eb" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                    ))
                                ) : (
                                  <div className="searchable-select-no-options">
                                    {lang === "si" ? "ගැලපෙන විෂය ලිපිකරුවන් හමු නොවුණි" : lang === "ta" ? "பொருந்தக்கூடிய அதிகாரிகள் இல்லை" : "No matching subject officers found"}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Priority */}
                      <div className="form-field-group">
                        <label htmlFor="priority" className="field-label">{t("priority")}</label>
                        <div className="priority-select-wrapper">
                          <span className={`priority-dot-indicator dot-${formState.priority}`} />
                          <div className="select-wrapper" style={{ flex: 1 }}>
                            <select
                              id="priority"
                              disabled={isEditMode}
                              value={formState.priority}
                              onChange={(e) => setFormState({ ...formState, priority: e.target.value as any })}
                              className="field-select"
                              style={isEditMode ? { backgroundColor: "#f8fafc", cursor: "not-allowed", opacity: 0.85, fontWeight: 600 } : {}}
                            >
                              <option value="high" className="priority-option-high">{t("priorityHigh")}</option>
                              <option value="medium" className="priority-option-medium">{t("priorityMedium")}</option>
                              <option value="low" className="priority-option-low">{t("priorityLow")}</option>
                            </select>
                            <div className="select-arrow-container">
                              <svg className="select-arrow-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* ── Card 5: PDF Document Attachment (ලිපි ගොනුව / ஆவண இணைப்பு) ── */}
                  <div className="register-step-card" style={{ border: "1.5px dashed #93c5fd", backgroundColor: "#f8fafc" }}>
                    <h3 className="register-step-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <svg style={{ width: "20px", height: "20px", color: "#2563eb" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {lang === "si" ? "ලිපියේ PDF පිටපත අමුණන්න" : lang === "ta" ? "PDF ஆவணத்தை இணைக்கவும்" : "Attach PDF Document (Complaint / Letter)"}
                    </h3>
                    <div style={{ padding: "12px 0" }}>
                      {/* If existing document exists in edit mode */}
                      {formState.documentUrl && (
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          backgroundColor: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          borderRadius: "8px",
                          marginBottom: "16px"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "24px" }}>📄</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "14px", color: "#1e3a8a" }}>
                                {formState.documentName || "Attached_Document.pdf"}
                              </div>
                              <div style={{ fontSize: "12px", color: "#64748b" }}>
                                {lang === "si" ? "පවතින ලේඛනය සුරක්ෂිතව ගබඩා කර ඇත" : lang === "ta" ? "இணைக்கப்பட்ட ஆவணம் சேமிக்கப்பட்டுள்ளது" : "Attached document stored in PostgreSQL"}
                              </div>
                            </div>
                          </div>
                          <a
                            href={formState.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "6px 14px",
                              backgroundColor: "#2563eb",
                              color: "#ffffff",
                              borderRadius: "6px",
                              fontSize: "13px",
                              fontWeight: 600,
                              textDecoration: "none"
                            }}
                          >
                            <svg style={{ width: "16px", height: "16px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            {lang === "si" ? "PDF පරීක්ෂා කරන්න" : lang === "ta" ? "PDF ஐப் பார்க்கவும்" : "View PDF"}
                          </a>
                        </div>
                      )}

                      {/* File upload input */}
                      {!isEditMode && (
                        <div>
                          <input
                            id="pdfUploadInput"
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                const file = e.target.files[0];
                                if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
                                  alert("Please upload a PDF file only.");
                                  return;
                                }
                                if (file.size > 25 * 1024 * 1024) {
                                  alert("File size exceeds 25MB limit.");
                                  return;
                                }
                                setSelectedPdf(file);
                              }
                            }}
                            style={{ display: "none" }}
                          />
                          <label
                            htmlFor="pdfUploadInput"
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "24px",
                              backgroundColor: "#ffffff",
                              border: "2px dashed #cbd5e1",
                              borderRadius: "10px",
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                          >
                            <svg style={{ width: "36px", height: "36px", color: "#3b82f6", marginBottom: "8px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>
                              {selectedPdf ? selectedPdf.name : (lang === "si" ? "PDF ගොනුවක් තෝරන්න (හෝ මෙහි ඇද දමන්න)" : lang === "ta" ? "PDF கோப்பைத் தேர்ந்தெடுக்கவும்" : "Click to select or browse a PDF document")}
                            </span>
                            <span style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                              {selectedPdf ? `${(selectedPdf.size / 1024).toFixed(1)} KB — ready to upload` : (lang === "si" ? "උපරිම ප්‍රමාණය: 25MB (PDF පමණි)" : lang === "ta" ? "அதிகபட்ச அளவு: 25MB (PDF மட்டும்)" : "Supports PDF files up to 25MB")}
                            </span>
                          </label>

                          {selectedPdf && (
                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                              <button
                                type="button"
                                onClick={() => setSelectedPdf(null)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#ef4444",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
                              >
                                ✕ {lang === "si" ? "ගොනුව ඉවත් කරන්න" : lang === "ta" ? "கோப்பை நீக்கு" : "Remove selected file"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Form Action Buttons */}
                  <div className="register-form-actions">
                    <button
                      type="button"
                      className="btn-action-cancel"
                      onClick={() => router.push("/daily-mail")}
                    >
                      {isEditMode ? (lang === "si" ? "නැවත ප්‍රධාන පුවරුවට" : lang === "ta" ? "முகப்புக்குச் செல்" : "Back to Dashboard") : t("cancelBtn")}
                    </button>

                    {!isEditMode && (
                      <button
                        type="submit"
                        className="btn-action-submit"
                      >
                        {t("submitBtn")}
                      </button>
                    )}
                  </div>

                </form>
              </div>

            </div>
          </section>

          {/* Footer Branding Notice */}
          <SiteFooter />
        </main>
      </div>
    </div>
  );
}

export default function RegisterComplaintPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterComplaintForm />
    </Suspense>
  );
}
