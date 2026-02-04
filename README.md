# claude-team

Scaffold Claude Code team agents, commands, and TypeScript hook validators into any repo with one command.

Based on the [claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery) workflow — plan with `/plan`, execute with `/build`, validate everything automatically.

## Quick Start

```bash
cd your-project
bunx degit KristjanPikhof/claude-team/templates .claude && mkdir -p specs
```

Done. Now in Claude Code:

```
/plan "build a login page with OAuth"
/build specs/login-page-oauth.md
```

## Update Existing Setup

```bash
bunx degit KristjanPikhof/claude-team/templates .claude --force
```

## What Gets Installed

```
.claude/
  agents/team/
    builder.md            # Code implementation (cyan)
    validator.md          # Read-only verification (yellow)
    browser-tester.md     # Browser QA testing (orange)
    documenter.md         # Documentation specialist (magenta)
    code-reviewer.md      # Code review analysis (red)
  commands/
    plan.md               # /plan — creates implementation specs
    build.md              # /build — executes plans with team agents
  hooks/validators/
    ruff_validator.ts     # Python linting (.py)
    ty_validator.ts       # Python type checking (.py)
    eslint_validator.ts   # JS/TS linting (.js/.ts/.tsx)
    tsc_validator.ts      # TypeScript type checking (.ts/.tsx)
    markdownlint_validator.ts  # Markdown validation (.md)
    validate_new_file.ts  # Stop hook: ensures plan file was created
    validate_file_contains.ts  # Stop hook: ensures required sections
specs/                    # Output directory for generated plans
```

## How It Works

### Phase 1: Planning

```
/plan "what to build" "optional orchestration guidance"
```

The planning agent (Opus) analyzes your codebase and creates a spec file in `specs/`. Two Stop hooks enforce quality — the agent cannot finish until the plan has all 7 required sections:

- Task Description
- Objective
- Relevant Files
- Step by Step Tasks
- Acceptance Criteria
- Team Orchestration
- Team Members

### Phase 2: Execution

```
/build specs/your-plan.md
```

The orchestrator reads the plan and deploys team agents:

1. Creates a TaskList with TaskCreate for each step
2. Sets dependencies with TaskUpdate + addBlockedBy
3. Launches Builder agents in parallel with `run_in_background: true`
4. Deploys Validators to check each builder's work
5. Monitors progress with TaskList and reports when done

### Key Concept: "2x the compute for trust"

Every task gets a **Builder** (does the work) AND a **Validator** (checks the work). This doubles compute but dramatically increases confidence.

## Team Agents

| Agent | Role | Hooks | Read-Only |
|---|---|---|---|
| **builder** | Writes code, creates files, implements features | ruff + ty + eslint + tsc (PostToolUse) | No |
| **validator** | Inspects and verifies builder output | None | Yes |
| **browser-tester** | Tests web apps via agent-browser CLI or Chrome MCP | None | Yes |
| **documenter** | Writes and updates documentation | markdownlint (PostToolUse) | No |
| **code-reviewer** | Comprehensive code review with severity levels | None | Yes |

Read-only agents have `disallowedTools: Write, Edit, NotebookEdit` — they cannot modify files.

## Validators

All validators are TypeScript scripts run with `bun run`. Each one auto-skips files it doesn't care about, so they can all be stacked on the builder without conflict.

### PostToolUse Hooks (trigger on Write/Edit)

| Validator | File Types | Tool | Fallback |
|---|---|---|---|
| `ruff_validator.ts` | `.py` | `uvx ruff check` | Pass-through if ruff unavailable |
| `ty_validator.ts` | `.py` | `uvx ty check` | Pass-through if ty unavailable |
| `eslint_validator.ts` | `.js/.ts/.tsx` | `bunx biome check` → `npx eslint` | Pass-through if neither available |
| `tsc_validator.ts` | `.ts/.tsx` | `npx tsc --noEmit` | Pass-through if tsc unavailable |
| `markdownlint_validator.ts` | `.md/.mdx` | Built-in checks | Always works (no external deps) |

### Stop Hooks (trigger when agent tries to finish)

| Validator | Purpose |
|---|---|
| `validate_new_file.ts` | Ensures a new file was created in `specs/` |
| `validate_file_contains.ts` | Ensures the plan has all required sections |

Hook output format:

- PostToolUse: `{"decision": "block", "reason": "..."}` or `{}` (allow)
- Stop: `{"result": "block", "reason": "..."}` or `{"result": "continue", "message": "..."}`

## Skills Integration

Plans can reference skills from `~/.claude/skills/` that team members activate via the `Skill` tool during execution. Each team member and task can specify skills:

```md
- Builder
  - Name: ui-builder
  - Role: Build the dashboard frontend
  - Agent Type: builder
  - Skills: frontend-design, brainstorming
```

## Requirements

- **Bun** — runs the TypeScript validators and CLI

Optional (validators gracefully skip if unavailable):

- `uvx` + `ruff` + `ty` — for Python linting/type checking
- `biome` or `eslint` — for JS/TS linting
- `tsc` — for TypeScript type checking

## Customization

### Add a new agent

Create `.claude/agents/team/your-agent.md`:

```yaml
---
name: your-agent
description: What this agent does
model: opus
color: green
---

# Your Agent

Instructions for the agent...
```

The planner auto-discovers agents via `.claude/agents/team/*.md`.

### Add a new validator

Create `.claude/hooks/validators/your_validator.ts` following the pattern:

```typescript
import { existsSync } from "node:fs";
import { extname } from "node:path";

const EXTENSIONS = new Set([".your-ext"]);

async function main() {
  const input = await Bun.stdin.text();
  const hookInput = input.trim() ? JSON.parse(input) : {};
  const filePath: string = hookInput?.tool_input?.file_path ?? "";

  // Skip irrelevant files
  if (!filePath || !EXTENSIONS.has(extname(filePath).toLowerCase())) {
    console.log(JSON.stringify({}));
    return;
  }

  // Run your check...
  // Output: {"decision": "block", "reason": "..."} or {}
  console.log(JSON.stringify({}));
}

main();
```

Then add it to the agent's frontmatter hooks:

```yaml
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: >-
            bun run $CLAUDE_PROJECT_DIR/.claude/hooks/validators/your_validator.ts
```

## Alternative: CLI Install

If you clone this repo locally, you can also use the CLI:

```bash
cd claude-team
bun link

# Then from any project:
claude-team init
claude-team update  # overwrite with latest
```

## Credits

Architecture based on [disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery) and the [video walkthrough](https://www.youtube.com/watch?v=4_2j5wgt_ds).
