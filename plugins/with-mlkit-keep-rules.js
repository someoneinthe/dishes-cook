const { withDangerousMod } = require('expo/config-plugins');
// Expo config plugin: since SDK 58, release builds are shrunk by R8, which removes code it sees no
// call to. ML Kit (text recognition of photos and PDF pages) creates its components from class
// names listed in the manifest (Firebase component discovery): R8 removed their constructors, and
// every reading failed ("NoSuchMethodException: …TextRegistrar.<init>"). This keeps them.
const fs = require('node:fs');
const path = require('node:path');

const RULES = `
# ML Kit's components are created by name (with-mlkit-keep-rules.js).
-keep class * implements com.google.firebase.components.ComponentRegistrar { <init>(); }
`;

module.exports = function withMlKitKeepRules(config) {
  return withDangerousMod(config, [
    'android',
    (moduleConfig) => {
      const rulesPath = path.join(
        moduleConfig.modRequest.platformProjectRoot,
        'app/proguard-rules.pro',
      );
      const rules = fs.readFileSync(rulesPath, 'utf8');
      if (!rules.includes(RULES)) {
        fs.writeFileSync(rulesPath, rules + RULES);
      }
      return moduleConfig;
    },
  ]);
};
