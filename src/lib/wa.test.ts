import { describe, it, expect } from "vitest";
import { normalizeWaNumber, fillTemplate, waLink } from "./wa";

describe("wa helpers", () => {
  it("converts 08 numbers to 628", () => {
    expect(normalizeWaNumber("0812-3456-7890")).toBe("6281234567890");
  });
  it("keeps +62 numbers", () => {
    expect(normalizeWaNumber("+62 812 3456 7890")).toBe("6281234567890");
  });
  it("rejects too-short numbers", () => {
    expect(normalizeWaNumber("12345")).toBeNull();
  });
  it("fills template variables", () => {
    expect(fillTemplate("Halo {nama} di {kota}", { nama: "Klinik A", kota: "Depok" })).toBe("Halo Klinik A di Depok");
  });
  it("encodes message in link", () => {
    expect(waLink("08123456789", "Hai A")).toBe("https://wa.me/628123456789?text=Hai%20A");
  });
});
