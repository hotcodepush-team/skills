# HotCodePush Agent Skills

[![Install via skills.sh](https://img.shields.io/badge/skills.sh-install-green)](https://skills.sh/hotcodepush-team/skills)

The Agent Skills an AI coding agent installs to set up, release and debug updates with HotCodePush, the over-the-air (OTA) update platform for React Native, Expo, Capacitor and Cordova, and to migrate an app to it from another service.

## Installation

```sh
npx skills add hotcodepush-team/skills
```

Update them later with `npx skills update`.

The repo is also a plugin for Claude Code and Devin. The plugin adds the [HotCodePush MCP server](https://hotcodepush.com/docs/ai/mcp) to the skills.

```sh
# Claude Code
/plugin install hotcodepush --marketplace hotcodepush-team/skills

# Devin CLI
devin plugins install hotcodepush-team/skills
```

## Usage

Each skill is a procedure over the HotCodePush CLI's `--json` output, so the agent runs it unattended and stops only where a person must approve something.

| Skill                                                                  | What it does                                                                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`hotcodepush-init`](./skills/hotcodepush-init/)                       | Sets OTA updates up in an existing project and repeats `hotcodepush doctor` until it is clean.                         |
| [`hotcodepush-release`](./skills/hotcodepush-release/)                 | Builds where the framework needs it, previews the audience, publishes the release and reports it.                      |
| [`hotcodepush-debug-no-update`](./skills/hotcodepush-debug-no-update/) | Finds out why a device did not update: a decision procedure over `device probe` and `doctor`, each cause with its fix. |
| [`hotcodepush-migrate`](./skills/hotcodepush-migrate/)                 | Moves an app off another OTA service: freezes the old line on a branch, removes the old client, hands off to `hotcodepush-init` and `hotcodepush-release`, maps the channels. |

Prompts that trigger them, in any agent:

```text
Set up HotCodePush OTA updates in this project.
Release the current build to the staging channel.
My iPhone on 2.4.1 build 57 did not get the latest release. Why?
Migrate this app from CodePush to HotCodePush.
```

## Documentation

See [hotcodepush.com/docs/ai/skills](https://hotcodepush.com/docs/ai/skills) for the agent setup, and [hotcodepush.com/docs](https://hotcodepush.com/docs) for everything else.

## Development

Pure Markdown, no build. The check validates each skill's folder shape and frontmatter, and CI runs it:

```sh
nvm use
npm ci
npm run check
```

`CLAUDE.md` holds the rules a skill follows.

## License

See [LICENSE](./LICENSE).
