/**
 * ESLint/Biome Validator - Claude Code PostToolUse Hook
 *
 * Validates JS/TS files after Write/Edit operations.
 * Tries biome first (via bunx), then eslint (via npx).
 * Outputs JSON for Claude Code PostToolUse hook:
 * - {"decision": "block", "reason": "..."} to block and retry
 * - {} to allow
 *
 * Skips non-JS/TS files gracefully.
 */

import { existsSync } from "node:fs";
import { extname } from "node:path";

const JS_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".mts"]);

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

  if (!filePath || !JS_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    console.log(JSON.stringify({}));
    return;
  }

  if (!existsSync(filePath)) {
    console.log(JSON.stringify({}));
    return;
  }

  // Try biome first (fast, Bun-native)
  const biome = await runCommand([
    "bunx",
    "biome",
    "check",
    "--no-errors-on-unmatched",
    filePath,
  ]);

  if (biome.exitCode !== -1) {
    if (biome.exitCode !== 0) {
      const output = (biome.stdout || biome.stderr).slice(0, 500);
      console.log(
        JSON.stringify({
          decision: "block",
          reason: `Biome lint errors in ${filePath}:\n${output}`,
        })
      );
      return;
    }
    console.log(JSON.stringify({}));
    return;
  }

  // Fall back to eslint
  const eslint = await runCommand(["npx", "eslint", filePath]);

  if (eslint.exitCode === -1) {
    // No linter available, pass through
    console.log(JSON.stringify({}));
    return;
  }

  if (eslint.exitCode !== 0) {
    const output = (eslint.stdout || eslint.stderr).slice(0, 500);
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `ESLint errors in ${filePath}:\n${output}`,
      })
    );
    return;
  }

  console.log(JSON.stringify({}));
}

main();
