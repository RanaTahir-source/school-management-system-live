// Minimal CSV builder - no dependency needed (Excel opens .csv natively, and
// this avoids adding a heavier xlsx library just for "export to Excel").
export type CsvColumn = { key: string; label: string };

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(','));
  // Leading BOM so Excel opens UTF-8 CSVs (accented names etc.) without
  // mangling characters.
  return '﻿' + [header, ...lines].join('\r\n');
}
