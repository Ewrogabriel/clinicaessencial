#!/usr/bin/env env bash
# scripts/migrate.sh
#
# Runner for all Phase-4 codemods.
# Usage:
#   ./scripts/migrate.sh [--dry-run]
#
# Flags:
#   --dry-run   Show what would change without touching the filesystem.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN_FLAG=""

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN_FLAG="--dry-run"
  echo "🔍  Running in DRY-RUN mode – no files will be modified."
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Phase 4 Migration Runner"
echo "═══════════════════════════════════════════════════════════"

echo ""
echo "▶  [1/3] migrate-imports: annotating direct Supabase imports..."
node "${SCRIPT_DIR}/codemods/migrate-imports.js" $DRY_RUN_FLAG src/pages

echo ""
echo "▶  [2/3] migrate-dashboard: identifying custom layout pages..."
node "${SCRIPT_DIR}/codemods/migrate-dashboard.js" $DRY_RUN_FLAG src/pages

echo ""
echo "▶  [3/3] migrate-forms: identifying duplicated patient forms..."
node "${SCRIPT_DIR}/codemods/migrate-forms.js" $DRY_RUN_FLAG src/pages

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  All codemods complete."
if [[ -n "$DRY_RUN_FLAG" ]]; then
  echo "  Re-run without --dry-run to apply changes."
fi
echo "═══════════════════════════════════════════════════════════"
