/**
 * Minimal RFC 4180-ish CSV serialiser. Good enough for agency exports
 * into Google Sheets / Excel — not a general-purpose library.
 *
 * What we handle:
 * - Commas, newlines, and quotes inside cells → field gets wrapped in
 *   double quotes; embedded quotes are doubled.
 * - `null` / `undefined` → empty field.
 * - Dates → ISO 8601 string (stable, parseable by every spreadsheet).
 * - Booleans → `"true"` / `"false"`.
 * - Everything else → `String(value)`.
 *
 * What we do NOT handle:
 * - BOM prefix (Excel's Latin-1 default assumption); add it at the
 *   response layer if Ramtin's users complain.
 * - Numeric formatting (currencies, locales). Numbers ship as-is.
 * - Multi-row exports with headers per section. One header row only.
 */

export type CsvValue = string | number | boolean | Date | null | undefined;
export type CsvRow = Record<string, CsvValue>;

function escapeField(raw: CsvValue): string {
  if (raw === null || raw === undefined) return '';
  let value: string;
  if (raw instanceof Date) {
    value = raw.toISOString();
  } else if (typeof raw === 'boolean') {
    value = raw ? 'true' : 'false';
  } else {
    value = String(raw);
  }
  // Only quote when necessary — keeps the file readable for simple
  // values. The triggers are: comma, newline, carriage return, or an
  // embedded double quote.
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serialise an array of objects to a CSV string. Header row is the
 * union of keys in their first-seen order across the rows (so callers
 * can rely on "whatever keys the first row has" as the ordering if
 * they're careful).
 */
export function toCsv(rows: readonly CsvRow[]): string {
  if (rows.length === 0) return '';
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  const lines: string[] = [headers.map(escapeField).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeField(row[h])).join(','));
  }
  // RFC 4180 says CRLF between records; Sheets + Excel both accept LF
  // so we keep it simple.
  return lines.join('\n');
}

/**
 * Build the common headers for a CSV download response. Filename is
 * already suffixed with `.csv`; callers pass the stem only (e.g.
 * `"clients-2026-04-24"`).
 */
export function csvResponseHeaders(filenameStem: string): Record<string, string> {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filenameStem}.csv"`,
    // Don't cache exports — tenants expect fresh data every click.
    'Cache-Control': 'no-store',
  };
}
