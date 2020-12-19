import { join } from "path";
import Validator from "../src/validator";

const OPTIONS = { downloadsDir: join(__dirname, "helper"), maxAge: 999999999999999999999 };

describe("validatePackage", () => {
  it("should validate package name.", async () => {
    const result = await (await Validator.validate("available-name", OPTIONS)).join(" ");
    expect(result).toContain("is available");
  });

  it("should invalidate package name because of similarity.", async () => {
    const result = await (await Validator.validate("azure-mgmt-store", OPTIONS)).join(" ");
    expect(result).toContain("is unavailable: azure-mgmt-store");
  });

  it("should invalidate package name because of synatx.", async () => {
    const result = await (await Validator.validate(" @@__", OPTIONS)).join(" ");
    expect(result).toContain("can only contain URL-friendly characters");
  });
});
