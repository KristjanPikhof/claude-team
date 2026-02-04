/**
 * Validate File Contains - Claude Code Stop Hook
 *
 * Checks that the newest file in a directory contains required content strings.
 * Used to enforce plan structure (required sections).
 *
 * Outputs JSON for Claude Code Stop hook:
 * - {"result": "block", "reason": "..."} to prevent stopping
 * - {"result": "continue", "message": "..."} to allow
 *
 * Usage: bun run validate_file_contains.ts --directory specs --extension .md \
 *        --contains '## Task Description' --contains '## Objective'
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

function parseArgs(): {
  directory: string;
  extension: string;
  maxAgeMinutes: number;
  contains: string[];
} {
  const args = process.argv.slice(2);
  let directory = "specs";
  let extension = ".md";
  let maxAgeMinutes = 5;
  const contains: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--directory" && args[i + 1]) {
      directory = args[++i];
    } else if (args[i] === "--extension" && args[i + 1]) {
      extension = args[++i];
    } else if (args[i] === "--max-age" && args[i + 1]) {
      maxAgeMinutes = parseInt(args[++i], 10);
    } else if (args[i] === "--contains" && args[i + 1]) {
      contains.push(args[++i]);
    }
  }

  return { directory, extension, maxAgeMinutes, contains };
}

function findNewestFile(
  directory: string,
  extension: string,
  maxAgeMinutes: number
): string | null {
  try {
    const files = readdirSync(directory);
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000;
    let newest: { path: string; mtime: number } | null = null;

    for (const file of files) {
      if (!file.endsWith(extension)) continue;
      const filePath = join(directory, file);
      const stat = statSync(filePath);

      if (now - stat.mtimeMs > maxAge) continue;

      if (!newest || stat.mtimeMs > newest.mtime) {
        newest = { path: filePath, mtime: stat.mtimeMs };
      }
    }

    return newest?.path ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const { directory, extension, maxAgeMinutes, contains } = parseArgs();

  if (contains.length === 0) {
    console.log(
      JSON.stringify({
        result: "continue",
        message: "No --contains checks specified, passing.",
      })
    );
    return;
  }

  const newestFile = findNewestFile(directory, extension, maxAgeMinutes);

  if (!newestFile) {
    console.log(
      JSON.stringify({
        result: "block",
        reason: `BLOCKED: No recent ${extension} file found in ${directory}/. Create the file first.`,
      })
    );
    return;
  }

  let content: string;
  try {
    content = readFileSync(newestFile, "utf-8");
  } catch (e) {
    console.log(
      JSON.stringify({
        result: "block",
        reason: `BLOCKED: Cannot read ${newestFile}: ${e}`,
      })
    );
    return;
  }

  const missing: string[] = [];
  for (const required of contains) {
    if (!content.includes(required)) {
      missing.push(required);
    }
  }

  if (missing.length > 0) {
    const missingList = missing.map((m) => `  - "${m}"`).join("\n");
    console.log(
      JSON.stringify({
        result: "block",
        reason: `BLOCKED: ${newestFile} is missing required sections:\n${missingList}\n\nAdd these sections to the file before completing.`,
      })
    );
    return;
  }

  console.log(
    JSON.stringify({
      result: "continue",
      message: `All ${contains.length} required sections found in ${newestFile}.`,
    })
  );
}

main();
