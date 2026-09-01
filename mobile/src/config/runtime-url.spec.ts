import { resolveMobileApiUrl } from "./runtime-url";

describe("resolveMobileApiUrl", () => {
  it("uses the Android emulator host bridge when no URL is configured", () => {
    expect(resolveMobileApiUrl(undefined, "android")).toBe(
      "http://10.0.2.2:3001",
    );
  });

  it("uses localhost for simulator and browser runtimes", () => {
    expect(resolveMobileApiUrl(undefined, "ios")).toBe("http://localhost:3001");
    expect(resolveMobileApiUrl("", "web")).toBe("http://localhost:3001");
  });

  it("preserves an explicit host while normalizing whitespace and one trailing slash", () => {
    expect(
      resolveMobileApiUrl("  http://192.168.1.10:3001/  ", "android"),
    ).toBe("http://192.168.1.10:3001");
  });
});
