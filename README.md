# HotCodePush Agent Skills

[![Install via skills.sh](https://img.shields.io/badge/skills.sh-install-green)](https://skills.sh/hotcodepush-team/skills)

The Agent Skills an AI coding agent installs to set up, release and debug updates with HotCodePush, the over-the-air (OTA) update platform for Capacitor, React Native, Expo and Cordova.

## Installation

Install the skills with the [skills](https://skills.sh/) command:

```sh
npx skills add hotcodepush-team/skills
```

Update them later with `npx skills update`.

## Usage

Each skill is a procedure over the HotCodePush CLI's `--json` output, so the agent runs it unattended and stops only where a person must approve something.

| Skill | What it does |
| ----- | ------------ |
| [`hotcodepush-init`](./skills/hotcodepush-init/) | Sets OTA updates up in an existing project: runs `hotcodepush init --yes --json`, handles the sign-in, performs every manual step the CLI stops on and repeats `hotcodepush doctor --json` until it is clean. |
| [`hotcodepush-release`](./skills/hotcodepush-release/) | Builds where the framework needs it, previews the audience with `release create --dry-run --json`, publishes with `release create --yes --json` and reports the release, the audience and the warnings. |
| [`hotcodepush-debug-no-update`](./skills/hotcodepush-debug-no-update/) | Finds out why a device did not update: the nineteen causes as a decision procedure over `device probe --json` and `doctor --json`, each with its reason code, the field that shows it and the fix. |

Prompts that trigger them, in any agent:

```text
Set up HotCodePush OTA updates in this project.
Release the current build to the staging channel.
My iPhone on 2.4.1 build 57 did not get the latest release. Why?
```

## Documentation

See [hotcodepush.com/docs/ai](https://hotcodepush.com/docs/ai) for the agent setup, and [hotcodepush.com/docs](https://hotcodepush.com/docs) for everything else.

## Development

Pure Markdown: no build.
The check CI runs validates each skill's folder shape and frontmatter, with `yaml` as its one dependency:

```sh
nvm use
npm ci
npm run check
```

## License

See [LICENSE](./LICENSE).
