/**
 * Ensure Gitignore - Claude Code PostToolUse Hook
 *
 * After a Write tool creates a file, checks if the file's directory
 * is listed in .gitignore. If not, appends it automatically.
 *
 * Outputs JSON for Claude Code PostToolUse hook:
 * - {} to allow (no action needed or gitignore updated)
 * - {"decision": "block", "reason": "..."} on critical failure
 *
 * Usage: bun run ensure_gitignore.ts --directory specs
 *        bun run ensure_gitignore.ts --directory specs --directory output
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

function parseArgs(): { directories: string[] } {
  const args = process.argv.slice(2);
  const directories: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--directory" && args[i + 1]) {
      directories.push(args[++i]);
    }
  }

  if (directories.length === 0) {
    directories.push("specs");
  }

  return { directories };
}

function ensureGitignore(directories: string[]): void {
  const gitignorePath = join(process.cwd(), ".gitignore");

  let existingContent = "";
  if (existsSync(gitignorePath)) {
    existingContent = readFileSync(gitignorePath, "utf-8");
  }

  const existingLines = new Set(
    existingContent.split("\n").map((line) => line.trim())
  );

  const toAdd: string[] = [];
  for (const dir of directories) {
    const entry = `${dir}/`;
    // Check both with and without trailing slash
    if (!existingLines.has(entry) && !existingLines.has(dir)) {
      toAdd.push(entry);
    }
  }

  if (toAdd.length === 0) {
    // Already covered
    console.log(JSON.stringify({}));
    return;
  }

  // Build the block to append
  const needsNewline = existingContent.length > 0 && !existingContent.endsWith("\n");
  let block = "";
  if (needsNewline) block += "\n";

  // Add a header comment if the file is new or doesn't have our section
  if (!existingContent.includes("# Generated output")) {
    block += "\n# Generated output\n";
  }

  for (const entry of toAdd) {
    block += `${entry}\n`;
  }

  if (existsSync(gitignorePath)) {
    appendFileSync(gitignorePath, block, "utf-8");
  } else {
    writeFileSync(gitignorePath, block, "utf-8");
  }

  console.log(JSON.stringify({}));
}

function main() {
  try {
    // Read stdin (PostToolUse hook input) but we don't need it
    // Just consume it so the process doesn't hang
    const { directories } = parseArgs();
    ensureGitignore(directories);
  } catch (err) {
    // On error, allow through - don't block the agent
    console.log(JSON.stringify({}));
  }
}

main();
