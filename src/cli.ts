#!/usr/bin/env bun

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const TEMPLATES_DIR = join(import.meta.dirname, "..", "templates");

function init(targetDir: string) {
  const claudeDir = join(targetDir, ".claude");
  const specsDir = join(targetDir, "specs");

  // Copy templates into .claude/
  const dirs = ["agents/team", "commands", "hooks/validators"];
  for (const dir of dirs) {
    const src = join(TEMPLATES_DIR, dir);
    const dest = join(claudeDir, dir);

    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }

    cpSync(src, dest, { recursive: true, force: false });
  }

  // Create specs/ directory
  if (!existsSync(specsDir)) {
    mkdirSync(specsDir, { recursive: true });
  }

  console.log(`Initialized claude-team in ${targetDir}`);
  console.log();
  console.log("Created:");
  console.log("  .claude/agents/team/   — 5 team agents (builder, validator, browser-tester, documenter, code-reviewer)");
  console.log("  .claude/commands/      — /plan and /build commands");
  console.log("  .claude/hooks/         — 7 TypeScript validators (ruff, ty, eslint, tsc, markdownlint, new-file, contains)");
  console.log("  specs/                 — output directory for plans");
  console.log();
  console.log("Usage:");
  console.log('  /plan "build a login page"     — create a plan');
  console.log("  /build specs/<plan>.md          — execute the plan with team agents");
}

function update(targetDir: string) {
  const claudeDir = join(targetDir, ".claude");

  if (!existsSync(claudeDir)) {
    console.error("No .claude/ directory found. Run 'claude-team init' first.");
    process.exit(1);
  }

  const dirs = ["agents/team", "commands", "hooks/validators"];
  for (const dir of dirs) {
    const src = join(TEMPLATES_DIR, dir);
    const dest = join(claudeDir, dir);

    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }

    cpSync(src, dest, { recursive: true, force: true });
  }

  console.log(`Updated claude-team in ${targetDir}`);
}

// --- Main ---
const command = process.argv[2];
const targetDir = resolve(process.argv[3] || ".");

switch (command) {
  case "init":
    if (existsSync(join(targetDir, ".claude", "agents", "team"))) {
      console.error("Already initialized. Use 'claude-team update' to overwrite.");
      process.exit(1);
    }
    init(targetDir);
    break;
  case "update":
    update(targetDir);
    break;
  default:
    console.log("claude-team — scaffold Claude Code team agents into any repo");
    console.log();
    console.log("Commands:");
    console.log("  init     Copy agents, commands, hooks, and create specs/");
    console.log("  update   Overwrite existing setup with latest templates");
    console.log();
    console.log("Usage:");
    console.log("  claude-team init           # current directory");
    console.log("  claude-team init ./my-app  # specific directory");
    console.log("  claude-team update");
    break;
}
