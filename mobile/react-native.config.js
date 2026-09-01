/**
 * Expo 53 moved the package bridge to `expo.modules`.
 * Keep the project-level override explicit so pnpm/Gradle autolinking cannot
 * reuse the legacy `expo.core` import from a stale package config cache.
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
