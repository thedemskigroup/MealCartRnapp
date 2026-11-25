const fs = require("fs");
const path = require("path");
const {
  withGradleProperties,
  withDangerousMod,
} = require("@expo/config-plugins");

/**
 * Turns R8 on for release builds, with the keep rules it needs.
 *
 * Play warns "There is no deobfuscation file associated with this App Bundle"
 * on every release because `android.enableMinifyInReleaseBuilds` is unset and
 * `android/app/build.gradle` defaults it to false, so nothing is minified.
 *
 * Both halves of this live here rather than in android/, which is gitignored
 * and rebuilt by `expo prebuild` -- and critically, EAS runs prebuild on its
 * own builder, so an edit to gradle.properties or proguard-rules.pro on this
 * machine would never reach a production build.
 *
 * KEEP RULES ARE THE RISK. R8 renames and strips aggressively, and React
 * Native resolves a lot through reflection and JNI, so release-only crashes
 * are the normal failure mode. The generated proguard-rules.pro ships keep
 * rules for reanimated and turbomodule only; the rules below cover the native
 * surface this app actually depends on. Anything added later that resolves
 * classes by name needs its own rule.
 */
const PROGUARD_RULES = `
# --- added by plugins/withReleaseMinification.js ---------------------------
# R8 is enabled for release builds. React Native and its native modules
# resolve classes reflectively/over JNI, so they must be kept by name.

# React Native core + JNI entry points
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.hermes.** { *; }
-keepclassmembers class * { @com.facebook.proguard.annotations.DoNotStrip *; }
-keepclassmembers class * { @com.facebook.common.internal.DoNotStrip *; }
-keepclassmembers class * { @com.facebook.react.bridge.ReactMethod *; }
-keepclassmembers class * extends com.facebook.react.bridge.BaseJavaModule { *; }

# Expo modules are discovered by name at runtime
-keep class expo.modules.** { *; }
-keep class host.exp.exponent.** { *; }

# Firebase / Google Sign-In (auth, firestore, storage, functions)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**

# Keep annotations and generic signatures so reflection still resolves
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Line numbers in stack traces -- the mapping file translates the rest
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
# --- end withReleaseMinification -------------------------------------------
`;

const MARKER = "added by plugins/withReleaseMinification.js";

const withReleaseMinification = (config) => {
  // 1. Flip the flag android/app/build.gradle reads.
  config = withGradleProperties(config, (config) => {
    const set = (key, value) => {
      const existing = config.modResults.find(
        (item) => item.type === "property" && item.key === key,
      );
      if (existing) {
        existing.value = value;
      } else {
        config.modResults.push({ type: "property", key, value });
      }
    };

    set("android.enableMinifyInReleaseBuilds", "true");
    // Resource shrinking requires minification and is read separately by
    // build.gradle. Left OFF deliberately: it strips resources by static
    // reference, and anything referenced only from JS can disappear.
    set("android.enableShrinkResourcesInReleaseBuilds", "false");

    return config;
  });

  // 2. Append the keep rules, idempotently.
  config = withDangerousMod(config, [
    "android",
    (config) => {
      const file = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "proguard-rules.pro",
      );
      const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      if (!current.includes(MARKER)) {
        fs.writeFileSync(file, `${current}\n${PROGUARD_RULES}`);
      }
      return config;
    },
  ]);

  return config;
};

module.exports = withReleaseMinification;
