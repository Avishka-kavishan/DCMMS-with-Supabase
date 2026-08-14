"use client";

import "../../../i18n";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../subject.css";
import "./add-details.css";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { getCurrentProfile, dashboardPath } from "@/lib/auth";
import { CheckCircle, X } from "lucide-react";
import { getInstitutesServer, saveInstituteServer, saveAccusedOfficerServer, getAccusedOfficerByRefServer } from "@/lib/db-actions";
const formatStepTaken = (step: string, t: any) => {
  if (!step) return "";
  if (step.startsWith("[EduSecApproval:")) {
    const isApproved = step.includes("EduSecApproval:yes");
    const dateMatch = step.match(/Date:([^\]\s]+)/);
    const dateStr = dateMatch ? dateMatch[1] : "";
    if (isApproved) {
      return `${t("eduSecretaryApproval")}: ${t("yesLabel")} (${t("approvalDate")}: ${dateStr})`;
    } else {
      return `${t("eduSecretaryApproval")}: ${t("noLabel")}`;
    }
  }
  return step;
};

export function parseCommitteeDetails(asgn: any) {
  let chairmanName = "";
  let chairmanNic = "";
  let memberList: string[] = [];

  if (asgn?.chairman) {
    if (typeof asgn.chairman === "object" && asgn.chairman !== null) {
      chairmanName = asgn.chairman.fullName || asgn.chairman.name || asgn.chairman.officer_name || "";
      chairmanNic = asgn.chairman.nicNo || asgn.chairman.nic || asgn.chairman.nic_no || "";
    } else if (typeof asgn.chairman === "string") {
      if (asgn.chairman.startsWith("{")) {
        try {
          const parsed = JSON.parse(asgn.chairman);
          chairmanName = parsed.fullName || parsed.name || parsed.officer_name || "";
          chairmanNic = parsed.nicNo || parsed.nic || parsed.nic_no || "";
        } catch (e) {
          chairmanName = asgn.chairman;
        }
      } else {
        chairmanName = asgn.chairman;
      }
    }
  }

  if (asgn?.members) {
    if (Array.isArray(asgn.members)) {
      memberList = asgn.members.map((m: any) => {
        if (typeof m === "object" && m !== null) {
          return m.fullName || m.name || m.officer_name || "";
        }
        return String(m || "");
      }).filter(Boolean);
    } else if (typeof asgn.members === "string") {
      try {
        const parsed = JSON.parse(asgn.members);
        if (Array.isArray(parsed)) {
          memberList = parsed.map((m: any) => (typeof m === "object" ? m.fullName || m.name || m.officer_name : String(m))).filter(Boolean);
        } else {
          memberList = asgn.members.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
      } catch (e) {
        memberList = asgn.members.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    }
  }

  const rawText = String(asgn?.assignedOfficers || asgn?.assigned_officers || asgn?.officerName || asgn?.committeeDetails || "").trim();

  if (!chairmanName && rawText) {
    if (rawText.includes("Chairman:")) {
      const match = rawText.match(/Chairman:\s*([^|]+)/i);
      if (match && match[1]) chairmanName = match[1].trim();
    } else if (rawText.includes("(Chairman)")) {
      const match = rawText.match(/([^(,]+)\s*\(Chairman\)/i);
      if (match && match[1]) chairmanName = match[1].trim();
    }
  }

  if (memberList.length === 0 && rawText) {
    if (rawText.includes("Members:")) {
      const match = rawText.match(/Members:\s*([^|]+)/i);
      if (match && match[1]) {
        memberList = match[1].split(",").map((s) => s.trim()).filter(Boolean);
      }
    } else if (rawText.includes("(Member)") || rawText.includes("(Members)")) {
      const matches = rawText.matchAll(/([^(,]+)\s*\(Members?\)/gi);
      for (const m of matches) {
        if (m[1] && m[1].trim()) memberList.push(m[1].trim());
      }
    }
  }

  const isPlaceholder = !rawText || rawText.includes("—") || rawText.includes("not yet assigned") || rawText.includes("යවා නොමැත");
  const hasDetails = !!(chairmanName || memberList.length > 0 || (!isPlaceholder && rawText));

  return {
    chairmanName,
    chairmanNic,
    memberList,
    rawText: isPlaceholder ? "" : rawText,
    hasDetails
  };
}

function CaseDetailsForm() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseNoParam = searchParams?.get("caseNo") || "CA/2026/01";

  // Accessibility & language state
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [letterData, setLetterData] = useState<any>(null);
  const [subsequentMails, setSubsequentMails] = useState<any[]>([]);
  const [previousActions, setPreviousActions] = useState<any[]>([]);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  // Format date statically to match mockup
  const getFormattedDate = () => {
    const date = new Date();
    if (lang === "si") {
      return date.toLocaleDateString("si-LK", { day: "numeric", month: "long", year: "numeric" });
    }
    if (lang === "ta") {
      return date.toLocaleDateString("ta-LK", { day: "numeric", month: "long", year: "numeric" });
    }
    return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  };

  // Mobile sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  // Sync document properties
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t("addSubjectDetailsTitle")} | DCMMS`;
  }, [lang, t]);

  // Sync letter data with flowchart states on load
  useEffect(() => {
    if (letterData) {
      const cleanVal = (val: string | null | undefined) => {
        if (!val) return "";
        const trimmed = val.trim();
        if (trimmed.toUpperCase() === "N/A" || trimmed === "—" || trimmed === "-") return "";
        return trimmed;
      };

      setComplainantName(cleanVal(letterData.senderName));
      setComplainantAddress(cleanVal(letterData.senderAddress));
      if (!isUserEditingSchoolRef.current && letterData.instituteName) {
        const instVal = cleanVal(letterData.instituteName);
        if (instVal) {
          setSchoolName(instVal);
        }
      }
      setComplaintMatter(cleanVal(letterData.subject));
      
      const isAnon = !letterData.senderName || 
                     letterData.senderName.toLowerCase().includes("anonymous") || 
                     letterData.senderName.toLowerCase().includes("නිර්නාමික") ||
                     letterData.regionProvince?.toLowerCase().includes("anonymous");
      setClassification(isAnon ? "anonymous" : "nominal");

      // Check if case is old
      let localIsOld = false;
      if (typeof window !== "undefined") {
        const storedCases = localStorage.getItem("dcmms_cases");
        if (storedCases) {
          try {
            const casesList = JSON.parse(storedCases);
            const foundCase = casesList.find((c: any) => c.caseNo === letterData.refNo);
            if (foundCase) {
              localIsOld = !!foundCase.isOld;
            }
          } catch (e) {}
        }
      }
      setComplaintAge(localIsOld ? "old" : "new");
    }
  }, [letterData]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // Form States - Left Card ("Add Details")
  const [subjectOfficer, setSubjectOfficer] = useState("");
  const [reportState, setReportState] = useState("");
  const [receivedDate, setReceivedDate] = useState("2026-06-23");
  const [stepTaken, setStepTaken] = useState("");
  const [refNo, setRefNo] = useState(caseNoParam);
  const [fileRelated, setFileRelated] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [priority, setPriority] = useState("medium");

  // Data Flow Assignment States (From Investigation Admin)
  const [assignedOfficersText, setAssignedOfficersText] = useState("");
  const [assignmentData, setAssignmentData] = useState<any>(null);
  const [subjectApptDate, setSubjectApptDate] = useState("");
  const [subjectDueDate, setSubjectDueDate] = useState("");

  // Flowchart Form States (as in the flowchart diagram)
  const [classification, setClassification] = useState<"nominal" | "anonymous">("nominal");
  const [complainantName, setComplainantName] = useState("");
  const [complainantAddress, setComplainantAddress] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolProvince, setSchoolProvince] = useState("");
  const [schoolDistrict, setSchoolDistrict] = useState("");
  const [schoolZone, setSchoolZone] = useState("");
  const [complaintMatter, setComplaintMatter] = useState("");
  const [complaintAge, setComplaintAge] = useState<"new" | "old">("new");

  const isUserEditingReportStateRef = useRef(false);

  const normalizeReportState = (val: string | null | undefined): string => {
    if (!val) return "";
    const trimmed = String(val).trim();
    if (!trimmed || trimmed.toUpperCase() === "N/A" || trimmed === "—" || trimmed === "-") return "";

    const optionMap: Record<string, string[]> = {
      statusCallingReports: [
        "statuscallingreports",
        "calling reports from principal/zone/province/police",
        "විදුහල්පති/කලාප/පළාත්/පොලිස් වාර්තා කැදවීම",
      ],
      statusCallingCourtReports: [
        "statuscallingcourtreports",
        "calling court reports",
        "අධිකරණ වාර්තා කැදවීම",
        "උසාවි වාර්තා කැදවීම",
      ],
      statusPreliminaryInvestigation: [
        "statuspreliminaryinvestigation",
        "conducting preliminary investigations",
        "මූලික විමර්ශන සිදු කිරීම",
      ],
      statusInquiry: [
        "statusinquiry",
        "conducting an inquiry",
        "පරීක්ෂණයක් සිදු කිරීම",
        "පරීක්ෂණයක් පැවැත්වීම",
      ],
      statusConsultRelevantInstitutes: [
        "statusconsultrelevantinstitutes",
        "taking advice from relevant institutes for complaints",
        "පැමිණිලි සදහා අදාළ ආයතන වලින් උපදෙස් ලබා ගැනීම",
        "පැමිණිලි සදහා අදාල ආයතන වලින් උපදෙස් ලබා ගැනීම",
      ],
      statusObtainStatements: [
        "statusobtainstatements",
        "proceeding by taking statements",
        "ප්රකාශ ලබා ගැනීම මගින් ඉදිරි කටයුතු සිදු කිරීම",
        "කටඋත්තර ලබා ගනිමින් කටයුතු කිරීම",
      ],
      statusUnclearAnonymous: [
        "statusunclearanonymous",
        "unclear facts / anonymous letters file",
        "කරුණු අපැදිලි/නිර්නාමික ලිපි ගොනු",
        "අපැහැදිලි තොරතුරු / නිර්නාමික ලිපි ගොනු කිරීම",
      ],
      statusReferOtherInstitute: [
        "statusreferotherinstitute",
        "referring letters not related to this ministry system to other institutes",
        "මෙම අමාත්යංශ පද්ධතියට අයත් නොවන ලිපි වෙනත් ආයතන වෙත යොමු කිරීම",
        "මෙම අමාත්‍යාංශ පද්ධතියට අදාල නැති ලිපි වෙනත් ආයතන වලට යොමු කිරීම",
      ],
    };

    const lower = trimmed.toLowerCase();
    for (const [key, aliases] of Object.entries(optionMap)) {
      if (key.toLowerCase() === lower || aliases.some((a) => a.toLowerCase() === lower)) {
        return key;
      }
    }

    return trimmed;
  };

  // Institute Autocomplete States (from institute_table)
  const isUserEditingSchoolRef = useRef(false);
  const [institutesList, setInstitutesList] = useState<{ name: string; address: string; province: string; district: string; zone: string }[]>([]);
  const [filteredInstitutes, setFilteredInstitutes] = useState<{ name: string; address: string; province: string; district: string; zone: string }[]>([]);
  const [showInstituteDropdown, setShowInstituteDropdown] = useState(false);

  useEffect(() => {
    const fetchInstitutesForAutocomplete = async () => {
      try {
        let res: any = null;
        try {
          res = await getInstitutesServer();
        } catch (actionErr) {
          try {
            const apiRes = await fetch("/api/institutes");
            if (apiRes.ok) res = await apiRes.json();
          } catch (e) {}
        }
        if (res && res.success && Array.isArray(res.data)) {
          const list = res.data
            .map((item: any) => {
              const name = (item.name || item.institute_name || "").trim();
              const addrRaw = (item.address || "").trim();
              const distRaw = (item.district || "").trim();
              const provRaw = (item.province || "").trim();
              const zoneRaw = (item.zone || "").trim();

              // Build full address using address column + district/province if address is short
              let fullAddr = addrRaw;
              if (addrRaw && distRaw && !addrRaw.toLowerCase().includes(distRaw.toLowerCase())) {
                fullAddr = `${addrRaw}, ${distRaw}`;
              }

              return {
                name,
                address: fullAddr || addrRaw || "",
                province: provRaw,
                district: distRaw,
                zone: zoneRaw,
              };
            })
            .filter((item: any) => item.name);
          setInstitutesList(list);
        }
      } catch (e) {
        console.error("Failed to load institutes for autocomplete", e);
      }
    };
    fetchInstitutesForAutocomplete();
  }, []);

  const handleSchoolNameChange = (val: string) => {
    isUserEditingSchoolRef.current = true;
    setSchoolName(val);
    const query = val.toLowerCase().trim();
    if (query.length > 0) {
      const matches = institutesList
        .filter((inst) => inst.name.toLowerCase().includes(query))
        .slice(0, 10);
      setFilteredInstitutes(matches);
      setShowInstituteDropdown(matches.length > 0);

      // If exact match found, auto-populate province/district/zone
      const exactMatch = institutesList.find((inst) => inst.name.toLowerCase() === query);
      if (exactMatch) {
        if (exactMatch.province) setSchoolProvince(exactMatch.province);
        if (exactMatch.district) setSchoolDistrict(exactMatch.district);
        if (exactMatch.zone) setSchoolZone(exactMatch.zone);
        if (exactMatch.address && !schoolAddress) setSchoolAddress(exactMatch.address);
      }
    } else {
      setFilteredInstitutes([]);
      setShowInstituteDropdown(false);
    }
  };

  const handleSelectInstitute = (inst: { name: string; address: string; province: string; district: string; zone: string }) => {
    isUserEditingSchoolRef.current = true;
    setSchoolName(inst.name);
    if (inst.address) setSchoolAddress(inst.address);
    if (inst.province) setSchoolProvince(inst.province);
    if (inst.district) setSchoolDistrict(inst.district);
    if (inst.zone) setSchoolZone(inst.zone);
    setShowInstituteDropdown(false);
  };

  // Form States - Right Card ("If officer concerned with the Complaint")
  interface ConcernedPerson {
    id?: string;
    name: string;
    position: string;
    dob: string;
    nic: string;
    appointmentDate: string;
    address: string;
  }

  const [isConcerned, setIsConcerned] = useState<"yes" | "no">("no");
  const [eduSecretaryApproval, setEduSecretaryApproval] = useState<"yes" | "no">("no");
  const [approvalDate, setApprovalDate] = useState("");
  const [concernedPersons, setConcernedPersons] = useState<ConcernedPerson[]>([
    { name: "", position: "", dob: "", nic: "", appointmentDate: "", address: "" }
  ]);

  const handleAddPerson = () => {
    setConcernedPersons((prev) => [
      ...prev,
      { name: "", position: "", dob: "", nic: "", appointmentDate: "", address: "" }
    ]);
  };

  const handleRemovePerson = (index: number) => {
    if (concernedPersons.length <= 1) return;
    setConcernedPersons((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePersonChange = (index: number, field: keyof ConcernedPerson, value: string) => {
    setConcernedPersons((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Verify role and pre-populate fields on mount
  useEffect(() => {
    const verifyAndFetch = async () => {
      // 1. Role verification
      if (isSupabaseConfigured) {
        try {
          const profile = await getCurrentProfile();
          if (!profile || profile.role !== "subject_officer") {
            if (profile) {
              router.replace(dashboardPath(profile.role));
            } else {
              router.replace("/");
            }
            return;
          }
        } catch (err) {
          console.error("Auth check failed:", err);
          router.replace("/");
          return;
        }
      }

      // 2. Fetch complaint details (Daily Mail form details)
      if (caseNoParam) {
        if (isSupabaseConfigured) {
          try {
            const { data, error } = await supabase
              .from("dcmms_daily_mail")
              .select("*")
              .eq("ref_no", caseNoParam)
              .single();

            if (error && error.code !== "PGRST116") throw error;

            if (data) {
              setLetterData({
                id: data.id,
                refNo: data.ref_no,
                senderName: data.sender_name,
                senderAddress: data.sender_address,
                letterDate: data.letter_date,
                receivedDate: data.received_date,
                subject: data.subject,
                priority: data.priority,
                status: data.status,
                letterNo: data.letter_no,
                letterType: data.letter_type,
                officerName: data.officer_name,
                subjectCategory: data.subject_category,
                instituteName: data.institute_name,
                regionProvince: data.region_province,
              });
              setPriority(data.priority || "medium");
            }
          } catch (e) {
            console.error("Failed to fetch letter details from Supabase", e);
          }
        }

        // Fetch from local storage fallback for Daily Mail details
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("dcmms_letters");
          if (stored) {
            try {
              const list = JSON.parse(stored);
              const found = list.find((item: any) => item.refNo === caseNoParam);
              if (found) {
                setLetterData(found);
                setPriority(found.priority || "medium");
              }
            } catch (e) {
              console.error("Failed to parse letters from local storage", e);
            }
          }
        }

        // Fetch Subject Assignment details (Chairman, Members, Extension, After-Investigation details)
        if (caseNoParam) {
          let asgn: any = null;
          if (isSupabaseConfigured) {
            try {
              const { data } = await supabase
                .from("dcmms_subject_assignments")
                .select("*")
                .ilike("case_no", caseNoParam.trim())
                .maybeSingle();
              if (data) asgn = data;
            } catch (e) {}
          }
          if (typeof window !== "undefined") {
            try {
              const storedLetters = localStorage.getItem("dcmms_letters");
              if (storedLetters) {
                const letters = JSON.parse(storedLetters);
                const foundLetter = letters.find((l: any) =>
                  String(l.refNo || l.caseNo || "").trim().toLowerCase() === String(caseNoParam).trim().toLowerCase()
                );
                if (foundLetter) asgn = { ...foundLetter, ...asgn };
              }
            } catch (e) {}

            try {
              const storedCases = localStorage.getItem("dcmms_cases");
              if (storedCases) {
                const cases = JSON.parse(storedCases);
                const foundCase = cases.find((c: any) =>
                  String(c.caseNo || c.refNo || "").trim().toLowerCase() === String(caseNoParam).trim().toLowerCase()
                );
                if (foundCase) asgn = { ...foundCase, ...asgn };
              }
            } catch (e) {}

            try {
              const stored = localStorage.getItem("dcmms_subject_assignments");
              if (stored) {
                const list = JSON.parse(stored);
                const found = list.find((a: any) =>
                  (a.caseNo && String(a.caseNo).trim().toLowerCase() === String(caseNoParam).trim().toLowerCase()) ||
                  (a.case_no && String(a.case_no).trim().toLowerCase() === String(caseNoParam).trim().toLowerCase())
                );
                if (found) asgn = { ...asgn, ...found };
              }
            } catch (e) {}
          }
          if (asgn) {
            setAssignmentData(asgn);
            let officerText = asgn.assigned_officers || asgn.assignedOfficers || "";
            if (!officerText && (asgn.chairman || asgn.members)) {
              const chairmanPart = asgn.chairman ? `Chairman: ${asgn.chairman.fullName || asgn.chairman.name}` : "";
              const membersPart = Array.isArray(asgn.members) && asgn.members.length > 0 ? `Members: ${asgn.members.map((m: any) => m.fullName || m.name).join(", ")}` : "";
              officerText = [chairmanPart, membersPart].filter(Boolean).join(" | ");
            }
            if (officerText) setAssignedOfficersText(officerText);
            if (asgn.appointment_date || asgn.appointmentDate) setSubjectApptDate(asgn.appointment_date || asgn.appointmentDate);
            if (asgn.report_due_date || asgn.reportDueDate) setSubjectDueDate(asgn.report_due_date || asgn.reportDueDate);
          }
        }

        // 3. Fetch subject details (from dcmms_subject_details and dcmms_concerned_officers)
        if (isSupabaseConfigured) {
          try {
            // Load subsequent mails for this case
            const { data: mailsData, error: mailsError } = await supabase
              .from("dcmms_subsequent_mails")
              .select("*")
              .eq("case_no", caseNoParam);

            if (!mailsError && mailsData) {
              const mapped = mailsData.map((d: any) => ({
                id: d.id,
                refNo: d.case_no,
                officerName: d.mail_officer_name,
                senderName: d.sender_name,
                subject: d.letter_title,
                letterType: d.letter_type,
                letterDate: d.mail_date,
                receivedDate: d.received_date,
              }));
              setSubsequentMails(mapped);
            }

            // Load new letter actions history list
            const { data: actionsData, error: actionError } = await supabase
              .from("dcmms_subject_details")
              .select("*")
              .eq("case_no", caseNoParam)
              .order("received_date", { ascending: false });

            if (!actionError && actionsData) {
              const mapped = actionsData.map((d: any) => ({
                id: d.id,
                caseNo: d.case_no,
                receivedDate: d.received_date,
                reportState: d.report_state,
                specialNotes: d.special_notes,
                subjectOfficerName: d.subject_officer_name,
                stepItem: d.step_taken, // map step_taken to stepItem just in case
                stepTaken: d.step_taken,
              }));
              setPreviousActions(mapped);

              // Pre-populate the form inputs with the most recent action details
              if (mapped.length > 0) {
                const latest = mapped[0];
                setSubjectOfficer(latest.subjectOfficerName || "");
                if (!isUserEditingReportStateRef.current) {
                  setReportState(normalizeReportState(latest.reportState));
                }
                setReceivedDate(latest.receivedDate || "2026-06-23");
                
                const rawStep = latest.stepTaken || "";
                if (rawStep.startsWith("[EduSecApproval:")) {
                  const isApproved = rawStep.includes("EduSecApproval:yes");
                  setEduSecretaryApproval(isApproved ? "yes" : "no");
                  const dateMatch = rawStep.match(/Date:([^\]\s]+)/);
                  setApprovalDate(dateMatch ? dateMatch[1] : "");
                  setStepTaken("");
                } else {
                  setEduSecretaryApproval("no");
                  setApprovalDate("");
                  setStepTaken(rawStep);
                }
                
                setRefNo(latest.caseNo || caseNoParam);
                setSpecialNotes(latest.specialNotes || "");
              }
            }

            // Load concerned officer details
            const { data: concernedDataList, error: concernedError } = await supabase
              .from("dcmms_concerned_officers")
              .select("*")
              .eq("case_no", caseNoParam);

            if (!concernedError && concernedDataList && concernedDataList.length > 0) {
              const cleanVal = (val: string | null | undefined) => {
                if (!val) return "";
                const trimmed = val.trim();
                if (trimmed.toUpperCase() === "N/A" || trimmed === "—" || trimmed === "-") return "";
                return trimmed;
              };
              const mappedPersons: ConcernedPerson[] = concernedDataList.map((cd: any) => ({
                id: cd.id,
                name: cleanVal(cd.officer_name),
                position: cleanVal(cd.position),
                dob: cleanVal(cd.dob),
                nic: cleanVal(cd.nic),
                appointmentDate: cleanVal(cd.appointment_date),
                address: cleanVal(cd.address),
              }));
              setConcernedPersons(mappedPersons);
              setIsConcerned(mappedPersons.some(p => p.name) ? "yes" : "no");
              if (!isUserEditingSchoolRef.current) {
                if (concernedDataList[0]?.institute_name) {
                  const val = cleanVal(concernedDataList[0].institute_name);
                  if (val) setSchoolName(val);
                }
                if (concernedDataList[0]?.institute_address) {
                  const val = cleanVal(concernedDataList[0].institute_address);
                  if (val) setSchoolAddress(val);
                }
              }
            } else {
              setIsConcerned("no");
            }
          } catch (e) {
            console.error("Failed to fetch case details from Supabase", e);
          }
        }

        // Always load PostgreSQL form, accused officer & school details directly via getAccusedOfficerByRefServer with API fallback
        try {
          let pgRes: any = null;
          try {
            pgRes = await getAccusedOfficerByRefServer(caseNoParam);
          } catch (actionErr) {
            try {
              const apiRes = await fetch(`/api/subject-officer-form?ref_number=${encodeURIComponent(caseNoParam)}`);
              if (apiRes.ok) pgRes = await apiRes.json();
            } catch (e) {}
          }
          if (pgRes && pgRes.success && pgRes.data) {
            const d = pgRes.data;
            const cleanVal = (val: string | null | undefined) => {
              if (!val) return "";
              const trimmed = String(val).trim();
              if (trimmed.toUpperCase() === "N/A" || trimmed === "—" || trimmed === "-") return "";
              return trimmed;
            };

            if (d.classification_of_complaint_letter) {
              setClassification(d.classification_of_complaint_letter === "anonymous" ? "anonymous" : "nominal");
            }
            if (d.name_of_the_presenting_the_complain) {
              setComplainantName(cleanVal(d.name_of_the_presenting_the_complain));
            }
            if (d.address_of_the_person_presenting_the_complaint) {
              setComplainantAddress(cleanVal(d.address_of_the_person_presenting_the_complaint));
            }
            if (d.subject_file_no) {
              setSpecialNotes(cleanVal(d.subject_file_no));
            }
            if (!isUserEditingReportStateRef.current && d.future_action) {
              setReportState(normalizeReportState(d.future_action));
            }
            if (d.date_prepared_and_submitted_for_signature) {
              setReceivedDate(String(d.date_prepared_and_submitted_for_signature).split("T")[0]);
            }

            const officersList = Array.isArray(d.accused_officers) && d.accused_officers.length > 0
              ? d.accused_officers
              : (d.accused_officer ? [d.accused_officer] : []);

            if (officersList.length > 0) {
              const mappedPersons = officersList.map((ao: any) => ({
                id: ao.id,
                name: cleanVal(ao.accused_officer_name),
                position: cleanVal(ao.position),
                dob: ao.date_of_birth ? String(ao.date_of_birth).split("T")[0] : "",
                nic: cleanVal(ao.nic_no),
                appointmentDate: ao.appointment_date ? String(ao.appointment_date).split("T")[0] : "",
                address: cleanVal(ao.address),
              })).filter((p: any) => p.name || p.position || p.nic);

              if (mappedPersons.length > 0) {
                setConcernedPersons(mappedPersons);
                setIsConcerned("yes");
              }
            }

            const sch = d.accused_school;
            if (!isUserEditingSchoolRef.current && sch && sch.accused_school_name) {
              const valName = cleanVal(sch.accused_school_name);
              if (valName) setSchoolName(valName);
              if (sch.address) {
                const valAddr = cleanVal(sch.address);
                if (valAddr) setSchoolAddress(valAddr);
              }
              if (sch.province) setSchoolProvince(cleanVal(sch.province));
              if (sch.district) setSchoolDistrict(cleanVal(sch.district));
              if (sch.zone) setSchoolZone(cleanVal(sch.zone));
            }
          }
        } catch (pgErr) {
          console.error("Failed to fetch accused officer details from PostgreSQL:", pgErr);
        }

        // Local storage fallbacks
        if (typeof window !== "undefined") {
          // Subsequent mails fallback
          const storedMails = localStorage.getItem("dcmms_new_mail_current_case");
          if (storedMails) {
            try {
              const list = JSON.parse(storedMails);
              const found = list.filter((item: any) => item.caseNo === caseNoParam);
              const mapped = found.map((item: any) => ({
                id: item.id,
                refNo: item.caseNo || item.refNo,
                officerName: item.mailOfficerName || item.officerName,
                senderName: item.senderName,
                subject: item.letterTitle || item.subject,
                letterType: item.letterType,
                letterDate: item.mailDate || item.letterDate,
                receivedDate: item.receivedDate,
              }));
              setSubsequentMails(mapped);
            } catch (e) {
              console.error("Failed to parse subsequent letters from localStorage", e);
            }
          }

          // Actions list timeline fallback
          const storedActions = localStorage.getItem("dcmms_new_letter_current_case");
          if (storedActions) {
            try {
              const actionsMap = JSON.parse(storedActions);
              let foundActions = [];
              if (Array.isArray(actionsMap)) {
                foundActions = actionsMap.filter((item: any) => item.caseNo === caseNoParam);
              } else if (actionsMap[caseNoParam]) {
                foundActions = [actionsMap[caseNoParam]];
              }

              foundActions.sort((a: any, b: any) => new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime());
              setPreviousActions(foundActions);

              if (foundActions.length > 0) {
                const latest = foundActions[0];
                setSubjectOfficer(latest.subjectOfficerName || "");
                if (!isUserEditingReportStateRef.current) {
                  setReportState(normalizeReportState(latest.reportState));
                }
                setReceivedDate(latest.receivedDate || "2026-06-23");
                
                const rawStep = latest.stepTaken || "";
                if (rawStep.startsWith("[EduSecApproval:")) {
                  const isApproved = rawStep.includes("EduSecApproval:yes");
                  setEduSecretaryApproval(isApproved ? "yes" : "no");
                  const dateMatch = rawStep.match(/Date:([^\]\s]+)/);
                  setApprovalDate(dateMatch ? dateMatch[1] : "");
                  setStepTaken("");
                } else {
                  setEduSecretaryApproval("no");
                  setApprovalDate("");
                  setStepTaken(rawStep);
                }
                
                setRefNo(latest.caseNo || caseNoParam);
                setSpecialNotes(latest.specialNotes || "");
              }
            } catch (e) {
              console.error("Failed to parse actions from localStorage", e);
            }
          }

          const storedConcerned = localStorage.getItem("dcmms_officer_concerned");
          if (storedConcerned) {
            try {
              const concernedMap = JSON.parse(storedConcerned);
              const existingConcerned = concernedMap[caseNoParam];
              if (existingConcerned) {
                const cleanVal = (val: string | null | undefined) => {
                  if (!val) return "";
                  const trimmed = val.trim();
                  if (trimmed.toUpperCase() === "N/A" || trimmed === "—" || trimmed === "-") return "";
                  return trimmed;
                };
                if (Array.isArray(existingConcerned.persons) && existingConcerned.persons.length > 0) {
                  setConcernedPersons(existingConcerned.persons);
                  setIsConcerned("yes");
                } else if (existingConcerned.officerName) {
                  setConcernedPersons([{
                    name: cleanVal(existingConcerned.officerName),
                    position: cleanVal(existingConcerned.position),
                    dob: cleanVal(existingConcerned.dob),
                    nic: cleanVal(existingConcerned.nic),
                    appointmentDate: cleanVal(existingConcerned.appointmentDate),
                    address: cleanVal(existingConcerned.address),
                  }]);
                  setIsConcerned("yes");
                }
                if (!isUserEditingSchoolRef.current) {
                  if (existingConcerned.instituteName) {
                    const valName = cleanVal(existingConcerned.instituteName);
                    if (valName) setSchoolName(valName);
                  }
                  if (existingConcerned.schoolAddress) {
                    const valAddr = cleanVal(existingConcerned.schoolAddress);
                    if (valAddr) setSchoolAddress(valAddr);
                  }
                }
              }
            } catch (e) {
              console.error("Failed to parse concerned officer from localStorage", e);
            }
          }
        }
      }

      setCheckingAuth(false);
    };

    verifyAndFetch();

    let channel: any = null;
    if (isSupabaseConfigured && caseNoParam) {
      channel = supabase
        .channel(`subject-add-details-realtime-${caseNoParam}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject_assignments" }, verifyAndFetch)
        .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject_details" }, verifyAndFetch)
        .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_daily_mail" }, verifyAndFetch)
        .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subsequent_mails" }, verifyAndFetch)
        .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_concerned_officers" }, verifyAndFetch)
        .subscribe();
    }

    const handleLocalUpdate = () => verifyAndFetch();
    window.addEventListener("storage", handleLocalUpdate);
    window.addEventListener("dcmms_data_updated", handleLocalUpdate);
    window.addEventListener("dcmms_assignment_updated", handleLocalUpdate);

    const interval = setInterval(verifyAndFetch, 15000);


    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener("storage", handleLocalUpdate);
      window.removeEventListener("dcmms_data_updated", handleLocalUpdate);
      window.removeEventListener("dcmms_assignment_updated", handleLocalUpdate);
      clearInterval(interval);
    };
  }, [caseNoParam, router]);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
  };

  const syncCalendar = async (apptDate: string) => {
    if (!apptDate) return;
    const newEvent = {
      id: `mock-${Date.now()}`,
      summary: `Officer Appointment: ${refNo}`,
      description: `Appointment date for Inquiry Officer ${concernedPersons[0]?.name || ""} for Subject: ${subjectOfficer || ""}.`,
      start: { dateTime: `${apptDate}T09:00:00+05:30` },
      end: { dateTime: `${apptDate}T10:00:00+05:30` },
      location: concernedPersons[0]?.address || "Discipline Branch, Isurupaya",
      source: "Officer Appointment Date",
    };

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from("dcmms_calendar")
          .upsert({
            id: newEvent.id,
            summary: newEvent.summary,
            description: newEvent.description,
            start_time: newEvent.start.dateTime,
            end_time: newEvent.end.dateTime,
            location: newEvent.location,
            source: newEvent.source,
          });
        return;
      } catch (err) {
        console.error("Failed to sync calendar to Supabase", err);
      }
    }

    // Fallback
    try {
      const stored = localStorage.getItem("dcmms_calendar_events") || "[]";
      const list = JSON.parse(stored);
      list.push(newEvent);
      localStorage.setItem("dcmms_calendar_events", JSON.stringify(list));
    } catch (err) {
      console.error("Failed to sync to local calendar storage", err);
    }
  };

  const handleSubjectSubmitDates = async () => {
    if (!subjectApptDate || !subjectDueDate) {
      alert("Please select both Appointment Date and Report Due Date.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const updated = {
      ...(assignmentData || {}),
      caseNo: caseNoParam,
      appointmentDate: subjectApptDate,
      reportDueDate: subjectDueDate,
      datesSubmittedBySubject: true,
      datesSubmitTimestamp: today,
      status: "Dates Confirmed by Subject Officer",
    };

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(stored);
        list = list.filter((a: any) => (a.caseNo !== caseNoParam && a.case_no !== caseNoParam));
        list.push(updated);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from("dcmms_subject_assignments").upsert({
          id: updated.id || `asgn-${caseNoParam}`,
          case_no: caseNoParam,
          subject_officer_name: updated.subjectOfficerName || subjectOfficer || "Subject Officer",
          assigned_officers: Array.isArray(updated.assignedOfficers) ? updated.assignedOfficers : (updated.assignedOfficers ? [updated.assignedOfficers] : null),
          chairman: updated.chairman || null,
          members: updated.members || null,
          appointment_date: subjectApptDate,
          report_due_date: subjectDueDate,
          dates_submitted_by_subject: true,
          status: updated.status,
        });
        await supabase.from("dcmms_subject").update({
          subject_officer_name: updated.subjectOfficerName || subjectOfficer || "Subject Officer",
        }).eq("case_no", caseNoParam);
      } catch (e) {}
    }
    setAssignmentData(updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("dcmms_assignment_updated"));
      window.dispatchEvent(new Event("dcmms_data_updated"));
    }
    alert(i18n.language === "si" ? "පත්වීම් ලිපිය දිනය සහ වාර්තා දිනය Admin වෙත යවන ලදී!" : "Appointment Date and Report Due Date submitted to Admin!");
  };

  const saveCaseData = async (status: string, isDraftMode = false) => {
    const actionId = `action-${refNo}-${Date.now()}`;
    const serializedStepTaken = `[EduSecApproval:${eduSecretaryApproval}${eduSecretaryApproval === "yes" && approvalDate ? `|Date:${approvalDate}` : ""}]`;

    // 1. Save directly into PostgreSQL database tables (subject_officer_form_table, accused_officer_table, accused_school_table, institute_table)
    try {
      const formattedAccusedOfficers = isConcerned === "yes"
        ? concernedPersons.map(p => ({
            accused_officer_name: p.name || "",
            address: p.address || "",
            position: p.position || "",
            date_of_birth: p.dob || null,
            nic_no: p.nic || null,
            appointment_date: p.appointmentDate || null,
          })).filter(p => (p.accused_officer_name && p.accused_officer_name.trim()) || p.nic_no)
        : [];

      const firstPerson = formattedAccusedOfficers.length > 0 ? formattedAccusedOfficers[0] : null;

      const payload = {
        ref_number: refNo,
        accused_officers: formattedAccusedOfficers,
        accused_officer_name: firstPerson?.accused_officer_name || "",
        address: firstPerson?.address || "",
        position: firstPerson?.position || "",
        date_of_birth: firstPerson?.date_of_birth || null,
        nic_no: firstPerson?.nic_no || null,
        appointment_date: firstPerson?.appointment_date || null,
        accused_school_name: schoolName || "",
        school_address: schoolAddress || "",
        province: schoolProvince || "",
        district: schoolDistrict || "",
        zone: schoolZone || "",
        subject_file_no: specialNotes || fileRelated || null,
        date_prepared_and_submitted_for_signature: receivedDate || null,
        classification_of_complaint_letter: classification,
        name_of_the_presenting_the_complain: classification === "nominal" ? complainantName : "Anonymous",
        address_of_the_person_presenting_the_complaint: classification === "nominal" ? complainantAddress : "N/A",
        future_action: reportState || "",
      };

      let res: any = null;
      try {
        res = await saveAccusedOfficerServer(payload);
      } catch (actionErr) {
        try {
          const apiRes = await fetch("/api/subject-officer-form", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (apiRes.ok) res = await apiRes.json();
        } catch (e) {}
      }

      if (schoolName && schoolName.trim()) {
        try {
          await saveInstituteServer({
            name: schoolName.trim(),
            address: schoolAddress ? schoolAddress.trim() : "",
          });
        } catch (actionErr) {
          try {
            await fetch("/api/institutes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: schoolName.trim(), address: schoolAddress ? schoolAddress.trim() : "" }),
            });
          } catch (e) {}
        }
      }
    } catch (postErr) {
      console.error("Failed to save data to PostgreSQL database tables:", postErr);
    }

    if (isSupabaseConfigured) {
      try {
        // Ensure the case row exists (needed for FK constraint)
        await supabase
          .from("dcmms_subject")
          .upsert({
            id: `case-${refNo}`,
            case_no: refNo,
            subject_officer_name: subjectOfficer || null,
            status: status || "In Progress",
          }, { onConflict: "case_no", ignoreDuplicates: true });

        // Update the priority, complainant, school and classification in dcmms_daily_mail as well
        await supabase
          .from("dcmms_daily_mail")
          .update({
            priority: priority,
            sender_name: classification === "anonymous" ? "Anonymous" : (complainantName || null),
            sender_address: classification === "anonymous" ? "N/A" : (complainantAddress || null),
            institute_name: schoolName || null,
            subject: complaintMatter || null,
            region_province: classification === "anonymous" ? "Anonymous" : "Nominal",
          })
          .eq("ref_no", refNo);

        // Save action/letters details as a new row in dcmms_subject_details
        const { error: actionError } = await supabase
          .from("dcmms_subject_details")
          .insert({
            id: actionId,
            case_no: refNo,
            received_date: receivedDate || null,
            report_state: status || "Pending",
            special_notes: specialNotes || null,
            subject_officer_name: subjectOfficer || null,
            step_taken: serializedStepTaken,
          });

        if (actionError) throw actionError;

        if (isConcerned === "yes") {
          try {
            await supabase.from("dcmms_concerned_officers").delete().eq("case_no", refNo);

            const validPersons = concernedPersons.filter(p => p.name.trim() !== "" || p.position.trim() !== "");
            if (validPersons.length > 0) {
              const payloadList = validPersons.map((p, idx) => ({
                id: `concerned-${refNo}-${idx}-${Date.now()}`,
                case_no: refNo,
                officer_name: p.name || null,
                institute_name: schoolName || null,
                institute_address: schoolAddress || null,
                position: p.position || null,
                address: p.address || null,
                appointment_date: p.appointmentDate || null,
                dob: p.dob || null,
                nic: p.nic || null,
              }));
              const { error: concernedError } = await supabase.from("dcmms_concerned_officers").insert(payloadList);
              if (concernedError) console.warn("Concerned officer insert warning:", concernedError);
            }
          } catch (err) {
            console.error("Failed to update concerned officers in Supabase:", err);
          }
        } else {
          try {
            await supabase.from("dcmms_concerned_officers").delete().eq("case_no", refNo);
          } catch (e) {}
        }

        // Update main case status and subject_officer_name
        const { data: caseData, error: fetchError } = await supabase
          .from("dcmms_subject")
          .select("*")
          .eq("case_no", refNo)
          .single();

        if (!fetchError && caseData) {
          await supabase
            .from("dcmms_subject")
            .upsert({
              ...caseData,
              subject_officer_name: subjectOfficer || caseData.subject_officer_name || caseData.officer_name,
              status: status || caseData.status,
            });
        }

        await logAuditEvent(
          "UPDATE_SUBJECT_CASE",
          "dcmms_subject",
          refNo,
          { reportState: status, subjectOfficer }
        );
      } catch (err: any) {
        console.error("Supabase save failed, falling back to localStorage:", err?.message || err?.details || JSON.stringify(err) || err);
      }
    }

    // Save to Local Storage fallbacks
    if (typeof window !== "undefined") {
      // Save actions to a list
      const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
      let actionsList = [];
      try { actionsList = JSON.parse(storedActions); } catch (e) {}
      if (!Array.isArray(actionsList)) { actionsList = []; }
      
      // Remove any existing draft action for this case before pushing the new one
      const cleanList = actionsList.filter((a: any) => a.id !== actionId);
      
      cleanList.push({
        id: actionId,
        caseNo: refNo,
        subjectOfficerName: subjectOfficer,
        reportState: status,
        receivedDate,
        stepTaken: serializedStepTaken,
        specialNotes,
        isDraft: isDraftMode,
      });
      localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(cleanList));

      // Save concerned officer list
      const storedConcerned = localStorage.getItem("dcmms_officer_concerned") || "{}";
      let concernedMap = {};
      try { concernedMap = JSON.parse(storedConcerned); } catch (e) {}
      (concernedMap as any)[refNo] = {
        caseNo: refNo,
        persons: isConcerned === "yes" ? concernedPersons : [],
        officerName: isConcerned === "yes" ? (concernedPersons[0]?.name || "") : "",
        position: isConcerned === "yes" ? (concernedPersons[0]?.position || "") : "",
        appointmentDate: isConcerned === "yes" ? (concernedPersons[0]?.appointmentDate || "") : "",
        address: isConcerned === "yes" ? (concernedPersons[0]?.address || "") : "",
        dob: isConcerned === "yes" ? (concernedPersons[0]?.dob || "") : "",
        nic: isConcerned === "yes" ? (concernedPersons[0]?.nic || "") : "",
        instituteName: schoolName,
        schoolAddress: schoolAddress,
      };
      localStorage.setItem("dcmms_officer_concerned", JSON.stringify(concernedMap));

      // Update case status locally
      const storedCases = localStorage.getItem("dcmms_cases");
      if (storedCases) {
        try {
          const casesList = JSON.parse(storedCases);
          const updated = casesList.map((c: any) => {
            if (c.caseNo === refNo) {
              return { ...c, status: status || c.status, isOld: complaintAge === "old" };
            }
            return c;
          });
          localStorage.setItem("dcmms_cases", JSON.stringify(updated));
        } catch (e) {}
      }

      // Also update daily mail letters details in localStorage
      const storedLetters = localStorage.getItem("dcmms_letters");
      if (storedLetters) {
        try {
          const lettersList = JSON.parse(storedLetters);
          const updatedLetters = lettersList.map((l: any) => {
            if (l.refNo === refNo) {
              return {
                ...l,
                priority: priority,
                senderName: classification === "anonymous" ? "Anonymous" : complainantName,
                senderAddress: classification === "anonymous" ? "N/A" : complainantAddress,
                instituteName: schoolName,
                subject: complaintMatter,
                regionProvince: classification === "anonymous" ? "Anonymous" : "Nominal",
              };
            }
            return l;
          });
          localStorage.setItem("dcmms_letters", JSON.stringify(updatedLetters));
        } catch (e) {}
      }
    }
  };

  // Submit case details form handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (concernedPersons[0]?.appointmentDate) {
      syncCalendar(concernedPersons[0].appointmentDate);
    }

    if (!refNo) {
      alert("Reference Number is required.");
      return;
    }

    await saveCaseData(reportState || "In Progress", false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("dcmms_assignment_updated"));
      window.dispatchEvent(new Event("dcmms_data_updated"));
    }
    alert("Case details updated successfully!");
    router.push("/subject");
  };

  // Save as draft handler
  const handleSaveDraft = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!refNo) {
      alert("Please fill in the Reference Number to save as draft.");
      return;
    }

    await saveCaseData(reportState || "Pending", true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("dcmms_assignment_updated"));
      window.dispatchEvent(new Event("dcmms_data_updated"));
    }
    alert("Draft saved successfully!");
    router.push("/subject");
  };



  if (checkingAuth) {
    return (
      <div className="page-loading-container">
        <div>Loading...</div>
      </div>
    );
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
        role="subject"
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          {/* ── Top App Bar Header ── */}
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
                <h2 className="dashboard-main-title">Subject Officer</h2>
                <p className="dashboard-main-subtitle">{t("subjectOfficerDesc")}</p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Date display badge */}
              <div className="date-badge">
                <span suppressHydrationWarning>{getFormattedDate()}</span>
                <svg className="date-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
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

          {/* Form container section */}
          <section className="add-details-page-wrapper">
            <div className="add-details-main-card">
              <form onSubmit={handleSubmit}>
                {/* Layout title area */}
                <div className="add-details-header-container">
                  <div className="add-details-header-left">
                    <h1 className="add-details-title">{t("addSubjectDetailsTitle")}</h1>
                    <p className="add-details-subtitle">{t("addSubjectDetailsDesc")}</p>
                  </div>
                  <div className="add-details-header-right-btns">
                    <Link href="/subject" className="btn-back-home">
                      <svg
                        className="btn-back-home-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      {t("backToHome")}
                    </Link>
                    <button
                      type="button"
                      className="btn-action-draft-top"
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

                 {letterData && (
                  <div className="current-case-details-card">
                    <h3 className="current-details-title">
                      <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" style={{ color: "#2563eb" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t("currentDetails", "Current details")}
                    </h3>
                    <div className="case-details-grid">
                      {/* Case No */}
                      <div className="case-detail-item-premium">
                        <div className="detail-icon-container">
                          <svg className="detail-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                        </div>
                        <div className="detail-content-container">
                          <span className="detail-label-premium">{t("caseNoLabel", "Case No.")}</span>
                          <span className="detail-value-premium">{letterData.letterNo || "—"}</span>
                        </div>
                      </div>

                      {/* Name of Subject Officer */}
                      <div className="case-detail-item-premium">
                        <div className="detail-icon-container">
                          <svg className="detail-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="detail-content-container">
                          <span className="detail-label-premium">{t("officerNameLabel", "Name of Subject Officer")}</span>
                          <span className="detail-value-premium">{letterData.officerName || "—"}</span>
                        </div>
                      </div>

                      {/* Reference Number */}
                      <div className="case-detail-item-premium">
                        <div className="detail-icon-container">
                          <svg className="detail-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="detail-content-container">
                          <span className="detail-label-premium">{t("refNoLabel", "Reference Number")}</span>
                          <span className="detail-value-premium">{letterData.refNo || "—"}</span>
                        </div>
                      </div>

                      {/* Priority */}
                      <div className="case-detail-item-premium">
                        <div className="detail-icon-container">
                          <svg className="detail-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="detail-content-container">
                          <span className="detail-label-premium">{t("priorityLabel", "Priority")}</span>
                          <span className={`detail-priority-pill pill-${letterData.priority?.toLowerCase()}`}>
                            {letterData.priority ? (t(`priority${letterData.priority.charAt(0).toUpperCase() + letterData.priority.slice(1).toLowerCase()}`, letterData.priority) as string) : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Received Date */}
                      <div className="case-detail-item-premium">
                        <div className="detail-icon-container">
                          <svg className="detail-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="detail-content-container">
                          <span className="detail-label-premium">{t("receivedDateLabel", "Received Date")}</span>
                          <span className="detail-value-premium">{letterData.receivedDate || "—"}</span>
                        </div>
                      </div>

                      {/* Letter Type */}
                      <div className="case-detail-item-premium">
                        <div className="detail-icon-container">
                          <svg className="detail-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="detail-content-container">
                          <span className="detail-label-premium">{t("letterTypeLabel", "Letter Type")}</span>
                          <span className="detail-value-premium">
                            {letterData.letterType ? t(letterData.letterType) : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {subsequentMails && subsequentMails.length > 0 && (
                  <div className="subsequent-letters-table-card">
                    <h2 className="card-title-header">
                      <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5" />
                      </svg>
                      {t("subsequentMailReceivedTable", "Subsequent Letters Received for Case")}
                    </h2>
                    <div className="table-responsive-container">
                      <table className="letters-data-table subsequent-table">
                        <thead>
                          <tr>
                            <th scope="col">{t("senderName", "Sender Name")}</th>
                            <th scope="col">{t("letterType", "Letter Type")}</th>
                            <th scope="col">{t("letterDate", "Letter Date")}</th>
                            <th scope="col">{t("receivedDate", "Received Date")}</th>
                            <th scope="col">{t("nameOfOfficer", "Name of Subject Officer")}</th>
                            <th scope="col">{t("subjectText", "Subject")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subsequentMails.map((mail: any, index: number) => (
                            <tr key={mail.id || index} className="letter-table-row">
                              <td className="font-semibold text-primary">{mail.senderName}</td>
                              <td>{mail.letterType ? t(mail.letterType) : "—"}</td>
                              <td>{mail.letterDate}</td>
                              <td>{mail.receivedDate}</td>
                              <td>{mail.officerName ? t(mail.officerName) : "—"}</td>
                              <td className="subject-cell">{mail.subject}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="add-details-cards-grid">
                  {/* ───────────────── Left Card ("Complaint Information" Flowchart) ───────────────── */}
                  <div className="add-details-card">
                    <h2 className="card-title-header">
                      <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {t("complaintClassification", "Classification of Complaint")}
                    </h2>

                    <div className="flowchart-container">
                      {/* Investigation Committee & Step 2 Dates Banner from Admin */}
                      {assignedOfficersText && (
                        <div style={{ backgroundColor: "#eff6ff", border: "1px solid #93c5fd", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", marginBottom: "6px" }}>
                            ✓ {i18n.language === "si" ? "පවරන ලද විමර්ශන නිලධාරීන් (Investigation Admin වෙතින් ලැබිණි):" : "Assigned Investigation Committee (From Admin):"}
                          </div>
                          {(() => {
                            const committee = parseCommitteeDetails({ assignedOfficers: assignedOfficersText, chairman: assignmentData?.chairman, members: assignmentData?.members });
                            if (committee.hasDetails) {
                              return (
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                  {committee.chairmanName && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                      <span style={{ fontSize: "11px", backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>
                                        👑 {i18n.language === "si" ? "සභාපති" : "Chairman"}:
                                      </span>
                                      <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>{committee.chairmanName}</span>
                                      {committee.chairmanNic && <span style={{ fontSize: "11px", color: "#64748b" }}>(NIC: {committee.chairmanNic})</span>}
                                    </div>
                                  )}
                                  {committee.memberList.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                                      <span style={{ fontSize: "11px", backgroundColor: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>
                                        👥 {i18n.language === "si" ? `සාමාජිකයින් (${committee.memberList.length})` : `Members (${committee.memberList.length})`}:
                                      </span>
                                      {committee.memberList.map((m: string, idx: number) => (
                                        <span key={idx} style={{ fontSize: "12px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", padding: "2px 8px", borderRadius: "6px", color: "#334155", fontWeight: 600 }}>
                                          {m}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return <div style={{ fontSize: "14px", fontWeight: 700, color: "#0369a1" }}>{assignedOfficersText}</div>;
                          })()}
                        </div>
                      )}

                      {/* Extension Details Banner if requested by Admin */}
                      {assignmentData && (assignmentData.extensionTerm || assignmentData.extensionStartDate || assignmentData.extension_start_date || assignmentData.extensionRequestedByAdmin) && (
                        <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span>⏳ {i18n.language === "si" ? "දිනයන් දීර්ඝ කිරීමේ තොරතුරු (Investigation Admin වෙතින්):" : "Date Extension Details (From Investigation Admin):"}</span>
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", backgroundColor: assignmentData.extensionApprovalStatus === "Approved" ? "#dcfce7" : assignmentData.extensionApprovalStatus === "Disapproved" ? "#fee2e2" : "#fef3c7", color: assignmentData.extensionApprovalStatus === "Approved" ? "#15803d" : assignmentData.extensionApprovalStatus === "Disapproved" ? "#b91c1c" : "#b45309" }}>
                              {assignmentData.extensionApprovalStatus === "Approved" ? (i18n.language === "si" ? "අනුමතයි" : "Approved") : assignmentData.extensionApprovalStatus === "Disapproved" ? (i18n.language === "si" ? "ප්‍රතික්ෂේපයි" : "Disapproved") : (i18n.language === "si" ? "අනුමැතිය අපේක්ෂාවෙන්" : "Pending Approval")}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "13px", fontWeight: 700, color: "#78350f" }}>
                            <span>{i18n.language === "si" ? "වාරය:" : "Term:"} {assignmentData.extensionTerm || assignmentData.extension_term || "First"}</span>
                            <span>|</span>
                            <span>{i18n.language === "si" ? "ආරම්භය:" : "Start:"} {assignmentData.extensionStartDate || assignmentData.extension_start_date || "—"}</span>
                            <span>|</span>
                            <span>{i18n.language === "si" ? "අවසානය:" : "End:"} {assignmentData.extensionEndDate || assignmentData.extension_end_date || "—"}</span>
                          </div>
                        </div>
                      )}

                      {/* Step 1: Case Administration */}
                      <div className="flowchart-step">
                        <div className="step-indicator">1</div>
                        <div className="step-content">
                          <h3 className="step-section-title">{t("caseAdministration", "Case Administration")}</h3>
                          
                          <div className="form-grid-2">
                            {/* Reference Number */}
                            <div className="form-field-group">
                              <label htmlFor="refNo" className="field-label">
                                {t("refNo")} <span className="required-star">*</span>
                              </label>
                              <input
                                id="refNo"
                                type="text"
                                required
                                readOnly
                                value={refNo}
                                className="field-input"
                                style={{ backgroundColor: "#e2e8f0", cursor: "not-allowed" }}
                              />
                            </div>

                            {/* Subject File Number (විෂය ගොනු අංකය) */}
                            <div className="form-field-group">
                              <label htmlFor="specialNotes" className="field-label">
                                {t("subjectFileNo", "විෂය ගොනු අංකය")}
                              </label>
                              <input
                                id="specialNotes"
                                type="text"
                                value={specialNotes}
                                onChange={(e) => setSpecialNotes(e.target.value)}
                                className="field-input"
                                placeholder="e.g. SUB/FILE/102"
                              />
                            </div>
                          </div>

                          <div className="form-grid-2 mt-3">

                            {/* Future Actions (ගනු ලබන ඉදිරි ක්‍රියාමාර්ග) */}
                            <div className="form-field-group">
                              <label htmlFor="reportState" className="field-label">
                                {t("futureActions", "ගනු ලබන ඉදිරි ක්‍රියාමාර්ග")} <span className="required-star">*</span>
                              </label>
                              <div className="select-wrapper">
                                <select
                                  id="reportState"
                                  value={reportState}
                                  onChange={(e) => {
                                    isUserEditingReportStateRef.current = true;
                                    setReportState(e.target.value);
                                  }}
                                  className="field-select"
                                  required
                                >
                                  <option value="">{t("Choose report state", "Select current status...")}</option>
                                  <option value="statusCallingReports">{t("statusCallingReports")}</option>
                                  <option value="statusCallingCourtReports">{t("statusCallingCourtReports")}</option>
                                  <option value="statusPreliminaryInvestigation">{t("statusPreliminaryInvestigation")}</option>
                                  <option value="statusInquiry">{t("statusInquiry")}</option>
                                  <option value="statusConsultRelevantInstitutes">{t("statusConsultRelevantInstitutes")}</option>
                                  <option value="statusObtainStatements">{t("statusObtainStatements")}</option>
                                  <option value="statusUnclearAnonymous">{t("statusUnclearAnonymous")}</option>
                                  <option value="statusReferOtherInstitute">{t("statusReferOtherInstitute")}</option>
                                  {reportState &&
                                    ![
                                      "",
                                      "statusCallingReports",
                                      "statusCallingCourtReports",
                                      "statusPreliminaryInvestigation",
                                      "statusInquiry",
                                      "statusConsultRelevantInstitutes",
                                      "statusObtainStatements",
                                      "statusUnclearAnonymous",
                                      "statusReferOtherInstitute",
                                    ].includes(reportState) && (
                                      <option value={reportState}>
                                        {t(reportState, reportState)}
                                      </option>
                                    )}
                                </select>
                                <div className="select-arrow-container">
                                  <svg className="select-arrow-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            </div>

                            {/* Date prepared and submitted for signature (ලිපිය සකසා අත්සනට ඉදිරිපත් කළ දිනය) */}
                            <div className="form-field-group">
                              <label htmlFor="receivedDate" className="field-label">
                                {t("datePreparedSubmitted")}
                              </label>
                              <div className="input-icon-wrapper">
                                <input
                                  id="receivedDate"
                                  type="date"
                                  value={receivedDate}
                                  onChange={(e) => setReceivedDate(e.target.value)}
                                  className="field-input input-with-right-icon"
                                />
                                <svg className="input-right-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Classification */}
                      <div className="flowchart-step">
                        <div className="step-indicator">2</div>
                        <div className="step-content">
                          <span className="field-label" style={{ display: "block", marginBottom: "8px" }}>
                            {t("complaintClassification", "Classification of complaint letter")} <span className="required-star">*</span>
                          </span>
                          <div className="classification-toggle-group" role="radiogroup" aria-label="Complaint Classification">
                            <button
                              type="button"
                              className={`toggle-btn ${classification === "nominal" ? "active" : ""}`}
                              onClick={() => setClassification("nominal")}
                              aria-checked={classification === "nominal"}
                              role="radio"
                            >
                              {t("nominalLabel", "Nominal")}
                            </button>
                            <button
                              type="button"
                              className={`toggle-btn ${classification === "anonymous" ? "active" : ""}`}
                              onClick={() => setClassification("anonymous")}
                              aria-checked={classification === "anonymous"}
                              role="radio"
                            >
                              {t("anonymousLabel", "Anonymous")}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Complainant Details (Shown only if nominal) */}
                      {classification === "nominal" && (
                        <div className="flowchart-step animated-fade-in">
                          <div className="step-indicator">3</div>
                          <div className="step-content">
                            <h3 className="step-section-title">{t("complainantDetailsTitle", "Complainant Details")}</h3>
                            <div className="form-grid-2">
                              <div className="form-field-group">
                                <label htmlFor="complainantName" className="field-label">
                                  {t("complainantName", "Name of the person presenting the complaint")} <span className="required-star">*</span>
                                </label>
                                <input
                                  id="complainantName"
                                  type="text"
                                  required={classification === "nominal"}
                                  value={complainantName}
                                  onChange={(e) => setComplainantName(e.target.value)}
                                  className="field-input"
                                  placeholder="Enter name..."
                                />
                              </div>
                              <div className="form-field-group">
                                <label htmlFor="complainantAddress" className="field-label">
                                  {t("complainantAddress", "Address of the person presenting the complaint")}
                                </label>
                                <input
                                  id="complainantAddress"
                                  type="text"
                                  value={complainantAddress}
                                  onChange={(e) => setComplainantAddress(e.target.value)}
                                  className="field-input"
                                  placeholder="Enter address..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* ───────────────── Right Card ("Related Person & Status" Flowchart) ───────────────── */}
                  <div className="add-details-card">
                    <h2 className="card-title-header">
                      <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      {t("relatedPersonStatus", "Accused Officer(s) Information")}
                    </h2>

                    <div className="flowchart-container">
                      {/* Step 4: Concerned Person */}
                      <div className="flowchart-step">
                        <div className="step-indicator">{classification === "nominal" ? "4" : "3"}</div>
                        <div className="step-content">
                          <span className="field-label" style={{ display: "block", marginBottom: "8px" }}>
                            {t("personRelatedQuestion", "Is there a person related to the complaint?")}
                          </span>
                          <div className="classification-toggle-group" role="radiogroup" aria-label="Concerned Person Toggle">
                            <button
                              type="button"
                              className={`toggle-btn ${isConcerned === "yes" ? "active" : ""}`}
                              onClick={() => setIsConcerned("yes")}
                              aria-checked={isConcerned === "yes"}
                              role="radio"
                            >
                              {t("yesLabel", "Yes")}
                            </button>
                            <button
                              type="button"
                              className={`toggle-btn ${isConcerned === "no" ? "active" : ""}`}
                              onClick={() => setIsConcerned("no")}
                              aria-checked={isConcerned === "no"}
                              role="radio"
                            >
                              {t("noLabel", "No")}
                            </button>
                          </div>

                          {isConcerned === "yes" && (
                            <div className="concerned-person-fields animated-fade-in" style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
                              {concernedPersons.map((person, index) => (
                                <div 
                                  key={index} 
                                  style={{ 
                                    backgroundColor: "#f8fafc", 
                                    padding: "16px", 
                                    borderRadius: "10px", 
                                    border: "1px solid #cbd5e1"
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
                                    <h3 className="step-section-title" style={{ margin: 0 }}>
                                      {t("personRelatedDetails", "Concerned Person Details")} {concernedPersons.length > 1 ? `#${index + 1}` : ""}
                                    </h3>
                                    {concernedPersons.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemovePerson(index)}
                                        title="Remove Person"
                                        style={{
                                          background: "none",
                                          border: "1px solid #fca5a5",
                                          color: "#ef4444",
                                          cursor: "pointer",
                                          padding: "4px 10px",
                                          borderRadius: "6px",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          fontSize: "12px",
                                          fontWeight: 600,
                                          backgroundColor: "#fef2f2"
                                        }}
                                      >
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span>{lang === "si" ? "ඉවත් කරන්න" : "Remove"}</span>
                                      </button>
                                    )}
                                  </div>

                                  <div className="form-grid-2">
                                    <div className="form-field-group">
                                      <label htmlFor={`officerName_${index}`} className="field-label">
                                        {t("personName", "Person's Name")} <span className="required-star">*</span>
                                      </label>
                                      <input
                                        id={`officerName_${index}`}
                                        type="text"
                                        required={isConcerned === "yes"}
                                        value={person.name}
                                        onChange={(e) => handlePersonChange(index, "name", e.target.value)}
                                        className="field-input"
                                        placeholder="Enter name..."
                                      />
                                    </div>
                                    <div className="form-field-group">
                                      <label htmlFor={`officerPosition_${index}`} className="field-label">
                                        {t("personDesignation", "Person's Designation / Position")}
                                      </label>
                                      <input
                                        id={`officerPosition_${index}`}
                                        type="text"
                                        value={person.position}
                                        onChange={(e) => handlePersonChange(index, "position", e.target.value)}
                                        className="field-input"
                                        placeholder="Enter position..."
                                      />
                                    </div>
                                  </div>

                                  <div className="form-grid-2 mt-3">
                                    <div className="form-field-group">
                                      <label htmlFor={`officerDob_${index}`} className="field-label">{t("dateOfBirth")}</label>
                                      <input
                                        id={`officerDob_${index}`}
                                        type="date"
                                        value={person.dob}
                                        onChange={(e) => handlePersonChange(index, "dob", e.target.value)}
                                        className="field-input"
                                      />
                                    </div>
                                    <div className="form-field-group">
                                      <label htmlFor={`officerNic_${index}`} className="field-label">{t("nicNumber")}</label>
                                      <input
                                        id={`officerNic_${index}`}
                                        type="text"
                                        value={person.nic}
                                        onChange={(e) => handlePersonChange(index, "nic", e.target.value)}
                                        className="field-input"
                                        placeholder="NIC number"
                                      />
                                    </div>
                                  </div>

                                  <div className="form-grid-2 mt-3">
                                    <div className="form-field-group">
                                      <label htmlFor={`officerApptDate_${index}`} className="field-label">{t("appointmentDate")}</label>
                                      <input
                                        id={`officerApptDate_${index}`}
                                        type="date"
                                        value={person.appointmentDate}
                                        onChange={(e) => handlePersonChange(index, "appointmentDate", e.target.value)}
                                        className="field-input"
                                      />
                                    </div>
                                    <div className="form-field-group">
                                      <label htmlFor={`officerAddress_${index}`} className="field-label">{t("addressLabel")}</label>
                                      <input
                                        id={`officerAddress_${index}`}
                                        type="text"
                                        value={person.address}
                                        onChange={(e) => handlePersonChange(index, "address", e.target.value)}
                                        className="field-input"
                                        placeholder="Address"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {/* Plus Button to add another person */}
                              <button
                                type="button"
                                onClick={handleAddPerson}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "8px",
                                  padding: "10px 18px",
                                  backgroundColor: "#eff6ff",
                                  color: "#1d4ed8",
                                  border: "1.5px dashed #93c5fd",
                                  borderRadius: "8px",
                                  fontWeight: 700,
                                  fontSize: "14px",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  marginTop: "4px"
                                }}
                              >
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                <span>
                                  {lang === "si" ? "+ තවත් පුද්ගලයෙකු එක් කරන්න" : "+ Add Another Person"}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 5: School Details */}
                      <div className="flowchart-step" style={{ position: "relative", zIndex: 40 }}>
                        <div className="step-indicator">{classification === "nominal" ? "5" : "4"}</div>
                        <div className="step-content" style={{ overflow: "visible" }}>
                          <h3 className="step-section-title">{t("schoolDetailsTitle", "School Details")}</h3>
                          <div className="form-grid-2" style={{ overflow: "visible" }}>
                            <div className="form-field-group" style={{ position: "relative", zIndex: 100 }}>
                              <label htmlFor="schoolName" className="field-label">
                                {t("schoolName", "School Name")} <span className="required-star">*</span>
                              </label>
                              <input
                                id="schoolName"
                                type="text"
                                required
                                value={schoolName}
                                onChange={(e) => handleSchoolNameChange(e.target.value)}
                                onFocus={() => {
                                  const query = schoolName.trim().toLowerCase();
                                  if (query.length > 0 && institutesList.length > 0) {
                                    const matches = institutesList
                                      .filter((inst) => inst.name.toLowerCase().includes(query))
                                      .slice(0, 10);
                                    setFilteredInstitutes(matches);
                                    setShowInstituteDropdown(matches.length > 0);
                                  }
                                }}
                                onBlur={() => {
                                  setTimeout(() => setShowInstituteDropdown(false), 300);
                                }}
                                className="field-input"
                                placeholder="Enter school name..."
                                autoComplete="off"
                              />

                              {/* Autocomplete Dropdown List from institute_table */}
                              {showInstituteDropdown && filteredInstitutes.length > 0 && (
                                <ul
                                  style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    right: 0,
                                    zIndex: 9999,
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #94a3b8",
                                    borderRadius: "8px",
                                    boxShadow: "0 14px 28px rgba(0, 0, 0, 0.18), 0 10px 10px rgba(0, 0, 0, 0.12)",
                                    maxHeight: "220px",
                                    overflowY: "auto",
                                    margin: "4px 0 0 0",
                                    padding: "6px 0",
                                    listStyle: "none",
                                  }}
                                >
                                  {filteredInstitutes.map((inst, index) => (
                                    <li
                                      key={index}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSelectInstitute(inst);
                                      }}
                                      style={{
                                        padding: "10px 14px",
                                        cursor: "pointer",
                                        borderBottom: index === filteredInstitutes.length - 1 ? "none" : "1px solid #f1f5f9",
                                        transition: "background-color 0.15s ease",
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#eff6ff")}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
                                    >
                                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#0f172a" }}>{inst.name}</div>
                                      {inst.address && (
                                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{inst.address}</div>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="form-field-group">
                              <label htmlFor="schoolAddress" className="field-label">
                                {t("schoolAddress", "School Address")}
                              </label>
                              <input
                                id="schoolAddress"
                                type="text"
                                value={schoolAddress}
                                onChange={(e) => {
                                  isUserEditingSchoolRef.current = true;
                                  setSchoolAddress(e.target.value);
                                }}
                                className="field-input"
                                placeholder="Enter school address..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 6: Subject Matter */}
                      <div className="flowchart-step" style={{ position: "relative", zIndex: 1 }}>
                        <div className="step-indicator">{classification === "nominal" ? "6" : "5"}</div>
                        <div className="step-content">
                          <div className="form-field-group">
                            <label htmlFor="complaintMatter" className="field-label">
                              {t("complaintMatterLabel", "Matter related to the complaint")} <span className="required-star">*</span>
                            </label>
                            <textarea
                              id="complaintMatter"
                              required
                              value={complaintMatter}
                              onChange={(e) => setComplaintMatter(e.target.value)}
                              className="field-textarea"
                              placeholder="Enter details of the complaint matter..."
                              rows={4}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Step 7: Education Secretary's Approval */}
                      <div className="flowchart-step">
                        <div className="step-indicator">{classification === "nominal" ? "7" : "6"}</div>
                        <div className="step-content">
                          <span className="field-label" style={{ display: "block", marginBottom: "8px" }}>
                            {t("eduSecretaryApproval", "මූලික විමර්ශනයට යවන්නේනම් අධ්‍යාපන ලේකම්ගේ අනුමැතිය")} <span className="required-star">*</span>
                          </span>
                          <div className="classification-toggle-group" role="radiogroup" aria-label="Education Secretary Approval Toggle">
                            <button
                              type="button"
                              className={`toggle-btn ${eduSecretaryApproval === "yes" ? "active" : ""}`}
                              onClick={() => setEduSecretaryApproval("yes")}
                              aria-checked={eduSecretaryApproval === "yes"}
                              role="radio"
                            >
                              {t("yesLabel", "Yes")}
                            </button>
                            <button
                              type="button"
                              className={`toggle-btn ${eduSecretaryApproval === "no" ? "active" : ""}`}
                              onClick={() => setEduSecretaryApproval("no")}
                              aria-checked={eduSecretaryApproval === "no"}
                              role="radio"
                            >
                              {t("noLabel", "No")}
                            </button>
                          </div>

                          {eduSecretaryApproval === "yes" && (
                            <div className="form-field-group animated-fade-in" style={{ marginTop: "16px" }}>
                              <label htmlFor="approvalDate" className="field-label">
                                {t("approvalDate", "Approved Date")} <span className="required-star">*</span>
                              </label>
                              <input
                                id="approvalDate"
                                type="date"
                                required={eduSecretaryApproval === "yes"}
                                value={approvalDate}
                                onChange={(e) => setApprovalDate(e.target.value)}
                                className="field-input"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Timeline of actions taken (placed at the bottom of the card) */}
                    {previousActions && previousActions.length > 0 && (
                      <div className="previous-actions-timeline" style={{ marginTop: "32px", paddingTop: "24px", borderTop: "2px solid #e2e8f0" }}>
                        <h3 className="timeline-title" style={{ fontSize: "15px", fontWeight: "700" }}>
                          <svg className="action-row-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {t("previousActionsHistory", "History of Actions Taken")}
                        </h3>
                        <div className="timeline-items-wrapper">
                          {previousActions.map((act: any, idx: number) => (
                            <div key={act.id || idx} className="timeline-item">
                              <div className="timeline-header">
                                <span>{act.receivedDate}</span>
                                <span className={`timeline-status timeline-status-${act.reportState?.toLowerCase().replace(/\s+/g, "") || "pending"}`}>
                                  {t(act.reportState || "Pending")}
                                </span>
                              </div>
                              <p className="timeline-step">{formatStepTaken(act.stepTaken, t)}</p>
                              {act.specialNotes && (
                                <p className="timeline-notes">
                                  {t("notes", "Notes")}: {act.specialNotes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              {/* Action Buttons Row */}
              <div className="add-details-form-actions">
                <button
                  type="button"
                  className="btn-action-cancel"
                  onClick={() => router.push("/subject")}
                >
                  {t("cancelBtn")}
                </button>

                <button
                  type="submit"
                  className="btn-action-submit"
                >
                  {t("submitToPrelimBtn")}
                </button>
              </div>
            </form>
            </div>
          </section>

          {/* Footer Branding Notice */}
          <SiteFooter />
        </main>
      </div>
    </div>
  );
}

export default function AddCaseDetailsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CaseDetailsForm />
    </Suspense>
  );
}
