/**
 * Keep the project-level override explicit so pnpm/Gradle autolinking uses the
 * current `expo.modules` bridge and cannot reuse a legacy `expo.core` import
 * from a stale package config cache.
 */
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: 'import expo.modules.ExpoModulesPackage;',
        },
      },
    },
  },
};
