---
name: hotcodepush-debug-no-update
description: "Finds out why a device did not take a HotCodePush over-the-air (OTA) update, live update or code-push bundle: a decision procedure over hotcodepush device probe --json and hotcodepush doctor --json, covering the nineteen causes in the order support sees them, each with the reason code the device reports, the output field that shows it and the fix. Use when a device, a tester's phone, a simulator or a share of the fleet did not update, still shows the old version after a release, or reports skipped or failed with a reason such as device_incompatible, device_not_in_rollout, channel_paused or release_older_than_binary. Do not use to set up a project (the hotcodepush-init skill) or to publish a release (the hotcodepush-release skill)."
license: MIT
compatibility: "Requires Node.js 22 or later, a project with hotcodepush.json or the --app and --channel flags, a credential (HOTCODEPUSH_TOKEN or a stored login) and network access to the API and its files host (api.hotcodepush.com and files.hotcodepush.com, or the hosts HOTCODEPUSH_API_URL implies)."
metadata:
  author: hotcodepush-team
  source: https://github.com/hotcodepush-team/skills/tree/main/skills/hotcodepush-debug-no-update
---

# Why did a device not update

Find the cause when a device did not take an update from HotCodePush, the over-the-air (OTA) update platform for React Native, Expo, Capacitor and Cordova.
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
3. The release the device should have: `npx hotcodepush release list --json`, newest first; note its `number`, `id`, `bundleId`, `status`, `rolloutPercent`, `conditions` and `liveAt`.
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

Add `--attribute key=value` for each attribute the app sets on the device and, without `--device`, `--channel <name>` when the device follows another channel than `hotcodepush.json`'s.
With `--device`, the probe takes the platform, the binary, the channel, the fingerprint, the OS version, the attributes, the rollout bucket, the running release and the failed bundles from the device's registry row; `builtAt` comes from the registered binary that matches the platform, version and build, with or without `--device`, and is `null` when none does.

stdout:

```json
{
  "channelId": "...",
  "platform": "ios",
  "url": "https://files.hotcodepush.com/apps/<appId>/channels/<channelId>/ios/v1/index.json",
  "status": 200,
  "sequence": 1761640000000,
  "unknownFacts": [],
  "device": { "deviceId": "...", "binaryVersion": "2.4.1", "binaryBuild": "57", "builtAt": "...", "fingerprint": "fp1:...", "osVersion": "17.4", "attributes": {}, "currentRelease": { "id": "...", "number": 41 }, "failedBundleIds": [], "reportedAt": "..." },
  "outcome": { "status": "skipped", "reason": "device_incompatible", "conditionType": "fingerprint", "release": { "number": 43, "...": "..." } },
  "verdicts": [{ "release": { "number": 43, "rolloutPercent": 100, "isMandatory": false, "bundleId": "...", "conditions": [{ "type": "fingerprint", "fingerprint": "fp1:..." }] }, "conditions": [{ "type": "fingerprint", "isSatisfied": false }], "isEligible": false, "reason": "device_incompatible", "conditionType": "fingerprint" }]
}
```

- `status` is the files host's HTTP status; `outcome` is `null` and `verdicts` empty when it serves no index. `sequence` is the moment the served index was published, in milliseconds, or `null` without an index.
- `outcome.status` is `available` (the device takes `outcome.release` on its next check), `up_to_date` (it runs `outcome.release`, or the embedded bundle when `null`) or `skipped` with `reason` and, for a condition, `conditionType`.
- `verdicts` is every release the index offers, newest first, each condition `isSatisfied` or not.
- `unknownFacts` lists what the probe could not know without `--device`: `os` and `rollout` always, `fingerprint` unless a registered store build has the binary's identity. An unknown fact counts as passing, so a `skipped` on it cannot show; when the outcome is `available` and the facts are unknown, run the probe again with `--device` before ruling causes 3, 4 and 6 out.

### Step 3: Branch on the outcome

| Probe shows | Go to cause |
| --- | --- |
| `status` is not `200`, `outcome` is `null` | 19, then 8: the channel exists but has no index for this platform yet |
| `outcome.status` `skipped`, `reason` `device_incompatible`, `conditionType` `fingerprint` | 3 |
| `skipped`, `device_incompatible`, `conditionType` `binary` or `os` | 4 |
| `skipped`, `device_not_in_rollout` | 6 |
| `skipped`, `channel_paused` | 7 |
| `skipped`, `release_older_than_binary` | 9 |
| `skipped`, `device_not_targeted` | 10 |
| `skipped`, `release_revoked` or `bundle_failed_before` | 11 |
| `skipped`, `spending_cap_reached` | 16 |
| `skipped`, `condition_unsupported` | 17 |
| `available` for the expected release | the device would take it: 2, then 12, 14, 15, 18, which only the device shows |
| `up_to_date` on the expected release | 1 |
| `up_to_date` on an older release or `null`, and the expected release is missing from `verdicts` | 5, 7, 8, 11, 19 |

The device-only reasons `build_debug`, `connection_metered` and every `failed` reason never appear in the probe; the debug screen or `npx hotcodepush device get --device <id> --json` (the row with its `events`, each `type` `checked`, `applied`, `confirmed` or `failed`, with a `reason` on `checked` and `failed`) shows them.

### Step 4: The causes, most likely first

**1. The release carries the previous build.** Very common.
Shows: `up_to_date` on the expected release, and the app looks unchanged. `npx hotcodepush release get --channel <channel> --release <number> --json` prints `bundle.gitSha`, `bundle.gitRef`, `bundle.gitMessage` and `bundle.isGitDirty`; a sha that is not the expected commit, or a dirty flag, means the upload took an older or uncommitted build. On Capacitor and Cordova the web build is the project's own, so a `release create` without a build in front releases yesterday's output.
Fix: build, then release, as one step, `npm run build && npx hotcodepush release create`; the hotcodepush-release skill does both.

**2. The device has not applied it yet.** Very common, and almost every report in the first hour.
Shows: `available`; with `--device`, `device.currentRelease.number` below the expected number and `device.reportedAt` older than the release's `liveAt`. The default strategy applies an update at the next cold start, and checks happen at start, on resume and every fifteen minutes in the foreground by default (`checkIntervalSeconds` in `hotcodepush.json`).
Fix: close the app completely and reopen it, or press check now on the debug screen. For at once, release with `--mandatory`; for another moment, `applyStrategy` in `hotcodepush.json` (`next_start`, `next_resume`, `immediate` or `manual`).

**3. The native fingerprint does not match.** Very common, and the CLI warned at upload.
Shows: `skipped`, `device_incompatible`, `conditionType` `fingerprint`; the verdict's `conditions` has `{ "type": "fingerprint", "isSatisfied": false }`, and `device.fingerprint` differs from the release condition's `fingerprint`. The fingerprint moves when a plugin or native dependency is added, removed or bumped. `npx hotcodepush fingerprint diff <store-build.json> <current.json>` names the package that moved, over two files `npx hotcodepush fingerprint --json` wrote.
Fix: ship a store build that carries the new native layer; devices on the old one keep getting releases built against it. Only when the change is known to be safe for the old binary is a release widened to it explicitly.

**4. The binary range excludes the device.** Common.
Shows: `skipped`, `device_incompatible`, `conditionType` `binary` or `os`; the range is `range` on the release's condition of that `type` in `verdicts`, beside `device.binaryVersion` or `device.osVersion`. `os` is in `unknownFacts` without `--device`.
Fix: release again with a range that includes the device, or without the condition; `release create --dry-run --json` prints the audience a range reaches before publishing.

**5. The device follows another channel.** Common; the usual answer when one tester's phone did not update.
Shows: the probe's `channelId`, or `npx hotcodepush device get --device <id> --json`'s `channelId`, differs from the expected release's `channelId`; with `--device` the probe reads the device's own channel, without it the expected release is missing from `verdicts` because the probe read `hotcodepush.json`'s channel. `device get --json` prints `channel.name` and `channelSource`, `config` for the build's channel and `runtime` for a `setChannel()` call; `channelId` `null` is a build made without a token or with `HOTCODEPUSH_OFFLINE=1` and a channel named rather than given by id, which follows no channel and takes no OTA updates.
Fix: release to the channel the device follows, or return the device with `setChannel(null)`; a test build that must follow its own channel gets it at build time through `HOTCODEPUSH_CHANNEL`.

**6. The rollout has not reached the device.** Common on channels that stage releases.
Shows: `skipped`, `device_not_in_rollout`, with `--device` only; the release's `rolloutPercent` is in `verdicts`, and `release get --json` prints `progression` and `releaseCounters` for the gate a progression waits on. The bucket is a stable hash of device id and release id, so the device stays out until the percentage passes it.
Fix: `npx hotcodepush release rollout --channel <channel> --release <number> --rollout-percent 100 --yes`, or leave the progression to finish; to reach one phone without moving the rollout, release to it with `--device <id>`.

**7. The release or its channel is paused.** Common; check it before anything subtler.
Shows: `skipped`, `channel_paused` for a paused channel, `npx hotcodepush channel get --channel <name> --json` printing `pausedAt`. A paused release is simply not offered: `release get --json` prints `status` `paused`, `pausedAt`, `autoPausedAt` when auto-pause acted, and the failure counts behind it in `releaseCounters`.
Fix: fix what the devices hit first, then `npx hotcodepush release resume --channel <channel> --release <number> --yes` or `npx hotcodepush channel resume --channel <name> --yes`; resuming a still-broken release trips auto-pause again.

**8. The release does not cover the platform.** Occasional, mostly on React Native and Expo, where a bundle is per platform.
Shows: the probe with `--platform android` finds no release where `--platform ios` finds one; `npx hotcodepush bundle get --bundle <number> --json` prints `platforms`.
Fix: release for both platforms; on Capacitor and Cordova the second release moves zero bytes, since both platforms share one bundle.

**9. The release is older than the binary.** Occasional, and normal right after a store release.
Shows: `skipped`, `release_older_than_binary`; `device.builtAt`, the build's floor, is after the release's `createdAt`. No release created before the build is ever applied on that binary; `device.builtAt` is `null` when no binary created by `binary create` matches the platform, version and build, and then this never shows, with or without `--device`.
Fix: create a release after the build; there is nothing to configure.

**10. The release targets devices this one is not.** Occasional, mostly on the first release that uses targeting.
Shows: `skipped`, `device_not_targeted`, `conditionType` `attribute` or `device`; `device.attributes` from the registry, or the `--attribute` flags given. A device that has not called `setAttributes()` yet matches no attribute condition; a typo in key or value never matches, since conditions carry hashes.
Fix: set the attributes before the first sync, or release without the condition.

**11. The release was revoked, or the bundle failed on this device before.** Occasional.
Shows: `skipped`, `release_revoked`, which means the release the device runs was revoked, `outcome.release` being the older release it falls back to or `null`, and `release get --json` printing `status` `revoked`; or `bundle_failed_before` with the bundle in `device.failedBundleIds`, from the device's `failed` events. `releaseCounters` shows whether it is this device or all of them.
Fix: for a revoked release, publish a new one; for a local blocklist, the app's `reset()` returns the device to its embedded bundle and clears the list.

**12. OTA updates are off in this build.** Occasional, a one-line answer.
Shows: every check on the device says `skipped` with `build_debug`; the probe shows `available`. `isEnabledInDebugBuilds` is `false` in `hotcodepush.json`, or on React Native and Expo the build is a debug build served by Metro, which embeds no bundle and takes no updates.
Fix: test on a release build, or on a development build that follows its own channel.

**13. The channel does not resolve.** Occasional, mostly on preview and tenant setups.
Shows: `failed` with `channel_unknown` on the device for a `setChannel({ name })` the app cannot resolve; `npx hotcodepush channel list --json` prints `isDiscoverable`, and no channel is discoverable until flagged. A deleted or expired channel makes the probe exit before it reads an index: `invalid_parameter` for a name, `not_found` for an id or for a device whose channel is gone; the device keeps what it runs and its channel, every check fails with `channel_unknown`, and the SDK never changes the channel on its own.
Fix: `npx hotcodepush channel update --channel <name> --discoverable --yes`, or switch by id, which needs no flag; recreate a channel that expired, or let the app clear a runtime choice with `setChannel(null)` when the check fails with `channel_unknown` and `getChannel().source` is `runtime`.

**14. The app is holding restarts.** Occasional, only in apps that use the gate.
Shows: the probe shows `available`; the debug screen shows a downloaded release under a running one that never changes. Search the app's source for `setRestartAllowed` with `isAllowed: false`.
Fix: call `setRestartAllowed({ isAllowed: true })` when the protected flow ends; the setting is never persisted.

**15. The build step never ran.** Occasional, near-certain on a project not set up with `init`.
Shows: the device is missing from `npx hotcodepush device list --json`, and `npx hotcodepush doctor --json` prints `hook` or `package` as `failed` with its `manualStep`. Without the build step the SDK has nothing to read: it is not configured, never checks and never reports, so the device never appears in the list. A missing device alone proves nothing, since one that cannot reach the events endpoint is missing too; the failed check is the proof.
Fix: the hotcodepush-init skill; `init` is idempotent and is the repair command. Then a new build.

**16. The organization is at its spending cap.** Rare, announced by mail beforehand.
Shows: `skipped`, `spending_cap_reached`; `npx hotcodepush organization get --json` prints `spendingCapCents` and `cappedAt`. Devices counted within the cap get every update; devices beyond it receive nothing new until the month turns or the cap is raised.
Fix: `npx hotcodepush organization update --spending-cap <dollars> --yes` when the person decides so; the indexes are rewritten within seconds.

**17. The SDK is older than the release needs.** Rare, growing with the age of the oldest binary.
Shows: `skipped`, `condition_unsupported`, or `failed`, `index_invalid` on the device; a condition `type` in `verdicts` outside `attribute`, `binary`, `device`, `fingerprint` and `os`; `device get --json` prints `sdkVersion`. Old SDKs fail closed on what they do not know.
Fix: ship a store build with a current SDK, and until then release without the new condition type.

**18. The download did not finish.** Rare as a cause, since every one retries on the next check.
Shows: on the device `failed` with `device_offline` (the index could not be fetched and no cached copy exists), `download_failed` (the pack or a file failed after the retries), `content_mismatched` (a file differs from the manifest), `manifest_invalid` (the manifest broke the wire rules) or `signature_invalid` (the manifest did not verify against the app's public keys), or `skipped` with `connection_metered` (the policy is `unmetered`). `release get --json` prints `releaseCounters.downloadFailureCount` and `verificationFailureCount` across the fleet; `device get --json` prints the device's `failed` events with their `reason`.
Fix: `device_offline` and `download_failed` need nothing. `connection_metered`: set `downloadStrategy` to `auto` in `hotcodepush.json` if updates should not wait for Wi-Fi. A persistent `signature_invalid` means the release was signed with a key this build does not trust: ship a store build that lists the key. A persistent `content_mismatched` or `manifest_invalid` is a support request with the probe's JSON.

**19. The index is not live, or has drifted.** Rare.
Shows: `release get --json` prints `liveAt` `null`; or the probe's `sequence` is older than the release's `createdAt` and the release is missing from `verdicts`, the served index being older than the release. A release becomes live within seconds of its creation; beyond that, a served index that disagrees with the database is HotCodePush's to fix.
Fix: for the first seconds, wait and probe again. If the probe still reports a mismatch, send its `--json` output to support; the indexes are rebuilt from the database.

### Step 5: Report

1. The cause by its number and name, the reason code and the field that showed it, with the probe's `outcome` quoted.
2. The fix, as a command when it is one; run it only when the person asked for the change.
3. What to check afterwards: the device's next check, `release get --json`'s counters, or the probe again.
4. When no cause matched: the probe's full JSON, the device's `events` and the debug screen's text, for a support request.

## Error Handling

- Exit `3`, `not_logged_in` or the API's `unauthenticated`: the probe needs a valid credential; set `HOTCODEPUSH_TOKEN` or log in as the hotcodepush-init skill describes.
- Exit `2`, `missing_parameter` naming `--platform`, `--binary-version` or `--binary-build`: without `--device` all three are required.
- Exit `2`, `invalid_parameter`: a channel name the app lacks or an attribute that is not `key=value`; `message` names it.
- `not_found`: the device in `--device` was deleted or belongs to another app, or the channel, by id or the device's own, was deleted.
- The files host times out: `hosts` in `npx hotcodepush doctor --json` says which host is unreachable from this machine; the device may still reach it.
- `unexpected_response`: the API answered something the CLI does not understand. Check `HOTCODEPUSH_API_URL` or the API URL in `config.json` and the network; if it persists, report it at `https://github.com/hotcodepush-team/cli/issues`.
- `unexpected`: run once more with `--verbose`; if it persists, report it at `https://github.com/hotcodepush-team/cli/issues`.
