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
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile } from "@/lib/auth";

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

  const [officerOptions, setOfficerOptions] = useState<string[]>([
    "Rathnaweera",
    "Kamal Perera",
    "Suresh Silva",
    "Aruni Rajapaksha",
  ]);
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
  });

  // Sync document properties
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${isEditMode ? t("editLetterTitle", "Edit Letter") : isSubsequentMode ? t("registerLetterForCurrentComplaintTitle", "Register New Letter for Current Complaint") : t("registerComplaintTitle")} | DCMMS`;
  }, [lang, t, isEditMode, isSubsequentMode]);

  // Load subject officers and institutes on mount
  useEffect(() => {
    const loadOfficers = async () => {
      const namesSet = new Set<string>([
        "Rathnaweera",
        "Kamal Perera",
        "Suresh Silva",
        "Aruni Rajapaksha",
      ]);

      // 1. Load from Supabase profiles (role = subject_officer)
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("dcmms_profiles")
            .select("full_name")
            .eq("role", "subject_officer");
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

      // 2. Load from localStorage custom profiles (role = subject_officer)
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("dcmms_custom_profiles");
        if (stored) {
          try {
            const list = JSON.parse(stored);
            list
              .filter((p: any) => p.role === "subject_officer")
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

      // 1. Load from Supabase
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

      // 2. Load from localStorage custom institutes
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
        if (isSupabaseConfigured) {
          try {
            const { data, error } = await supabase
              .from("dcmms_daily_mail")
              .select("*")
              .eq("ref_no", caseNo)
              .order("created_at", { ascending: true });

            if (!error && data && data.length > 0) {
              const originalMail = data[0];
              setCurrentCaseDetails({
                letterNo: originalMail.letter_no || "—",
                officerName: originalMail.officer_name || "—",
                refNo: originalMail.ref_no || "—",
                priority: originalMail.priority || "medium",
                receivedDate: originalMail.received_date || "—",
                letterType: originalMail.letter_type || "—",
              });
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
                setCurrentCaseDetails({
                  letterNo: originalMail.letterNo || "—",
                  officerName: originalMail.officerName || "—",
                  refNo: originalMail.refNo || "—",
                  priority: originalMail.priority || "medium",
                  receivedDate: originalMail.receivedDate || "—",
                  letterType: originalMail.letterType || "—",
                });
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
                setPreviousLetters(found);
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
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("dcmms_daily_mail")
            .select("*")
            .eq("id", id)
            .single();

          if (!error && data) {
            setFormState({
              id: data.id,
              letterNo: data.letter_no || "",
              senderName: data.sender_name || "",
              letterType: data.letter_type || "",
              officerName: data.officer_name || "",
              subjectCategory: data.subject_category || "Other",
              instituteName: data.institute_name || "",
              refNo: data.ref_no || "",
              letterDate: data.letter_date || "",
              subject: data.subject || "",
              regionProvince: data.region_province || "",
              receivedDate: data.received_date || "",
              priority: data.priority || "medium",
              status: data.status || "registered",
            });
            return;
          }
        } catch (err) {
          console.error("Failed to load letter for edit from Supabase:", err);
        }
      }

      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("dcmms_letters");
        if (stored) {
          try {
            const list = JSON.parse(stored);
            const found = list.find((item: any) => item.id === id);
            if (found) {
              setFormState({
                id: found.id,
                letterNo: found.letterNo || "",
                senderName: found.senderName || "",
                letterType: found.letterType || "",
                officerName: found.officerName || "",
                subjectCategory: found.subjectCategory || "Other",
                instituteName: found.instituteName || "",
                refNo: found.refNo || "",
                letterDate: found.letterDate || "",
                subject: found.subject || "",
                regionProvince: found.regionProvince || "",
                receivedDate: found.receivedDate || "",
                priority: found.priority || "medium",
                status: found.status || "registered",
              });
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
    if (!formState.senderName || !formState.refNo) {
      alert("Please fill in all required fields (Reference Number and Sender's Party).");
      return;
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
    };

    if (isSubsequentMode) {
      if (isSupabaseConfigured) {
        try {
          // Ensure the case row exists (needed for FK constraint) before inserting subsequent mail
          const { error: caseUpsertError } = await supabase
            .from("dcmms_subject")
            .upsert({
              id: `case-${newLetter.refNo}`,
              case_no: newLetter.refNo,
              assigned_date: newLetter.receivedDate,
              subject: newLetter.subject || null,
              priority: newLetter.priority || "medium",
              status: "In Progress",
            }, { onConflict: "case_no", ignoreDuplicates: true });

          if (caseUpsertError) {
            console.warn("Case upsert warning (may already exist):", caseUpsertError.message);
          }

          const { error } = await supabase
            .from("dcmms_subsequent_mails")
            .insert({
              id: newLetter.id,
              case_no: newLetter.refNo,
              mail_officer_name: newLetter.officerName || null,
              sender_name: newLetter.senderName,
              letter_title: newLetter.subject,
              letter_type: newLetter.letterType || null,
              mail_date: newLetter.letterDate,
              received_date: newLetter.receivedDate,
            });

          if (error) throw error;

          // Also insert into dcmms_daily_mail so that it displays in the daily mail recent add/list ledger
          const { error: mailError } = await supabase
            .from("dcmms_daily_mail")
            .insert({
              id: newLetter.id,
              ref_no: newLetter.refNo,
              sender_name: newLetter.senderName,
              sender_address: newLetter.senderAddress || "N/A",
              letter_date: newLetter.letterDate,
              received_date: newLetter.receivedDate,
              subject: newLetter.subject,
              priority: newLetter.priority || "medium",
              status: "registered",
              letter_no: newLetter.letterNo || null,
              letter_type: newLetter.letterType || null,
              officer_name: newLetter.officerName || null,
              subject_category: newLetter.subjectCategory || null,
              institute_name: newLetter.instituteName || null,
              region_province: mapRegionProvince(newLetter.regionProvince),
            });

          if (mailError) {
            console.error("Error inserting subsequent mail to dcmms_daily_mail:", mailError);
          }

          localStorage.setItem("show_register_success", "true");
          router.push("/daily-mail");
          return;
        } catch (err: any) {
          console.error("Failed to save subsequent mail to Supabase", err);
        }
      }


      // Local storage fallback for subsequent mails
      if (typeof window !== "undefined") {
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
        });
        localStorage.setItem("dcmms_new_mail_current_case", JSON.stringify(list));

        // 2. Also save to dcmms_letters so it displays in the homepage list fallback
        const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
        let lettersList = [];
        try { lettersList = JSON.parse(storedLetters); } catch (e) {}
        lettersList.push(newLetter);
        localStorage.setItem("dcmms_letters", JSON.stringify(lettersList));

        localStorage.setItem("show_register_success", "true");
      }

      router.push("/daily-mail");
      return;
    }

    if (isSupabaseConfigured) {
      const { data: { session: dbgSession } } = await supabase.auth.getSession();
      console.log("[DMMS Debug] isSupabaseConfigured:", isSupabaseConfigured);
      console.log("[DMMS Debug] Session at submit:", dbgSession ? `✓ user=${dbgSession.user.email}` : "✗ NO SESSION (anon)");
      try {
        const { data: upserted, error } = await supabase
          .from("dcmms_daily_mail")
          .upsert({
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
          })
          .select();

        if (error) {
          console.error("Supabase letters write error", error);
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
          console.error("Supabase cases write error", caseError);
          throw caseError;
        }

        // Also write assignment entry to dcmms_subject_assignments if an officer is assigned
        if (newLetter.officerName) {
          const { error: asgnError } = await supabase
            .from("dcmms_subject_assignments")
            .upsert({
              id: `asgn-${newLetter.refNo}`,
              case_no: newLetter.refNo,
              subject_officer_name: newLetter.officerName.trim(),
              status: "Step 1: Officers Assigned",
            });
          if (asgnError) {
            console.warn("Supabase subject assignment write warning:", asgnError.message);
          }
        }

        // success
        console.debug("Supabase upsert returned:", upserted);
        localStorage.setItem("show_register_success", "true");
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
                      ? t("editLetterTitle", "Edit Letter") 
                      : isSubsequentMode 
                        ? t("registerLetterForCurrentComplaintTitle", "Register New Letter for Current Complaint") 
                        : t("registerComplaintTitle")}
                  </h1>
                  <p className="register-subtitle">
                    {isEditMode ? t("editLetterDesc", "Update the saved letter details and save changes.") : t("registerComplaintDesc")}
                  </p>
                </div>
                <div className="register-header-right-btns">
                  <Link href="/daily-mail" className="btn-back-home">
                    <svg className="btn-back-home-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("backToHome")}
                  </Link>
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
                          value={formState.letterNo}
                          onChange={(e) => setFormState({ ...formState, letterNo: e.target.value })}
                          placeholder={t("placeholderLetterNo")}
                          className="field-input"
                        />
                      </div>

                      {/* Reference Number * */}
                      <div className="form-field-group">
                        <label htmlFor="refNo" className="field-label">{t("refNo")} <span className="required-star">*</span></label>
                        <input
                          id="refNo"
                          type="text"
                          required
                          value={formState.refNo}
                          onChange={(e) => setFormState({ ...formState, refNo: e.target.value })}
                          placeholder={t("refPlaceholder")}
                          className="field-input"
                          readOnly={isSubsequentMode}
                        />
                      </div>

                      {/* Mode of Receipt */}
                      <div className="form-field-group">
                        <label htmlFor="letterType" className="field-label">{t("letterType")}</label>
                        <select
                          id="letterType"
                          value={formState.letterType}
                          onChange={(e) => setFormState({ ...formState, letterType: e.target.value })}
                          className="field-select"
                        >
                          <option value="">{t("placeholderLetterType")}</option>
                          {receiptModes.map((mode) => (
                            <option key={mode.value} value={mode.value}>
                              {t(mode.labelKey)}
                            </option>
                          ))}
                        </select>
                      </div>

                    </div>
                  </div>

                  {/* ── Card 2: Sender Details (යවන පාර්ශ්වයේ තොරතුරු) ── */}
                  <div className="register-step-card">
                    <h3 className="register-step-title">{t("stepSenderDetails", "Sender Details")}</h3>
                    <div className="register-step-grid">

                      {/* Sender's Party * */}
                      <div className="form-field-group">
                        <label htmlFor="senderName" className="field-label">{t("senderName")} <span className="required-star">*</span></label>
                        <input
                          id="senderName"
                          type="text"
                          required
                          value={formState.senderName}
                          onChange={(e) => setFormState({ ...formState, senderName: e.target.value })}
                          placeholder={t("senderPlaceholder")}
                          className="field-input"
                        />
                      </div>

                      {/* Nature of the Letter */}
                      <div className="form-field-group">
                        <label htmlFor="regionProvince" className="field-label">{t("regionProvince")}</label>
                        <select
                          id="regionProvince"
                          value={formState.regionProvince}
                          onChange={(e) => setFormState({ ...formState, regionProvince: e.target.value })}
                          className="field-select"
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
                          value={formState.subjectCategory}
                          onChange={(e) => setFormState({ ...formState, subjectCategory: e.target.value })}
                          className="field-select"
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

                      {/* Subject / Matter of the Letter */}
                      <div className="form-field-group">
                        <label htmlFor="subject" className="field-label">{t("letterTitle")}</label>
                        <input
                          id="subject"
                          type="text"
                          value={formState.subject}
                          onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                          placeholder={t("subjectPlaceholder")}
                          className="field-input"
                        />
                      </div>

                      {/* Date Received by Additional Secretary */}
                      <div className="form-field-group">
                        <label htmlFor="receivedDate" className="field-label">{t("receivedDate")}</label>
                        <div className="input-icon-wrapper">
                          <input
                            id="receivedDate"
                            type="date"
                            value={formState.receivedDate}
                            onChange={(e) => setFormState({ ...formState, receivedDate: e.target.value })}
                            className="field-input input-with-right-icon"
                          />
                          <div className="input-right-icons">
                            <svg className="input-right-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Date Letter Handed Over to Disciplinary Branch */}
                      <div className="form-field-group">
                        <label htmlFor="letterDate" className="field-label">{t("letterDate")}</label>
                        <div className="input-icon-wrapper">
                          <input
                            id="letterDate"
                            type="date"
                            value={formState.letterDate}
                            onChange={(e) => setFormState({ ...formState, letterDate: e.target.value })}
                            className="field-input input-with-right-icon"
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
                        <label htmlFor="officerNameInput" className="field-label">{t("nameOfOfficer")}</label>
                        <div className="searchable-select-wrapper">
                          <div className="searchable-select-input-container">
                            <input
                              id="officerNameInput"
                              type="text"
                              readOnly
                              value={formState.officerName || ""}
                              onClick={() => setIsOfficerDropdownOpen(!isOfficerDropdownOpen)}
                              placeholder={t("selectSubjectOfficer")}
                              className="field-input searchable-select-input"
                            />
                            <div className="searchable-select-icons">
                              {formState.officerName && (
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
                                className="searchable-select-arrow-btn"
                                onClick={() => setIsOfficerDropdownOpen(!isOfficerDropdownOpen)}
                              >
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
                              </button>
                            </div>
                          </div>

                          {isOfficerDropdownOpen && (
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
                              value={formState.priority}
                              onChange={(e) => setFormState({ ...formState, priority: e.target.value as any })}
                              className="field-select"
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

                  {/* Form Action Buttons */}
                  <div className="register-form-actions">
                    <button
                      type="button"
                      className="btn-action-cancel"
                      onClick={() => router.push("/daily-mail")}
                    >
                      {t("cancelBtn")}
                    </button>

                    <button
                      type="submit"
                      className="btn-action-submit"
                    >
                      {isEditMode ? t("saveChangesBtn", "Save Changes") : t("submitBtn")}
                    </button>
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
