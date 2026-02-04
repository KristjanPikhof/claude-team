/**
 * Validate New File - Claude Code Stop Hook
 *
 * Checks that a new file was created in the specified directory.
 * Uses git status + file modification time to verify.
 *
 * Outputs JSON for Claude Code Stop hook:
 * - {"result": "block", "reason": "..."} to prevent stopping
 * - {"result": "continue", "message": "..."} to allow
 *
 * Usage: bun run validate_new_file.ts --directory specs --extension .md
 */

import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

function parseArgs(): {
  directory: string;
  extension: string;
  maxAgeMinutes: number;
} {
  const args = process.argv.slice(2);
  let directory = "specs";
  let extension = ".md";
  let maxAgeMinutes = 5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--directory" && args[i + 1]) {
      directory = args[++i];
    } else if (args[i] === "--extension" && args[i + 1]) {
      extension = args[++i];
    } else if (args[i] === "--max-age" && args[i + 1]) {
      maxAgeMinutes = parseInt(args[++i], 10);
    }
  }

  return { directory, extension, maxAgeMinutes };
}

async function checkGitForNewFiles(
  directory: string,
  extension: string
): Promise<string[]> {
  try {
    const proc = Bun.spawn(["git", "status", "--porcelain", directory], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) return [];

    const stdout = await new Response(proc.stdout).text();
    const newFiles: string[] = [];

    for (const line of stdout.trim().split("\n")) {
      if (!line.trim()) continue;
      const status = line.substring(0, 2);
      const filePath = line.substring(3).trim();

      // Untracked (??) or Added (A) or Modified (M)
      if (
        (status.includes("?") || status.includes("A") || status.includes("M")) &&
        filePath.endsWith(extension)
      ) {
        newFiles.push(filePath);
      }
    }

    return newFiles;
  } catch {
    return [];
  }
}

function findRecentFiles(
  directory: string,
  extension: string,
  maxAgeMinutes: number
): string[] {
  try {
    const files = readdirSync(directory);
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000;
    const recent: string[] = [];

    for (const file of files) {
      if (!file.endsWith(extension)) continue;
      const filePath = join(directory, file);
      const stat = statSync(filePath);
      if (now - stat.mtimeMs < maxAge) {
        recent.push(filePath);
      }
    }

    return recent;
  } catch {
    return [];
  }
}

async function main() {
  const { directory, extension, maxAgeMinutes } = parseArgs();

  // Try git first
  const gitFiles = await checkGitForNewFiles(directory, extension);
  if (gitFiles.length > 0) {
    console.log(
      JSON.stringify({
        result: "continue",
        message: `New file(s) found: ${gitFiles.join(", ")}`,
      })
    );
    return;
  }

  // Fall back to mtime check
  const recentFiles = findRecentFiles(directory, extension, maxAgeMinutes);
  if (recentFiles.length > 0) {
    console.log(
      JSON.stringify({
        result: "continue",
        message: `Recent file(s) found: ${recentFiles.join(", ")}`,
      })
    );
    return;
  }

  console.log(
    JSON.stringify({
      result: "block",
      reason: `BLOCKED: No new ${extension} file found in ${directory}/. You must create a file in ${directory}/ before completing.`,
    })
  );
}

main();
