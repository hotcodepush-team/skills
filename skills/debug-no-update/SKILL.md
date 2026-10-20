---
name: debug-no-update
description: "Finds out why a device did not take a HotCodePush live update: a decision procedure over hotcodepush device probe --json and hotcodepush doctor --json, covering the nineteen causes in the order support sees them, each with the reason code the device reports, the output field that shows it and the fix. Use when a device, a tester's phone, a simulator or a share of the fleet did not update, still shows the old version after a release, or reports SKIPPED or FAILED with a reason such as DEVICE_INCOMPATIBLE, DEVICE_NOT_IN_ROLLOUT, CHANNEL_PAUSED or RELEASE_OLDER_THAN_BINARY. Do not use to set up a project (the init skill) or to publish a release (the release skill)."
license: MIT
compatibility: "Requires Node.js 22 or later, a project with hotcodepush.json or the --app and --channel flags, a credential (HOTCODEPUSH_TOKEN or a stored login) and network access to api.hotcodepush.com."
metadata:
  author: hotcodepush-team
  source: https://github.com/hotcodepush-team/skills/tree/main/skills/debug-no-update
---

# Why did a device not update

Find the cause when a device did not take a live update from HotCodePush, the live-update platform for Capacitor, Cordova, React Native and Expo.
Almost every answer is one of three: the device has not restarted or checked yet, the released bundle was the previous build, or the release excludes the device on compatibility.
Every other cause names itself with a reason code, and `hotcodepush device probe` prints it from the agent's machine.
The causes below are ordered by how often each happens, not by how the system is built; work down them in order and stop at the first that matches.

## Rules

- Run every CLI command with `--json`; parse stdout as one JSON document, stderr carries diagnostics.
- The probe reads; it changes nothing. Every fix that changes what devices receive, `release rollout`, `release resume`, `channel resume`, `organization update --spending-cap`, a new `release create`, asks for a confirmation and takes `--yes`. Run such a fix only when the person asked for it; otherwise name it.
- Never print a token or a private key.
- A device missing from the console is not evidence that it did not update: a device that reaches the files host but not the events endpoint updates and reports nothing.

## Procedure

### Step 1: Collect the facts

1. The app and the channel: `hotcodepush.json` in the project root, or `--app <id|name>` and `--channel <id|name>` when the command runs elsewhere.
2. The device. Best is its id, from the app's debug screen, the device's page in the console or `npx hotcodepush device list --json`, filtered with `--attribute userId=42`, `--platform ios`, `--binary-version 2.4.1` or `--channel staging`. Without the id: the platform, the binary version (`CFBundleShortVersionString` or `versionName`) and the binary build (`CFBundleVersion` or `versionCode`), from the debug screen.
3. The release the device should have: `npx hotcodepush release list --json`, newest first; note its `number`, `id`, `bundleId`, `status`, `rolloutPercentage`, `conditions` and `liveAt`.
4. What the device reports, when the person has it: the debug screen's last check, its status and reason, and the channel line with its source. Its share button copies the screen as text.

### Step 2: Probe

With the device id:

```sh
npx hotcodepush device probe --device <id> --json
```

Without it:

```sh
npx hotcodepush device probe --platform ios --binary-version 2.4.1 --binary-build 57 --json
```

Add `--attribute key=value` for each attribute the app sets on the device and `--channel <name>` when the device follows another channel than `hotcodepush.json`'s.
With `--device`, the probe takes the platform, the binary, the channel, the fingerprint, the OS version, the attributes, the rollout bucket, the running release and the failed bundles from the device's registry row.

stdout:

```json
{
  "channelId": "...",
  "platform": "ios",
  "url": "https://files.hotcodepush.com/apps/<appId>/channels/<channelId>/ios/v1/index.json",
  "status": 200,
  "etag": "\"...\"",
  "sequence": 12,
  "isServedIndexCurrent": true,
  "unknownFacts": [],
  "device": { "deviceId": "...", "binaryVersion": "2.4.1", "binaryBuild": "57", "builtAt": "...", "fingerprint": "fp1:...", "osVersion": "17.4", "attributes": {}, "currentRelease": { "id": "...", "number": 41 }, "failedBundleIds": [], "reportedAt": "..." },
  "outcome": { "status": "SKIPPED", "reason": "DEVICE_INCOMPATIBLE", "condition": "fingerprint", "release": { "number": 43, "...": "..." } },
  "verdicts": [{ "release": { "number": 43, "rolloutPercentage": 100, "isMandatory": false, "bundleId": "...", "conditions": [{ "type": "fingerprint", "fingerprint": "fp1:..." }] }, "conditions": [{ "type": "fingerprint", "isSatisfied": false }], "isEligible": false, "reason": "DEVICE_INCOMPATIBLE", "condition": "fingerprint" }]
}
```

- `status` is the files host's HTTP status; `outcome` and `verdicts` are empty when it serves no index.
- `outcome.status` is `AVAILABLE` (the device takes `outcome.release` on its next check), `UP_TO_DATE` (it runs `outcome.release`, or the embedded bundle when `null`) or `SKIPPED` with `reason` and, for a condition, `condition`.
- `verdicts` is every release the index offers, newest first, each condition `isSatisfied` or not.
- `unknownFacts` lists what the probe could not know without `--device`: `os` and `rollout` always, `fingerprint` unless a registered store build has the binary's identity. An unknown fact counts as passing, so a `SKIPPED` on it cannot show; when the outcome is `AVAILABLE` and the facts are unknown, run the probe again with `--device` before ruling causes 3, 4 and 6 out.

### Step 3: Branch on the outcome

| Probe shows | Go to cause |
| --- | --- |
| `status` is not `200`, `outcome` is `null` | 13, then 19 |
| `outcome.status` `SKIPPED`, `reason` `DEVICE_INCOMPATIBLE`, `condition` `fingerprint` | 3 |
| `SKIPPED`, `DEVICE_INCOMPATIBLE`, `condition` `binary` or `os` | 4 |
| `SKIPPED`, `DEVICE_NOT_IN_ROLLOUT` | 6 |
| `SKIPPED`, `CHANNEL_PAUSED` | 7 |
| `SKIPPED`, `RELEASE_OLDER_THAN_BINARY` | 9 |
| `SKIPPED`, `DEVICE_NOT_TARGETED` | 10 |
| `SKIPPED`, `RELEASE_REVOKED` or `BUNDLE_FAILED_BEFORE` | 11 |
| `SKIPPED`, `SPENDING_CAP_REACHED` | 16 |
| `SKIPPED`, `CONDITION_UNSUPPORTED` | 17 |
| `AVAILABLE` for the expected release | the device would take it: 2, then 12, 14, 15, 18, which only the device shows |
| `UP_TO_DATE` on the expected release | 1 |
| `UP_TO_DATE` on an older release or `null`, and the expected release is missing from `verdicts` | 5, 7, 8, 11, 19 |
| `isServedIndexCurrent` `false` | 19 |

The device-only reasons `BUILD_DEBUG`, `CONNECTION_METERED` and every `FAILED` reason never appear in the probe; the debug screen or `npx hotcodepush device get --device <id> --json` (the row with its `events`, each `type` `checked`, `attempted`, `applied` or `failed` with a `reason`) shows them.

### Step 4: The causes, most likely first

**1. The release carries the previous build.** Very common.
Shows: `UP_TO_DATE` on the expected release, and the app looks unchanged. `npx hotcodepush release get --channel <channel> --release <number> --json` prints `bundle.gitSha`, `bundle.gitRef`, `bundle.gitMessage` and `bundle.isGitDirty`; a sha that is not the expected commit, or a dirty flag, means the upload took an older or uncommitted build. On Capacitor and Cordova the web build is the project's own, so a `release create` without a build in front releases yesterday's output.
Fix: build, then release, as one step, `npm run build && npx hotcodepush release create`; the release skill does both.

**2. The device has not applied it yet.** Very common, and almost every report in the first hour.
Shows: `AVAILABLE`; with `--device`, `device.currentRelease.number` below the expected number and `device.reportedAt` older than the release's `liveAt`. The default strategy applies an update at the next cold start, and checks happen at start, on resume and at most every fifteen minutes in the foreground.
Fix: close the app completely and reopen it, or press check now on the debug screen. For at once, release with `--mandatory`; for another moment, `applyStrategy` in `hotcodepush.json` (`next-start`, `next-resume`, `immediate` or `manual`).

**3. The native fingerprint does not match.** Very common, and the CLI warned at upload.
Shows: `SKIPPED`, `DEVICE_INCOMPATIBLE`, `condition` `fingerprint`; the verdict's `conditions` has `{ "type": "fingerprint", "isSatisfied": false }`, and `device.fingerprint` differs from the release condition's `fingerprint`. The fingerprint moves when a plugin or native dependency is added, removed or bumped. `npx hotcodepush fingerprint diff <store-build.json> <current.json>` names the package that moved, over two files `npx hotcodepush fingerprint --json` wrote.
Fix: ship a store build that carries the new native layer; devices on the old one keep getting releases built against it. Only when the change is known to be safe for the old binary is a release widened to it explicitly.

**4. The binary range excludes the device.** Common.
Shows: `SKIPPED`, `DEVICE_INCOMPATIBLE`, `condition` `binary` or `os`; the range is `range` on the release's condition of that `type` in `verdicts`, beside `device.binaryVersion` or `device.osVersion`. `os` is in `unknownFacts` without `--device`.
Fix: release again with a range that includes the device, or without the condition; `release create --dry-run --json` prints the audience a range reaches before publishing.

**5. The device follows another channel.** Common; the usual answer when one tester's phone did not update.
Shows: `UP_TO_DATE` and the expected release missing from `verdicts` because the probe read another channel's index. `npx hotcodepush device get --device <id> --json` prints `channelId`, `channel.name` and `channelSource`, `config` for the build's channel and `runtime` for a `setChannel()` call; `channelId` `null` is a build made without a token or with `HOTCODEPUSH_OFFLINE=1`, which follows no channel and answers `CHANNEL_UNKNOWN`.
Fix: release to the channel the device follows, or return the device with `setChannel(null)`; a test build that must follow its own channel gets it at build time through `HOTCODEPUSH_CHANNEL`.

**6. The rollout has not reached the device.** Common on channels that stage releases.
Shows: `SKIPPED`, `DEVICE_NOT_IN_ROLLOUT`, with `--device` only; the release's `rolloutPercentage` is in `verdicts`, and `release get --json` prints `progression` and `releaseCounters` for the gate a progression waits on. The bucket is a stable hash of device id and release id, so the device stays out until the percentage passes it.
Fix: `npx hotcodepush release rollout --channel <channel> --release <number> --rollout-percentage 100 --yes`, or leave the progression to finish; to reach one phone without moving the rollout, release to it with `--device <id>`.

**7. The release or its channel is paused.** Common; check it before anything subtler.
Shows: `SKIPPED`, `CHANNEL_PAUSED` for a paused channel, `npx hotcodepush channel get --channel <name> --json` printing `pausedAt`. A paused release is simply not offered: `release get --json` prints `status` `paused`, `pausedAt`, `autoPausedAt` when auto-pause acted, and the failure counts behind it in `releaseCounters`.
Fix: fix what the devices hit first, then `npx hotcodepush release resume --channel <channel> --release <number> --yes` or `npx hotcodepush channel resume --channel <name> --yes`; resuming a still-broken release trips auto-pause again.

**8. The release does not cover the platform.** Occasional, mostly on React Native and Expo, where a bundle is per platform.
Shows: the probe with `--platform android` finds no release where `--platform ios` finds one; `npx hotcodepush bundle get --bundle <number> --json` prints `platforms`.
Fix: release for both platforms; on Capacitor and Cordova the second release moves zero bytes, since both platforms share one bundle.

**9. The release is older than the binary.** Occasional, and normal right after a store release.
Shows: `SKIPPED`, `RELEASE_OLDER_THAN_BINARY`; `device.builtAt`, the build's floor, is after the release's `createdAt`. No release created before the build is ever applied on that binary; without `--device` and a registered binary the floor is unknown and this never shows.
Fix: create a release after the build; there is nothing to configure.

**10. The release targets devices this one is not.** Occasional, mostly on the first release that uses targeting.
Shows: `SKIPPED`, `DEVICE_NOT_TARGETED`, `condition` `attribute` or `device`; `device.attributes` from the registry, or the `--attribute` flags given. A device that has not called `setAttributes()` yet matches no attribute condition; a typo in key or value never matches, since conditions carry hashes.
Fix: set the attributes before the first sync, or release without the condition.

**11. The release was revoked, or the bundle failed on this device before.** Occasional.
Shows: `SKIPPED`, `RELEASE_REVOKED`, the release `status` `revoked` in `release get --json`; or `BUNDLE_FAILED_BEFORE` with the bundle in `device.failedBundleIds`, from the device's `failed` events. `releaseCounters` shows whether it is this device or all of them.
Fix: for a revoked release, publish a new one; for a local blocklist, the app's `reset()` returns the device to its embedded bundle and clears the list.

**12. Live updates are off in this build.** Occasional, a one-line answer.
Shows: every check on the device says `SKIPPED` with `BUILD_DEBUG`; the probe shows `AVAILABLE`. `enabledInDebugBuilds` is `false` in `hotcodepush.json`, or on React Native and Expo the build is a debug build served by Metro, which embeds no bundle and takes no updates.
Fix: test on a release build, or on a development build that follows its own channel.

**13. The channel does not resolve.** Occasional, mostly on preview and tenant setups.
Shows: `FAILED` with `CHANNEL_UNKNOWN` on the device for a `setChannel({ name })` the app cannot resolve; `npx hotcodepush channel list --json` prints `isDiscoverable`, and no channel is discoverable until flagged. A deleted or expired channel serves no index: the probe's `status` is `404` and `outcome` `null`, and the device keeps what it runs.
Fix: `npx hotcodepush channel update --channel <name> --discoverable --yes`, or switch by id, which needs no flag; recreate a channel that expired.

**14. The app is holding restarts.** Occasional, only in apps that use the gate.
Shows: the probe shows `AVAILABLE`; the debug screen shows a downloaded release under a running one that never changes. Search the app's source for `setRestartAllowed` with `isAllowed: false`.
Fix: call `setRestartAllowed({ isAllowed: true })` when the protected flow ends; the setting is never persisted.

**15. The build step never ran.** Occasional, near-certain on a project not set up with `init`.
Shows: `npx hotcodepush doctor --json` prints `hook` or `package` as `failed` with its `manualStep`; `device get --json` prints `fingerprint` `null` and `embeddedBundleId` `null`, or the device never reported at all. Without the build step the SDK has nothing to read.
Fix: the init skill; `init` is idempotent and is the repair command. Then a new build.

**16. The organization is at its spending cap.** Rare, announced by mail beforehand.
Shows: `SKIPPED`, `SPENDING_CAP_REACHED`; `npx hotcodepush organization get --json` prints `spendingCapCents` and `cappedAt`. Devices counted within the cap get every update; devices beyond it receive nothing new until the month turns or the cap is raised.
Fix: `npx hotcodepush organization update --spending-cap <dollars> --yes` when the person decides so; the indexes are rewritten within seconds.

**17. The SDK is older than the release needs.** Rare, growing with the age of the oldest binary.
Shows: `SKIPPED`, `CONDITION_UNSUPPORTED`, or `FAILED`, `INDEX_INVALID` on the device; a condition `type` in `verdicts` outside `attribute`, `binary`, `device`, `fingerprint` and `os`; `device get --json` prints `sdkVersion`. Old SDKs fail closed on what they do not know.
Fix: ship a store build with a current SDK, and until then release without the new condition type.

**18. The download did not finish.** Rare as a cause, since every one retries on the next check.
Shows: on the device `FAILED` with `DEVICE_OFFLINE` (the index could not be fetched and no cached copy exists), `DOWNLOAD_FAILED` (the pack or a file failed after the retries), `CONTENT_MISMATCHED` (a file differs from the manifest), `MANIFEST_INVALID` (the manifest broke the wire rules) or `SIGNATURE_INVALID` (the manifest did not verify against the app's public keys), or `SKIPPED` with `CONNECTION_METERED` (the policy is `unmetered`). `release get --json` prints `releaseCounters.downloadFailureCount` and `verificationFailureCount` across the fleet; `device get --json` prints the device's `failed` events with their `reason`.
Fix: `DEVICE_OFFLINE` and `DOWNLOAD_FAILED` need nothing. `CONNECTION_METERED`: set `downloadStrategy` to `auto` in `hotcodepush.json` if updates should not wait for Wi-Fi. A persistent `SIGNATURE_INVALID` means the release was signed with a key this build does not trust: ship a store build that lists the key. A persistent `CONTENT_MISMATCHED` or `MANIFEST_INVALID` is a support request with the probe's JSON.

**19. The index is not live, or has drifted.** Rare.
Shows: `isServedIndexCurrent` `false`, with `sequence` and `etag` beside `channel get --json`'s `indexSequence`, `verificationResult` and `verifiedAt`; or a release whose `liveAt` is `null`. A release becomes live within seconds of its creation; beyond that, a served index that disagrees with the database is HotCodePush's to fix.
Fix: for the first seconds, wait and probe again. If the probe still reports a mismatch, send its `--json` output to support; the indexes are rebuilt from the database.

### Step 5: Report

1. The cause by its number and name, the reason code and the field that showed it, with the probe's `outcome` quoted.
2. The fix, as a command when it is one; run it only when the person asked for the change.
3. What to check afterwards: the device's next check, `release get --json`'s counters, or the probe again.
4. When no cause matched: the probe's full JSON, the device's `events` and the debug screen's text, for a support request.

## Error Handling

- Exit `3`, `E_NOT_LOGGED_IN`: the probe needs a credential; set `HOTCODEPUSH_TOKEN` or log in as the init skill describes.
- Exit `2`, `E_MISSING_PARAMETER` naming `--platform`, `--binary-version` or `--binary-build`: without `--device` all three are required.
- Exit `2`, `E_INVALID_PARAMETER`: a channel name the app lacks, an attribute that is not `key=value`, or a device id the app does not know; `message` names it.
- `E_NOT_FOUND` on `--device`: the device was deleted or belongs to another app.
- The files host times out: `hosts` in `npx hotcodepush doctor --json` says which host is unreachable from this machine; the device may still reach it.
- `E_UNEXPECTED`, `E_UNEXPECTED_RESPONSE`: run once more with `--verbose`; if it persists, report it at `https://github.com/hotcodepush-team/cli/issues`.
