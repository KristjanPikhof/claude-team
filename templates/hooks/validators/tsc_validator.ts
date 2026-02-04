/**
 * TypeScript Type Check Validator - Claude Code PostToolUse Hook
 *
 * Validates TypeScript files after Write/Edit operations using tsc.
 * Outputs JSON for Claude Code PostToolUse hook:
 * - {"decision": "block", "reason": "..."} to block and retry
 * - {} to allow
 *
 * Skips non-TypeScript files gracefully.
 */

import { existsSync } from "node:fs";
import { extname } from "node:path";

const TS_EXTENSIONS = new Set([".ts", ".tsx", ".mts"]);

async function runCommand(
  cmd: string[],
  timeoutMs = 30000
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
    const timer = setTimeout(() => proc.kill(), timeoutMs);
    const exitCode = await proc.exited;
    clearTimeout(timer);
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch {
    return { exitCode: -1, stdout: "", stderr: "Command not found" };
  }
}

async function main() {
  const input = await Bun.stdin.text();
  const hookInput = input.trim() ? JSON.parse(input) : {};
  const filePath: string = hookInput?.tool_input?.file_path ?? "";

  if (!filePath || !TS_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    console.log(JSON.stringify({}));
    return;
  }

  if (!existsSync(filePath)) {
    console.log(JSON.stringify({}));
    return;
  }

  // Try tsc --noEmit (checks the whole project, not just one file, but catches type errors)
  const tsc = await runCommand(["npx", "tsc", "--noEmit"]);

  if (tsc.exitCode === -1) {
    // tsc not available, pass through
    console.log(JSON.stringify({}));
    return;
  }

  if (tsc.exitCode !== 0) {
    // Filter output to lines mentioning this file
    const lines = (tsc.stdout || tsc.stderr).split("\n");
    const relevant = lines
      .filter((l) => l.includes(filePath) || l.includes("error TS"))
      .slice(0, 10)
      .join("\n");
    const output = relevant || (tsc.stdout || tsc.stderr).slice(0, 500);
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `TypeScript errors affecting ${filePath}:\n${output}`,
      })
    );
    return;
  }

  console.log(JSON.stringify({}));
}

main();
