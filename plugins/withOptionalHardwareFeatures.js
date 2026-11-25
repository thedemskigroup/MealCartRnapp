const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Declares screen-orientation hardware features as NOT required.
 *
 * `app.json` sets `orientation: "portrait"`, which prebuild turns into
 * `android:screenOrientation="portrait"` on MainActivity. The Android build
 * tools then *imply* `<uses-feature android:name="android.hardware.screen.portrait"
 * android:required="true" />` from that fixed orientation — the manifest never
 * declares it, which is why it does not show up in a grep of the generated file.
 * Google Play reads that implied requirement and filters out every device that
 * cannot do portrait: tablets, desktop/ChromeOS and Android XR. That is the
 * warning raised against release 1.0.4 (30).
 *
 * Declaring the feature explicitly with `required="false"` overrides the
 * implication. It does NOT unlock rotation — `screenOrientation` stays
 * portrait, so phones remain portrait-locked exactly as before. It only stops
 * the Play Store treating portrait capability as an install requirement.
 *
 * Note this is the generated android/ directory, which is gitignored and
 * recreated by `expo prebuild`, so the change has to live here rather than in
 * AndroidManifest.xml to survive a rebuild and reach EAS.
 */
const OPTIONAL_FEATURES = ["android.hardware.screen.portrait"];

const withOptionalHardwareFeatures = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!Array.isArray(manifest["uses-feature"])) {
      manifest["uses-feature"] = [];
    }

    for (const name of OPTIONAL_FEATURES) {
      const existing = manifest["uses-feature"].find(
        (feature) => feature?.$?.["android:name"] === name,
      );

      if (existing) {
        existing.$["android:required"] = "false";
      } else {
        manifest["uses-feature"].push({
          $: { "android:name": name, "android:required": "false" },
        });
      }
    }

    return config;
  });

module.exports = withOptionalHardwareFeatures;
