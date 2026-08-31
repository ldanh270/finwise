const path = require("node:path");

module.exports = {
  rootDir: __dirname,
  moduleDirectories: ["<rootDir>/../backend/node_modules", "node_modules"],
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": [
      path.join(__dirname, "../backend/node_modules/ts-jest"),
      {
        tsconfig: "<rootDir>/tsconfig.json",
        diagnostics: false,
      },
    ],
  },
};
