# The edits init makes, for when it cannot

`hotcodepush init`, the CLI of HotCodePush, the over-the-air (OTA) update platform for React Native, Expo, Capacitor and Cordova, makes additive, marked edits and returns the edit as the manual step when a file has no place for it.
This file holds the exact lines, so a hand-made edit matches what the CLI writes and `hotcodepush doctor` recognises it.
The marker in each edit is what `doctor` looks for.
The sections follow the frameworks: React Native, Expo, Capacitor and Cordova.

## React Native

### The Gradle line, `android/app/build.gradle`

Append at the end of the file, after an empty line:

```groovy
apply from: new File(["node", "--print", "require.resolve('@hotcodepush/react-native-code-push/package.json')"].execute(null, rootDir).text.trim(), "../android/hotcodepush.gradle")
```

For `android/app/build.gradle.kts`:

```kotlin
apply(from = File(providers.exec { workingDir(rootDir); commandLine("node", "--print", "require.resolve('@hotcodepush/react-native-code-push/package.json')") }.standardOutput.asText.get().trim()).resolveSibling("android/hotcodepush.gradle"))
```

The marker is `hotcodepush.gradle`.
The manual step `Apply node_modules/@hotcodepush/react-native-code-push/android/hotcodepush.gradle from the app module's Gradle file.` means this line in the app module's Gradle file, created when the module has none.

### The Xcode phase, `ios/<App>.xcodeproj/project.pbxproj`

One Run Script phase named `Create HotCodePush binary`, placed right after the phase `Bundle React Native code and images`, `alwaysOutOfDate = 1`, shell `/bin/sh`, running:

```sh
set -e

# hotcodepush: writes hotcodepush.json into the app and, in a store build, creates the binary
WITH_ENVIRONMENT="$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh"
HOTCODEPUSH_BINARY_CREATE="$REACT_NATIVE_PATH/../@hotcodepush/react-native-code-push/scripts/binary-create-xcode.sh"

/bin/sh -c "$WITH_ENVIRONMENT $HOTCODEPUSH_BINARY_CREATE"
```

In `project.pbxproj`, add one `PBXShellScriptBuildPhase` object with a new 24-character hexadecimal id, and insert its id into the app target's `buildPhases` list right after the bundling phase's id. Its input file is the processed `Info.plist`, which the script reads the version and the build number from:

```text
		A1B2C3D4E5F60718293A4B5C /* Create HotCodePush binary */ = {
			isa = PBXShellScriptBuildPhase;
			alwaysOutOfDate = 1;
			buildActionMask = 2147483647;
			files = (
			);
			inputPaths = (
				"$(TARGET_BUILD_DIR)/$(INFOPLIST_PATH)",
			);
			name = "Create HotCodePush binary";
			outputPaths = (
			);
			runOnlyForDeploymentPostprocessing = 0;
			shellPath = /bin/sh;
			shellScript = "set -e\n\n# hotcodepush: writes hotcodepush.json into the app and, in a store build, creates the binary\nWITH_ENVIRONMENT=\"$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh\"\nHOTCODEPUSH_BINARY_CREATE=\"$REACT_NATIVE_PATH/../@hotcodepush/react-native-code-push/scripts/binary-create-xcode.sh\"\n\n/bin/sh -c \"$WITH_ENVIRONMENT $HOTCODEPUSH_BINARY_CREATE\"\n";
		};
```

The marker is the phase name `Create HotCodePush binary`.

### The bundle the app loads, `SceneDelegate.swift` or `AppDelegate.swift`

In the Swift file that overrides `bundleURL()` (`SceneDelegate.swift` from React Native 0.88, `AppDelegate.swift` before), add after the last `import` line:

```swift
import HotcodepushReactNativeCodePush
```

and replace the template's embedded-bundle line

```swift
Bundle.main.url(forResource: "main", withExtension: "jsbundle")
```

with

```swift
HotCodePush.bundleURL()
```

The Metro line for debug builds beside it stays as it is.
The marker is `HotCodePush.bundleURL()`.

An Objective-C `AppDelegate.mm` is not edited by the CLI; by hand, import `<HotcodepushReactNativeCodePush/HotcodepushReactNativeCodePush-Swift.h>` and return `[HotCodePush bundleURL]` from `bundleURL` where it returns the embedded bundle.
The marker is `[HotCodePush bundleURL]`.

### The React host, `android/app/src/main/java/<package>/MainApplication.kt`

Replace the import

```kotlin
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
```

with

```kotlin
import com.hotcodepush.reactnative.HotCodePushReactHost.getDefaultReactHost
```

The call and its parameters stay.
The marker is the new import.

A Java `MainApplication.java` is not edited by the CLI; by hand, build the React host with `com.hotcodepush.reactnative.HotCodePushReactHost.getDefaultReactHost`, which takes `DefaultReactHost.getDefaultReactHost`'s parameters.
The marker is `com.hotcodepush.reactnative.HotCodePushReactHost`.

### The pods, `ios/Podfile`

No Podfile edit: the SDK's pod carries the iOS core, and a pinned `HotCodePushCore` pod beside it would put the module into the app twice.
`init` runs `pod install` in the iOS project when `Podfile.lock` does not list `HotcodepushReactNativeCodePush`; by hand, run `pod install` in `ios/`.

## Expo

### The config plugin, `app.json` or `app.config.json`

Add `"@hotcodepush/expo-ota-updates"` to `expo.plugins`, or to the top-level `plugins` when the file has no `expo` key:

```json
{
  "expo": {
    "plugins": ["@hotcodepush/expo-ota-updates"]
  }
}
```

A project without an app config gets an `app.json` with this content.

### An app config that is code, `app.config.ts`, `app.config.js` or a `.mts`, `.cts`, `.mjs` or `.cjs` file

The CLI does not edit code; add the same string to the `plugins` array in the config object:

```ts
plugins: ['@hotcodepush/expo-ota-updates'],
```

`doctor` finds the entry by the package's name in the file's text.
Nothing else is edited: `npx expo prebuild` wires the native projects from the plugin.

## Capacitor

### The Gradle line, `android/app/build.gradle`

As for React Native, with the package `@hotcodepush/capacitor-live-updates`:

```groovy
apply from: new File(["node", "--print", "require.resolve('@hotcodepush/capacitor-live-updates/package.json')"].execute(null, rootDir).text.trim(), "../android/hotcodepush.gradle")
```

The `build.gradle.kts` form and the manual step read the same, with this package.

### The Xcode phase, `ios/App/App.xcodeproj/project.pbxproj`

One Run Script phase named `Create HotCodePush binary`, appended after the app target's last build phase, with "Based on dependency analysis" off (`alwaysOutOfDate = 1`), shell `/bin/sh`, running:

```sh
set -e

# hotcodepush: writes hotcodepush.json into the app and, in a store build, creates the binary
PROJECT_ROOT="$PROJECT_DIR/../.."
export PROJECT_ROOT
/bin/sh "$PROJECT_ROOT/node_modules/@hotcodepush/capacitor-live-updates/scripts/binary-create-xcode.sh"
```

`PROJECT_ROOT` is the project root as seen from the directory holding the `.xcodeproj`: `$PROJECT_DIR/../..` for the default `ios/App/App.xcodeproj`, adjusted when the iOS project lives elsewhere.

The `PBXShellScriptBuildPhase` object has the same shape as React Native's, with this script, the same input file, and its id as the last entry of the app target's `buildPhases` list:

```text
		A1B2C3D4E5F60718293A4B5C /* Create HotCodePush binary */ = {
			isa = PBXShellScriptBuildPhase;
			alwaysOutOfDate = 1;
			buildActionMask = 2147483647;
			files = (
			);
			inputPaths = (
				"$(TARGET_BUILD_DIR)/$(INFOPLIST_PATH)",
			);
			name = "Create HotCodePush binary";
			outputPaths = (
			);
			runOnlyForDeploymentPostprocessing = 0;
			shellPath = /bin/sh;
			shellScript = "set -e\n\n# hotcodepush: writes hotcodepush.json into the app and, in a store build, creates the binary\nPROJECT_ROOT=\"$PROJECT_DIR/../..\"\nexport PROJECT_ROOT\n/bin/sh \"$PROJECT_ROOT/node_modules/@hotcodepush/capacitor-live-updates/scripts/binary-create-xcode.sh\"\n";
		};
```

The marker is the phase name `Create HotCodePush binary`.
An earlier `init` may have added a `hotcodepush.json` file reference to the Xcode project; the current CLI removes it, since the build step writes the file into the app. Removing it by hand is optional.

### The native projects

`Neither ios nor android exists. Run "npx cap add ios" and "npx cap add android", or pass --ios-path and --android-path.`, the paths as the project names them: run the two commands for the platforms the app ships, then run `init` again.
Projects elsewhere are named with `--ios-path <dir>` and `--android-path <dir>`, relative to the working directory.

## Cordova

Nothing to wire: the plugin brings its own Gradle task and Xcode phase.
When `doctor`'s `hook` check fails, run the command its `manualStep` names, `npx cordova plugin add <spec>`, which lists the plugin in `package.json`'s `cordova.plugins`.
When `android_file_mode` fails, remove the `AndroidInsecureFileModeEnabled` preference from `config.xml`, from the `<widget>` and from the `<platform name="android">` section alike.
