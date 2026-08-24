/**
 * Universal Protected XLSX Exporter.
 * Generates valid OpenXML (.xlsx) workbooks with Worksheet Protection and Password Locking.
 * 
 * Features:
 * - Read-only / Sheet locked to prevent unauthorized tampering of exported records.
 * - Password unlock support (Default: DCMMS@Secure2026).
 * - Full UTF-8 support for English, Sinhala, and Tamil characters.
 * - Styled header rows (Navy Blue `#1E3A8A`, bold white text, frozen pane).
 * - Zebra striping on data rows and subtle cell borders.
 * - Automatic column width calculation.
 * - Zero external dependencies (runs purely in the browser).
 */

// CRC32 Lookup Table for standard ZIP archive generation
const CRC_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

function calculateCrc32(buf: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Generates the standard Excel 16-bit password hash used by OpenXML for sheet protection.
 */
export function hashExcelPassword(password: string): string {
  if (!password) return "CE4B";
  let hash = 0;
  for (let i = password.length - 1; i >= 0; i--) {
    const char = password.charCodeAt(i);
    hash = ((hash >> 14) & 0x01) | ((hash << 1) & 0x7fff);
    hash ^= char;
  }
  hash = ((hash >> 14) & 0x01) | ((hash << 1) & 0x7fff);
  hash ^= password.length;
  hash ^= 0xce4b;
  return hash.toString(16).toUpperCase().padStart(4, "0");
}

function escapeXml(str: any): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = "";
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

interface ZipFileEntry {
  name: string;
  content: string;
}

/**
 * Creates a valid, uncompressed (Store method) ZIP binary buffer in memory.
 */
function createZipArchive(files: ZipFileEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const processedFiles = files.map((file) => {
    const dataBuf = encoder.encode(file.content);
    const nameBuf = encoder.encode(file.name);
    const crc = calculateCrc32(dataBuf);
    return {
      nameBuf,
      dataBuf,
      crc,
      size: dataBuf.length,
      offset: 0,
    };
  });

  // 1. Calculate total size required
  let totalLocalSize = 0;
  let totalCentralDirSize = 0;

  processedFiles.forEach((file) => {
    file.offset = totalLocalSize;
    // Local header: 30 bytes + name length + data size
    totalLocalSize += 30 + file.nameBuf.length + file.size;
    // Central directory header: 46 bytes + name length
    totalCentralDirSize += 46 + file.nameBuf.length;
  });

  const endOfCentralDirSize = 22;
  const totalBufferSize = totalLocalSize + totalCentralDirSize + endOfCentralDirSize;

  const buffer = new Uint8Array(totalBufferSize);
  const view = new DataView(buffer.buffer);
  let pos = 0;

  // 2. Write Local File Headers + Data Chunks
  for (const file of processedFiles) {
    const localHeaderPos = pos;
    view.setUint32(pos, 0x04034b50, true); // Local header signature
    view.setUint16(pos + 4, 20, true);     // Version needed (2.0)
    view.setUint16(pos + 6, 0, true);      // General purpose bit flag
    view.setUint16(pos + 8, 0, true);      // Compression method (0 = Store)
    view.setUint16(pos + 10, 0, true);     // File mod time
    view.setUint16(pos + 12, 0, true);     // File mod date
    view.setUint32(pos + 14, file.crc, true);       // CRC-32
    view.setUint32(pos + 18, file.size, true);      // Compressed size
    view.setUint32(pos + 22, file.size, true);      // Uncompressed size
    view.setUint16(pos + 26, file.nameBuf.length, true); // Filename length
    view.setUint16(pos + 28, 0, true);             // Extra field length
    pos += 30;

    buffer.set(file.nameBuf, pos);
    pos += file.nameBuf.length;

    buffer.set(file.dataBuf, pos);
    pos += file.size;
  }

  // 3. Write Central Directory Headers
  const centralDirStartPos = pos;
  for (const file of processedFiles) {
    view.setUint32(pos, 0x02014b50, true); // Central directory file header signature
    view.setUint16(pos + 4, 20, true);     // Version made by
    view.setUint16(pos + 6, 20, true);     // Version needed to extract
    view.setUint16(pos + 8, 0, true);      // General purpose bit flag
    view.setUint16(pos + 10, 0, true);     // Compression method (0 = Store)
    view.setUint16(pos + 12, 0, true);     // File mod time
    view.setUint16(pos + 14, 0, true);     // File mod date
    view.setUint32(pos + 16, file.crc, true);       // CRC-32
    view.setUint32(pos + 20, file.size, true);      // Compressed size
    view.setUint32(pos + 24, file.size, true);      // Uncompressed size
    view.setUint16(pos + 28, file.nameBuf.length, true); // Filename length
    view.setUint16(pos + 30, 0, true);             // Extra field length
    view.setUint16(pos + 32, 0, true);             // Comment length
    view.setUint16(pos + 34, 0, true);             // Disk number start
    view.setUint16(pos + 36, 0, true);             // Internal file attributes
    view.setUint32(pos + 38, 0, true);             // External file attributes
    view.setUint32(pos + 42, file.offset, true);   // Relative offset of local header
    pos += 46;

    buffer.set(file.nameBuf, pos);
    pos += file.nameBuf.length;
  }

  // 4. Write End of Central Directory Record (EOCD)
  view.setUint32(pos, 0x06054b50, true);                    // EOCD signature
  view.setUint16(pos + 4, 0, true);                         // Number of this disk
  view.setUint16(pos + 6, 0, true);                         // Disk where central directory starts
  view.setUint16(pos + 8, processedFiles.length, true);     // Total entries on this disk
  view.setUint16(pos + 10, processedFiles.length, true);    // Total entries
  view.setUint32(pos + 12, totalCentralDirSize, true);      // Size of central directory
  view.setUint32(pos + 16, centralDirStartPos, true);       // Offset of start of central directory
  view.setUint16(pos + 20, 0, true);                        // Comment length

  return buffer;
}

export interface ExportToExcelOptions {
  sheetName?: string;
  password?: string;
}

export const LOCAL_STORAGE_EXCEL_PASSWORD_KEY = "dcmms_excel_export_password";

/** Default password used to lock exported sheets (configurable via NEXT_PUBLIC_EXCEL_EXPORT_PASSWORD) */
export const DEFAULT_EXCEL_PASSWORD =
  process.env.NEXT_PUBLIC_EXCEL_EXPORT_PASSWORD || "DCMMS@Secure2026";

/**
 * Gets the current active Excel export password (checking localStorage first, then falling back to default)
 */
export function getActiveExcelPassword(): string {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_EXCEL_PASSWORD_KEY);
      if (stored && stored.trim()) {
        return stored.trim();
      }
    } catch (e) {}
  }
  return DEFAULT_EXCEL_PASSWORD;
}

/**
 * Updates the stored Excel export password in localStorage
 */
export function setActiveExcelPassword(newPassword: string): void {
  if (typeof window !== "undefined") {
    try {
      if (!newPassword || newPassword.trim() === "" || newPassword.trim() === DEFAULT_EXCEL_PASSWORD) {
        localStorage.removeItem(LOCAL_STORAGE_EXCEL_PASSWORD_KEY);
      } else {
        localStorage.setItem(LOCAL_STORAGE_EXCEL_PASSWORD_KEY, newPassword.trim());
      }
      // Dispatch custom storage event so all tabs/components update
      window.dispatchEvent(new Event("dcmms_excel_password_changed"));
    } catch (e) {}
  }
}

/**
 * Universal Excel Exporter with Password Protection and Worksheet Locking.
 * 
 * @param filename File name for the downloaded spreadsheet (e.g. "DCMMS_Report")
 * @param headers Array of column header strings
 * @param rows 2D array of row cell values
 * @param options Optional configuration for sheet name and sheet protection password
 */
export function exportToExcel(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  options: ExportToExcelOptions = {}
) {
  if (!rows || rows.length === 0) {
    alert("No data available to export.");
    return;
  }

  const activePassword = options.password || getActiveExcelPassword();
  const { sheetName = "DCMMS Records", password = activePassword } = options;

  let cleanFilename = filename.replace(/\.(csv|xlsx)$/i, "");
  cleanFilename = `${cleanFilename}.xlsx`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // Excel styles: Navy header, alternating row zebra-fill, borders, and locked protection
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><color rgb="FF1F2937"/><name val="Segoe UI"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/></font>
    <font><sz val="10"/><color rgb="FF4B5563"/><name val="Segoe UI"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF9FAFB"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="FFE5E7EB"/></left>
      <right style="thin"><color rgb="FFE5E7EB"/></right>
      <top style="thin"><color rgb="FFE5E7EB"/></top>
      <bottom style="thin"><color rgb="FFE5E7EB"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <!-- 0: Default Cell (Locked) -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyProtection="1">
      <protection locked="1"/>
    </xf>
    <!-- 1: Header Cell (Navy, Bold White Text, Center) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
      <protection locked="1"/>
    </xf>
    <!-- 2: Standard Data Row (White, Left aligned) -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1" applyProtection="1">
      <alignment vertical="center"/>
      <protection locked="1"/>
    </xf>
    <!-- 3: Striped Data Row (Subtle Gray, Left aligned) -->
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1" applyProtection="1">
      <alignment vertical="center"/>
      <protection locked="1"/>
    </xf>
  </cellXfs>
</styleSheet>`;

  // Auto-calculate column widths
  const colWidths = headers.map((h, colIdx) => {
    let maxLen = String(h ?? "").length;
    for (const r of rows) {
      const val = r[colIdx] !== null && r[colIdx] !== undefined ? String(r[colIdx]) : "";
      if (val.length > maxLen) {
        maxLen = Math.min(val.length, 60);
      }
    }
    return Math.max(maxLen + 4, 15);
  });

  const colsXml =
    `<cols>` +
    colWidths
      .map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`)
      .join("") +
    `</cols>`;

  let sheetDataXml = "<sheetData>";

  // Header Row (Row 1)
  sheetDataXml += `<row r="1" ht="28" customHeight="1">`;
  headers.forEach((h, colIdx) => {
    const cellRef = `${colToLetter(colIdx + 1)}1`;
    sheetDataXml += `<c r="${cellRef}" s="1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  sheetDataXml += `</row>`;

  // Data Rows (Row 2 onwards)
  rows.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 2;
    const styleId = rowIdx % 2 === 1 ? "3" : "2";
    sheetDataXml += `<row r="${rowNum}" ht="22" customHeight="1">`;
    headers.forEach((_, colIdx) => {
      const cellRef = `${colToLetter(colIdx + 1)}${rowNum}`;
      const val = row[colIdx];
      if (val === null || val === undefined || val === "") {
        sheetDataXml += `<c r="${cellRef}" s="${styleId}"/>`;
      } else if (typeof val === "number" && !isNaN(val)) {
        sheetDataXml += `<c r="${cellRef}" s="${styleId}"><v>${val}</v></c>`;
      } else {
        sheetDataXml += `<c r="${cellRef}" s="${styleId}" t="inlineStr"><is><t>${escapeXml(
          String(val)
        )}</t></is></c>`;
      }
    });
    sheetDataXml += `</row>`;
  });
  sheetDataXml += "</sheetData>";

  // Sheet Protection Tag with hashed password & restricted permissions
  const passHash = hashExcelPassword(password);
  const protectionXml = `<sheetProtection password="${passHash}" sheet="1" objects="1" scenarios="1" selectLockedCells="1" selectUnlockedCells="1" formatCells="0" formatColumns="0" formatRows="0" insertColumns="0" insertRows="0" insertHyperlinks="0" deleteColumns="0" deleteRows="0" sort="1" autoFilter="1"/>`;

  const totalCols = headers.length || 1;
  const totalRows = rows.length + 1;
  const dimensionRef = `A1:${colToLetter(totalCols)}${totalRows}`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dimensionRef}"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  ${colsXml}
  ${sheetDataXml}
  ${protectionXml}
</worksheet>`;

  const zipFiles: ZipFileEntry[] = [
    { name: "[Content_Types].xml", content: contentTypesXml },
    { name: "_rels/.rels", content: relsXml },
    { name: "xl/workbook.xml", content: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRelsXml },
    { name: "xl/styles.xml", content: stylesXml },
    { name: "xl/worksheets/sheet1.xml", content: sheet1Xml },
  ];

  const zipBuffer = createZipArchive(zipFiles);

  // Download XLSX Blob
  const blob = new Blob([zipBuffer.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
