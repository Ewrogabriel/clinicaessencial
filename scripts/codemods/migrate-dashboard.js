#!/usr/bin/env node
/**
 * migrate-dashboard.js
 *
 * Codemod: identifies pages that build their own dashboard layout instead of
 * extending the shared DashboardBase / AppLayout components.
 *
 * Usage:
 *   node scripts/codemods/migrate-dashboard.js [--dry-run] [path]
 *
 * The script outputs a report of candidate files and, when not in dry-run mode,
 * prepends a deprecation comment to each one to guide the developer.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const TARGET_DIR =
  process.argv.find((a) => !a.startsWith("-") && a !== process.argv[0] && a !== process.argv[1]) ??
  "src/pages";

// Patterns that suggest a page is rolling its own layout instead of using AppLayout
const LAYOUT_PATTERNS = [
  /className=["'][^"']*flex[^"']*min-h-screen/,
  /className=["'][^"']*h-screen[^"']*flex/,
  /import.*AppLayout.*from/,            // already using it – skip
];

const MIGRATION_COMMENT = `/**
 * @deprecated Dashboard layout
 * This page builds its own shell. Migrate to DashboardBase or AppLayout.
 * See: docs/MIGRATION_GUIDES.md#dashboard-migration
 */
`;

let filesReported = 0;

function processFile(filePath) {
  const ext = extname(filePath);
  if (![".tsx"].includes(ext)) return;

  const content = readFileSync(filePath, "utf-8");

  // Skip if already using AppLayout
  if (/import.*AppLayout/.test(content)) return;

  const needsMigration = LAYOUT_PATTERNS.slice(0, 2).some((p) => p.test(content));
  if (!needsMigration) return;

  filesReported++;
  console.log(`[migrate-dashboard] candidate: ${filePath}`);

  if (!DRY_RUN && !content.startsWith("/**\n * @deprecated Dashboard")) {
    writeFileSync(filePath, MIGRATION_COMMENT + content, "utf-8");
  }
}

function walkDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    console.error(`Cannot read directory: ${dir}`);
    process.exit(1);
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory() && !["node_modules", ".git", "dist"].includes(entry)) {
      walkDir(full);
    } else if (stat.isFile()) {
      processFile(full);
    }
  }
}

walkDir(TARGET_DIR);
console.log(
  `\n✅  migrate-dashboard complete – ${filesReported} candidate(s) ${DRY_RUN ? "found (dry-run)" : "annotated"}.`,
);
