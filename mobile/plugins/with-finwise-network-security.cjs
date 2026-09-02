const { withAndroidManifest, withInfoPlist } = require("expo/config-plugins");

const CLEAR_TEXT_ATTRIBUTE = "android:usesCleartextTraffic";

function shouldAllowLocalHttp(environment = process.env) {
  if (
    environment.EAS_BUILD_PROFILE === "preview" ||
    environment.EAS_BUILD_PROFILE === "production"
  ) {
    return false;
  }
  return (
    environment.FINWISE_ALLOW_HTTP === "true" ||
    environment.EAS_BUILD_PROFILE === "development"
  );
}

function applyAndroidNetworkPolicy(attributes, environment = process.env) {
  const nextAttributes = { ...(attributes ?? {}) };
  if (shouldAllowLocalHttp(environment)) {
    nextAttributes[CLEAR_TEXT_ATTRIBUTE] = "true";
  } else {
    delete nextAttributes[CLEAR_TEXT_ATTRIBUTE];
  }
  return nextAttributes;
}

function applyIosNetworkPolicy(infoPlist, environment = process.env) {
  const nextInfoPlist = { ...(infoPlist ?? {}) };
  const transportSecurity = {
    ...(nextInfoPlist.NSAppTransportSecurity ?? {}),
  };
  if (shouldAllowLocalHttp(environment)) {
    transportSecurity.NSAllowsArbitraryLoads = true;
  } else if (transportSecurity.NSAllowsArbitraryLoads === true) {
    delete transportSecurity.NSAllowsArbitraryLoads;
  }

  if (Object.keys(transportSecurity).length > 0) {
    nextInfoPlist.NSAppTransportSecurity = transportSecurity;
  } else {
    delete nextInfoPlist.NSAppTransportSecurity;
  }
  return nextInfoPlist;
}

function withFinwiseNetworkSecurity(config) {
  const androidConfig = withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) return modConfig;

    application.$ = applyAndroidNetworkPolicy(application.$);
    return modConfig;
  });

  return withInfoPlist(androidConfig, (modConfig) => {
    modConfig.modResults = applyIosNetworkPolicy(modConfig.modResults);
    return modConfig;
  });
}

module.exports = withFinwiseNetworkSecurity;
module.exports.shouldAllowLocalHttp = shouldAllowLocalHttp;
module.exports.applyAndroidNetworkPolicy = applyAndroidNetworkPolicy;
module.exports.applyIosNetworkPolicy = applyIosNetworkPolicy;
