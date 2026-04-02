#!/usr/bin/env node
/**
 * migrate-imports.js
 *
 * Codemod: rewrites direct `supabase` imports that bypass the service layer.
 *
 * Before:
 *   import { supabase } from "@/integrations/supabase/client";
 *   const { data } = await supabase.from("pacientes").select();
 *
 * After (example):
 *   import { patientService } from "@/modules/patients/services/patientService";
 *   const data = await patientService.listPatients(clinicId);
 *
 * Usage:
 *   node scripts/codemods/migrate-imports.js [--dry-run] [path]
 *
 * Options:
 *   --dry-run   Print changes without writing to disk.
 *   path        Directory to process (default: src/pages).
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const TARGET_DIR = process.argv.find((a) => !a.startsWith("-") && a !== process.argv[0] && a !== process.argv[1]) ?? "src/pages";

const DIRECT_IMPORT_PATTERN = /import\s*\{\s*supabase\s*\}\s*from\s*["']@\/integrations\/supabase\/client["']/g;

const SERVICE_COMMENT = `// TODO: Replace direct supabase call with the appropriate service/hook.
// See docs/MIGRATION_GUIDES.md for the migration path.`;

let filesChanged = 0;

function processFile(filePath) {
  const ext = extname(filePath);
  if (![".ts", ".tsx"].includes(ext)) return;

  const content = readFileSync(filePath, "utf-8");
  if (!DIRECT_IMPORT_PATTERN.test(content)) return;

  // Reset lastIndex after test()
  DIRECT_IMPORT_PATTERN.lastIndex = 0;

  const updated = content.replace(DIRECT_IMPORT_PATTERN, (match) => {
    return `${SERVICE_COMMENT}\n${match}`;
  });

  if (updated !== content) {
    filesChanged++;
    console.log(`[migrate-imports] ${DRY_RUN ? "(dry-run) " : ""}${filePath}`);
    if (!DRY_RUN) {
      writeFileSync(filePath, updated, "utf-8");
    }
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
console.log(`\n✅  migrate-imports complete – ${filesChanged} file(s) ${DRY_RUN ? "would be " : ""}updated.`);
