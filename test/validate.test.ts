import { validatePackage } from "../src/validate";

const OPTIONS = { file: "test-data.json", maxAge: 999999999999999999999 };

describe("validatePackage", () => {
  it("should validate package name.", async () => {
    const result = await (await validatePackage("not-available-before-name-xyz", OPTIONS)).join(" ");
    expect(result).toContain("is available");
  });

  it("should invalidate package name because of similarity.", async () => {
    const result = await (await validatePackage("azuremgmtstore", OPTIONS)).join(" ");
    expect(result).toContain("is unavailable: azure-mgmt-store");
  });

  it("should invalidate package name because of synatx.", async () => {
    const result = await (await validatePackage(" @@__", OPTIONS)).join(" ");
    expect(result).toContain("can only contain URL-friendly characters");
  });
});
