import { describe, expect, it } from "vitest";
import { toCsv } from "./csv.server";

describe("toCsv", () => {
  it("joins headers and rows with commas and CRLF line endings", () => {
    const csv = toCsv(
      ["Date", "Order", "Answer"],
      [["2026-01-15", "#1042", "Instagram"]],
    );
    expect(csv).toBe(
      "﻿Date,Order,Answer\r\n2026-01-15,#1042,Instagram",
    );
  });

  it("quotes and escapes values containing commas, quotes, or newlines", () => {
    const csv = toCsv(["Answer"], [['Said "hi", then left\nthen came back']]);
    expect(csv).toBe(
      '﻿Answer\r\n"Said ""hi"", then left\nthen came back"',
    );
  });

  it("leaves plain values unquoted", () => {
    const csv = toCsv(["Answer"], [["Instagram"]]);
    expect(csv).toBe("﻿Answer\r\nInstagram");
  });

  it("neutralizes values that would be read as a formula in Excel/Sheets", () => {
    const csv = toCsv(
      ["Answer"],
      [["=cmd|'/c calc'!A1"], ["+1"], ["-1"], ["@SUM(A1)"]],
    );
    const rows = csv.split("\r\n").slice(1);
    expect(rows).toEqual([
      "'=cmd|'/c calc'!A1",
      "'+1",
      "'-1",
      "'@SUM(A1)",
    ]);
  });

  it("handles numeric values", () => {
    const csv = toCsv(["Count"], [[42]]);
    expect(csv).toBe("﻿Count\r\n42");
  });
});
