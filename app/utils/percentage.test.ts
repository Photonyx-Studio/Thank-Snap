import { describe, expect, it } from "vitest";
import { percentage } from "./percentage";

describe("percentage", () => {
  it("returns null when total is zero or negative", () => {
    expect(percentage(0, 0)).toBeNull();
    expect(percentage(5, 0)).toBeNull();
    expect(percentage(5, -1)).toBeNull();
  });

  it("rounds to one decimal place", () => {
    expect(percentage(1, 3)).toBe(33.3);
    expect(percentage(3, 10)).toBe(30);
  });

  it("caps at 100 for a full match", () => {
    expect(percentage(10, 10)).toBe(100);
  });
});
