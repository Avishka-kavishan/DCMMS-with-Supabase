export type LetterOriginGroup = 
  | "deputy_secretary" 
  | "asst_sec_discipline" 
  | "asst_sec_investigation" 
  | "direct_additional_sec";

export interface OfficerOption {
  role: string;
  name: string;
  titleSi: string;
  titleEn: string;
  titleTa: string;
}

export const KEY_ADMINISTRATIVE_OFFICERS: OfficerOption[] = [
  {
    role: "senior_assistant_secretary",
    name: "Dharshana Senanayake",
    titleSi: "නියෝජ්‍ය ලේකම් / ජ්‍යෙෂ්ඨ සහකාර ලේකම්",
    titleEn: "Deputy Secretary / Senior Assistant Secretary",
    titleTa: "பிரதிச் செயலாளர் / சிரேஷ்ட உதவிச் செயலாளர்",
  },
  {
    role: "assistant_secretary_discipline",
    name: "Bandula Gunawardena",
    titleSi: "සහකාර ලේකම් (විනය)",
    titleEn: "Assistant Secretary (Discipline)",
    titleTa: "உதவிச் செயலாளர் (ஒழுக்கம்)",
  },
  {
    role: "assistant_secretary_investigation",
    name: "Ranjith Siyambalapitiya",
    titleSi: "සහකාර ලේකම් (විමර්ශන)",
    titleEn: "Assistant Secretary (Investigation)",
    titleTa: "உதவிச் செயலாளர் (விசாரணைகள்)",
  },
  {
    role: "chief_clerk",
    name: "Chief Clerk Officer (ශාඛා ප්‍රධානී)",
    titleSi: "ශාඛා ප්‍රධානී (විනය ශාඛාව)",
    titleEn: "Chief Clerk (Discipline Branch)",
    titleTa: "பிரதான எழுதுவினைஞர் (ஒழுக்கக் கிளை)",
  },
];

/**
 * Categorize letter provenance for Additional Secretary into the 3 key sending officers + Direct
 * Letters are accurately categorized based on WHO SENT/FORWARDED the letter to the Additional Secretary,
 * NOT who the Additional Secretary forwarded the letter TO.
 */
export function getLetterOriginGroup(l: any): LetterOriginGroup {
  if (!l) return "direct_additional_sec";
  const roleRaw = (l.created_by_role || l.createdByRole || "").toLowerCase().trim();
  const creator = (l.created_by_name || "").toLowerCase().trim();
  const fwdReason = (l.forward_reason || l.forwardReason || "").toLowerCase().trim();
  const fwdDirection = (l.forward_direction || l.forwardDirection || "").toLowerCase().trim();
  const isSelfAddSec = creator.includes("nihal") || roleRaw.includes("additional");

  // If the letter was registered by/for Additional Secretary or Daily Mail without incoming forward to Addl Sec:
  if (isSelfAddSec && fwdDirection !== "from_senior_to_add_sec" && !fwdReason.includes("to additional secretary")) {
    return "direct_additional_sec";
  }

  // 1. Deputy Secretary / Senior Assistant Secretary (Sent / Forwarded BY them to Addl Sec)
  const isCreatedByDeputy =
    (roleRaw.includes("deputy") || roleRaw.includes("senior") || roleRaw === "senior_assistant_secretary" || roleRaw === "deputy_secretary" || creator.includes("dharshana")) &&
    !roleRaw.includes("additional");

  const isFwdByDeputy =
    fwdDirection === "from_senior_to_add_sec" ||
    (fwdReason.includes("forwarded by") &&
      (fwdReason.includes("senior assistant") || fwdReason.includes("deputy") || fwdReason.includes("dharshana")) &&
      (fwdReason.includes("to additional") || fwdReason.includes("to addl") || fwdDirection === "from_senior_to_add_sec") &&
      !fwdReason.includes("forwarded by additional") &&
      !fwdReason.includes("forwarded by addl"));

  if (isCreatedByDeputy || isFwdByDeputy) {
    return "deputy_secretary";
  }

  // 2. Assistant Secretary of Discipline (Sent / Forwarded BY them to Addl Sec)
  const isCreatedByDiscipline =
    (creator.includes("bandula") ||
      (roleRaw.includes("discipline") && roleRaw.includes("assistant") && !roleRaw.includes("chief") && !roleRaw.includes("clerk"))) &&
    !roleRaw.includes("additional");

  const isFwdByDiscipline =
    fwdReason.includes("forwarded by") &&
    (fwdReason.includes("assistant secretary (discipline") || fwdReason.includes("bandula")) &&
    (fwdReason.includes("to additional") || fwdReason.includes("to addl")) &&
    !fwdReason.includes("forwarded by additional");

  if (isCreatedByDiscipline || isFwdByDiscipline) {
    return "asst_sec_discipline";
  }

  // 3. Assistant Secretary of Investigations (Sent / Forwarded BY them to Addl Sec)
  const isCreatedByInvestigation =
    (creator.includes("ranjith") ||
      (roleRaw.includes("investigation") && roleRaw.includes("assistant") && !roleRaw.includes("chief") && !roleRaw.includes("clerk"))) &&
    !roleRaw.includes("additional");

  const isFwdByInvestigation =
    fwdReason.includes("forwarded by") &&
    (fwdReason.includes("assistant secretary (investigation") || fwdReason.includes("ranjith")) &&
    (fwdReason.includes("to additional") || fwdReason.includes("to addl")) &&
    !fwdReason.includes("forwarded by additional");

  if (isCreatedByInvestigation || isFwdByInvestigation) {
    return "asst_sec_investigation";
  }

  // 4. Meant directly for Additional Secretary (from Daily Mail / Post / Hand Registry)
  return "direct_additional_sec";
}

/**
 * Return badge details for each origin group
 */
export function getOriginBadge(group: LetterOriginGroup, lang: string = "si") {
  switch (group) {
    case "deputy_secretary":
      return {
        label: lang === "si" ? "නියෝජ්‍ය ලේකම්" : lang === "ta" ? "பிரதிச் செயலாளர்" : "Deputy Secretary",
        bg: "#f3e8ff",
        color: "#6b21a8",
        border: "#d8b4fe",
        icon: "🏛️",
      };
    case "asst_sec_discipline":
      return {
        label: lang === "si" ? "සහකාර ලේකම් (විනය)" : lang === "ta" ? "உதவிச் செயலாளர் (ஒழுக்கம்)" : "Asst. Sec (Discipline)",
        bg: "#fef3c7",
        color: "#92400e",
        border: "#fde68a",
        icon: "⚖️",
      };
    case "asst_sec_investigation":
      return {
        label: lang === "si" ? "සහකාර ලේකම් (විමර්ශන)" : lang === "ta" ? "உதவிச் செயலாளர் (விசாரணை)" : "Asst. Sec (Investigation)",
        bg: "#e0f2fe",
        color: "#0369a1",
        border: "#bae6fd",
        icon: "🔍",
      };
    case "direct_additional_sec":
    default:
      return {
        label: lang === "si" ? "අතිරේක ලේකම් වෙත පමණි" : lang === "ta" ? "கூடுதல் செயலாளருக்கு மட்டும்" : "Direct Addl. Sec",
        bg: "#ecfdf5",
        color: "#065f46",
        border: "#a7f3d0",
        icon: "📬",
      };
  }
}

/**
 * Check if a letter was created or sent by one of the three subordinate administrative officers:
 * - Senior Assistant Secretary / Deputy Secretary
 * - Assistant Secretary (Discipline)
 * - Assistant Secretary (Investigation)
 */
export function isLetterFromAdministrativeOfficers(letter: any): boolean {
  if (!letter) return false;
  const group = getLetterOriginGroup(letter);
  return group === "deputy_secretary" || group === "asst_sec_discipline" || group === "asst_sec_investigation";
}

/**
 * Get display title for the sending administrative officer
 */
export function getOfficerSenderTitle(group: LetterOriginGroup, lang: string = "si"): string {
  switch (group) {
    case "deputy_secretary":
      return lang === "si"
        ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම් / නියෝජ්‍ය ලේකම්"
        : lang === "ta"
        ? "சிரேஷ்ட உதவிச் செயலாளர் / பிரதிச் செயலாளர்"
        : "Senior Assistant Secretary / Deputy Secretary";
    case "asst_sec_discipline":
      return lang === "si"
        ? "සහකාර ලේකම් (විනය ශාඛාව)"
        : lang === "ta"
        ? "உதவிச் செயலாளர் (ஒழுக்காற்றுப் பிரிவு)"
        : "Assistant Secretary (Discipline Branch)";
    case "asst_sec_investigation":
      return lang === "si"
        ? "සහකාර ලේකම් (විමර්ශන ශාඛාව)"
        : lang === "ta"
        ? "உதவிச் செயலாளர் (விசாரணைப் பிரிவு)"
        : "Assistant Secretary (Investigation Branch)";
    default:
      return lang === "si" ? "අදාළ නිලධාරියා" : "Originating Officer";
  }
}

/**
 * Check if a letter or case was assigned, handled, or originated by the Senior Assistant Secretary (or Deputy Secretary).
 */
export function isAssignedBySeniorAssistantSecretary(item: any): boolean {
  if (!item) return false;
  const raw = item.rawLetter || item;

  const assignedTo = String(item.assignedTo || raw.action_officer || raw.actionOfficer || raw.officer_name || "").toLowerCase().trim();
  const createdByName = String(raw.created_by_name || raw.createdByName || "").toLowerCase().trim();
  const createdByRole = String(raw.created_by_role || raw.createdByRole || "").toLowerCase().trim();
  const forwardedTo = String(raw.forwarded_to || raw.forwardedTo || "").toLowerCase().trim();
  const forwardReason = String(raw.forward_reason || raw.forwardReason || "").toLowerCase().trim();
  const addressedRole = String(raw.addressed_role || raw.addressedRole || "").toLowerCase().trim();
  const addressedTo = String(raw.addressed_to || raw.addressedTo || "").toLowerCase().trim();

  const isSeniorMatch = (text: string) => {
    if (!text) return false;
    return (
      text.includes("dharshana") ||
      text.includes("senanayake") ||
      text.includes("senior assistant") ||
      text.includes("senior_assistant") ||
      text.includes("deputy secretary") ||
      text.includes("deputy_secretary") ||
      text.includes("deputy") ||
      text.includes("ජ්‍යෙෂ්ඨ සහකාර") ||
      text.includes("ජ්‍යෙෂ්ඨ") ||
      text.includes("නියෝජ්‍ය ලේකම්") ||
      text.includes("නියෝජ්‍ය")
    );
  };

  // 1. Handled by / assigned to Senior Assistant Secretary (e.g. Dharshana Senanayake)
  if (isSeniorMatch(assignedTo)) {
    return true;
  }

  // 2. Created/registered by Senior Assistant Secretary
  if (isSeniorMatch(createdByName) || isSeniorMatch(createdByRole)) {
    return true;
  }

  // 3. Forward reason mentions Senior Assistant Secretary or Dharshana
  if (isSeniorMatch(forwardReason)) {
    return true;
  }

  // 4. Deputy / Senior Secretary origin group
  try {
    if (getLetterOriginGroup(raw) === "deputy_secretary") {
      return true;
    }
  } catch {}

  return false;
}

/**
 * Check if a letter or case is strictly routed, addressed, or assigned to Chief Clerk,
 * or was assigned by the Chief Clerk to a Subject Officer.
 */
export function isLetterForChiefClerk(item: any, officerProfile?: any): boolean {
  if (!item) return false;
  const raw = item.rawLetter || item;

  const assignedTo = String(item.assignedTo || raw.action_officer || raw.actionOfficer || raw.officer_name || "").toLowerCase().trim();
  const forwardedTo = String(raw.forwarded_to || raw.forwardedTo || "").toLowerCase().trim();
  const forwardReason = String(raw.forward_reason || raw.forwardReason || "").toLowerCase().trim();
  const addressedRole = String(raw.addressed_role || raw.addressedRole || "").toLowerCase().trim();
  const addressedTo = String(raw.addressed_to || raw.addressedTo || "").toLowerCase().trim();
  const createdByName = String(raw.created_by_name || raw.createdByName || "").toLowerCase().trim();

  const status = String(item.status || raw.status || "").toLowerCase().trim();

  const myName = String(officerProfile?.full_name || "").toLowerCase().trim();
  const myEmpNo = String(officerProfile?.employee_no || "").toLowerCase().trim();

  const isNameMatch = (field: string) => {
    if (!field) return false;
    if (myName && (field.includes(myName) || myName.includes(field))) return true;
    if (myEmpNo && field.includes(myEmpNo)) return true;
    return false;
  };

  const isChiefKeyword = (field: string) => {
    if (!field) return false;
    return (
      field.includes("chief_clerk") ||
      field.includes("chief clerk") ||
      field.includes("ශාඛා ප්‍රධානී") ||
      field.includes("chief_clerk_discipline") ||
      field.includes("chief_clerk_investigation") ||
      field === "chief clerk" ||
      field === "chief_clerk"
    );
  };

  // Branch separation check:
  // If viewing Discipline Chief Clerk, exclude letters routed exclusively to Investigation Branch Chief Clerk
  const myRole = String(officerProfile?.role || "").toLowerCase().trim();
  const isDisciplineBranch = myRole.includes("discipline") || myRole === "chief_clerk" || myRole.includes("විනය");
  const isInvestigationBranch = myRole.includes("investigation");

  if (isDisciplineBranch) {
    const isExclusivelyInvestigation =
      (forwardedTo.includes("investigation") || addressedRole.includes("investigation")) &&
      !forwardedTo.includes("discipline") &&
      !addressedRole.includes("discipline") &&
      !forwardReason.includes("discipline") &&
      !forwardReason.includes("disciplinary") &&
      !forwardReason.includes("විනය") &&
      !forwardReason.includes("chief clerk") &&
      !forwardReason.includes("ශාඛා ප්‍රධානී");
    if (isExclusivelyInvestigation && !isNameMatch(assignedTo) && !isNameMatch(forwardedTo)) {
      return false;
    }
  } else if (isInvestigationBranch) {
    const isExclusivelyDiscipline =
      (forwardedTo.includes("discipline") || addressedRole.includes("discipline") || forwardReason.includes("discipline") || forwardReason.includes("disciplinary") || forwardReason.includes("විනය")) &&
      !forwardedTo.includes("investigation") &&
      !addressedRole.includes("investigation") &&
      !forwardReason.includes("investigation");
    if (isExclusivelyDiscipline && !isNameMatch(assignedTo) && !isNameMatch(forwardedTo)) {
      return false;
    }
  }

  // 1. Matched directly by logged-in Chief Clerk's name or employee no
  if (isNameMatch(assignedTo) || isNameMatch(forwardedTo) || isNameMatch(addressedTo)) {
    return true;
  }

  // 2. Explicitly assigned, forwarded, or addressed to Chief Clerk role
  if (
    isChiefKeyword(assignedTo) ||
    isChiefKeyword(forwardedTo) ||
    isChiefKeyword(addressedTo) ||
    isChiefKeyword(addressedRole)
  ) {
    return true;
  }

  // 3. Forward reason notes specifically that it is routed to Chief Clerk or assigned by Chief Clerk
  if (
    forwardReason.includes("chief clerk") ||
    forwardReason.includes("chief_clerk") ||
    forwardReason.includes("ශාඛා ප්‍රධානී") ||
    forwardReason.includes("assigned by chief clerk") ||
    (myName && forwardReason.includes(myName))
  ) {
    return true;
  }

  // 4. Letters created by Chief Clerk
  if (isNameMatch(createdByName) || isChiefKeyword(createdByName)) {
    return true;
  }

  // 5. Letters assigned to Subject Officers under the Discipline Branch
  // (Chief Clerk oversees all Discipline Branch subject officers)
  if (isDisciplineBranch) {
    const isDisciplineSubjectOfficer =
      addressedRole.includes("subject") ||
      assignedTo.includes("subject") ||
      forwardedTo.includes("subject") ||
      assignedTo.includes("upul") ||
      forwardedTo.includes("upul");

    const hasDisciplineContext =
      forwardReason.includes("chief clerk") ||
      forwardReason.includes("ශාඛා ප්‍රධානී") ||
      forwardReason.includes("assigned by chief clerk") ||
      forwardReason.includes("discipline") ||
      forwardReason.includes("disciplinary") ||
      forwardReason.includes("විනය") ||
      Boolean(raw.date_letter_handover_discipline);

    // Exclude if routed exclusively to another branch or directly to Additional Secretary
    const isExclusivelyOther =
      (forwardedTo.includes("investigation") && !forwardedTo.includes("discipline")) ||
      ((forwardedTo.includes("additional") || assignedTo.includes("additional")) &&
        !forwardReason.includes("chief clerk") &&
        !forwardReason.includes("ශාඛා ප්‍රධානී") &&
        !forwardReason.includes("discipline"));

    if (isDisciplineSubjectOfficer && hasDisciplineContext && !isExclusivelyOther) {
      return true;
    }
  }

  return false;
}

/**
 * Determines whether a letter assigned / forwarded to Senior Assistant Secretary has already been submitted/forwarded out
 * (e.g. to Chief Clerk, Assistant Secretary of Discipline, Assistant Secretary of Investigations, or Subject Officer)
 * or is still pending action/submission by Senior Assistant Secretary.
 */
export function isLetterSubmittedBySenior(l: any): boolean {
  if (!l) return false;
  const fwdReason = String(l.forward_reason || l.forwardReason || "").toLowerCase();
  const fwdTo = String(l.forwarded_to || l.forwardedTo || "").toLowerCase();
  const actOfficer = String(l.action_officer || l.actionOfficer || "").toLowerCase();
  const status = String(l.status || "").toLowerCase();

  // 1. Explicit reason check: forwarded by Senior Assistant Secretary
  if (
    fwdReason.includes("forwarded by senior") ||
    fwdReason.includes("forwarded by deputy") ||
    fwdReason.includes("forwarded by dharshana")
  ) {
    return true;
  }

  // 2. Destination check: targeted to branch, chief clerk, or subject officer
  const isTargetedToBranch =
    fwdTo.includes("chief") ||
    fwdTo.includes("clerk") ||
    fwdTo.includes("discipline") ||
    fwdTo.includes("investigation") ||
    fwdTo.includes("subject") ||
    fwdTo.includes("upul") ||
    fwdTo.includes("bandula") ||
    fwdTo.includes("ranjith") ||
    fwdTo.includes("ශාඛා ප්‍රධානී") ||
    actOfficer.includes("chief") ||
    actOfficer.includes("clerk") ||
    actOfficer.includes("discipline") ||
    actOfficer.includes("investigation") ||
    actOfficer.includes("subject") ||
    actOfficer.includes("upul") ||
    actOfficer.includes("ශාඛා ප්‍රධානී");

  const isStillWithSenior =
    (fwdTo.includes("senior") || fwdTo.includes("dharshana") || fwdTo.includes("deputy")) &&
    !fwdReason.includes("forwarded by senior");

  if (isTargetedToBranch && !isStillWithSenior) {
    return true;
  }

  // 3. Status progression check: has progressed past Senior Assistant Secretary
  if (
    status === "forwarded" ||
    status === "under subject officer" ||
    status === "assigned answer letter" ||
    status === "closed" ||
    status === "finalized"
  ) {
    if (!isStillWithSenior) return true;
  }

  return false;
}

/**
 * Returns formatted badge information for Senior Assistant Secretary submission status
 */
export function getSeniorLetterStatusInfo(l: any, lang: string = "si") {
  const isSubmitted = isLetterSubmittedBySenior(l);
  const fwdTo = String(l.forwarded_to || l.forwardedTo || "");
  const actOff = String(l.action_officer || l.actionOfficer || "");
  const target = fwdTo || actOff;

  let destLabel = "";
  const targetLower = target.toLowerCase();
  if (targetLower.includes("chief") || targetLower.includes("clerk") || targetLower.includes("ශාඛා")) {
    destLabel = lang === "si" ? "ශාඛා ප්‍රධානී (විනය)" : lang === "ta" ? "முதன்மை எழுதுநர்" : "Chief Clerk";
  } else if (targetLower.includes("discipline") || targetLower.includes("විනය") || targetLower.includes("bandula")) {
    destLabel = lang === "si" ? "සහකාර ලේකම් (විනය)" : lang === "ta" ? "உதவிச் செயலாளர் (ஒழுக்கம்)" : "Asst. Sec (Discipline)";
  } else if (targetLower.includes("investigation") || targetLower.includes("විමර්ශන") || targetLower.includes("ranjith")) {
    destLabel = lang === "si" ? "සහකාර ලේකම් (විමර්ශන)" : lang === "ta" ? "உதவிச் செயலாளர் (விசாரணை)" : "Asst. Sec (Investigation)";
  } else if (targetLower.includes("subject") || targetLower.includes("upul")) {
    destLabel = lang === "si" ? "විෂයභාර නිලධාරී" : lang === "ta" ? "விடய அதிகாரி" : "Subject Officer";
  } else if (target) {
    destLabel = target.split("(")[0].trim();
  }

  if (isSubmitted) {
    return {
      isSubmitted: true,
      badgeText: lang === "si" ? "ඉදිරිපත් කළා (යොමු වූ)" : lang === "ta" ? "சமர்ப்பிக்கப்பட்டது" : "Submitted / Forwarded",
      destination: destLabel,
      badgeBg: "#ecfdf5",
      badgeColor: "#047857",
      badgeBorder: "#a7f3d0",
    };
  }

  return {
    isSubmitted: false,
    badgeText: lang === "si" ? "ඉදිරිපත් කිරීමට ඇති (පොරොත්තු)" : lang === "ta" ? "நிலுவையில் உள்ளது" : "Unsubmitted (Pending)",
    destination: "",
    badgeBg: "#fffbeb",
    badgeColor: "#b45309",
    badgeBorder: "#fde68a",
  };
}

/**
 * Determines whether a letter assigned / forwarded to Assistant Secretary Discipline Branch
 * has already been submitted/forwarded out (specifically to Chief Clerk or Subject Officer)
 * or is still pending action/submission.
 */
export function isLetterSubmittedByDiscipline(l: any): boolean {
  if (!l) return false;
  const fwdReason = String(l.forward_reason || l.forwardReason || "").toLowerCase();
  const fwdTo = String(l.forwarded_to || l.forwardedTo || "").toLowerCase();
  const actOfficer = String(l.action_officer || l.actionOfficer || "").toLowerCase();
  const addrTo = String(l.addressed_to || l.addressedTo || "").toLowerCase();
  const addrRole = String(l.addressed_role || l.addressedRole || "").toLowerCase();
  const status = String(l.status || "").toLowerCase();

  // 1. Explicit reason: forwarded by Assistant Secretary Discipline / Bandula or forwarded to Chief Clerk
  if (
    fwdReason.includes("forwarded to chief clerk") ||
    fwdReason.includes("forwarded to chief") ||
    fwdReason.includes("ශාඛා ප්‍රධානී වෙත යොමු") ||
    fwdReason.includes("ශාඛා ප්‍රධානී") ||
    fwdReason.includes("forwarded by assistant secretary (discipline)") ||
    fwdReason.includes("forwarded by assistant secretary discipline") ||
    fwdReason.includes("forwarded by bandula") ||
    fwdReason.includes("assigned by chief clerk")
  ) {
    return true;
  }

  // 2. Has been targeted to Chief Clerk or Subject Officer
  const isTargetedToChiefOrSubject =
    fwdTo.includes("chief") ||
    fwdTo.includes("clerk") ||
    fwdTo.includes("ශාඛා ප්‍රධානී") ||
    fwdTo.includes("subject") ||
    fwdTo.includes("upul") ||
    fwdTo.includes("so-") ||
    actOfficer.includes("chief") ||
    actOfficer.includes("clerk") ||
    actOfficer.includes("ශාඛා ප්‍රධානී") ||
    actOfficer.includes("subject") ||
    actOfficer.includes("upul") ||
    addrTo.includes("chief") ||
    addrTo.includes("clerk") ||
    addrTo.includes("ශාඛා ප්‍රධානී") ||
    addrRole.includes("chief") ||
    addrRole.includes("clerk") ||
    addrRole.includes("subject");

  // Check if it's still addressed/forwarded purely to Assistant Secretary Discipline / Bandula
  const isStillWithDiscipline =
    (fwdTo.includes("bandula") || fwdTo.includes("assistant_secretary_discipline") || actOfficer.includes("bandula") || addrTo.includes("bandula")) &&
    !fwdTo.includes("chief") &&
    !fwdTo.includes("clerk") &&
    !fwdTo.includes("ශාඛා") &&
    !fwdTo.includes("subject") &&
    !actOfficer.includes("chief") &&
    !actOfficer.includes("clerk") &&
    !actOfficer.includes("subject");

  if (isTargetedToChiefOrSubject && !isStillWithDiscipline) {
    return true;
  }

  // 3. Status progression check: under subject officer, closed, finalized
  if (
    status === "under subject officer" ||
    status === "assigned answer letter" ||
    status === "closed" ||
    status === "finalized"
  ) {
    return true;
  }

  return false;
}

/**
 * Universal submission check for any officer role (Discipline, Senior, Chief Clerk, Admin, etc.)
 */
export function isLetterSubmittedGeneral(l: any, userRole?: string, userName?: string): boolean {
  if (!l) return false;
  const roleLower = String(userRole || "").toLowerCase().trim();
  const nameLower = String(userName || "").toLowerCase().trim();

  if (roleLower.includes("chief") || roleLower.includes("clerk") || roleLower.includes("ශාඛා")) {
    return (
      String(l.status || "").toLowerCase().includes("subject") ||
      String(l.action_officer || l.actionOfficer || "").toLowerCase().includes("subject") ||
      String(l.forwarded_to || l.forwardedTo || "").toLowerCase().includes("subject") ||
      String(l.forward_reason || l.forwardReason || "").toLowerCase().includes("assigned by chief")
    );
  }

  if (roleLower.includes("senior") || roleLower.includes("deputy") || nameLower.includes("dharshana")) {
    return isLetterSubmittedBySenior(l);
  }

  if (roleLower.includes("discipline") || nameLower.includes("bandula") || roleLower === "admin") {
    return isLetterSubmittedByDiscipline(l);
  }

  // Fallback check
  if (isLetterSubmittedByDiscipline(l) || isLetterSubmittedBySenior(l)) {
    return true;
  }

  return Boolean(l.isForwarded || (l.forwarded_to && !l.forwarded_to.includes("additional")));
}

/**
 * Returns formatted badge information for any letter's submission status
 */
export function getGeneralLetterStatusInfo(l: any, lang: string = "si", userRole?: string, userName?: string) {
  const isSubmitted = isLetterSubmittedGeneral(l, userRole, userName);
  const fwdTo = String(l.forwarded_to || l.forwardedTo || "");
  const actOff = String(l.action_officer || l.actionOfficer || "");
  const addrTo = String(l.addressed_to || l.addressedTo || "");
  const target = fwdTo || actOff || addrTo;

  let destLabel = "";
  const targetLower = target.toLowerCase();
  if (targetLower.includes("chief") || targetLower.includes("clerk") || targetLower.includes("ශාඛා")) {
    destLabel = lang === "si" ? "ශාඛා ප්‍රධානී (විනය)" : lang === "ta" ? "முதன்மை எழுதுநர்" : "Chief Clerk";
  } else if (targetLower.includes("discipline") || targetLower.includes("විනය") || targetLower.includes("bandula")) {
    destLabel = lang === "si" ? "සහකාර ලේකම් (විනය)" : lang === "ta" ? "உதவிச் செயலாளர் (ஒழுக்கம்)" : "Asst. Sec (Discipline)";
  } else if (targetLower.includes("investigation") || targetLower.includes("විමර්ශන") || targetLower.includes("ranjith")) {
    destLabel = lang === "si" ? "සහකාර ලේකම් (විමර්ශන)" : lang === "ta" ? "உதவிச் செயலாளர் (விசாரணை)" : "Asst. Sec (Investigation)";
  } else if (targetLower.includes("subject") || targetLower.includes("upul") || targetLower.includes("so-")) {
    destLabel = lang === "si" ? "විෂයභාර නිලධාරී" : lang === "ta" ? "விடய அதிகாரி" : "Subject Officer";
  } else if (target) {
    destLabel = target.split("(")[0].trim();
  }

  if (isSubmitted) {
    return {
      isSubmitted: true,
      badgeText: lang === "si" ? "ඉදිරිපත් කළා (යොමු වූ)" : lang === "ta" ? "சமர்ப்பிக்கப்பட்டது" : "Submitted / Forwarded",
      destination: destLabel,
      badgeBg: "#ecfdf5",
      badgeColor: "#047857",
      badgeBorder: "#a7f3d0",
    };
  }

  return {
    isSubmitted: false,
    badgeText: lang === "si" ? "ඉදිරිපත් කිරීමට ඇති (පොරොත්තු)" : lang === "ta" ? "நிலுவையில் உள்ளது" : "Unsubmitted (Pending)",
    destination: "",
    badgeBg: "#fffbeb",
    badgeColor: "#b45309",
    badgeBorder: "#fde68a",
  };
}



