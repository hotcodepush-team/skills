# CLAUDE.md

The Agent Skills a customer's AI coding agent installs for HotCodePush, the over-the-air (OTA) update platform for React Native, Expo, Capacitor and Cordova: `hotcodepush-init`, `hotcodepush-release`, `hotcodepush-debug-no-update` and `hotcodepush-migrate`, one folder each under `skills/`, listed on [skills.sh](https://skills.sh/) and linked from `hotcodepush.com/docs/ai` and every SDK README.
Pure Markdown, no build; `scripts/check-skills.mjs` validates the folder shape and the frontmatter with `yaml`, the one dependency, and CI runs it.

The plan is the private `handbook` repo, checked out beside this one: `../handbook/docs/onboarding.md` defines the three skills, `cli.md` the commands they run and `drafts/debugging-guide.md` the nineteen causes.
The CLI at `../cli` is the source of truth for every JSON shape, flag, code and exit code a procedure names; when the handbook and the CLI disagree, the skill follows the CLI and the difference is surfaced, never improvised around.

## Layout

```
skills/<name>/SKILL.md      frontmatter (name, description, license, compatibility, metadata), then the procedure
skills/<name>/references/   what the procedure reads only when needed, one level deep
scripts/check-skills.mjs    the check: SKILL.md present, name equals the folder, description at most 1,024 characters,
                            only assets/, references/ and scripts/ beside it, flat, and the README lists the skill
```

## Writing a skill

- Load the `skill-creator` skill before creating or changing a `SKILL.md`; the skills follow the agentskills.io spec.
- Every step names the exact command to run, the field of its `--json` output to read and what to do next. A step an agent cannot run unattended is a bug, except the stated human approvals: the device-authorization click and a change to what devices receive.
- Branch on `code`, the reason code or the field, never on prose; quote the CLI's `manualStep` and `message` texts as the CLI prints them.
- Third-person imperative, no "you". The `description` is the trigger: what it does, when to use it, and when not to, naming the sibling skill instead.
- Keep `SKILL.md` under 500 lines; a large rule set moves to `references/`.
- Voice: `HotCodePush` in CamelCase, the appositive "the over-the-air (OTA) update platform for React Native, Expo, Capacitor and Cordova" on the first mention in a file, no exclamation marks, no emoji, plain headings.
- Framework order: React Native, Expo, Capacitor and Cordova wherever the supported frameworks are listed, the larger communities first.
- HotCodePush ships over-the-air (OTA) updates: "over-the-air (OTA) update" on the first mention in a file, "OTA update" after it. "Live update" appears only in a `description`'s list of alternative names ("OTA updates, live updates or code push") and in the Capacitor package name `capacitor-live-updates`, never as HotCodePush's own term.
- Quote the `description` in double quotes; a colon in an unquoted YAML value breaks parsers.

## Commands

| Command | Does |
| --- | --- |
| `npm run check` | the check CI runs |

## Process

- Commits are conventional commits; `main` is trunk and CI is the gate.
- Commit only when the owner says "commit", push only on "push", each time separately.
- Never place internal company information or customer data in this repo; it is public.
