#!/bin/bash
# Install claude-team into the current directory
# Usage: curl -fsSL https://raw.githubusercontent.com/KristjanPikhof/claude-team/main/install.sh | bash

set -e

REPO="https://github.com/KristjanPikhof/claude-team.git"
TMPDIR=$(mktemp -d)

echo "Downloading claude-team..."
git clone --depth 1 --quiet "$REPO" "$TMPDIR"

# Copy templates into .claude/
mkdir -p .claude/agents/team .claude/commands .claude/hooks/validators specs

cp "$TMPDIR"/templates/agents/team/*.md .claude/agents/team/
cp "$TMPDIR"/templates/commands/*.md .claude/commands/
cp "$TMPDIR"/templates/hooks/validators/*.ts .claude/hooks/validators/

# Cleanup
rm -rf "$TMPDIR"

echo ""
echo "Installed claude-team into .claude/"
echo ""
echo "Created:"
echo "  .claude/agents/team/   — 5 team agents"
echo "  .claude/commands/      — /plan and /build commands"
echo "  .claude/hooks/         — 7 TypeScript validators"
echo "  specs/                 — output directory for plans"
echo ""
echo "Usage in Claude Code:"
echo '  /plan "build a login page"'
echo "  /build specs/<plan>.md"
