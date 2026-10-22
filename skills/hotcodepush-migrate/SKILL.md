---
name: hotcodepush-migrate
description: "Moves an app to HotCodePush from another over-the-air (OTA) update service: CodePush (react-native-code-push), EAS Update (expo-updates), RevoPush (@revopush/react-native-code-push), Stallion (react-native-stallion), Hot Updater (hot-updater), Capgo (@capgo/capacitor-updater) or Ionic Appflow (@capacitor/live-updates, cordova-plugin-ionic). Detects the source from package.json, freezes the old line on a branch, removes the old client and its native config, hands off to the hotcodepush-init and hotcodepush-release skills, maps channels, signing key, binary ranges and defaults, and reports the guide's gotchas as a checklist. Use when asked to migrate, move or switch an app off one of these services, or to leave a retired OTA, live-update or code-push service. Do not use to set up a project that had no update client (the hotcodepush-init skill), to publish a release (the hotcodepush-release skill) or to debug a device that did not update (the hotcodepush-debug-no-update skill)."
license: MIT
compatibility: "Requires Node.js 22 or later, git, the project's package manager, network access to api.hotcodepush.com and hotcodepush.com, and a HotCodePush account."
metadata:
  author: hotcodepush-team
  source: https://github.com/hotcodepush-team/skills/tree/main/skills/hotcodepush-migrate
---

# Migrate to HotCodePush

Move an app from another update service to HotCodePush, the over-the-air (OTA) update platform for React Native, Expo, Capacitor and Cordova.
`hotcodepush init` sets HotCodePush up but removes nothing: it does not know the old client, and a binary carries one client.
This skill records what carries over, freezes the old line on a branch, removes the old client and its configuration, hands the setup to the hotcodepush-init skill, maps the channels, the key, the ranges and the defaults, and ends on a report whose checklist carries the guide's gotchas for the person to confirm before the store release that ships the swap.

Every source has a guide that carries the detail, the full CLI and SDK mapping and the before-and-after code:

| Source | Guide |
| --- | --- |
| CodePush | `https://hotcodepush.com/docs/migrate/codepush` |
| EAS Update | `https://hotcodepush.com/docs/migrate/eas-update` |
| RevoPush | `https://hotcodepush.com/docs/migrate/revopush` |
| Stallion | `https://hotcodepush.com/docs/migrate/stallion` |
| Hot Updater | `https://hotcodepush.com/docs/migrate/hot-updater` |
| Capgo | `https://hotcodepush.com/docs/migrate/capgo` |
| Ionic Appflow | `https://hotcodepush.com/docs/migrate/ionic-appflow` |

Read the guide before acting: its markdown twin is the URL plus `.md`, or the HotCodePush MCP server's `get_doc_page` tool with the path, `/docs/migrate/capgo`. This skill carries the procedure; the guide carries the detail. Where the two disagree, follow the guide and say so in the report; the one exception is the secrets rule below, which wins over a guide's delete.

## Rules

- Read the source's guide first, and follow its mapping for every SDK call the app makes. This file names the files and keys to remove; the guide names what each call becomes.
- Run every CLI command with `--json` and, where it changes something, `--yes`. Parse stdout as one JSON document; diagnostics go to stderr.
- Use the project's package manager, read from the lockfile: `bun.lock` or `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, otherwise npm. The commands below show npm.
- Never print, log, commit or paste a token or a private key. A signing key file is named by its path and never read.
- Never delete a file that holds a secret, `.env.hotupdater`, `.capgo_key_v2` or a private key: the old pipeline still needs it, and an untracked file is gone for good. Name it in the report for the person to move into the old pipeline's secrets.
- Never run `hotcodepush signing-key create` unasked; a new key pair is a person's decision. `signing-key add` registers a key the person already has, and only when they ask for it.
- Never act on the old service: no command of its CLI, no console change, no pause, no cancellation. What it must and must not receive is the "In the report" line of its section in Step 3, for the person.
- Never release a bundle built from the migrated code to the old service. The old binaries have no HotCodePush native module; what they get comes from the branch of Step 3.
- Do not commit. The person reviews the diff; the migration ships in a store release they submit.

## Procedure

### Step 1: Detect the source

1. Find the project root, the directory holding `package.json`. Run every command from there.
2. Read `dependencies` and `devDependencies` and match them against the table. Note the framework, which the hotcodepush-init skill detects the same way.

| Package | Source | Framework |
| --- | --- | --- |
| `react-native-code-push` | CodePush | React Native, or Expo |
| `expo-updates`, with `updates.url` in the app config | EAS Update | Expo, or React Native with `expo-updates` |
| `@revopush/react-native-code-push`, and `@revopush/expo-code-push-plugin` on Expo | RevoPush | React Native, or Expo |
| `react-native-stallion`, and `expo-stallion-plugin` and `stallion-cli` beside it | Stallion | React Native, or Expo |
| `hot-updater`, or any `@hot-updater/*` package | Hot Updater | React Native, or Expo |
| `@capgo/capacitor-updater`, and `@capgo/cli` beside it | Capgo | Capacitor |
| `@capacitor/live-updates` | Ionic Appflow | Capacitor |
| `cordova-plugin-ionic` in `cordova.plugins` | Ionic Appflow | Cordova |

3. None matches: ask the person which service the app used, and which package; a Cordova app on CodePush is outside the CodePush guide, which points it at `https://hotcodepush.com/docs/sdks/cordova/installation`. Several match, for instance `expo-updates` beside `react-native-stallion`: ask which one serves the app's updates; the others are removed as leftovers in Step 3. `expo-updates` without `updates.url`: ask whether the app ever used EAS Update; without it, the package is a leftover.
4. Check the floor before removing anything: React Native 0.82 or later on the New Architecture, Expo SDK 55 to 57, Capacitor 7 or 8, Cordova with `cordova-android` 14 or 15 on `cordova-ios` 8 (`https://hotcodepush.com/docs/supported-versions`). Below it, stop and say the framework upgrade comes first; an Expo app on SDK 58 cannot migrate yet.
5. On Ionic Appflow, ask whether the app also built on Appflow or published to the stores from it. If so, say that Capawesome Cloud replaces all three, as the guide's "Which product fits" section describes, and continue only when the person chooses HotCodePush for the updates.
6. Read the source's guide, as the table above names it.

### Step 2: Take stock

Step 3 deletes the files the later steps read, so record these first; they go into the report too:

1. The streams and the build that follows each, from the table. `production` exists after `init`; every other stream becomes a channel in Step 5.

| Source | Streams | Where the names and the per-build mapping are |
| --- | --- | --- |
| CodePush, RevoPush | each deployment, `Staging` and `Production` by default; RevoPush's `appcenter_Staging` and `appcenter_Production` duplicates collapse into one | the deployment keys per build type in `strings.xml`, `Info.plist` or the build settings; the person names the deployments the keys belong to |
| EAS Update | each channel, never a branch | `build.<profile>.channel` in `eas.json` |
| Stallion | each project beyond the main one, one per flavour | `StallionProjectId` per flavour in `strings.xml` and `.xcconfig` |
| Hot Updater | each channel | `HOT_UPDATER_CHANNEL`, `com.hotupdater.CHANNEL`, the Expo plugin's `channel`, and the names `checkForUpdate({ channel })` passes |
| Capgo | each channel | `defaultChannel` in `capacitor.config`; ask for the rest |
| Ionic Appflow | each Live Update channel | `plugins.LiveUpdates.channel`, `IonChannelName`, `ionic_channel_name`, `CHANNEL_NAME` |

2. Every release call of the pipeline with its flags: the deployment or channel, the target range the source's row in Step 5 names, the rollout and mandatory flags, and the key file it names. Step 5 rewrites each.
3. The options the wrapper, the plugin block or the app config set, which the guide maps to `hotcodepush.json`.
4. Whether the app switches channels by name at runtime: `sync({ deploymentKey })`, `setChannel`, `setConfig({ channel })`, `setUpdateRequestHeadersOverride`, `checkForUpdate({ channel })` or Capgo's self-assignment. Step 5 makes those channels discoverable.
5. The signing key's path, from the pipeline or the table in Step 5; the file is never read.

### Step 3: Remove the old client

First, freeze the old line: create the branch `<slug>-fleet` at the current commit, with the slug of the guide's URL, as the Hot Updater guide shows it:

```sh
git branch hot-updater-fleet
```

Every later update for the old binaries is released from that branch with the old pipeline, since the old binaries keep checking the old service until their users move to the new store build.

Then remove the client as its section says. Every section ends with an "In the report" line, what the old service must and must not receive, for the person; this skill touches the old service nowhere.

#### CodePush

1. `npm uninstall react-native-code-push`.
2. Remove the `codePush()` wrapper, every call and every option; the guide's "SDK calls" table names what each becomes.
3. Delete `CodePushDeploymentKey`, `CodePushPublicKey` and `CodePushServerURL` from `Info.plist`; `CodePushDeploymentKey`, `CodePushPublicKey` and `CodePushServerUrl` from `strings.xml`; the `codepush.gradle` `apply from` line in `android/app/build.gradle`.
4. Put the two host files back to what React Native's template generates for the project's version: the Swift file that overrides `bundleURL()` returns `Bundle.main.url(forResource: "main", withExtension: "jsbundle")` again, and `MainApplication.kt` imports `com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost` again. `init` recognises the template's lines and stops with a manual step on a file it does not.
5. On Expo, remove the config plugin entry the CodePush setup added to `app.json`; the next prebuild regenerates the native projects.

In the report: the CodePush pipeline keeps releasing from the branch while the old builds have users; the CodePush server or account goes last.

#### EAS Update

1. `npm uninstall expo-updates`. Setting `updates.enabled` to `false` also passes the prebuild, but removal is the guide's recommendation.
2. In the app config, remove the `updates` block and `runtimeVersion`; keep `extra.eas.projectId` when EAS Build stays. Remove every `expo-updates` import; `useUpdates()` and the methods map per the guide.
3. A bare React Native app with `expo-updates` moves to the React Native SDK: delete the `EXUpdates*` keys from the iOS project and the `expo.modules.updates.*` entries from `AndroidManifest.xml`.
4. Remove `channel` from each build profile in `eas.json`; Step 5 sets `env.HOTCODEPUSH_CHANNEL` in its place. EAS Build makes the store binary and the build step registers it, so the build needs `HOTCODEPUSH_TOKEN` as an EAS secret, never in `eas.json`: the report tells the person to add it.

In the report: the old builds' updates come from the branch with `eas update`, since their runtime version must match exactly; once the old share is small, `eas channel:pause production` leaves them on what they have; `eas update:roll-back-to-embedded` is never run, since it sends old users back to older code.

#### RevoPush

1. `npm uninstall @revopush/react-native-code-push`, and `@revopush/expo-code-push-plugin` on Expo.
2. Remove the `codePush()` wrapper and every call, as for CodePush; the import is the only difference, and `notifyApplicationReady` is `notifyAppReady`'s alias.
3. Delete `CodePushDeploymentKey`, `CodePushServerURL` and `CodePushPublicKey` from `Info.plist`; `CodePushDeploymentKey`, `CodePushServerUrl` and `CodePushPublicKey` from `strings.xml`; the `$(CODEPUSH_KEY)` build setting and the `resValue "string", "CodePushDeploymentKey"` lines per build type; the `codepush.gradle` `apply from` line; the ATS exceptions for `api.revopush.org` and `blob.revopush.org`. The `SOURCEMAP_FILE` line in `ios/.xcode.env` may go.
4. Put the host files back to the template, as for CodePush: `import CodePush` and `CodePush.bundleURL()` in the Swift file, and `import com.microsoft.codepush.react.CodePush` with the `getJSBundleFile()` override or the `jsBundleFilePath = CodePush.getJSBundleFile()` line in `MainApplication.kt` go.
5. On Expo, remove the `["@revopush/expo-code-push-plugin", { ... }]` entry from `plugins`.

In the report: the RevoPush plan, deployment keys and apps stay alive; releases for the old builds come from the branch with `-t` on their store versions; `revopush app rm` stops their updates, so the apps go last.

#### Stallion

1. `npm uninstall react-native-stallion`, and `expo-stallion-plugin` and `stallion-cli` where present.
2. Remove `withStallion`, the hooks `useStallionUpdate`, `useStallionModal` and `useStallionConfig`, `sync`, `restart` and the listeners per the guide.
3. Delete `StallionProjectId`, `StallionAppToken` and `StallionPublicSigningKey` from `Info.plist`, from every flavour's `strings.xml` and from the `.xcconfig` variables that fed them; delete `stallion.config.js` where it exists.
4. Put `MainApplication.kt` and the Swift `bundleURL()` back to the template: `Stallion.getJSBundleFile(applicationContext)` and `StallionModule.getBundleURL()` go.
5. On Expo, remove the `expo-stallion-plugin` entry; an `expo-updates` left installed must be removed too, or `updates.enabled` set to `false`, since the prebuild refuses it beside the HotCodePush plugin.

In the report: Stallion matches an exact app version, so the app version is bumped for the HotCodePush build, and `stallion release-bundle --app-version=<old>` keeps going from the branch for the old versions while they have users.

#### Hot Updater

1. `npm uninstall hot-updater` and every `@hot-updater/*` package, the provider packages included.
2. Delete `src/hotUpdater.ts`, or the `HotUpdater.init` or `HotUpdater.wrap` export, and every call; delete `hot-updater.config.ts` and `fingerprint.json`. Leave `.env.hotupdater` where it is: the guide deletes it, but it holds the provider secrets the old pipeline needs and is usually untracked, so the branch does not keep it.
3. Bare: restore `Bundle.main.url(forResource: "main", withExtension: "jsbundle")` in the Swift file, drop `import com.hotupdater.HotUpdater` and the `jsBundleFilePath` or `getJSBundleFile` override in `MainApplication.kt`. Delete `HOT_UPDATER_CHANNEL` and `HOT_UPDATER_PUBLIC_KEY` from `Info.plist`, the `com.hotupdater.*` `<meta-data>` entries from `AndroidManifest.xml`, the v0 strings `hot_updater_channel`, `hot_updater_fingerprint_hash` and `hot_updater_public_key` from `strings.xml`, and `HOT_UPDATER_APP_ROOT` and `HOT_UPDATER_NODE_BINARY` from the build settings. Then `pod install` in `ios/`.
4. On Expo, remove the `@hot-updater/expo` plugin entry, `@hot-updater/expo/babel-plugin` from the Babel config and the `EXPO_PUBLIC_HOT_UPDATER_*` variables; `expo-updates` stays absent or disabled, as for Stallion.

In the report: the old builds still call the person's own server, storage and database, so these and the client API key stay live; `.env.hotupdater` moves into the old pipeline's secrets; no bundle is disabled while old builds check, since a device with no enabled bundle falls back to its built-in one; the decommission order is to stop deploying, delete the function or Worker, the hosted console, the CI secrets and the API keys, and the bucket and database last.

#### Capgo

1. `npm uninstall @capgo/capacitor-updater`, and `@capgo/cli` where it is a dependency.
2. Delete `plugins.CapacitorUpdater` from `capacitor.config.ts` or `.json`.
3. Delete `CapacitorUpdater.notifyAppReady()` and its import from the entry file, or `plugins/capacitorUpdater.client.ts` on Nuxt. Replace every other call and listener per the guide.
4. If instant updates were on, Capgo set `SplashScreen.launchAutoHide` to `false` and `autoSplashscreen` to `true`: restore `launchAutoHide`, or hide the splash screen in the app's own code. The `NSPrivacyAccessedAPICategoryUserDefaults` entry stays only when other code needs it.
5. Leave `.capgo_key_v2` where it is, unread; the guide keeps it on the hotfix branch and nowhere else, and the report says so.
6. Run `npx cap sync`.

In the report: a web build without `notifyAppReady()` must never go to Capgo, since the old builds roll it back after 10 seconds; Capgo hotfixes come from the branch, which alone keeps `.capgo_key_v2`; the Capgo plan stays while the old builds check in and is cancelled last; device overrides, statistics and device ids do not carry over.

#### Ionic Appflow

Capacitor:

1. `npm uninstall @capacitor/live-updates`.
2. Delete the `LiveUpdates` block from `capacitor.config.ts`, `IonAppId` and `IonChannelName` from `Info.plist`, `ionic_app_id` and `ionic_channel_name` from `strings.xml`, and `public_key.pem` from the native projects if Secure Live Updates was on.
3. Replace every call per the guide's "What maps to what" table, drop `live-update generate-manifest` from the pipeline, and run `npx cap sync`.

Cordova:

1. `npx cordova plugin remove cordova-plugin-ionic`.
2. Remove the `APP_ID`, `CHANNEL_NAME`, `UPDATE_METHOD`, `MAX_STORE` and `MIN_BACKGROUND_DURATION` preferences from `config.xml`.

In the report: the Appflow channel keeps receiving deploys from the branch while the old builds have users; Appflow's Live Update MAU shows how many still check in.

### Step 4: Set up with hotcodepush-init

1. Run the hotcodepush-init skill. It runs `hotcodepush init --yes --json`, which installs the package for the framework, writes `hotcodepush.json` and wires the build step, and it repeats `hotcodepush doctor --json` until it is clean. A host file it does not recognise means Step 3 left a line of the old client in it.
2. The skill never runs `signing-key create`. Whether the key carries over or the person wants a new one is Step 5.
3. On Capacitor, import the package in the app's entry file, the module that runs at every start, even when the app calls no method; `init` does not add it. The import is the readiness signal: an app that imports it late or not at all confirms no update, and every one is rolled back.

```ts
import '@hotcodepush/capacitor-live-updates';
```

4. On Expo, the plugin entry in `app.json` wires the build step at `npx expo prebuild`; the prebuild refuses while `expo-updates` is listed and `updates.enabled` is not `false`.
5. Pin the CLI as a dev dependency, `npm install --save-dev hotcodepush`, since every native build runs it.

### Step 5: Map what carries over

#### Channels

Each stream Step 2 recorded, other than `production`, becomes a channel:

```sh
npx hotcodepush channel create --name <name> --if-not-exists --json
```

- Names take letters, digits, `-` and `_`, one to 64 characters; the guides write them lowercase, `Staging` to `staging`. stdout is the channel with its `id`, `name` and `isDiscoverable`.
- Add `--discoverable` when the app switches to the channel by name at runtime, as Step 2 recorded, because `setChannel({ name })` resolves discoverable channels alone. `--if-not-exists` returns an existing channel as it is, without applying the flag: when the flag was wanted and `isDiscoverable` is `false`, run `npx hotcodepush channel update --channel <name> --discoverable --json`.
- A build flavour that follows another channel than `hotcodepush.json`'s sets `HOTCODEPUSH_CHANNEL=<name>` in its build environment; this replaces the per-build-type deployment keys, `eas.json`'s `channel`, Capgo's `defaultChannel`, Stallion's per-flavour projects and Appflow's `IonChannelName`. There is no server-side default channel: the channel is stamped into the build.

#### The signing key

| Source | The key | `signing-key add` takes it |
| --- | --- | --- |
| CodePush | the RSA private key `release-react -k` named | yes |
| EAS Update | the PEM `eas update --private-key-path` named, RSA-2048 PKCS #1 | yes |
| RevoPush | the RSA private key `release-react -k` named | yes |
| Stallion | `stallion/secrets/private-key.pem`, RSA-2048 PKCS #8 | yes |
| Hot Updater | the local `keys/private-key.pem` of at least 2,048 bits | yes; a KMS or remote signer's key cannot be exported |
| Capgo | `.capgo_key_v2` is an encryption key | no; signing is new here, and bundles are no longer confidential |
| Ionic Appflow | Secure Live Updates' `public_key.pem` | no |

`signing-key add` takes an RSA key of at least 2,048 bits as a PEM of PKCS #8 or PKCS #1, derives the public key and registers it; the private key stays where it is. When the table says yes and the person wants the key kept, ask for the file's path and run:

```sh
npx hotcodepush signing-key add --private-key-path <file> --json
```

stdout is the key with its `id` and `fingerprint`, and `publicKeys` in `hotcodepush.json` gains it. A file that holds no such key is refused before any request with `E_INVALID_PARAMETER`; relay `message`. Where no key carries over, or the person wants a fresh pair, name `npx hotcodepush signing-key create` and leave the decision to them. From then on every upload needs the private key, through `--private-key-path` or `HOTCODEPUSH_SIGNING_KEY` in CI, as the hotcodepush-release skill reads it.

#### Binary ranges

The fingerprint rides on every release and keeps it off a build whose native code differs; `--binary` narrows a release to store versions on top of it. A release without `--binary` reaches every store version with the same fingerprint, where RevoPush targeted the exact store version unless `-t` widened it. The syntax takes no `^`, `~` or hyphen range; the API refuses one with the validation rule `range_syntax`. Rewrite each range Step 2 recorded:

| Old | HotCodePush |
| --- | --- |
| `-t "1.2.x"`, `deploy -t "1.2.x"` | `--binary "1.2.x"` |
| `"^1.2.3"` | `--binary ">=1.2.3 <2.0.0"` |
| `"~1.2.0"` | `--binary ">=1.2.0 <1.3.0"` |
| `"1.2.3 - 1.2.7"` | `--binary ">=1.2.3 <=1.2.7"` |
| RevoPush `-t 1.2.3 --buildNumber 100` | `--binary "1.2.3.100"` |
| Stallion `--app-version 1.0.1` | `--binary "1.0.1"` only to pin; the fingerprint gates by default |
| Hot Updater `updateStrategy: "appVersion"` | `--binary` on each release that must keep version gating |
| Capgo `--min-update-version 2.0.0` | `--binary ">=2.0.0"` |
| Appflow `live-update set-native-versions` | `--binary ">=2.3.0"` for a range; nothing to set per release |

#### Rollout and mandatory defaults

| Source | There | Here | Do |
| --- | --- | --- | --- |
| CodePush | `-d` names the deployment on every call; `-x` makes a disabled release; `rollback` republishes the previous release | `release create` without `--channel` releases to `hotcodepush.json`'s channel, `production`; `--rollout-percentage 0` starts dark and `release rollout` widens; `release rollback` is a new release, mandatory by default, and a device keeps its release when the percentage falls | pass `--channel` where `-d` named another deployment; `-x` becomes `--rollout-percentage 0` |
| EAS Update | one rollout per branch at a time, the next update waits; no mandatory updates | 100 percent by default; `--mandatory` exists | nothing |
| RevoPush | `-d` left out releases to `Staging`; a new release waits while a rollout is active, and `patch -r` only raises the percentage; `rollback` copies the earlier release's flags | `release create` without `--channel` releases to `production`; releases never wait, and `release rollout` moves the percentage either way; `release rollback` is mandatory unless `--mandatory false` | pass `--channel staging` where the pipeline relied on the default |
| Stallion | a release starts at 0 percent and only rises; the sample CI passes `--is-mandatory=true`, and the app's own modal handles it | 100 percent by default; `--mandatory` reloads at once under `mandatoryApplyStrategy: immediate` | pass `--rollout-percentage 0` to start dark as before; drop `--mandatory`, or set `mandatoryApplyStrategy: manual` to keep the modal |
| Hot Updater | `-f` reloads after the download unless `reloadOnForceUpdate` is `false`; rollout in 0.1 percent steps; `wrap` checks at mount only | `--mandatory` with `mandatoryApplyStrategy: immediate` or `manual`; whole percents; `checkStrategy: auto` checks at start, on resume and every 900 seconds | `checkStrategy: manual` with `sync()` for launch-only |
| Capgo | applies on the next background by default; rollout random per device, cached 30 days; auto-pause off by default | `applyStrategy: next-start` applies at the next cold start; the rollout bucket is a stable hash of device and release; auto-pause on every release, 5 percent over 50 applied | `applyStrategy: next-resume` with `nextResumeMinimumBackgroundSeconds: 0` is the closest to Capgo's moment |
| Ionic Appflow | `autoUpdateMethod: 'background'` | the defaults, `checkStrategy: auto` and `applyStrategy: next-start` | nothing |

### Step 6: The checklist for the store release

A release created before a binary was built is never served to that binary, so the order is: store build, then release. The report lists the guide's differences section, "What else differs" on CodePush and "What differs" on the others, and the items below for the source, each as one line the person confirms before they build. Nothing here waits for them.

Every source:

- The readiness gate has no off switch: a release that has not rendered within `readyTimeoutSeconds`, 10 by default, is rolled back on that device and never tried there again. For a slow first render, raise `readyTimeoutSeconds` in `hotcodepush.json`.
- The fingerprint replaces hand-set native versions; a native dependency change needs a store build.
- `release rollback` publishes the previous bundle as a new release, mandatory by default; `release revoke` ends a release.
- The build machine holds `npx hotcodepush login` or `HOTCODEPUSH_TOKEN`; under `CI` a store build without a token fails. `npx hotcodepush binary list --json` shows the registered builds.
- On React Native and Expo a debug build served by Metro takes no updates: test on a release build.
- The old pipeline releases from the branch only, and the old service is shut down last, once its own active count and the device counts of `binary list` show the old builds below the share the person will leave behind.

CodePush and RevoPush: every `-d` and `-t` of the pipeline is rewritten per Step 5; on RevoPush a call that left `-d` out passes `--channel staging`.

EAS Update: `HOTCODEPUSH_TOKEN` is an EAS secret of the store build; the fingerprint hashes the lockfile's native packages and `extraFingerprintPaths` only, never the app config; development builds preview no updates, so QA moves to release builds on preview channels; `EXPO_PUBLIC_*` values must be in the release job's environment, since the upload bundles locally with `expo export:embed`.

Stallion: the app version is bumped; `--ci-token` becomes `HOTCODEPUSH_TOKEN` in the environment; the rollout and mandatory defaults of Step 5.

Hot Updater: `.env.hotupdater` moves into the old pipeline's secrets; Remote Config and KMS signing have no equivalent; Hermes and New Architecture flags, `patches/` and local codegen specs count toward the fingerprint only through `extraFingerprintPaths`; no infrastructure to run afterwards.

Capgo: `.capgo_key_v2` stays on the hotfix branch alone; no end-to-end encryption, signing only; the channel is in the build and no console switch moves the fleet; `listChannels()` has no equivalent; on the web the package rejects with `UNIMPLEMENTED`, so guard calls with `Capacitor.isNativePlatform()`.

Ionic Appflow: channel names are lowercase and spaceless; an undiscoverable channel is private to the devices holding its id; the entry-file import of Step 4 is the readiness signal.

### Step 7: Release and report

1. Replace the old pipeline step with the one line the guides' pipeline step uses, `npx hotcodepush release create --bundle-version "$(git rev-parse --short HEAD)" --yes`, with `npm run build &&` in front on Capacitor and Cordova: `appcenter codepush release-react`, `eas update`, `revopush release-react` per platform, Stallion's `publish-bundle`, `release-bundle` and `update-release` per platform, `hot-updater deploy -p` per platform, `@capgo/cli bundle upload`, or `appflow deploy web`. One run covers both platforms. The secrets become `HOTCODEPUSH_TOKEN` and, for a signing app, `HOTCODEPUSH_SIGNING_KEY`.
2. Run `npx hotcodepush binary list --json`. stdout is `{ "binaries": [...], "nextOffset": ... }`, each binary with its `version`, `build` and `platform`, and every one is a store build that ran the HotCodePush build step, since the old client registered none. `binaries` holds one: run the hotcodepush-release skill for the first release, with `--channel` from Step 5 where the pipeline named a channel other than `hotcodepush.json`'s, and no `--binary` unless the person asks, since the old ranges named old store versions. `binaries` is empty: no store build with the SDK exists yet; the first release is the hotcodepush-release skill's once one does, and the report says so.
3. Report, in this order: the source and the branch; what Step 2 recorded; what was removed, file by file; what `init` did; the channels created and the key added; the binary ranges and defaults rewritten; the checklist of Step 6; the "In the report" line of the source, what the old service still serves and when to shut it down; the secret files left in place and where they go; whether the first release ran or waits for the store build.
4. List the files that changed for the person to review and commit.

## Error Handling

- `git branch` refuses the name because it exists: an earlier run made it; keep it and say so. No repository: stop and say the old line cannot be frozen.
- `hotcodepush init` stops with `E_NATIVE_PROJECT` or `E_XCODE_PROJECT` after Step 3: a line of the old client is still in the host file `message` names. Remove it as the source's section says, then run the hotcodepush-init skill again.
- `npx expo prebuild` refuses with `HotCodePush and expo-updates cannot both serve updates.`: `expo-updates` is still listed with `updates.enabled` not `false`. Finish the EAS Update section of Step 3.
- `release create` is refused with the validation rule `range_syntax`: the `--binary` range still carries `^`, `~` or a hyphen. Rewrite it per Step 5.
- `signing-key add` exits with `E_INVALID_PARAMETER`: the file cannot be read, is encrypted, or holds no RSA key of at least 2,048 bits as PKCS #8 or PKCS #1; `message` says which. Relay it; the person decides between another file and `signing-key create`.
- Every device still shows the old version after the release: the hotcodepush-debug-no-update skill; cause 9 there, `RELEASE_OLDER_THAN_BINARY`, is a release created before the store build.
- The guide's URL is not reachable: the HotCodePush MCP server's `get_doc_page` tool answers with the page; without either, stop and say the guide could not be read, rather than acting on this file alone.
