// Cell values that would be read as a formula by Excel/Sheets if a survey
// respondent's free-text answer happened to start with one of these
// characters ("CSV injection" - a real risk here since answerText is
// buyer-supplied and this file is opened directly in a spreadsheet app).
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

function escapeCsvValue(value: string | number): string {
  let str = String(value);

  if (FORMULA_PREFIXES.some((prefix) => str.startsWith(prefix))) {
    str = `'${str}`;
  }

  if (/[",\r\n]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Serializes rows into CSV text (RFC 4180: CRLF line endings, double-quote
 * escaping). Prefixed with a UTF-8 BOM so Excel - which otherwise guesses
 * the system codepage instead of UTF-8 - doesn't mangle non-ASCII answers.
 */
export function toCsv(
  headers: string[],
  rows: (string | number)[][],
): string {
  const lines = [headers, ...rows].map((line) =>
    line.map(escapeCsvValue).join(","),
  );
  return "﻿" + lines.join("\r\n");
}
