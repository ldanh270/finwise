import {
  DEFAULT_POST_AUTH_PATH,
  protectedPathForLogin,
  resolvePostAuthPath,
} from "./deep-link";

describe("deep-link post-auth routing", () => {
  it("maps public deep-link paths to the grouped Expo route", () => {
    expect(resolvePostAuthPath("/transactions")).toBe("/(app)/transactions");
    expect(protectedPathForLogin("/group")).toBe("/(app)/group");
  });

  it("accepts an already grouped internal route", () => {
    expect(resolvePostAuthPath("/(app)/budgets")).toBe("/(app)/budgets");
    expect(protectedPathForLogin("/(app)/settings")).toBe("/(app)/settings");
  });

  it("rejects external, malformed, and unknown routes", () => {
    expect(resolvePostAuthPath("https://example.com/phishing")).toBe(
      DEFAULT_POST_AUTH_PATH,
    );
    expect(resolvePostAuthPath("//example.com/phishing")).toBe(
      DEFAULT_POST_AUTH_PATH,
    );
    expect(protectedPathForLogin("/admin")).toBeUndefined();
    expect(protectedPathForLogin("%ZZ")).toBeUndefined();
  });
});
