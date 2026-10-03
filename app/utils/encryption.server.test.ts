import { beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./encryption.server";

describe("encryptSecret/decryptSecret", () => {
  beforeEach(() => {
    // A fresh 32-byte key per test run - real keys are generated once per
    // deployment (see .env.example) and must stay stable across restarts.
    process.env.SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      "base64",
    );
  });

  it("round-trips a plaintext value", () => {
    const ciphertext = encryptSecret("shpat_super-secret-token");
    expect(ciphertext).not.toBe("shpat_super-secret-token");
    expect(decryptSecret(ciphertext)).toBe("shpat_super-secret-token");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-input");
    expect(decryptSecret(b)).toBe("same-input");
  });

  it("passes through values that were never encrypted (legacy plaintext rows)", () => {
    expect(decryptSecret("shpat_legacy-plaintext-token")).toBe(
      "shpat_legacy-plaintext-token",
    );
  });

  it("throws without a configured key", () => {
    delete process.env.SESSION_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/SESSION_ENCRYPTION_KEY/);
  });

  it("throws if the key isn't 32 bytes", () => {
    process.env.SESSION_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
  });
});
