---
name: hotcodepush-init
description: "Sets HotCodePush over-the-air (OTA) updates up in an existing React Native, Expo, Capacitor or Cordova project: runs hotcodepush init --yes --json, handles the three authentication modes (a token in HOTCODEPUSH_TOKEN, a person who approves the device-authorization link, nobody watching), performs every manual step the CLI stops on and repeats hotcodepush doctor --json until it is clean. Use when asked to add OTA updates, live updates or code push to an app, to set up or repair HotCodePush in a project, or when doctor reports a failed check. Do not use to publish a release (the hotcodepush-release skill), to find out why a device did not update (the hotcodepush-debug-no-update skill) or to move an app off CodePush, EAS Update or another OTA update service (the hotcodepush-migrate skill)."
license: MIT
compatibility: "Requires Node.js 22 or later, the project's package manager, network access to api.hotcodepush.com and a HotCodePush account."
metadata:
  author: hotcodepush-team
  source: https://github.com/hotcodepush-team/skills/tree/main/skills/hotcodepush-init
---

# Set up HotCodePush

Set up HotCodePush, the over-the-air (OTA) update platform for React Native, Expo, Capacitor and Cordova, in an existing app project.
One CLI command does the ordinary project; this skill handles the unusual one: it runs `hotcodepush init --yes --json`, performs every step the CLI stopped on, and verifies the result with `hotcodepush doctor --json` until it is clean.

## Rules

- Run every CLI command with `--json` and, where it changes something, `--yes`. Without them the CLI prompts and the run hangs.
- Parse stdout as one JSON document. Diagnostics go to stderr: the subprocesses `init` runs, lines starting with `Warning:`, the telemetry notice on the first run, the update notice.
- Branch on `code`, never on the exit code alone. `init` exits `1` whenever a step stopped, whatever the step's code.
- Never print, log, commit or paste a token or a private key. `HOTCODEPUSH_TOKEN` stays in the environment.
- Edit only what a manual step names, and only as it names it. The CLI edits what it can recognise afterwards; the same rule applies here.
- Never run `hotcodepush signing-key create` unasked. It writes a private key file, which is a person's decision.
- Do not commit. The person reviews the diff.

## Procedure

### Step 1: Detect the project

1. Find the project root: the directory holding `package.json`. Run every command from there.
2. Read `package.json`'s `dependencies` and `devDependencies`. The CLI detects the framework from `react-native`, `expo`, `@capacitor/core` and `cordova`, with the framework's config file (`app.json` with an `expo` key, `capacitor.config.json` or `.ts`, `config.xml`) breaking a tie. None of the four: stop and say that HotCodePush supports React Native, Expo, Capacitor and Cordova.
3. Pass `--framework capacitor|cordova|expo|react_native` only when the person says the detection is wrong.
4. If `hotcodepush.json` exists in the root or a directory above it, this is a repair run: `init` keeps the app it names and completes what is missing.

### Step 2: Run init

Run:

```sh
npx hotcodepush init --yes --json
```

Add `--organization <id|name>`, `--app <id|name>`, `--ios-path <dir>`, `--android-path <dir>` or `--xcode-target <name>` only when Step 3 asks for them.

Read stdout:

- `{ "error": { "code", "message", "fix" } }`: the command failed before its steps ran. Go to Error Handling.
- `{ "status": "complete", "steps": [...] }`: go to Step 4.
- `{ "status": "incomplete", "steps": [...] }`: go to Step 3.

Every entry of `steps` is `{ "step", "status", "message" }` with `"code"` and `"manualStep"` on a stopped step.
The steps are `sign_in`, `organization`, `app`, `package`, `configuration`, `hook`, `signing_key`, `build` and `release`, each `done`, `skipped` or `stopped`.
Under `--yes` the steps `signing_key`, `build` and `release` are always `skipped`: they are interactive-only, and the first release comes from the hotcodepush-release skill.
A step `skipped` with `Waits on the <step> step.` resolves itself on the next run.

### Step 3: Perform every manual step

For each step with `"status": "stopped"`, act on its `code` and `manualStep`, then run Step 2 again.

| `code` | Step | Do this |
| --- | --- | --- |
| `not_logged_in` | `sign_in` | Nobody is logged in and `HOTCODEPUSH_TOKEN` is not set. `manualStep` carries the device-authorization page and the code: `Approve at <url> with code <code>, then run "hotcodepush login" again.` Pick the authentication mode below. |
| `missing_parameter` naming `--organization` | `organization` | Run `npx hotcodepush organization list --json`. Several organizations: pass `--organization <id>` for the one the person named, and ask when they named none. No organization at all: pass `--organization "<name>"` to create one; the name is the person's to give, so ask for it. |
| `missing_parameter` naming `--app` | `app` | Run `npx hotcodepush app list --json`. Several apps: pass `--app <id>` for the one whose name matches the project, and ask when none or several do. No app yet: pass `--app "<name>"` to create one, named after the project's display name (`appName` in `capacitor.config`, `expo.name` in `app.json`, `<name>` in `config.xml`, `displayName` in a React Native `app.json`), falling back to `package.json`'s `name`. |
| `invalid_parameter` | `organization`, `app` | The id in the flag or in `hotcodepush.json`'s `appId` belongs to nothing the account can see. Correct it from the lists above. |
| `command_failed` | `package` | The package install the CLI ran failed; `message` names the command line. Run it by hand from the project root, read its output, fix the cause (registry access, a peer dependency, a lockfile out of date) and run Step 2 again. |
| `missing_parameter` naming `--ios-path` | `hook` | No native project was found. On Capacitor run `npx cap add ios` and `npx cap add android` for the platforms the app ships, or pass `--ios-path` and `--android-path` when the projects live elsewhere. |
| `missing_parameter` naming `--xcode-target` | `hook` | The iOS project has several app targets. List them from the `.xcodeproj` and pass `--xcode-target <name>` for the one the app ships; ask when it is unclear. |
| `native_project`, `xcode_project` | `hook` | A native file has no place for the CLI's edit. Make exactly the edit `manualStep` names in the file `message` names. Read `references/manual-steps.md` for the exact lines per framework. |
| `confirmation_required` | `package`, `configuration`, `hook` | `--yes` was left out. Run Step 2 with it. |
| Any other code | any | An API error passed through: `message` says what happened and what to do. Relay it and act on it; a limit, a role or a missing resource is not solved by a retry. |

Run Step 2 at most three times. When a step stops with the same code after its manual step was performed, stop and report the step, its `message` and its `manualStep` to the person.

**The three authentication modes.** `HOTCODEPUSH_TOKEN` in the environment wins over all of them: with it, `sign_in` is `skipped` with `Authenticated with HOTCODEPUSH_TOKEN as <name>.`

1. A token in the environment but the step still stopped: the token is refused. Tell the person; a new token comes from the console. Stop.
2. A person is nearby, that is, someone reads this session and can click: relay the page and the code from `manualStep` word for word, ask them to approve the code in the browser and wait for their answer. Then run Step 2 again. The CLI keeps the code, so the next `init` redeems the approval; the same code again means the approval has not happened yet, a new code means the old one expired.
3. Nobody is watching, that is, the agent runs in CI, on a schedule or in a pipeline with no one to answer: stop. Print the page and the code, and say what to do: open the page, approve the code, then run `npx hotcodepush login` on this machine, or set `HOTCODEPUSH_TOKEN` and run the setup again. Nothing is created on the server before the sign-in; the steps that do not depend on it, the package install and the build step's wiring, still ran, and the report names them.

### Step 4: Verify with doctor

Run:

```sh
npx hotcodepush doctor --json
```

Read stdout: `{ "status": "clean" | "failed", "checks": [{ "check", "status", "message", "manualStep"? }] }`.
The checks are `configuration`, `session`, `app`, `package`, `hook`, `host` (React Native only), `android_file_mode` (Cordova only), `hosts`, `signing_key` and `versions`; `framework` appears alone when the project has no supported framework.
`session` `skipped` without a token is not a failure, and `app` is then left out.

For each check with `"status": "failed"`, act on its `manualStep`:

| `manualStep` | Do this |
| --- | --- |
| `Run "hotcodepush init".` | Step 2 again; `init` is idempotent and is the repair command. |
| `Install the dependencies.` | Run the project's package manager install. |
| `Run "hotcodepush login", or set a valid HOTCODEPUSH_TOKEN.` | The authentication modes in Step 3. |
| `Run "hotcodepush signing-key list --json" and ...` | Do as it says: `publicKeys` in `hotcodepush.json` must list exactly the keys the app has registered. |
| `Add "@hotcodepush/expo-ota-updates" to the plugins in <file>.` | Make the edit; `references/manual-steps.md` shows it. |
| `Remove the preference.` (Cordova, `android_file_mode`) | Remove `AndroidInsecureFileModeEnabled` from `config.xml`; the plugin serves no update from `file://`. |
| `Check the network, the API URL in config.json and the HOTCODEPUSH_*_BASE_URL variables.` | A host is unreachable; relay `message`. Not a project problem. |

Run `doctor` after every round of fixes, at most three rounds, until `status` is `clean`.

### Step 5: Report

1. Run `npx hotcodepush open --json`; it prints `{ "url" }`, the app's console page, and launches nothing.
2. Report, in this order: what `init` did (the `message` of every `done` step), what was done by hand, the console URL and the docs at `https://hotcodepush.com/docs`.
3. Say what happens next: a store build, an Xcode archive or a Gradle release build, runs the build step the setup wired and registers the binary; a developer's build takes updates too, its first update being the full bundle; a React Native or Expo debug build served by Metro takes no updates.
4. Point at the first release: the hotcodepush-release skill, or `npx hotcodepush release create` on React Native and Expo and `npm run build && npx hotcodepush release create` on Capacitor and Cordova.
5. Mention once that code signing is off and that `npx hotcodepush signing-key create` turns it on, without running it.
6. List the files that changed, `hotcodepush.json`, `package.json`, the lockfile and the native files, for the person to review and commit.

## Error Handling

- `npx` cannot find `hotcodepush`: the CLI is not installed. Install it as a dev dependency with the project's package manager as the docs at `https://hotcodepush.com/docs/cli` name it, then run the command again.
- `unknown_framework`: `package.json` names none of `react-native`, `expo`, `@capacitor/core` or `cordova`. Stop and say so.
- `invalid_json`: a file the CLI reads does not parse; `message` names the file and where parsing stopped. Fix the JSON and run again.
- `invalid_parameter` with `--config`: the named `hotcodepush.json` does not exist. Run from the project root without `--config`.
- `client_update_required`: the CLI version is refused by the API. Update the CLI as `message` says.
- `unexpected`, `unexpected_response`: run the command once more with `--verbose`; if it persists, report it at `https://github.com/hotcodepush-team/cli/issues` with the output and stop.
- A `Warning:` line on stderr is information for the report, never a failure.
- Exit `1` with `"status": "incomplete"` is the normal stopped case, not a crash; Step 3 handles it.
