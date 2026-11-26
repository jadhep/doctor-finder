import { describe, expect, it } from "vitest";
import { isAccountApproved, normalizeAccountStatus } from "./account-access";

describe("account access rules", () => {
  it("allows only approved accounts", () => {
    expect(isAccountApproved("approved")).toBe(true);
    expect(isAccountApproved("pending")).toBe(false);
    expect(isAccountApproved("rejected")).toBe(false);
  });

  it("rejects unrecognized access states", () => {
    expect(normalizeAccountStatus("unknown")).toBeNull();
  });
});