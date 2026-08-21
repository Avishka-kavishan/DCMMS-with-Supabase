/**
 * Universal Excel / CSV Exporter with UTF-8 BOM encoding.
 * Ensures 100% compatibility when opened directly in Microsoft Excel, Google Sheets, LibreOffice, Numbers.
 */
export function exportToExcel(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
) {
  if (!rows || rows.length === 0) {
    alert("No data available to export.");
    return;
  }

  const cleanFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;

  // Format headers
  const headerLine = headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(",");

  // Format data rows
  const rowLines = rows.map((row) =>
    row
      .map((cell) => {
        if (cell === null || cell === undefined) return '""';
        const str = String(cell).replace(/"/g, '""').replace(/\r?\n/g, " ");
        return `"${str}"`;
      })
      .join(",")
  );

  // Prepend UTF-8 Byte Order Mark (\uFEFF)
  const csvContent = "\uFEFF" + [headerLine, ...rowLines].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
