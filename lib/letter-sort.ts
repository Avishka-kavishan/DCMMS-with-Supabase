/**
 * Utility functions for ordering letters, cases, and mail records
 * so that the latest letters appear at the top (newest first).
 */

/**
 * Robustly parses various date formats into a millisecond timestamp.
 * Supports:
 * - "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss..."
 * - "YYYY/MM/DD" or "YYYY MM DD" or "YYYY.MM.DD"
 * - "DD-MM-YYYY" or "DD/MM/YYYY"
 * - Date instances or numeric timestamps
 */
export function parseDateToTime(val: any): number {
  if (!val) return 0;
  if (val instanceof Date) {
    const t = val.getTime();
    return isNaN(t) ? 0 : t;
  }
  if (typeof val === "number") {
    return isNaN(val) ? 0 : val;
  }
  if (typeof val !== "string") return 0;

  const s = val.trim();
  if (!s || s === "—" || s === "-" || s === "N/A" || s === "null" || s === "undefined") return 0;

  // 1. Check for YYYY[-/.\s]MM[-/.\s]DD at start
  const m = s.match(/^(\d{4})[-/\.\s](\d{1,2})[-/\.\s](\d{1,2})/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);

    const timeMatch = s.match(/[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (timeMatch) {
      const hh = parseInt(timeMatch[1], 10);
      const mm = parseInt(timeMatch[2], 10);
      const ss = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const dt = new Date(y, mon, d, hh, mm, ss);
      const t = dt.getTime();
      if (!isNaN(t)) return t;
    }

    const dt = new Date(y, mon, d);
    const t = dt.getTime();
    if (!isNaN(t)) return t;
  }

  // 2. Check for DD[-/.\s]MM[-/.\s]YYYY
  const mDmy = s.match(/^(\d{1,2})[-/\.\s](\d{1,2})[-/\.\s](\d{4})/);
  if (mDmy) {
    const d = parseInt(mDmy[1], 10);
    const mon = parseInt(mDmy[2], 10) - 1;
    const y = parseInt(mDmy[3], 10);
    const dt = new Date(y, mon, d);
    const t = dt.getTime();
    if (!isNaN(t)) return t;
  }

  // 3. Fallback to standard Date.parse
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) return parsed;

  return 0;
}

/**
 * Extracts a calendar date timestamp from a letter number or case number string
 * e.g. "2026/10/28/1" -> 2026-10-28
 */
export function parseDateFromLetterNo(no?: string | null): number {
  if (!no || typeof no !== "string") return 0;
  const m = no.match(/(\d{4})[-/\.\s](\d{1,2})[-/\.\s](\d{1,2})/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    const dt = new Date(y, mon, d);
    const t = dt.getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

/**
 * Extracts the sequential index at the end of a letter/case number (e.g. "2026/10/28/2" -> 2).
 */
export function extractSequenceNumber(no?: string | null): number {
  if (!no || typeof no !== "string") return 0;
  const match = no.match(/(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})[-/\.](\d+)/);
  if (match && match[4]) {
    return parseInt(match[4], 10) || 0;
  }
  const trailing = no.match(/[-/](\d+)$/);
  if (trailing && trailing[1]) {
    return parseInt(trailing[1], 10) || 0;
  }
  return 0;
}

/**
 * Calculates the effective sorting timestamp for a letter or case record.
 * Takes the most recent calendar date among letterDate, receivedDate, assignedDate,
 * or the date encoded in the letter/case number.
 */
export function getLetterSortTime(item: any): number {
  if (!item) return 0;

  const letTime = parseDateToTime(
    item.letterDate ||
    item.letter_date ||
    item.submitted_date ||
    item.submittedDate ||
    item.date_letter_handover_discipline ||
    item.dateFiled ||
    item.mailDate ||
    item.mail_date
  );

  const recTime = parseDateToTime(
    item.receivedDate ||
    item.received_date ||
    item.date_received_by_add_secretary
  );

  const asgTime = parseDateToTime(
    item.assignedDate ||
    item.assigned_date
  );

  const noTime = parseDateFromLetterNo(
    item.letterNo ||
    item.letter_no ||
    item.letter_number ||
    item.caseNo ||
    item.case_no ||
    item.serialNo ||
    item.serial_no ||
    item.refNo ||
    item.ref_no ||
    item.ref_number
  );

  const maxCalendarDate = Math.max(letTime, recTime, asgTime, noTime);
  if (maxCalendarDate > 0) {
    return maxCalendarDate;
  }

  const createdTime = parseDateToTime(
    item.createdAt ||
    item.created_at ||
    item.updatedAt ||
    item.updated_at
  );
  return createdTime > 0 ? createdTime : 0;
}

/**
 * Comparator function to sort letters/cases in descending order
 * so that the latest letters are placed first.
 */
export function compareLettersLatestFirst(a: any, b: any): number {
  const timeA = getLetterSortTime(a);
  const timeB = getLetterSortTime(b);
  if (timeA !== timeB) {
    return timeB - timeA; // Descending: latest date first
  }

  // Tie-breaker 1: sequence number if from the same day (e.g. 2026/10/28/2 before 2026/10/28/1)
  const seqA = extractSequenceNumber(a?.letterNo || a?.letter_no || a?.caseNo || a?.case_no || a?.serial_no || a?.refNo);
  const seqB = extractSequenceNumber(b?.letterNo || b?.letter_no || b?.caseNo || b?.case_no || b?.serial_no || b?.refNo);
  if (seqA !== seqB) {
    return seqB - seqA;
  }

  // Tie-breaker 2: creation timestamp
  const createA = parseDateToTime(a?.createdAt || a?.created_at);
  const createB = parseDateToTime(b?.createdAt || b?.created_at);
  if (createA !== createB && createA > 0 && createB > 0) {
    return createB - createA;
  }

  // Tie-breaker 3: string locale compare descending
  const strA = String(a?.letterNo || a?.letter_no || a?.caseNo || a?.case_no || a?.id || "");
  const strB = String(b?.letterNo || b?.letter_no || b?.caseNo || b?.case_no || b?.id || "");
  return strB.localeCompare(strA);
}

/**
 * Helper to return a new array sorted with the latest letter first.
 */
export function sortLettersLatestFirst<T>(list: T[]): T[] {
  if (!Array.isArray(list)) return [];
  return [...list].sort(compareLettersLatestFirst);
}

