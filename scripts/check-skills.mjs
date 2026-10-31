#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

const SKILLS_DIRECTORY_PATH = resolve(import.meta.dirname, '..', 'skills');
const README_PATH = resolve(import.meta.dirname, '..', 'README.md');
const ALLOWED_SUBDIRECTORY_NAMES = new Set(['assets', 'references', 'scripts']);
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX_LENGTH = 64;
const DESCRIPTION_MAX_LENGTH = 1024;

const problems = [];
const readme = readFileSync(README_PATH, 'utf8');
const skillNames = readdirSync(SKILLS_DIRECTORY_PATH, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();

for (const skillName of skillNames) {
  checkSkill(skillName);
}

if (problems.length > 0) {
  console.error(problems.map(problem => `- ${problem}`).join('\n'));
  process.exit(1);
}
console.log(`${skillNames.length} skills checked: ${skillNames.join(', ')}.`);

function checkSkill(skillName) {
  const skillDirectoryPath = join(SKILLS_DIRECTORY_PATH, skillName);
  const skillFilePath = join(skillDirectoryPath, 'SKILL.md');
  if (!existsSync(skillFilePath)) {
    problems.push(`${skillName}: SKILL.md is missing.`);
    return;
  }
  checkFolderShape(skillName, skillDirectoryPath);
  checkFrontmatter(skillName, readFileSync(skillFilePath, 'utf8'));
  if (!readme.includes(`skills/${skillName}/`)) {
    problems.push(`${skillName}: README.md does not list it.`);
  }
}

function checkFolderShape(skillName, skillDirectoryPath) {
  for (const entry of readdirSync(skillDirectoryPath, { withFileTypes: true })) {
    if (entry.isFile() && entry.name !== 'SKILL.md') {
      problems.push(`${skillName}: ${entry.name} is a file beside SKILL.md; only the three subfolders are allowed.`);
    }
    if (!entry.isDirectory()) {
      continue;
    }
    if (!ALLOWED_SUBDIRECTORY_NAMES.has(entry.name)) {
      problems.push(`${skillName}: ${entry.name}/ is not one of assets/, references/ or scripts/.`);
      continue;
    }
    const nestedDirectory = readdirSync(join(skillDirectoryPath, entry.name), { withFileTypes: true }).find(nested => nested.isDirectory());
    if (nestedDirectory !== undefined) {
      problems.push(`${skillName}: ${entry.name}/${nestedDirectory.name}/ nests a folder; the three subfolders are flat.`);
    }
  }
}

function checkFrontmatter(skillName, skillText) {
  let frontmatter;
  try {
    frontmatter = parseFrontmatter(skillText);
  } catch (error) {
    problems.push(`${skillName}: the frontmatter is not valid YAML: ${error.message.trimEnd()}`);
    return;
  }
  if (frontmatter === undefined) {
    problems.push(`${skillName}: SKILL.md does not start with a --- frontmatter block.`);
    return;
  }
  const { description, name } = frontmatter;
  if (typeof name !== 'string') {
    problems.push(`${skillName}: the frontmatter has no name.`);
  } else if (name !== skillName) {
    problems.push(`${skillName}: the frontmatter name "${name}" differs from the folder name.`);
  } else if (!NAME_PATTERN.test(name) || name.length > NAME_MAX_LENGTH) {
    problems.push(`${skillName}: the name must be 1 to ${NAME_MAX_LENGTH} lowercase letters, digits and single hyphens.`);
  }
  if (typeof description !== 'string' || description.length === 0) {
    problems.push(`${skillName}: the frontmatter has no description.`);
  } else if (description.length > DESCRIPTION_MAX_LENGTH) {
    problems.push(`${skillName}: the description is ${description.length} characters; at most ${DESCRIPTION_MAX_LENGTH}.`);
  }
}

function parseFrontmatter(skillText) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(skillText);
  if (match === null) {
    return undefined;
  }
  return parse(match[1]) ?? {};
}
