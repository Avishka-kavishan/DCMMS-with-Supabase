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
];

/**
 * Categorize letter provenance for Additional Secretary into the 3 key sending officers + Direct
 */
export function getLetterOriginGroup(l: any): LetterOriginGroup {
  if (!l) return "direct_additional_sec";
  const roleRaw = (l.created_by_role || l.createdByRole || "").toLowerCase().trim();
  const creator = (l.created_by_name || "").toLowerCase().trim();
  const addrRole = (l.addressedRole || l.addressed_role || "").toLowerCase().trim();
  const addrTo = (l.addressedTo || l.addressed_to || "").toLowerCase().trim();
  const fwdReason = (l.forward_reason || l.forwardReason || "").toLowerCase().trim();

  // 1. Deputy Secretary / Senior Assistant Secretary
  if (
    roleRaw.includes("deputy") ||
    roleRaw.includes("senior") ||
    roleRaw === "senior_assistant_secretary" ||
    roleRaw === "deputy_secretary" ||
    creator.includes("dharshana") ||
    creator.includes("deputy") ||
    creator.includes("senior assistant") ||
    creator.includes("ජ්‍යෙෂ්ඨ") ||
    creator.includes("නියෝජ්‍ය") ||
    fwdReason.includes("senior assistant") ||
    fwdReason.includes("deputy") ||
    fwdReason.includes("dharshana") ||
    (l.isForwarded && (addrRole.includes("senior") || addrRole.includes("deputy") || addrTo.includes("dharshana")))
  ) {
    return "deputy_secretary";
  }

  // 2. Assistant Secretary of Discipline
  if (
    roleRaw.includes("discipline") ||
    creator.includes("bandula") ||
    (creator.includes("discipline") && (creator.includes("assistant") || creator.includes("secretary"))) ||
    fwdReason.includes("discipline") ||
    (l.isForwarded && (addrRole.includes("discipline") || addrTo.includes("bandula")))
  ) {
    return "asst_sec_discipline";
  }

  // 3. Assistant Secretary of Investigations
  if (
    (roleRaw.includes("investigation") && (roleRaw.includes("assistant") || roleRaw.includes("sec") || !roleRaw.includes("officer"))) ||
    creator.includes("ranjith") ||
    (creator.includes("investigation") && (creator.includes("assistant") || creator.includes("secretary"))) ||
    fwdReason.includes("investigation") ||
    (l.isForwarded && (addrRole.includes("investigation") || addrTo.includes("ranjith")))
  ) {
    return "asst_sec_investigation";
  }

  // 4. Meant directly for Additional Secretary
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

  // 5. Letter addressed/forwarded to Chief Clerk with Senior provenance
  const isChiefTarget = (
    forwardedTo.includes("chief") ||
    forwardedTo.includes("clerk") ||
    forwardedTo.includes("ශාඛා ප්‍රධානී") ||
    addressedRole.includes("chief") ||
    addressedTo.includes("chief")
  );
  if (isChiefTarget && (isSeniorMatch(forwardReason) || isSeniorMatch(createdByName) || isSeniorMatch(assignedTo) || isSeniorMatch(addressedRole))) {
    return true;
  }

  return false;
}

