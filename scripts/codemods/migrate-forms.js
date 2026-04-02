#!/usr/bin/env node
/**
 * migrate-forms.js
 *
 * Codemod: identifies pages that implement their own patient data-collection
 * form instead of using the unified PatientFormBuilder.
 *
 * Usage:
 *   node scripts/codemods/migrate-forms.js [--dry-run] [path]
 *
 * Candidates are files that:
 *   - Define <form> or <Form> with patient-related field names (nome, cpf, telefone).
 *   - Do NOT already import PatientFormBuilder.
 *
 * The script prints a migration checklist and, when not dry-run,
 * prepends a deprecation comment to each candidate file.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const TARGET_DIR =
  process.argv.find((a) => !a.startsWith("-") && a !== process.argv[0] && a !== process.argv[1]) ??
  "src/pages";

const PATIENT_FIELD_PATTERN = /\b(nome|cpf|telefone|dataNascimento|responsavel)\b/;
const FORM_PATTERN = /<form|<Form/;
const ALREADY_MIGRATED = /PatientFormBuilder/;

const DEPRECATION_COMMENT = `/**
 * @deprecated Patient form
 * This page duplicates patient data-collection logic.
 * Migrate to PatientFormBuilder (src/pages/patients/PatientFormBuilder.tsx).
 * See: docs/MIGRATION_GUIDES.md#form-migration
 */
`;

let candidates = 0;

function processFile(filePath) {
  const ext = extname(filePath);
  if (![".tsx"].includes(ext)) return;

  const content = readFileSync(filePath, "utf-8");

  if (ALREADY_MIGRATED.test(content)) return;
  if (!FORM_PATTERN.test(content)) return;
  if (!PATIENT_FIELD_PATTERN.test(content)) return;

  candidates++;
  console.log(`[migrate-forms] candidate: ${filePath}`);

  if (!DRY_RUN && !content.startsWith("/**\n * @deprecated Patient form")) {
    writeFileSync(filePath, DEPRECATION_COMMENT + content, "utf-8");
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

console.log(`\n✅  migrate-forms complete – ${candidates} candidate(s) ${DRY_RUN ? "found (dry-run)" : "annotated"}.`);
console.log("\nMigration checklist:");
console.log("  1. Import PatientFormBuilder from @/pages/patients/PatientFormBuilder");
console.log("  2. Replace inline form fields with <PatientFormBuilder mode=\"staff\" ... />");
console.log("  3. Pass onSubmit handler and initialData");
console.log("  4. Remove duplicated validation and masking logic");
console.log("  5. See docs/MIGRATION_GUIDES.md#form-migration for full instructions");
