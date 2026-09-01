import * as ExcelJS from 'exceljs';

// Shared helpers for "bulk import from Excel" features (Students, Teachers,
// and any future module that wants the same pattern). Keeping this generic
// here means every module gets identical, predictable parsing behaviour
// instead of each one rolling its own header-matching logic.

// Turns a human header like "Guardian CNIC" or "Date of Birth" into a plain
// camelCase key ("guardianCnic", "dateOfBirth") so callers can read
// row.fullName / row.admissionNo etc. regardless of exact spacing/casing the
// school admin used when they filled in the template.
function normalizeHeader(header: string): string {
  const words = header
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  return words
    .map((word, i) => (i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join('');
}

// Reads the FIRST worksheet of an uploaded .xlsx buffer. Row 1 is always
// treated as the header row (whatever text is there gets normalized into a
// key) - every row after that becomes one plain object. Fully blank rows are
// skipped (common when someone leaves gaps in a spreadsheet).
export async function parseExcelRows(buffer: Buffer): Promise<Record<string, any>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = normalizeHeader(String(cell.value ?? '').trim());
  });

  const rows: Record<string, any>[] = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    let hasValue = false;
    const obj: Record<string, any> = {};

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      let value: any = cell.value;
      // Formula cells resolve to { result, formula }; rich text resolves to
      // { richText: [...] } - unwrap both to a plain value.
      if (value && typeof value === 'object') {
        if ('result' in value) value = (value as any).result;
        else if ('richText' in value) value = (value as any).richText.map((t: any) => t.text).join('');
      }
      if (value instanceof Date) value = value.toISOString().slice(0, 10);
      if (value !== null && value !== undefined && String(value).trim() !== '') hasValue = true;
      obj[key] = typeof value === 'string' ? value.trim() : value;
    });

    if (hasValue) rows.push(obj);
  }
  return rows;
}

// Builds a downloadable .xlsx template: bold header row + one greyed-out
// example row so a non-technical admin can see exactly what format each
// column expects before they start typing real data.
export async function buildExcelTemplate(
  columns: { header: string; example?: string; width?: number }[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Import');
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.header, width: c.width ?? 22 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

  if (columns.some((c) => c.example)) {
    const exampleValues: Record<string, string> = {};
    columns.forEach((c) => {
      if (c.example) exampleValues[c.header] = c.example;
    });
    const row = sheet.addRow(exampleValues);
    row.font = { italic: true, color: { argb: 'FF94A3B8' } };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

// Standard shape every bulk-import service method should return, and every
// frontend "Bulk Import" page should render (row-by-row results table).
export type BulkImportRowResult = {
  row: number; // 1-based spreadsheet row number (header = row 1)
  status: 'created' | 'error';
  identifier?: string; // e.g. admissionNo / employeeId, for quick scanning
  message?: string; // success detail (e.g. Login ID) or the error reason
};

export type BulkImportSummary = {
  total: number;
  created: number;
  failed: number;
  results: BulkImportRowResult[];
};
