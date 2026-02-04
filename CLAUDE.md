# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

claude-team is a scaffolding CLI that installs multi-agent orchestration (agents, commands, hook validators) into any repository. It provides a `/plan` → `/build` workflow where an Opus agent creates a spec, then an orchestrator deploys specialized team agents (builder, validator, browser-tester, documenter, code-reviewer) to execute it.

## Commands

```bash
# Local development — link CLI globally
bun link

# Run CLI from any project
claude-team init          # copy templates into .claude/ + create specs/
claude-team update        # overwrite existing setup with latest templates

# One-liner install (no clone needed)
curl -fsSL https://raw.githubusercontent.com/KristjanPikhof/claude-team/main/install.sh | bash

# Run a single validator manually
bun run templates/hooks/validators/ruff_validator.ts
```

No test suite exists. No build step — Bun runs TypeScript directly.

## Architecture

```
src/cli.ts              — CLI entry point (init/update). Copies templates/ into target .claude/
install.sh              — Standalone installer that clones repo, copies templates, cleans up
templates/              — Everything that gets scaffolded into a project:
  agents/team/*.md      — 5 agent definitions with YAML frontmatter (model, hooks, color)
  commands/plan.md      — /plan command: creates specs in specs/ (Stop hooks enforce 7 sections)
  commands/build.md     — /build command: reads a spec and orchestrates team agents
  hooks/validators/*.ts — 8 TypeScript validators run via `bun run`
```

### Validator Pattern

All validators read JSON from stdin (`hookInput.tool_input.file_path`), check the file extension, skip irrelevant files, and output:
- PostToolUse: `{"decision": "block", "reason": "..."}` or `{}` (allow)
- Stop: `{"result": "block", "reason": "..."}` or `{"result": "continue"}`

Validators gracefully pass-through when their external tools (ruff, tsc, biome, etc.) are unavailable.

### Agent Frontmatter

Agents use YAML frontmatter to wire hooks, set model, and configure permissions:
```yaml
---
name: builder
model: opus
color: cyan
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: bun run $CLAUDE_PROJECT_DIR/.claude/hooks/validators/ruff_validator.ts
disallowedTools: Write, Edit  # (used by read-only agents: validator, browser-tester, code-reviewer)
---
```

### Key Design Decisions

- **"2x compute for trust"**: Every task gets a Builder + Validator pair. Validators are read-only (disallowedTools prevents file modification).
- **Graceful degradation**: Validators pass-through if external tools are missing — no hard dependencies beyond Bun.
- **`$CLAUDE_PROJECT_DIR`**: All hook commands use this variable so validators work regardless of where Claude Code runs.
- **Plan enforcement**: The /plan command has Stop hooks that block the agent until the spec contains all 7 required sections and a new file exists in specs/.
