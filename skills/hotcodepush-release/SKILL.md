---
name: hotcodepush-release
description: "Builds, uploads and releases an over-the-air (OTA) update with the HotCodePush CLI: runs the project's build where the framework needs one (Capacitor and Cordova), previews the audience with hotcodepush release create --dry-run --json, publishes with hotcodepush release create --yes --json, labels the bundle from the commit in CI, and reports the release number, the audience and every warning. Use when asked to release, publish, ship or deploy an OTA update, a live update or a code-push bundle to a channel. Do not use to set up a project that has no hotcodepush.json (the hotcodepush-init skill), to pause, revoke or roll back an existing release, or to debug a device that did not update (the hotcodepush-debug-no-update skill)."
license: MIT
compatibility: "Requires Node.js 22 or later, a project set up with hotcodepush init, a credential (HOTCODEPUSH_TOKEN or a stored login) and network access to api.hotcodepush.com."
metadata:
  author: hotcodepush-team
  source: https://github.com/hotcodepush-team/skills/tree/main/skills/hotcodepush-release
---

# Release an update

Publish an update with HotCodePush, the over-the-air (OTA) update platform for Capacitor, React Native, Expo and Cordova: build where the framework needs it, preview the audience, release, and report what happened.
`hotcodepush release create` uploads the build and releases it to the project's channel in one command; this skill puts the build in front of it and reads the result.

## Rules

- Run every CLI command with `--json`, and the release with `--yes`. Without them the CLI prompts and the run hangs.
- Parse stdout as one JSON document. Diagnostics go to stderr: the packaging the CLI runs, lines starting with `Warning:`, the notices.
- Never print, log or commit a token or a private key. A signing key reaches the CLI through `HOTCODEPUSH_SIGNING_KEY` or `--private-key-path <file>`; never read the file.
- Never invent a channel, a rollout percentage or a condition. Pass a flag only when the person asked for what it does.
- Never release without building first on Capacitor and Cordova. A release carries what lies on disk, and a stale build is the most common support case.

## Procedure

### Step 1: Check the project

1. Find `hotcodepush.json` in the working directory or a directory above it. None: stop and point at the hotcodepush-init skill.
2. Read the framework from `package.json`: `@capacitor/core`, `cordova`, `expo` or `react-native`.
3. Read `hotcodepush.json`: `channel` is the default channel (`production` when absent); `publicKeys` not empty means the app signs its bundles, so the upload needs the private key. In CI it is the secret `HOTCODEPUSH_SIGNING_KEY`; in a session, ask the person for the key file's path and pass `--private-key-path <file>`.
4. Note the package manager from the lockfile: `bun.lock` or `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, otherwise npm. The CLI uses the same one.
5. In CI, `HOTCODEPUSH_TOKEN` must be set; a pipeline without it exits `3`.

### Step 2: Build where the framework needs it

| Framework | Before the release |
| --- | --- |
| Capacitor | Run the `build` script with the project's package manager, `npm run build`. The release uploads `webDir` from `capacitor.config`. No `build` script: stop and ask how the web build is made; never upload a `webDir` of unknown age. |
| Cordova | Run the `build` script when `package.json` has one; otherwise `www` is the source and is uploaded as it is. |
| React Native | Nothing. The release runs `react-native bundle` per platform itself, inside the upload. |
| Expo | Nothing. The release runs `expo export:embed` per platform itself, inside the upload. |

A build that exits non-zero stops the procedure; report its output.
On React Native and Expo the dependencies must be installed, since the CLI runs the project's bundler and Hermes compiler.

### Step 3: Choose the flags

- `--channel <id|name>`: only when the person names a channel other than `hotcodepush.json`'s; repeatable for several.
- `--bundle-version <label>`: the bundle's version label, `package.json`'s `version` by default. In CI (the `CI` variable is set), pass `<version>+<short commit sha>`, for example `1.4.2+a1b2c3d`, so every pipeline run carries its own label; without a `version` in `package.json`, pass the short sha alone.
- `--rollout-percentage <0-100>`, `--progress`, `--mandatory`, `--notes "<text>"`, `--binary "<range>"`, `--os "<range>"`, `--attribute key=value`, `--device <id>`, `--platform ios|android`: pass each only when the person asked for what it does.
- `--private-key-path <file>`: from Step 1, when the app signs and the key is not in `HOTCODEPUSH_SIGNING_KEY`.
- `--git-sha`, `--git-ref`, `--git-message`: in a pipeline without a git checkout, so the release still records its commit; `--no-git` turns detection off.

The commit is recorded on the bundle in any case: sha, ref, message, dirty flag.
Working-tree changes not committed make the release carry `isGitDirty: true`; say so in the report.

### Step 4: Preview the audience

Run, with the flags of Step 3:

```sh
npx hotcodepush release create --dry-run --json
```

It validates the build, hashes it, checks the size limit and asks the API for the audience; nothing is signed, uploaded or published, so it needs no private key.
stdout is an array, one entry per channel:

```json
[{ "channelId": "...", "deviceCount": 10000, "reachedDeviceCount": 9995, "estimatedDeviceCount": 9995, "byPlatform": [...], "byBinaryVersion": [...], "warnings": [{ "code": "FINGERPRINT_UNKNOWN", "message": "...", "details": null }] }]
```

- `deviceCount` is the channel's active devices, `reachedDeviceCount` those the release's conditions reach, `estimatedDeviceCount` the share at the rollout percentage.
- `reachedDeviceCount` is `0` while `deviceCount` is above `0`: the conditions exclude every device. Stop and show the person the numbers and the warnings; a release that reaches nobody is almost always a mistake.
- `FINGERPRINT_UNKNOWN`: no store build registered with HotCodePush carries the native fingerprint this build has, because a native dependency changed since the last store build. The release reaches devices on a matching binary only; the rest need a store build. Continue, and say so in the report.
- `UNSUPPORTED_CONDITION_SHARE`: a share of the devices run an SDK that does not know one of the release's condition types and will skip it. Continue, and say so in the report.
- A non-zero exit: Step 6.

On React Native and Expo the dry run bundles the JavaScript once and the release bundles it again; that is expected.

### Step 5: Release

Run, with the same flags:

```sh
npx hotcodepush release create --yes --json
```

stdout is an array of releases, one per channel, and on React Native and Expo one per platform and channel:

```json
[{ "id": "...", "number": 43, "channelId": "...", "bundleId": "...", "rolloutPercentage": 100, "status": "active", "liveAt": "2026-10-20T10:00:00.000Z", "isMandatory": false, "progression": null }]
```

- `number` is the release's number in its channel; it is printed as `#43`.
- `liveAt` is set once the channel's index is written, which the CLI waits up to sixty seconds for. `null` means it is not live yet: run `npx hotcodepush release get --channel <channel> --release <number> --json` every few seconds until `liveAt` is set, at most a minute more, then report it as pending.
- `Warning:` lines on stderr carry the audience warnings again; relay them.

### Step 6: Act on the exit code

| Exit | Meaning | Do this |
| --- | --- | --- |
| `0` | Done | Step 7. |
| `1` | An error, `error.code` on stdout | See the table below. |
| `2` | A missing or invalid parameter | `E_MISSING_PARAMETER` names the flag: `--path <dir>` when `capacitor.config` sets no `webDir` the CLI can read, `--bundle-version <label>` when `package.json` has no `version`. `E_INVALID_PARAMETER` names the wrong flag or `hotcodepush.json` field; correct it and run again. |
| `3` | Not logged in, `E_NOT_LOGGED_IN` or the API's `E_UNAUTHENTICATED` | Set `HOTCODEPUSH_TOKEN`, or log in as the hotcodepush-init skill's authentication modes describe. |
| `4` | A confirmation required, `E_CONFIRMATION_REQUIRED` | `--yes` was left out. |

Codes under exit `1`:

| `error.code` | Do this |
| --- | --- |
| `E_FINGERPRINT_UNAVAILABLE` | The native fingerprint cannot be computed; `fix` says why: no lockfile, two lockfiles, or `node_modules` out of step with the lockfile. Install the dependencies from the one lockfile and run again. |
| `E_SIGNING_KEY_UNAVAILABLE` | `hotcodepush.json` lists public keys and no private key was given. Step 1, item 3. |
| `E_BUNDLE_TOO_LARGE` | A file or the bundle is above 512 MB. Move large media out of the web build; nothing was uploaded. |
| `E_SIGNATURE_REQUIRED` | The app has a signing key the project does not list. Run `npx hotcodepush signing-key list --json`, add each `publicKey` to `publicKeys` in `hotcodepush.json`, provide the private key, run again. |
| `E_UNKNOWN_FRAMEWORK`, `E_INVALID_JSON` | The project has no supported framework, or a JSON file does not parse; `message` names it. |
| `E_NOT_FOUND` | The app or channel in `hotcodepush.json` or `--channel` no longer exists. `npx hotcodepush channel list --json` shows what does. |
| `E_CLIENT_UPDATE_REQUIRED` | Update the CLI as `message` says. |
| Any other API code | `message` carries the fix; relay it. A limit or a role is not solved by a retry. |
| `E_UNEXPECTED`, `E_UNEXPECTED_RESPONSE` | Run once more with `--verbose`; if it persists, report it at `https://github.com/hotcodepush-team/cli/issues`. |

A run that failed after the upload and before the release leaves an uploaded bundle; running again uploads only what the app lacks, so run again rather than cleaning up.
A run repeated after success creates another release of the same bundle; that is by design, never an error to retry.

### Step 7: Report

1. The release: `#<number>` in channel `<name>`, the bundle label, the rollout percentage and progression, mandatory or not, live since `liveAt`.
2. The audience from Step 4: reached of total, and every warning with what it means.
3. The commit the release carries, and that the working tree was dirty when it was.
4. What devices do: by default they check at start and resume and apply the update at the next cold start; the person closes the app completely and reopens it to see the change. A mandatory release applies at once.
5. How to watch it: `npx hotcodepush release get --channel <channel> --release <number> --json` shows `releaseCounters` (`attemptedUpdateCount`, `appliedUpdateCount`, the failure counts) and the progression step; a device that did not update is the hotcodepush-debug-no-update skill's case.
6. For a pipeline: the same command, `npx hotcodepush release create --yes`, with `HOTCODEPUSH_TOKEN` and, when the app signs, `HOTCODEPUSH_SIGNING_KEY` as secrets, and `release create --dry-run` in the pull-request pipeline, which holds no secret.

## Error Handling

- `npx` cannot find `hotcodepush`: the CLI is not installed; install it as a dev dependency as `https://hotcodepush.com/docs/cli` names it.
- The build script fails: report its output and stop; the release is not attempted.
- `react-native bundle` or `expo export:embed` fails inside the upload, `E_COMMAND_FAILED`: run the command line `message` names by hand from the project root and read its output; usually a missing dependency or an entry file the project renamed.
- The API answers `E_RATE_LIMITED` or a `5xx`: the client retries three times itself; a failure after that is reported, and the run can be repeated.
- A `Warning:` line on stderr is information for the report, never a failure.
