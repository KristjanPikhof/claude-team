/**
 * Ruff Lint Validator - Claude Code PostToolUse Hook
 *
 * Validates Python files after Write/Edit operations using ruff.
 * Outputs JSON for Claude Code PostToolUse hook:
 * - {"decision": "block", "reason": "..."} to block and retry
 * - {} to allow
 *
 * Skips non-Python files gracefully.
 */

import { existsSync } from "node:fs";
import { extname } from "node:path";

const PY_EXTENSIONS = new Set([".py", ".pyi"]);

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

  if (!filePath || !PY_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    console.log(JSON.stringify({}));
    return;
  }

  if (!existsSync(filePath)) {
    console.log(JSON.stringify({}));
    return;
  }

  const result = await runCommand(["uvx", "ruff", "check", filePath]);

  if (result.exitCode === -1) {
    // ruff not available, pass through
    console.log(JSON.stringify({}));
    return;
  }

  if (result.exitCode !== 0) {
    const output = (result.stdout || result.stderr).slice(0, 500);
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `Ruff lint errors in ${filePath}:\n${output}`,
      })
    );
    return;
  }

  console.log(JSON.stringify({}));
}

main();
