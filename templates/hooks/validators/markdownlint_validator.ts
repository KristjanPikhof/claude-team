/**
 * Markdown Lint Validator - Claude Code PostToolUse Hook
 *
 * Validates markdown files after Write/Edit operations.
 * Built-in checks: heading hierarchy, consecutive blank lines, trailing newline, empty files.
 * Optionally tries external markdownlint if available.
 *
 * Outputs JSON for Claude Code PostToolUse hook:
 * - {"decision": "block", "reason": "..."} to block and retry
 * - {} to allow
 *
 * Skips non-markdown files gracefully.
 */

import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

const MD_EXTENSIONS = new Set([".md", ".mdx", ".markdown"]);

function checkMarkdown(filePath: string): string[] {
  const issues: string[] = [];

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (e) {
    return [`Cannot read file: ${e}`];
  }

  const lines = content.split("\n");

  // Check 1: File should not be empty
  if (!content.trim()) {
    return ["File is empty"];
  }

  // Check 2: Heading hierarchy (no skipping levels)
  let prevLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimStart();
    if (line.startsWith("#") && !line.startsWith("#!")) {
      let level = 0;
      for (const ch of line) {
        if (ch === "#") level++;
        else break;
      }
      if (level <= 6 && line.length > level && line[level] === " ") {
        if (prevLevel > 0 && level > prevLevel + 1) {
          issues.push(
            `Line ${i + 1}: Heading level skipped (h${prevLevel} -> h${level})`
          );
        }
        prevLevel = level;
      }
    }
  }

  // Check 3: No multiple consecutive blank lines
  let blankCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      blankCount++;
      if (blankCount > 2) {
        issues.push(`Line ${i + 1}: Multiple consecutive blank lines`);
        break;
      }
    } else {
      blankCount = 0;
    }
  }

  // Check 4: File should end with a newline
  if (content && !content.endsWith("\n")) {
    issues.push("File does not end with a newline");
  }

  return issues;
}

async function main() {
  const input = await Bun.stdin.text();
  const hookInput = input.trim() ? JSON.parse(input) : {};
  const filePath: string = hookInput?.tool_input?.file_path ?? "";

  if (!filePath || !MD_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    console.log(JSON.stringify({}));
    return;
  }

  if (!existsSync(filePath)) {
    console.log(JSON.stringify({}));
    return;
  }

  const issues = checkMarkdown(filePath);

  if (issues.length > 0) {
    const issuesText = issues.map((i) => `- ${i}`).join("\n");
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `Markdown issues found in ${filePath}:\n${issuesText}`,
      })
    );
    return;
  }

  console.log(JSON.stringify({}));
}

main();
