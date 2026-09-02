const assert = require("node:assert/strict");
const test = require("node:test");
const {
  applyAndroidNetworkPolicy,
  applyIosNetworkPolicy,
  shouldAllowLocalHttp,
} = require("./with-finwise-network-security.cjs");

test("allows cleartext only for explicit local/development builds", () => {
  assert.equal(shouldAllowLocalHttp({ FINWISE_ALLOW_HTTP: "true" }), true);
  assert.equal(shouldAllowLocalHttp({ EAS_BUILD_PROFILE: "development" }), true);
  assert.equal(
    shouldAllowLocalHttp({
      FINWISE_ALLOW_HTTP: "true",
      EAS_BUILD_PROFILE: "production",
    }),
    false,
  );
  assert.equal(shouldAllowLocalHttp({ EAS_BUILD_PROFILE: "preview" }), false);
  assert.equal(shouldAllowLocalHttp({ NODE_ENV: "development" }), false);
  assert.equal(shouldAllowLocalHttp({}), false);
});

test("applies and removes Android cleartext policy without touching other attributes", () => {
  assert.deepEqual(
    applyAndroidNetworkPolicy(
      { "android:allowBackup": "true" },
      { FINWISE_ALLOW_HTTP: "true" },
    ),
    {
      "android:allowBackup": "true",
      "android:usesCleartextTraffic": "true",
    },
  );
  assert.deepEqual(
    applyAndroidNetworkPolicy(
      { "android:allowBackup": "true", "android:usesCleartextTraffic": "true" },
      { EAS_BUILD_PROFILE: "production" },
    ),
    { "android:allowBackup": "true" },
  );
});

test("applies and removes iOS ATS policy while preserving unrelated entries", () => {
  assert.deepEqual(
    applyIosNetworkPolicy(
      { CFBundleDisplayName: "Finwise" },
      { EAS_BUILD_PROFILE: "development" },
    ),
    {
      CFBundleDisplayName: "Finwise",
      NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
    },
  );
  assert.deepEqual(
    applyIosNetworkPolicy(
      {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSAllowsLocalNetworking: true,
        },
      },
      { EAS_BUILD_PROFILE: "production" },
    ),
    {
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  );
});
